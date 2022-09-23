import React, { useState } from 'react';

import { PageLayoutType } from '@grafana/data';
import { config } from '@grafana/runtime';
import { PageToolbar, ToolbarButton } from '@grafana/ui';
import { AppChromeUpdate } from 'app/core/components/AppChrome/AppChromeUpdate';
import { Page } from 'app/core/components/Page/Page';

import { SceneComponentProps, SceneObjectStatePlain, SceneObject } from '../core/types';
import { UrlSyncManager } from '../services/UrlSyncManager';

import { SceneInspectGraph } from './SceneInspectGraph';
import { SceneContextObject } from '../core/SceneContextObject';

interface SceneState extends SceneObjectStatePlain {
  title: string;
  children: SceneObject[];
  actions?: SceneObject[];
  isEditing?: boolean;
}

export class Scene extends SceneContextObject<SceneState> {
  static Component = SceneRenderer;
  urlSyncManager?: UrlSyncManager;

  activate() {
    super.activate();
    this.urlSyncManager = new UrlSyncManager(this);
  }

  deactivate() {
    super.deactivate();
    this.urlSyncManager!.cleanUp();
  }
}

function SceneRenderer({ model }: SceneComponentProps<Scene>) {
  const { title, children, actions = [], isEditing, $editor } = model.useState();

  const [isInspecting, setIsInspecting] = useState(false);
  const toolbarActions = (actions ?? []).map((action) => <action.Component key={action.state.key} model={action} />);

  if ($editor) {
    toolbarActions.push(
      <ToolbarButton
        icon="cog"
        variant={isEditing ? 'primary' : 'default'}
        onClick={() => model.setState({ isEditing: !model.state.isEditing })}
      />
    );
  }

  toolbarActions.push(
    <ToolbarButton
      icon="bug"
      variant={isInspecting ? 'primary' : 'default'}
      onClick={() => setIsInspecting(!isInspecting)}
    />
  );

  const pageToolbar = config.featureToggles.topnav ? (
    <AppChromeUpdate actions={toolbarActions} />
  ) : (
    <PageToolbar title={title}>{toolbarActions}</PageToolbar>
  );

  return (
    <Page navId="scenes" pageNav={{ text: title }} layout={PageLayoutType.Canvas} toolbar={pageToolbar}>
      <div style={{ flexGrow: 1, display: 'flex', gap: '8px', overflow: 'auto' }}>
        {renderNodes(children, Boolean(isEditing))}
        {$editor && <$editor.Component model={$editor} isEditing={isEditing} />}

        {/* simple dev */}
        {isInspecting && <SceneInspectGraph model={model} onClose={() => setIsInspecting(false)} />}
      </div>
    </Page>
  );
}

export function renderNodes(nodes: SceneObject[], isEditing: boolean): React.ReactNode {
  return nodes.map((node) => {
    return <node.Component key={node.state.key} model={node} />;
  });
}
