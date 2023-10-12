import { css } from '@emotion/css';
import React from 'react';

import { DataFrame, Field, getFieldDisplayName, GrafanaTheme2, LinkModel } from '@grafana/data';
import { useStyles2 } from '@grafana/ui';
import { VizTooltipContent } from '@grafana/ui/src/components/VizTooltip/VizTooltipContent';
import { VizTooltipFooter } from '@grafana/ui/src/components/VizTooltip/VizTooltipFooter';
import { VizTooltipHeader } from '@grafana/ui/src/components/VizTooltip/VizTooltipHeader';
import { LabelValue } from '@grafana/ui/src/components/VizTooltip/types';
import { getTitleFromHref } from 'app/features/explore/utils/links';

import { Options } from './panelcfg.gen';
import { ScatterSeries, YValue } from './types';
import { fmt } from './utils';

export interface Props {
  dataIdxs: Array<number | null>;
  seriesIdx: number | null | undefined;
  isPinned: boolean;
  dismiss: () => void;
  options: Options;
  data: DataFrame[]; // source data
  allSeries: ScatterSeries[];
}

export const XYChartTooltip = ({ dataIdxs, seriesIdx, data, allSeries, dismiss, options, isPinned }: Props) => {
  const styles = useStyles2(getStyles);

  const rowIndex = dataIdxs.find((idx) => idx !== null);
  const seriesIndex = dataIdxs.findIndex((idx) => idx != null);
  // @todo: remove -1 when uPlot v2 arrive
  // context: first value in dataIdxs always null and represent X serie
  const hoveredPointIndex = seriesIndex - 1;

  if (!allSeries || rowIndex == null) {
    return null;
  }

  const series = allSeries[hoveredPointIndex];
  const frame = series.frame(data);
  const xField = series.x(frame);
  const yField = series.y(frame);

  const getHeaderLabel = (): LabelValue => {
    return {
      label: getFieldDisplayName(xField, frame),
      value: fmt(xField, xField.values[rowIndex]),
      // eslint-disable-next-line @typescript-eslint/consistent-type-assertions
      color: series.pointColor(frame) as string,
    };
  };

  const getLabelValue = (): LabelValue[] => {
    return [
      {
        label: getFieldDisplayName(yField, frame),
        value: fmt(yField, yField.values[rowIndex]),
        // eslint-disable-next-line @typescript-eslint/consistent-type-assertions
        color: series.pointColor(frame) as string,
      },
    ];
  };

  const getContentLabel = (): LabelValue[] => {
    // const yValue: YValue = {
    //   name: getFieldDisplayName(yField, frame),
    //   val: yField.values[rowIndex],
    //   field: yField,
    //   // eslint-disable-next-line @typescript-eslint/consistent-type-assertions
    //   color: series.pointColor(frame) as string,
    // };

    const content: LabelValue[] = [
      // {
      //   label: yValue.name,
      //   value: fmt(yValue.field, yValue.val),
      // },
    ];

    // add extra fields
    const extraFields: Field[] = frame.fields.filter((f) => f !== xField && f !== yField);
    if (extraFields) {
      extraFields.forEach((field) => {
        content.push({
          label: field.name,
          value: fmt(field, field.values[rowIndex]),
        });
      });
    }

    return content;
  };

  const getLinks = (): Array<LinkModel<Field>> => {
    let links: Array<LinkModel<Field>> = [];
    if (yField.getLinks) {
      const v = yField.values[rowIndex];
      const disp = yField.display ? yField.display(v) : { text: `${v}`, numeric: +v };
      links = yField.getLinks({ calculatedValue: disp, valueRowIndex: rowIndex }).map((linkModel) => {
        if (!linkModel.title) {
          linkModel.title = getTitleFromHref(linkModel.href);
        }

        return linkModel;
      });
    }
    return links;
  };

  return (
    <div className={styles.wrapper}>
      <VizTooltipHeader headerLabel={getHeaderLabel()} keyValuePairs={getLabelValue()} />
      <VizTooltipContent contentLabelValue={getContentLabel()} />
      {isPinned && <VizTooltipFooter dataLinks={getLinks()} canAnnotate={false} />}
    </div>
  );
};

const getStyles = (theme: GrafanaTheme2) => ({
  wrapper: css({
    display: 'flex',
    flexDirection: 'column',
    width: '280px',
    padding: theme.spacing(0.5),
  }),
});
