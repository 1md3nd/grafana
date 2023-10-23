import { css, cx } from '@emotion/css';
import React, { useEffect, useState } from 'react';

import { GrafanaTheme2, LinkModel, TimeZone, TraceLog } from '@grafana/data';
import { config, locationService, reportInteraction } from '@grafana/runtime';
import { Button, DataLinkButton, Icon, Tab, TabContent, TabsBar, useStyles2 } from '@grafana/ui';

import { autoColor, DetailState, TraceSpan } from '..';
import { ExploreDrawer } from '../../../ExploreDrawer';
import { getOverviewItems } from '../TraceTimelineViewer/SpanDetail';
import AccordianKeyValues from '../TraceTimelineViewer/SpanDetail/AccordianKeyValues';
import TextList from '../TraceTimelineViewer/SpanDetail/TextList';
import { TopOfViewRefType } from '../TraceTimelineViewer/VirtualizedTraceView';
import LabeledList from '../common/LabeledList';
import { SpanLinkFunc, SpanLinkType } from '../types/links';
import { TraceSpanReference } from '../types/trace';
import { uAlignIcon, ubTxRightAlign } from '../uberUtilityStyles';

import AccordianLogs from './AccordianLogs';
import AccordianReferences from './AccordianReferences';
import { StackTraces } from './StackTraces';

type Props = {
  span?: TraceSpan;
  timeZone: TimeZone;
  width: number;
  clearSelectedSpan: () => void;
  detailState: DetailState | undefined;
  traceStartTime: number;
  detailLogItemToggle: (spanID: string, log: TraceLog) => void;
  detailReferenceItemToggle: (spanID: string, reference: TraceSpanReference) => void;
  createFocusSpanLink: (traceId: string, spanId: string) => LinkModel;
  setDetailsPanelOffset: (offset: number) => void;
  defaultDetailsPanelHeight: number;
  createSpanLink?: SpanLinkFunc;
  datasourceType: string;
  topOfViewRefType: TopOfViewRefType;
};

enum TabLabels {
  Attributes = 'Attributes',
  Events = 'Events',
  Warnings = 'Warnings',
  StackTraces = 'Stack Traces',
  References = 'References',
}

export function DetailsPanel(props: Props) {
  const {
    span,
    timeZone,
    width,
    clearSelectedSpan,
    detailState,
    traceStartTime,
    detailLogItemToggle,
    detailReferenceItemToggle,
    createFocusSpanLink,
    setDetailsPanelOffset,
    defaultDetailsPanelHeight,
    createSpanLink,
    datasourceType,
    topOfViewRefType,
  } = props;
  const [activeTab, setActiveTab] = useState(TabLabels.Attributes);
  const styles = useStyles2(getStyles);

  useEffect(() => {
    setActiveTab(TabLabels.Attributes);
  }, [span]);

  if (!span || !detailState) {
    return null;
  }

  let { operationName, process, tags, logs, warnings, stackTraces, references } = span;
  const { logs: logsState, references: referencesState } = detailState;

  const tabs = [TabLabels.Attributes];
  const tabsCounters: Record<string, number> = {};

  if (logs && logs.length > 0) {
    tabs.push(TabLabels.Events);
    tabsCounters[TabLabels.Events] = logs.length;
  }
  if (warnings && warnings.length > 0) {
    tabs.push(TabLabels.Warnings);
    tabsCounters[TabLabels.Warnings] = warnings.length;
  }
  if (stackTraces && stackTraces.length > 0) {
    tabs.push(TabLabels.StackTraces);
    tabsCounters[TabLabels.StackTraces] = stackTraces.length;
  }
  if (references && references.length > 0) {
    tabs.push(TabLabels.References);
    tabsCounters[TabLabels.References] = references.length;
  }

  const focusSpanLink = createFocusSpanLink(span.traceID, span.spanID);
  let logLinkButton: JSX.Element | undefined = undefined;
  if (createSpanLink) {
    const links = createSpanLink(span);
    const logLinks = links?.filter((link) => link.type === SpanLinkType.Logs);
    if (links && logLinks && logLinks.length > 0) {
      logLinkButton = (
        <DataLinkButton
          link={{
            ...logLinks[0],
            title: 'Logs for this span',
            target: '_blank',
            origin: logLinks[0].field,
            onClick: (event: React.MouseEvent) => {
              // DataLinkButton assumes if you provide an onClick event you would want to prevent default behavior like navigation
              // In this case, if an onClick is not defined, restore navigation to the provided href while keeping the tracking
              // this interaction will not be tracked with link right clicks
              reportInteraction('grafana_traces_trace_view_span_link_clicked', {
                datasourceType: datasourceType,
                grafana_version: config.buildInfo.version,
                type: 'log',
                location: 'detailsPanel',
              });

              if (logLinks?.[0].onClick) {
                logLinks?.[0].onClick?.(event);
              } else {
                locationService.push(logLinks?.[0].href);
              }
            },
          }}
          buttonProps={{ icon: 'gf-logs' }}
        />
      );
    }
  }

  const linksGetter = () => [];

  const onDrawerResize = () => {
    const container = document.querySelector(`.${styles.container}`)?.firstChild;
    if (container instanceof HTMLElement) {
      const height = container.style.height;
      const heightVal =
        height && typeof parseInt(height.split('px')[0], 10) === 'number' ? parseInt(height.split('px')[0], 10) : 0;
      setDetailsPanelOffset(heightVal);
    }
  };

  return (
    <div className={styles.container}>
      {/* The first child here needs to be the ExploreDrawer to we can get it's height via onDrawerResize. This is so we can set a paddingBottom in the TraceView according to this components height */}
      <ExploreDrawer
        width={width}
        onResize={onDrawerResize}
        defaultHeight={defaultDetailsPanelHeight}
        className={styles.drawer}
      >
        <div className={cx(styles.header, styles.flexSpaceBetween)}>
          <div
            className={cx(
              styles.flexSpaceBetween,
              css`
                flex: 1 0 auto;
              `
            )}
          >
            <h4 style={{ margin: 0 }}>{operationName}</h4>
            <LabeledList className={ubTxRightAlign} divider={true} items={getOverviewItems(span, timeZone)} />
          </div>
          <Button icon={'times'} variant={'secondary'} onClick={clearSelectedSpan} size={'sm'} />
        </div>

        <div className={styles.linkContainer}>
          {logLinkButton}

          {topOfViewRefType === TopOfViewRefType.Explore && (
            <small className={styles.debugInfo}>
              {/* TODO: fix keyboard a11y */}
              {/* eslint-disable-next-line jsx-a11y/click-events-have-key-events, jsx-a11y/no-static-element-interactions */}
              <a
                {...focusSpanLink}
                onClick={(e) => {
                  // click handling logic copied from react router:
                  // https://github.com/remix-run/react-router/blob/997b4d67e506d39ac6571cb369d6d2d6b3dda557/packages/react-router-dom/index.tsx#L392-L394s
                  if (
                    focusSpanLink.onClick &&
                    e.button === 0 && // Ignore everything but left clicks
                    (!e.currentTarget.target || e.currentTarget.target === '_self') && // Let browser handle "target=_blank" etc.
                    !(e.metaKey || e.altKey || e.ctrlKey || e.shiftKey) // Ignore clicks with modifier keys
                  ) {
                    e.preventDefault();
                    focusSpanLink.onClick(e);
                  }
                }}
              >
                <Icon name={'link'} className={cx(uAlignIcon, styles.linkIcon)}></Icon>
              </a>
              <span className={styles.debugLabel} data-label="SpanID:" /> {span.spanID}
            </small>
          )}
        </div>

        <TabsBar>
          {tabs.map((tab) => {
            return (
              <Tab
                key={tab}
                label={tab}
                active={activeTab === tab}
                counter={tabsCounters[tab]}
                onChangeTab={() => setActiveTab(tab)}
              />
            );
          })}
        </TabsBar>

        <TabContent className={styles.tab}>
          {activeTab === TabLabels.Attributes && (
            <div style={{ display: 'flex', gap: '0 1rem' }}>
              <div className={styles.attributesContainer}>
                <AccordianKeyValues
                  className={styles.attributeValues}
                  data={tags}
                  label="Span Attributes"
                  linksGetter={linksGetter}
                  isOpen={true}
                  onToggle={() => {}}
                  interactive={false}
                />
              </div>
              <div className={styles.attributesContainer}>
                {process.tags && (
                  <AccordianKeyValues
                    className={styles.attributeValues}
                    data={process.tags}
                    label="Resource Attributes"
                    linksGetter={linksGetter}
                    isOpen={true}
                    interactive={false}
                    onToggle={() => {}}
                  />
                )}
              </div>
            </div>
          )}
          {activeTab === TabLabels.Events && logs && logs.length > 0 && (
            <AccordianLogs
              linksGetter={linksGetter}
              logs={logs}
              openedItems={logsState.openedItems}
              onItemToggle={(logItem) => detailLogItemToggle(span.spanID, logItem)}
              timestamp={traceStartTime}
            />
          )}
          {activeTab === TabLabels.Warnings && <TextList data={warnings} />}
          {activeTab === TabLabels.StackTraces && <StackTraces stackTraces={stackTraces ?? []} />}
          {activeTab === TabLabels.References && (
            <AccordianReferences
              data={references}
              openedItems={referencesState.openedItems}
              onItemToggle={(reference) => detailReferenceItemToggle(span.spanID, reference)}
              createFocusSpanLink={createFocusSpanLink}
            />
          )}
        </TabContent>
      </ExploreDrawer>
    </div>
  );
}

const getStyles = (theme: GrafanaTheme2) => ({
  container: css`
    label: DetailsPanelContainer;
    position: fixed;
    overflow: auto;
    bottom: 0;
    z-index: 9;
  `,
  drawer: css`
    margin: 0;
    position: relative !important;
  `,
  header: css`
    gap: 0 1rem;
    padding: 0.6rem;
    overflow: scroll;
  `,
  flexSpaceBetween: css`
    display: flex;
    align-items: center;
    justify-content: space-between;
  `,
  tab: css`
    label: DetailsPanelTab;
    padding: 0.5rem 1rem;

    & .json-markup {
      line-height: 17px;
      font-size: 13px;
      font-family: monospace;
      white-space: pre-wrap;
    }

    & .json-markup-key {
      font-weight: bold;
    }

    & .json-markup-bool {
      color: ${autoColor(theme, 'firebrick')};
    }

    & .json-markup-string {
      color: ${autoColor(theme, 'teal')};
    }

    & .json-markup-null {
      color: ${autoColor(theme, 'teal')};
    }

    & .json-markup-number {
      color: ${autoColor(theme, 'blue', 'black')};
    }
  `,
  attributesContainer: css`
    display: flex;
    flex: 1 0 auto;
    flex-direction: column;
    flex: 0 50%;
  `,
  attributeValues: css`
    display: flex;
    flex-direction: column;
  `,
  linkContainer: css`
    label: DetailsPanelLinkContainer;
    display: flex;
    align-items: flex-end;
    flex-direction: row-reverse;
    padding-right: 0.6rem;
  `,
  debugInfo: css`
    label: DetailsPanelDebugInfo;
    letter-spacing: 0.25px;
    margin-right: 15px;
  `,
  debugLabel: css`
    label: DetailsPanelDebugLabel;
    &::before {
      color: ${autoColor(theme, '#bbb')};
      content: attr(data-label);
    }
  `,
  linkIcon: css`
    font-size: 1.5em;
  `,
});
