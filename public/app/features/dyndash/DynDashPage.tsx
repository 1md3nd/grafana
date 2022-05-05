// Libraries
import React, { FC } from 'react';

// Types
import { getDemoScene } from './scenes/demo';
import { SceneView } from './components/SceneView';
import { useObservable } from '@grafana/data';

export interface Props {
  name: string;
}

export const DynDash: FC<Props> = ({ name }) => {
  const scene = useObservable(getDemoScene(name), null);

  if (!scene) {
    return <h2>Loading...</h2>;
  }

  return (
    <div className="dashboard-container">
      <SceneView model={scene} />
    </div>
  );
};

