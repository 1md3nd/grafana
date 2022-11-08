import { SceneObjectBase } from '../../core/SceneObjectBase';
import { SceneObjectStatePlain } from '../../core/types';
import { SceneVariableSet } from '../sets/SceneVariableSet';
import { ConstantVariable } from '../variants/ConstantVariable';
import { TestVariable } from '../variants/TestVariable';

import { sceneInterpolator } from './sceneInterpolator';

interface TestSceneState extends SceneObjectStatePlain {
  nested?: TestScene;
}

class TestScene extends SceneObjectBase<TestSceneState> {}

describe('sceneInterpolator', () => {
  it('Should be interpolate and use closest variable', () => {
    const scene = new TestScene({
      $variables: new SceneVariableSet({
        variables: [
          new ConstantVariable({
            name: 'test',
            value: 'hello',
          }),
          new ConstantVariable({
            name: 'atRootOnly',
            value: 'RootValue',
          }),
        ],
      }),
      nested: new TestScene({
        $variables: new SceneVariableSet({
          variables: [
            new ConstantVariable({
              name: 'test',
              value: 'nestedValue',
            }),
          ],
        }),
      }),
    });

    expect(sceneInterpolator(scene, '${test}')).toBe('hello');
    expect(sceneInterpolator(scene.state.nested!, '${test}')).toBe('nestedValue');
    expect(sceneInterpolator(scene.state.nested!, '${atRootOnly}')).toBe('RootValue');
  });

  it('Can use format', () => {
    const scene = new TestScene({
      $variables: new SceneVariableSet({
        variables: [
          new ConstantVariable({
            name: 'test',
            value: 'hello',
          }),
        ],
      }),
    });

    expect(sceneInterpolator(scene, '${test:queryparam}')).toBe('var-test=hello');
  });

  it('Can format multi valued values', () => {
    const scene = new TestScene({
      $variables: new SceneVariableSet({
        variables: [
          new TestVariable({
            name: 'test',
            value: ['hello', 'world'],
          }),
        ],
      }),
    });

    expect(sceneInterpolator(scene, 'test.${test}.asd')).toBe('test.{hello,world}.asd');
  });
});
