import React from 'react';

import { SceneComponentProps, SceneObjectBase, SceneObject, SceneObjectState } from '@grafana/scenes';
import { Drawer } from '@grafana/ui';
import { Props as DrawerProps } from '@grafana/ui/src/components/Drawer/Drawer';
import { DrawerProvider } from '@grafana/ui/src/components/Drawer/DrawerContext';
import appEvents from 'app/core/app_events';
import { ShowModalReactEvent } from 'app/types/events';

export type SceneDrawerProps = {
  scene: SceneObject;
  onClose: () => void;
} & Partial<Omit<DrawerProps, 'onClose'>>;

export function SceneDrawer(props: SceneDrawerProps) {
  const { scene, title, onClose, size = 'lg', ...rest } = props;

  return (
    <DrawerProvider>
      <Drawer title={title} onClose={onClose} {...rest} size={size}>
        <scene.Component model={scene} />
      </Drawer>
    </DrawerProvider>
  );
}

interface SceneDrawerAsSceneState extends SceneObjectState, SceneDrawerProps {}

export class SceneDrawerAsScene extends SceneObjectBase<SceneDrawerAsSceneState> {
  constructor(state: SceneDrawerProps) {
    super(state);
  }

  static Component({ model }: SceneComponentProps<SceneDrawerAsScene>) {
    const state = model.useState();

    return <SceneDrawer {...state} />;
  }
}

export function launchSceneDrawerInGlobalModal(props: Omit<SceneDrawerProps, 'onDismiss'>) {
  const payload = {
    component: SceneDrawer,
    props,
  };

  appEvents.publish(new ShowModalReactEvent(payload));
}
