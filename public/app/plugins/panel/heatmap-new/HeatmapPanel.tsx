import React, { useCallback, useMemo, useRef, useState } from 'react';
// import { css } from '@emotion/css';
// import { PanelProps, reduceField, ReducerID, TimeRange } from '@grafana/data';
import {
  // ArrayVector,
  DataFrame,
  // Field,
  GrafanaTheme2,
  // formattedValueToString,
  PanelProps,
  reduceField,
  ReducerID,
  TimeRange,
  // ValueLinkConfig,
} from '@grafana/data';
import { Portal, UPlotChart, useTheme2, VizLayout, LegendDisplayMode, VizTooltipContainer, useStyles2 } from '@grafana/ui';
import { PanelDataErrorView } from '@grafana/runtime';

import { HeatmapData, prepareHeatmapData } from './fields';
import { PanelOptions } from './models.gen';
import { quantizeScheme } from './palettes';
import {
  findExemplarFrameInPanelData,
  findDataFramesInPanelData,
  HeatmapHoverEvent,
  prepConfig,
  // timeFormatter,
  // translateMatrixIndex,
} from './utils';
import { HeatmapHoverView } from './HeatmapHoverView';
import { ColorScale } from './ColorScale';
// import { getFieldLinksForExplore } from 'app/features/explore/utils/links';
import { HeatmapCalculationMode } from 'app/features/transformers/calculateHeatmap/models.gen';
// import { HeatmapLookup } from './types';
// import { HeatmapTab } from './hovertabs/HeatmapTab';
// import { ExemplarTab } from './hovertabs/ExemplarTab';
import { ExemplarsPlugin } from './plugins/ExemplarsPlugin';
import { CloseButton } from 'app/core/components/CloseButton/CloseButton';
import { css } from '@emotion/css';

interface HeatmapPanelProps extends PanelProps<PanelOptions> {}

export const HeatmapPanel: React.FC<HeatmapPanelProps> = ({
  data,
  id,
  timeRange,
  timeZone,
  width,
  height,
  options,
  fieldConfig,
  onChangeTimeRange,
  replaceVariables,
}) => {
  const theme = useTheme2();
  const styles = useStyles2(getStyles);

  // ugh
  let timeRangeRef = useRef<TimeRange>(timeRange);
  timeRangeRef.current = timeRange;

  const info = useMemo(
    () => prepareHeatmapData(findDataFramesInPanelData(data), options, theme),
    [data, options, theme]
  );
  const exemplars: HeatmapData | undefined = useMemo((): HeatmapData | undefined => {
    const exemplarsFrame: DataFrame | undefined = findExemplarFrameInPanelData(data);
    if (exemplarsFrame) {
      return prepareHeatmapData(
        [exemplarsFrame],
        {
          ...options,
          heatmap: {
            yAxis: {
              mode: HeatmapCalculationMode.Size,
              value: info.yBucketSize?.toString(),
            },
          },
        },
        theme
      );
    }
    return undefined;
  }, [data, info, options, theme]);
  const facets = useMemo(() => [null, info.heatmap?.fields.map((f) => f.values.toArray())], [info.heatmap]);
  // const { onSplitOpen } = usePanelContext();

  const palette = useMemo(() => quantizeScheme(options.color, theme), [options.color, theme]);

  const [hover, setHover] = useState<HeatmapHoverEvent | undefined>(undefined);
  const [shouldDisplayCloseButton, setShouldDisplayCloseButton] = useState<boolean>(false);
  const isToolTipOpen = useRef<boolean>(false);

  const onCloseToolTip = () => {
    isToolTipOpen.current = false;
    setShouldDisplayCloseButton(false);
    onhover(null);
  };

  const onclick = () => {
    isToolTipOpen.current = !isToolTipOpen.current;
    setShouldDisplayCloseButton(isToolTipOpen.current);
  };

  const onhover = useCallback(
    (evt?: HeatmapHoverEvent | null) => {
      setHover(evt ?? undefined);
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [options, data.structureRev]
  );

  // ugh
  const dataRef = useRef<HeatmapData>(info);
  dataRef.current = info!;

  const builder = useMemo(() => {
    return prepConfig({
      dataRef,
      theme,
      onhover: onhover,
      onclick: options.tooltip.show ? onclick : null,
      onzoom: (evt) => {
        onChangeTimeRange({ from: evt.xMin, to: evt.xMax });
      },
      isToolTipOpen,
      timeZone,
      getTimeRange: () => timeRangeRef.current,
      palette,
      cellGap: options.cellGap,
      hideThreshold: options.hideThreshold,
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [options, data.structureRev]);

  // const getValuesInCell = useCallback(
  //   (lookupRange: HeatmapLookup): DataFrame[] | undefined => {
  //     const timeField: Field | undefined = data.annotations?.[0].fields.find((f: Field) => f.type === 'time');
  //     const valueField: Field | undefined = data.annotations?.[0].fields.find((f: Field) => f.type === 'number');
  //     if (timeField && valueField) {
  //       const minIndex: number = timeField.values
  //         .toArray()
  //         .findIndex((value: number) => value >= lookupRange.xRange.min!);
  //       const count: number = timeField.values
  //         .toArray()
  //         .slice(minIndex)
  //         .findIndex((value: number) => value >= lookupRange.xRange.max!);

  //       // Now find the relevant values in the value field.
  //       const indicies: number[] = valueField.values
  //         .toArray()
  //         .slice(minIndex, minIndex + count)
  //         .reduce((tally: number[], curr: number, i: number) => {
  //           if (curr >= lookupRange.yRange?.min! && curr < lookupRange.yRange?.max!) {
  //             tally.push(i + minIndex);
  //           }
  //           return tally;
  //         }, []);

  //       return indicies.map((annotationIndex: number, index: number) => {
  //         return {
  //           name: `${index + 1}`,
  //           fields: (data.annotations?.[0].fields || []).map((f: Field, rowIndex: number) => {
  //             const newField: Field = {
  //               ...f,
  //               values: new ArrayVector([f.values.get(annotationIndex)]),
  //             };
  //             if (f.config.links?.length) {
  //               // We have links to configure. Add a getLinks function to the field
  //               newField.getLinks = (config: ValueLinkConfig) => {
  //                 return getFieldLinksForExplore({ field: f, rowIndex, splitOpenFn: onSplitOpen, range: timeRange });
  //               };
  //             }
  //             if (f.type === 'time') {
  //               newField.display = (value: number) => {
  //                 return {
  //                   numeric: value,
  //                   text: timeFormatter(value, timeZone),
  //                 };
  //               };
  //             }
  //             return newField;
  //           }),
  //           length: 1,
  //         };
  //       });
  //     }
  //     return undefined;
  //   },
  //   [data.annotations, onSplitOpen, timeRange, timeZone]
  // );

  const renderLegend = () => {
    if (options.legend.displayMode === LegendDisplayMode.Hidden || !info.heatmap) {
      return null;
    }

    const field = info.heatmap.fields[2];
    const { min, max } = reduceField({ field, reducers: [ReducerID.min, ReducerID.max] });

    let hoverValue: number | undefined = undefined;
    if (hover && info.heatmap.fields) {
      const countField = info.heatmap.fields[2];
      hoverValue = countField?.values.get(hover.index);
    }

    return (
      <VizLayout.Legend placement="bottom" maxHeight="20%">
        <ColorScale hoverValue={hoverValue} colorPalette={palette} min={min} max={max} display={info.display} />
      </VizLayout.Legend>
    );
  };

  if (info.warning || !info.heatmap) {
    return (
      <PanelDataErrorView
        panelId={id}
        fieldConfig={fieldConfig}
        data={data}
        needsNumberField={true}
        message={info.warning}
      />
    );
  }

  return (
    <>
      <VizLayout width={width} height={height} legend={renderLegend()}>
        {(vizWidth: number, vizHeight: number) => (
          <UPlotChart config={builder} data={facets as any} width={vizWidth} height={vizHeight} timeRange={timeRange}>
            <ExemplarsPlugin exemplars={exemplars!} config={builder} colorPalette={palette} />
          </UPlotChart>
        )}
      </VizLayout>
      <Portal>
        {/* {hover && (
          <HeatmapHoverView
            ttip={{
              layers: [
                HeatmapTab({
                  heatmapData: info,
                  index: hover.index,
                  options: { showHistogram: options.tooltip.yHistogram, timeZone },
                }),
                ExemplarTab({
                  heatmapData: exemplars!,
                  getValuesInCell,
                  index: translateMatrixIndex(hover.index, info.yBucketCount!, exemplars?.yBucketCount!),
                }),
              ],
              hover,
              point: {},
            }}
            isOpen={shouldDisplayCloseButton}
            onClose={onCloseToolTip}
          /> */}
        {hover && options.tooltip.show && (
          <VizTooltipContainer
            position={{ x: hover.pageX, y: hover.pageY }}
            offset={{ x: 10, y: 10 }}
            allowPointerEvents={isToolTipOpen.current}
          >
            {shouldDisplayCloseButton && (
              <>
                <CloseButton onClick={onCloseToolTip} />
                <div className={styles.closeButtonSpacer} />
              </>
            )}
            <HeatmapHoverView data={info} hover={hover} showHistogram={options.tooltip.yHistogram} />
          </VizTooltipContainer>
        )}
      </Portal>
    </>
  );
};

const getStyles = (theme: GrafanaTheme2) => ({
  closeButtonSpacer: css`
    margin-bottom: 15px;
  `,
});
