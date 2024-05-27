import { render, screen } from '@testing-library/react';
import React from 'react';

import { selectors as e2eSelectors } from '@grafana/e2e-selectors';
import {
  CustomVariable,
  SceneGridLayout,
  SceneQueryRunner,
  SceneTimeRange,
  SceneVariableSet,
  VizPanel,
  VizPanelState,
} from '@grafana/scenes';
import { contextSrv } from 'app/core/core';
import { DashboardGridItem } from 'app/features/dashboard-scene/scene/DashboardGridItem';
import { DashboardScene, DashboardSceneState } from 'app/features/dashboard-scene/scene/DashboardScene';

import ShareAlerts from './ShareAlerts';

const selectors = e2eSelectors.pages.ShareDashboardModal.PublicDashboard;

beforeEach(() => {
  jest.spyOn(contextSrv, 'hasPermission').mockReturnValue(true);
});

describe('ShareAlerts', () => {
  describe('UnsupportedTemplateVariablesAlert', () => {
    it('should render alert when hasPermission and the dashboard has template vars', async () => {
      setup(undefined, {
        $variables: new SceneVariableSet({
          variables: [
            new CustomVariable({
              name: 'customVar',
              query: 'test, test2',
              value: 'test',
              text: 'test',
            }),
          ],
        }),
      });

      expect(await screen.findByTestId(selectors.TemplateVariablesWarningAlert)).toBeInTheDocument();
    });
    it('should not render alert when hasPermission but the dashboard has no template vars', async () => {
      setup();

      expect(screen.queryByTestId(selectors.TemplateVariablesWarningAlert)).not.toBeInTheDocument();
    });
  });
  describe('UnsupportedDataSourcesAlert', () => {
    it('should render alert when hasPermission and the dashboard has unsupported ds', async () => {
      setup({
        $data: new SceneQueryRunner({
          datasource: { uid: 'abcdef' },
          queries: [{ refId: 'A' }],
        }),
      });

      expect(await screen.findByTestId(selectors.UnsupportedDataSourcesWarningAlert)).toBeInTheDocument();
    });
    it('should not render alert when hasPermission but the dashboard has no unsupported ds', async () => {
      setup({
        $data: new SceneQueryRunner({
          datasource: { uid: 'prometheus' },
          queries: [{ refId: 'A' }],
        }),
      });

      expect(screen.queryByTestId(selectors.UnsupportedDataSourcesWarningAlert)).not.toBeInTheDocument();
    });
  });
});

function setup(panelState?: Partial<VizPanelState>, dashboardState?: Partial<DashboardSceneState>) {
  const panel = new VizPanel({
    title: 'Panel A',
    pluginId: 'table',
    key: 'panel-12',
    ...panelState,
  });

  const dashboard = new DashboardScene({
    title: 'hello',
    uid: 'dash-1',
    $timeRange: new SceneTimeRange({}),
    body: new SceneGridLayout({
      children: [
        new DashboardGridItem({
          key: 'griditem-1',
          x: 0,
          y: 0,
          width: 10,
          height: 12,
          body: panel,
        }),
      ],
    }),
    ...dashboardState,
  });

  render(<ShareAlerts dashboard={dashboard} />);
}
