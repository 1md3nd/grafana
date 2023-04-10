import {
  ArrayVector,
  DataFrame,
  DataQueryRequest,
  DateTime,
  dateTime,
  durationToMilliseconds,
  Field,
  isValidDuration,
  parseDuration,
} from '@grafana/data/src';
import { amendTable, Table, trimTable } from 'app/features/live/data/amendTimeSeries';

import { InfluxQuery } from '../../influxdb/types';
import { PromQuery } from '../types';

// dashboardUID + panelId + refId
// (must be stable across query changes, time range changes / interval changes / panel resizes / template variable changes)
type TargetIdent = string;

// query + template variables + interval + raw time range
// used for full target cache busting -> full range re-query
type TargetSig = string;

type TimestampMs = number;

type SupportedQueryTypes = PromQuery | InfluxQuery;

// string matching requirements defined in durationutil.ts
export const defaultPrometheusQueryOverlapWindow = '10m';

interface TargetCache {
  sig: TargetSig;
  prevTo: TimestampMs;
  prevFrom: TimestampMs;
  frames: DataFrame[];
}

export interface CacheRequestInfo<T extends SupportedQueryTypes> {
  requests: Array<DataQueryRequest<T>>;
  targSigs: Map<TargetIdent, TargetSig>;
  shouldCache: boolean;
}

/**
 * Get field identity
 * This is the string used to uniquely identify a field within a "target"
 * @param field
 */
export const getFieldIdent = (field: Field) => `${field.type}|${field.name}|${JSON.stringify(field.labels ?? '')}`;

/**
 * NOMENCLATURE
 * Target: The request target (DataQueryRequest), i.e. a specific query reference within a panel
 * Ident: Identity: the string that is not expected to change
 * Sig: Signature: the string that is expected to change, upon which we wipe the cache fields
 */
export class QueryCache<T extends SupportedQueryTypes> {
  private overlapWindowMs: number;
  private getTargetSignature: (request: DataQueryRequest<T>, target: T) => string;

  constructor(getTargetSignature: (request: DataQueryRequest<T>, target: T) => string, overlapString: string) {
    const unverifiedOverlap = overlapString;
    if (isValidDuration(unverifiedOverlap)) {
      const duration = parseDuration(unverifiedOverlap);
      this.overlapWindowMs = durationToMilliseconds(duration);
    } else {
      const duration = parseDuration(defaultPrometheusQueryOverlapWindow);
      this.overlapWindowMs = durationToMilliseconds(duration);
    }
    this.getTargetSignature = getTargetSignature;
  }

  cache = new Map<TargetIdent, TargetCache>();

  // can be used to change full range request to partial, split into multiple requests
  requestInfo(request: DataQueryRequest<T>): CacheRequestInfo<T> {
    // TODO: align from/to to interval to increase probability of hitting backend cache
    // console.error('');
    // console.warn('requestInfo');
    // console.log('requestInfo', JSON.parse(JSON.stringify(request)));

    const newFrom = request.range.from.valueOf();
    const newTo = request.range.to.valueOf();

    // only cache 'now'-relative queries (that can benefit from a backfill cache)
    const shouldCache = request.rangeRaw?.to?.toString() === 'now';

    // all targets are queried together, so we check for any that causes group cache invalidation & full re-query
    let doPartialQuery = shouldCache;
    let prevTo: TimestampMs | undefined = undefined;
    let prevFrom: TimestampMs | undefined = undefined;

    // pre-compute reqTargSigs
    const reqTargSigs = new Map<TargetIdent, TargetSig>();
    request.targets.forEach((targ) => {
      let targIdent = `${request.dashboardUID}|${request.panelId}|${targ.refId}`;
      let targSig = this.getTargetSignature(request, targ); // ${request.maxDataPoints} ?

      reqTargSigs.set(targIdent, targSig);
    });

    // figure out if new query range or new target props trigger full cache invalidation & re-query
    for (const [targIdent, targSig] of reqTargSigs) {
      let cached = this.cache.get(targIdent);
      let cachedSig = cached?.sig;

      if (cachedSig !== targSig) {
        doPartialQuery = false;
      } else {
        // only do partial queries when new request range follows prior request range (possibly with overlap)
        // e.g. now-6h with refresh <= 6h
        prevTo = cached?.prevTo ?? Infinity;
        prevFrom = cached?.prevFrom ?? Infinity;

        doPartialQuery = newTo > prevTo && newFrom <= prevTo;
      }

      if (!doPartialQuery) {
        break;
      }
    }

    if (doPartialQuery && prevTo && prevFrom) {
      // clamp to make sure we don't re-query previous 10m when newFrom is ahead of it (e.g. 5min range, 30s refresh)
      let newFromPartial = Math.max(prevTo - this.overlapWindowMs, prevFrom);

      // Round down to the original to.
      // What is the full duration
      //
      // console.log('');

      const newToDate = dateTime(newTo);
      const newFromPartialDate = dateTime(newFromPartial) as moment.Moment;

      // newToDate.set('seconds', newFromPartialDate.seconds());
      // newToDate.set('ms', newFromPartialDate.milliseconds());

      // console.log('prevFrom', prevFrom, dateTime(prevFrom).format('MM/DD/YYYY h:mm:ss.SSS A'))
      // console.log('prevTo', prevTo, dateTime(prevTo).format('MM/DD/YYYY h:mm:ss.SSS A'))
      //
      // console.log('thisFrom', newFrom, dateTime(newFrom).format('MM/DD/YYYY h:mm:ss.SSS A'))
      // console.log('thisTo', newTo, dateTime(newTo).format('MM/DD/YYYY h:mm:ss.SSS A'))
      //
      // console.log('thisFromPending', newFromPartialDate.valueOf(), newFromPartialDate.format('MM/DD/YYYY h:mm:ss.SSS A'))
      // console.log('thisToPending', newToDate.valueOf(), newToDate.format('MM/DD/YYYY h:mm:ss.SSS A'))

      // console.log('overlap', prevTo - newFromPartial);
      // console.log('How much time has elapsed since last query', prevTo - newTo);

      // console.log('duration of next query', newFromPartialDate.valueOf() - newToDate.valueOf())

      // modify to partial query
      request = {
        ...request,
        range: {
          ...request.range,
          from: newFromPartialDate as DateTime,
          to: newToDate as DateTime,
        },
      };
    } else {
      reqTargSigs.forEach((targSig, targIdent) => {
        this.cache.delete(targIdent);
      });
    }

    return {
      requests: [request],
      targSigs: reqTargSigs,
      shouldCache,
    };
  }

  // should amend existing cache with new frames and return full response
  procFrames(
    request: DataQueryRequest<T>,
    requestInfo: CacheRequestInfo<T> | undefined,
    respFrames: DataFrame[]
  ): DataFrame[] {
    // console.warn('procFrames');
    // console.log('procFrames request', JSON.parse(JSON.stringify(request)));
    // console.log('procFrames requestInfo', JSON.parse(JSON.stringify(requestInfo)));
    // console.log('procFrames respFrames', JSON.parse(JSON.stringify(respFrames)));
    // console.log('procFrames cache', JSON.parse(JSON.stringify(this)));

    if (requestInfo?.shouldCache) {
      const newFrom = request.range.from.valueOf();
      const newTo = request.range.to.valueOf();

      // group frames by targets
      const respByTarget = new Map<TargetIdent, DataFrame[]>();

      respFrames.forEach((frame: DataFrame) => {
        let targIdent = `${request.dashboardUID}|${request.panelId}|${frame.refId}`;

        let frames = respByTarget.get(targIdent);

        if (!frames) {
          frames = [];
          respByTarget.set(targIdent, frames);
        }

        frames.push(frame);
      });

      let outFrames: DataFrame[] = [];

      respByTarget.forEach((respFrames, targIdent) => {
        let cachedFrames = (targIdent ? this.cache.get(targIdent)?.frames : null) ?? [];

        respFrames.forEach((respFrame: DataFrame) => {
          // skip empty frames
          if (respFrame.length === 0 || respFrame.fields.length === 0) {
            return;
          }

          // frames are identified by their second (non-time) field's name + labels
          // TODO: maybe also frame.meta.type?
          let respFrameIdent = getFieldIdent(respFrame.fields[1]);

          let cachedFrame = cachedFrames.find((cached) => getFieldIdent(cached.fields[1]) === respFrameIdent);

          if (!cachedFrame) {
            // append new unknown frames
            cachedFrames.push(respFrame);
          } else {
            // we assume that fields cannot appear/disappear and will all exist in same order

            // amend & re-cache
            // eslint-disable-next-line @typescript-eslint/consistent-type-assertions
            let prevTable: Table = cachedFrame.fields.map((field) => field.values.toArray()) as Table;
            // eslint-disable-next-line @typescript-eslint/consistent-type-assertions
            let nextTable: Table = respFrame.fields.map((field) => field.values.toArray()) as Table;

            let amendedTable = amendTable(prevTable, nextTable);

            for (let i = 0; i < amendedTable.length; i++) {
              cachedFrame.fields[i].values = new ArrayVector(amendedTable[i]);
            }

            cachedFrame.length = cachedFrame.fields[0].values.length;
          }
        });

        // trim all frames to in-view range, evict those that end up with 0 length
        let nonEmptyCachedFrames: DataFrame[] = [];

        cachedFrames.forEach((frame) => {
          // eslint-disable-next-line @typescript-eslint/consistent-type-assertions
          let table: Table = frame.fields.map((field) => field.values.toArray()) as Table;

          let trimmed = trimTable(table, newFrom, newTo);

          if (trimmed[0].length > 0) {
            for (let i = 0; i < trimmed.length; i++) {
              frame.fields[i].values = new ArrayVector(trimmed[i]);
            }
            nonEmptyCachedFrames.push(frame);
          }
        });

        this.cache.set(targIdent, {
          sig: requestInfo.targSigs.get(targIdent)!,
          frames: nonEmptyCachedFrames,
          prevTo: newTo,
          prevFrom: newFrom,
        });

        outFrames.push(...nonEmptyCachedFrames);
      });

      // transformV2 mutates field values for heatmap de-accum, and modifies field order, so we gotta clone here, for now :(
      respFrames = outFrames.map((frame) => ({
        ...frame,
        fields: frame.fields.map((field) => ({
          ...field,
          config: {
            ...field.config, // prevents mutatative exemplars links (re)enrichment
          },
          values: new ArrayVector(field.values.toArray().slice()),
        })),
      }));

      respFrames.forEach((frame: DataFrame) => {
        let targIdent = `${request.dashboardUID}|${request.panelId}|${frame.refId}`;

        const valuesAfterSecond = this.cache
          .get(targIdent)
          ?.frames[0].fields[1].values.toArray()
          ?.map((value, idx) => {
            return { value: value, originalIndex: idx };
          })
          .filter((value) => value.value !== null);

        // console.log('NUMBER OF VALUES', valuesAfterSecond?.length);
      });
    }

    return respFrames;
  }
}
