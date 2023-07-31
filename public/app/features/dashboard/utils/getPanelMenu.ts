import {
  PanelData,
  PanelMenuItem,
  PluginExtensionLink,
  PluginExtensionPoints,
  type PluginExtensionPanelContext,
} from '@grafana/data';
import {
  AngularComponent,
  getDataSourceSrv,
  locationService,
  reportInteraction,
  getPluginLinkExtensions,
} from '@grafana/runtime';
import { PanelCtrl } from 'app/angular/panel/panel_ctrl';
import config from 'app/core/config';
import { t } from 'app/core/internationalization';
import { contextSrv } from 'app/core/services/context_srv';
import { getExploreUrl } from 'app/core/utils/explore';
import { DashboardModel } from 'app/features/dashboard/state/DashboardModel';
import { PanelModel } from 'app/features/dashboard/state/PanelModel';
import {
  addLibraryPanel,
  copyPanel,
  duplicatePanel,
  exportPanel,
  removePanel,
  sharePanel,
  toggleLegend,
  unlinkLibraryPanel,
} from 'app/features/dashboard/utils/panel';
import { ExportType } from 'app/features/exporter/types';
import { InspectTab } from 'app/features/inspector/types';
import { isPanelModelLibraryPanel } from 'app/features/library-panels/guard';
import { truncateTitle } from 'app/features/plugins/extensions/utils';
import { SHARED_DASHBOARD_QUERY } from 'app/plugins/datasource/dashboard';
import { store } from 'app/store/store';

import { navigateToExplore } from '../../explore/state/main';
import { getTimeSrv } from '../services/TimeSrv';

export function getPanelMenu(
  dashboard: DashboardModel,
  panel: PanelModel,
  angularComponent?: AngularComponent | null,
  data?: PanelData | null
): PanelMenuItem[] {
  const onViewPanel = (event: React.MouseEvent) => {
    event.preventDefault();
    locationService.partial({
      viewPanel: panel.id,
    });
    reportInteraction('dashboards_panelheader_menu', { item: 'view' });
  };

  const onEditPanel = (event: React.MouseEvent) => {
    event.preventDefault();
    locationService.partial({
      editPanel: panel.id,
    });

    reportInteraction('dashboards_panelheader_menu', { item: 'edit' });
  };

  const onSharePanel = (event: React.MouseEvent) => {
    event.preventDefault();
    sharePanel(dashboard, panel);
    reportInteraction('dashboards_panelheader_menu', { item: 'share' });
  };

  //================= WORKING HERE

  const onExportPanel = (exportType: ExportType) => {
    reportInteraction('dashboards_panelheader_menu', {
      item: 'createExportPanel',
      exportType: exportType ?? ExportType.jpeg,
    });

    exportPanel(
      document.documentElement.querySelector(`[data-panelid="${panel.id}"]`)!,
      panel,
      exportType ?? ExportType.jpeg,
      data
    );
  };

  //=================

  const onAddLibraryPanel = (event: React.MouseEvent) => {
    event.preventDefault();
    addLibraryPanel(dashboard, panel);
    reportInteraction('dashboards_panelheader_menu', { item: 'createLibraryPanel' });
  };

  const onUnlinkLibraryPanel = (event: React.MouseEvent) => {
    event.preventDefault();
    unlinkLibraryPanel(panel);
    reportInteraction('dashboards_panelheader_menu', { item: 'unlinkLibraryPanel' });
  };

  const onInspectPanel = (tab?: InspectTab) => {
    locationService.partial({
      inspect: panel.id,
      inspectTab: tab,
    });
    reportInteraction('dashboards_panelheader_menu', { item: 'inspect', tab: tab ?? InspectTab.Data });
  };

  const onMore = (event: React.MouseEvent) => {
    event.preventDefault();
  };

  const onDuplicatePanel = (event: React.MouseEvent) => {
    event.preventDefault();
    duplicatePanel(dashboard, panel);
    reportInteraction('dashboards_panelheader_menu', { item: 'duplicate' });
  };

  const onCopyPanel = (event: React.MouseEvent) => {
    event.preventDefault();
    copyPanel(panel);
    reportInteraction('dashboards_panelheader_menu', { item: 'copy' });
  };

  const onRemovePanel = (event: React.MouseEvent) => {
    event.preventDefault();
    removePanel(dashboard, panel, true);
    reportInteraction('dashboards_panelheader_menu', { item: 'remove' });
  };

  const onNavigateToExplore = (event: React.MouseEvent) => {
    event.preventDefault();
    const openInNewWindow =
      event.ctrlKey || event.metaKey ? (url: string) => window.open(`${config.appSubUrl}${url}`) : undefined;
    store.dispatch(navigateToExplore(panel, { getDataSourceSrv, getTimeSrv, getExploreUrl, openInNewWindow }) as any);
    reportInteraction('dashboards_panelheader_menu', { item: 'explore' });
  };

  const onToggleLegend = (event: React.MouseEvent) => {
    event.preventDefault();
    toggleLegend(panel);
    reportInteraction('dashboards_panelheader_menu', { item: 'toggleLegend' });
  };

  const menu: PanelMenuItem[] = [];

  if (!panel.isEditing) {
    menu.push({
      text: t('panel.header-menu.view', `View`),
      iconClassName: 'eye',
      onClick: onViewPanel,
      shortcut: 'v',
    });
  }

  if (dashboard.canEditPanel(panel) && !panel.isEditing) {
    menu.push({
      text: t('panel.header-menu.edit', `Edit`),
      iconClassName: 'edit',
      onClick: onEditPanel,
      shortcut: 'e',
    });
  }

  menu.push({
    text: t('panel.header-menu.share', `Share`),
    iconClassName: 'share-alt',
    onClick: onSharePanel,
    shortcut: 'p s',
  });

  const subMenuEnable = true; // ============

  const exportMenu: PanelMenuItem[] = [];
  let exportImageMenu = exportMenu;
  let exportDataMenu = exportMenu;

  if (subMenuEnable) {
    exportImageMenu = [];

    exportDataMenu = [];
  }

  exportImageMenu.push({
    text: `PNG`,
    onClick: () => onExportPanel(ExportType.png),
  });

  exportImageMenu.push({
    text: `JPEG`,
    onClick: () => onExportPanel(ExportType.jpeg),
  });

  exportImageMenu.push({
    text: `BMP`,
    onClick: () => onExportPanel(ExportType.bmp),
  });

  if (!subMenuEnable) {
    exportImageMenu.push({
      type: 'divider',
      text: '',
    });
  }

  if (panel.plugin && !panel.plugin.meta.skipDataQuery) {
    exportDataMenu.push({
      text: `CSV`,
      onClick: () => onExportPanel(ExportType.csv),
    });

    exportDataMenu.push({
      text: `Excel`,
      onClick: () => onExportPanel(ExportType.xlsx),
    });

    exportDataMenu.push({
      text: `Data JSON`,
      onClick: () => onExportPanel(ExportType.dataJson),
    });

    exportDataMenu.push({
      text: `DataFrame JSON`,
      onClick: () => onExportPanel(ExportType.dataFrameJson),
    });
  }

  exportDataMenu.push({
    text: `Panel JSON`,
    onClick: () => onExportPanel(ExportType.panelJson),
  });

  if (subMenuEnable) {
    exportMenu.push({
      type: 'submenu',
      text: `Image`,
      iconClassName: 'image-v',
      subMenu: exportImageMenu,
    });

    exportMenu.push({
      type: 'submenu',
      text: `Data`,
      iconClassName: 'book',
      subMenu: exportDataMenu,
    });
  }

  // TODO: Re-implement feature toggle
  // TODO: Remove optional submenu syntax

  const featureToggleEnabled = true;

  if (featureToggleEnabled) {
    // PLACEHOLDER FEATURE TOGGLE THING
    menu.push({
      type: 'submenu',
      text: t('panel.header-menu.export', `Export`),
      iconClassName: 'download-alt',
      subMenu: exportMenu,
    });
  }

  if (
    contextSrv.hasAccessToExplore() &&
    !(panel.plugin && panel.plugin.meta.skipDataQuery) &&
    panel.datasource?.uid !== SHARED_DASHBOARD_QUERY
  ) {
    menu.push({
      text: t('panel.header-menu.explore', `Explore`),
      iconClassName: 'compass',
      onClick: onNavigateToExplore,
      shortcut: 'p x',
    });
  }

  const inspectMenu: PanelMenuItem[] = [];

  // Only show these inspect actions for data plugins
  if (panel.plugin && !panel.plugin.meta.skipDataQuery) {
    inspectMenu.push({
      text: t('panel.header-menu.inspect-data', `Data`),
      onClick: () => onInspectPanel(InspectTab.Data),
    });

    if (dashboard.meta.canEdit) {
      inspectMenu.push({
        text: t('panel.header-menu.query', `Query`),
        onClick: () => onInspectPanel(InspectTab.Query),
      });
    }
  }

  inspectMenu.push({
    text: t('panel.header-menu.inspect-json', `Panel JSON`),
    onClick: () => onInspectPanel(InspectTab.JSON),
  });

  menu.push({
    type: 'submenu',
    text: t('panel.header-menu.inspect', `Inspect`),
    iconClassName: 'info-circle',
    onClick: (e: React.MouseEvent<HTMLElement>) => {
      const currentTarget = e.currentTarget;
      const target = e.target as HTMLElement;
      const closestMenuItem = target.closest('[role="menuitem"]');

      if (target === currentTarget || closestMenuItem === currentTarget) {
        onInspectPanel();
      }
    },
    shortcut: 'i',
    subMenu: inspectMenu,
  });

  const subMenu: PanelMenuItem[] = [];
  const canEdit = dashboard.canEditPanel(panel);
  if (!(panel.isViewing || panel.isEditing)) {
    if (canEdit) {
      subMenu.push({
        text: t('panel.header-menu.duplicate', `Duplicate`),
        onClick: onDuplicatePanel,
        shortcut: 'p d',
      });

      subMenu.push({
        text: t('panel.header-menu.copy', `Copy`),
        onClick: onCopyPanel,
      });

      if (isPanelModelLibraryPanel(panel)) {
        subMenu.push({
          text: t('panel.header-menu.unlink-library-panel', `Unlink library panel`),
          onClick: onUnlinkLibraryPanel,
        });
      } else {
        subMenu.push({
          text: t('panel.header-menu.create-library-panel', `Create library panel`),
          onClick: onAddLibraryPanel,
        });
      }
    } else if (contextSrv.isEditor) {
      // An editor but the dashboard is not editable
      subMenu.push({
        text: t('panel.header-menu.copy', `Copy`),
        onClick: onCopyPanel,
      });
    }
  }

  // add old angular panel options
  if (angularComponent) {
    const scope = angularComponent.getScope();
    const panelCtrl: PanelCtrl = scope.$$childHead.ctrl;
    const angularMenuItems = panelCtrl.getExtendedMenu();

    for (const item of angularMenuItems) {
      const reactItem: PanelMenuItem = {
        text: item.text,
        href: item.href,
        shortcut: item.shortcut,
      };

      if (item.click) {
        reactItem.onClick = () => {
          scope.$eval(item.click, { ctrl: panelCtrl });
        };
      }

      subMenu.push(reactItem);
    }
  }

  if (panel.options.legend) {
    subMenu.push({
      text: panel.options.legend.showLegend
        ? t('panel.header-menu.hide-legend', 'Hide legend')
        : t('panel.header-menu.show-legend', 'Show legend'),
      onClick: onToggleLegend,
      shortcut: 'p l',
    });
  }

  // When editing hide most actions
  if (panel.isEditing) {
    subMenu.length = 0;
  }

  if (canEdit && panel.plugin && !panel.plugin.meta.skipDataQuery) {
    subMenu.push({
      text: t('panel.header-menu.get-help', 'Get help'),
      onClick: () => onInspectPanel(InspectTab.Help),
    });
  }

  const { extensions } = getPluginLinkExtensions({
    extensionPointId: PluginExtensionPoints.DashboardPanelMenu,
    context: createExtensionContext(panel, dashboard),
    limitPerPlugin: 3,
  });

  if (extensions.length > 0 && !panel.isEditing) {
    menu.push({
      text: 'Extensions',
      iconClassName: 'plug',
      type: 'submenu',
      subMenu: createExtensionSubMenu(extensions),
    });
  }

  if (subMenu.length) {
    menu.push({
      type: 'submenu',
      text: t('panel.header-menu.more', `More...`),
      iconClassName: 'cube',
      subMenu,
      onClick: onMore,
    });
  }

  if (dashboard.canEditPanel(panel) && !panel.isEditing && !panel.isViewing) {
    menu.push({ type: 'divider', text: '' });

    menu.push({
      text: t('panel.header-menu.remove', `Remove`),
      iconClassName: 'trash-alt',
      onClick: onRemovePanel,
      shortcut: 'p r',
    });
  }

  return menu;
}

function createExtensionContext(panel: PanelModel, dashboard: DashboardModel): PluginExtensionPanelContext {
  return {
    id: panel.id,
    pluginId: panel.type,
    title: panel.title,
    timeRange: dashboard.time,
    timeZone: dashboard.timezone,
    dashboard: {
      uid: dashboard.uid,
      title: dashboard.title,
      tags: Array.from<string>(dashboard.tags),
    },
    targets: panel.targets,
    scopedVars: panel.scopedVars,
    data: panel.getQueryRunner().getLastResult(),
  };
}

function createExtensionSubMenu(extensions: PluginExtensionLink[]): PanelMenuItem[] {
  const categorized: Record<string, PanelMenuItem[]> = {};
  const uncategorized: PanelMenuItem[] = [];

  for (const extension of extensions) {
    const category = extension.category;

    if (!category) {
      uncategorized.push({
        text: truncateTitle(extension.title, 25),
        href: extension.path,
        onClick: extension.onClick,
      });
      continue;
    }

    if (!Array.isArray(categorized[category])) {
      categorized[category] = [];
    }

    categorized[category].push({
      text: truncateTitle(extension.title, 25),
      href: extension.path,
      onClick: extension.onClick,
    });
  }

  const subMenu = Object.keys(categorized).reduce((subMenu: PanelMenuItem[], category) => {
    subMenu.push({
      text: truncateTitle(category, 25),
      type: 'group',
      subMenu: categorized[category],
    });
    return subMenu;
  }, []);

  if (uncategorized.length > 0) {
    if (subMenu.length > 0) {
      subMenu.push({
        text: 'divider',
        type: 'divider',
      });
    }

    Array.prototype.push.apply(subMenu, uncategorized);
  }

  return subMenu;
}
