// Copyright (c) 2018 Uber Technologies, Inc.
//
// Licensed under the Apache License, Version 2.0 (the "License");
// you may not use this file except in compliance with the License.
// You may obtain a copy of the License at
//
// http://www.apache.org/licenses/LICENSE-2.0
//
// Unless required by applicable law or agreed to in writing, software
// distributed under the License is distributed on an "AS IS" BASIS,
// WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
// See the License for the specific language governing permissions and
// limitations under the License.

import { css } from '@emotion/css';
import React, { memo, Dispatch, SetStateAction } from 'react';

import { config, reportInteraction } from '@grafana/runtime';
import { Button, useStyles2 } from '@grafana/ui';

import { SearchProps } from '../../useSearch';
import { ubJustifyEnd } from '../uberUtilityStyles';

export type TracePageSearchBarProps = {
  search: SearchProps;
  // setSearch: (value: string) => void;
  searchMatches: Set<string> | undefined;
  focusedSearchMatch: string;
  setFocusedSearchMatch: Dispatch<SetStateAction<string>>;
  datasourceType?: string;
};

export default memo(function TracePageSearchBar(props: TracePageSearchBarProps) {
  const { search, searchMatches, focusedSearchMatch, setFocusedSearchMatch, datasourceType } = props;
  const styles = useStyles2(getStyles);

  // const setTraceSearch = (value: string) => {
  //   setFocusedSearchMatch('');
  // };

  const nextResult = () => {
    reportInteraction('grafana_traces_trace_view_find_next_prev_clicked', {
      datasourceType: datasourceType,
      grafana_version: config.buildInfo.version,
      direction: 'next',
    });

    const spanMatches = Array.from(searchMatches!);
    const prevMatchedIndex = spanMatches.indexOf(focusedSearchMatch) ? spanMatches.indexOf(focusedSearchMatch) : 0;

    // new query || at end, go to start
    if (prevMatchedIndex === -1 || prevMatchedIndex === spanMatches.length - 1) {
      setFocusedSearchMatch(spanMatches[0]);
      return;
    }

    // get next
    setFocusedSearchMatch(spanMatches[prevMatchedIndex + 1]);
  };

  const prevResult = () => {
    reportInteraction('grafana_traces_trace_view_find_next_prev_clicked', {
      datasourceType: datasourceType,
      grafana_version: config.buildInfo.version,
      direction: 'prev',
    });

    const spanMatches = Array.from(searchMatches!);
    const prevMatchedIndex = spanMatches.indexOf(focusedSearchMatch) ? spanMatches.indexOf(focusedSearchMatch) : 0;

    // new query || at start, go to end
    if (prevMatchedIndex === -1 || prevMatchedIndex === 0) {
      setFocusedSearchMatch(spanMatches[spanMatches.length - 1]);
      return;
    }

    // get prev
    setFocusedSearchMatch(spanMatches[prevMatchedIndex - 1]);
  };

  const buttonEnabled =
    (search.serviceName && search.serviceName !== '') ||
    (search.spanName && search.spanName !== '') ||
    (search.from && search.from !== '') ||
    (search.to && search.to !== '');

  return (
    <div className={styles.searchBar}>
      <span className={ubJustifyEnd} style={{ display: 'flex' }}>
        <>
          <Button
            className={styles.button}
            variant="secondary"
            disabled={!buttonEnabled}
            type="button"
            fill={'outline'}
            aria-label="Prev result button"
            onClick={prevResult}
          >
            Prev
          </Button>
          <Button
            className={styles.button}
            variant="secondary"
            disabled={!buttonEnabled}
            type="button"
            fill={'outline'}
            aria-label="Next result button"
            onClick={nextResult}
          >
            Next
          </Button>
        </>
      </span>
    </div>
  );
});

export const getStyles = () => {
  return {
    searchBar: css`
      display: inline;
    `,
    button: css`
      transition: 0.2s;
      margin-left: 8px;
    `,
  };
};
