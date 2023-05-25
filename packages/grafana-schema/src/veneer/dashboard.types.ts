import { DataSourceRef as CommonDataSourceRef, DataSourceRef } from '../common/common.gen';
import * as raw from '../raw/dashboard/x/dashboard_types.gen';

import { DataQuery } from './common.types';

export type { CommonDataSourceRef as DataSourceRef };

export interface Panel<TOptions = Record<string, unknown>, TCustomFieldConfig = Record<string, unknown>>
  extends raw.Panel {
  fieldConfig: FieldConfigSource<TCustomFieldConfig>;
}

export interface BaseVariableModel extends Omit<raw.BaseVariableModel, 'rootStateKey' | 'error' | 'description'> {
  // Overrides nullable properties because CUE doesn't support null values
  rootStateKey: string | null;
  error: any | null;
  description: string | null;
}

export interface VariableWithOptions extends Omit<raw.VariableWithOptions, 'rootStateKey' | 'error' | 'description'> {
  // Overrides nullable properties because CUE doesn't support null values
  rootStateKey: string | null;
  error: any | null;
  description: string | null;
}

export interface VariableWithMultiSupport
  extends Omit<raw.VariableWithMultiSupport, 'rootStateKey' | 'error' | 'description' | 'allValue'> {
  // Overrides nullable properties because CUE doesn't support null values
  rootStateKey: string | null;
  error: any | null;
  description: string | null;
  allValue?: string | null;
}

export interface QueryVariableModel
  extends Omit<raw.QueryVariableModel, 'rootStateKey' | 'error' | 'description' | 'datasource' | 'allValue' | 'query'> {
  // Overrides nullable properties because CUE doesn't support null values
  rootStateKey: string | null;
  error: any | null;
  description: string | null;
  datasource: raw.DataSourceRef | null;
  allValue?: string | null;
  query: any;
}

export interface AdHocVariableModel
  extends Omit<raw.AdHocVariableModel, 'rootStateKey' | 'error' | 'description' | 'datasource'> {
  // Overrides nullable properties because CUE doesn't support null values
  rootStateKey: string | null;
  error: any | null;
  description: string | null;
  datasource: raw.DataSourceRef | null;
}

export interface ConstantVariableModel
  extends Omit<raw.ConstantVariableModel, 'rootStateKey' | 'error' | 'description'> {
  // Overrides nullable properties because CUE doesn't support null values
  rootStateKey: string | null;
  error: any | null;
  description: string | null;
}

export interface DataSourceVariableModel
  extends Omit<raw.DataSourceVariableModel, 'rootStateKey' | 'error' | 'description' | 'allValue'> {
  // Overrides nullable properties because CUE doesn't support null values
  rootStateKey: string | null;
  error: any | null;
  description: string | null;
  allValue?: string | null;
}

export interface IntervalVariableModel
  extends Omit<raw.IntervalVariableModel, 'rootStateKey' | 'error' | 'description'> {
  // Overrides nullable properties because CUE doesn't support null values
  rootStateKey: string | null;
  error: any | null;
  description: string | null;
}

export interface TextBoxVariableModel
  extends Omit<raw.TextBoxVariableModel, 'rootStateKey' | 'error' | 'description' | 'originalQuery'> {
  // Overrides nullable properties because CUE doesn't support null values
  rootStateKey: string | null;
  error: any | null;
  description: string | null;
  originalQuery: string | null;
}

export interface CustomVariableModel
  extends Omit<raw.CustomVariableModel, 'rootStateKey' | 'error' | 'description' | 'allValue'> {
  // Overrides nullable properties because CUE doesn't support null values
  rootStateKey: string | null;
  error: any | null;
  description: string | null;
  allValue?: string | null;
}

export interface UserSystemVariableModel
  extends Omit<raw.UserSystemVariableModel, 'rootStateKey' | 'error' | 'description'> {
  // Overrides nullable properties because CUE doesn't support null values
  rootStateKey: string | null;
  error: any | null;
  description: string | null;
}

export interface OrgSystemVariableModel
  extends Omit<raw.OrgSystemVariableModel, 'rootStateKey' | 'error' | 'description'> {
  // Overrides nullable properties because CUE doesn't support null values
  rootStateKey: string | null;
  error: any | null;
  description: string | null;
}

export interface DashSystemVariableModel
  extends Omit<raw.DashSystemVariableModel, 'rootStateKey' | 'error' | 'description'> {
  // Overrides nullable properties because CUE doesn't support null values
  rootStateKey: string | null;
  error: any | null;
  description: string | null;
}

export type VariableModel =
  | QueryVariableModel
  | AdHocVariableModel
  | ConstantVariableModel
  | DataSourceVariableModel
  | IntervalVariableModel
  | TextBoxVariableModel
  | CustomVariableModel
  | UserSystemVariableModel
  | OrgSystemVariableModel
  | DashSystemVariableModel;

export interface SystemVariable<TProps> extends BaseVariableModel {
  type: 'system';
  current: { value: TProps };
}

export interface Dashboard extends Omit<raw.Dashboard, 'templating' | 'annotations'> {
  panels?: Array<Panel | raw.RowPanel | raw.GraphPanel | raw.HeatmapPanel>;
  annotations?: AnnotationContainer;
  templating?: {
    list?: VariableModel[];
  };
}

export interface AnnotationQuery<TQuery extends DataQuery = DataQuery>
  extends Omit<raw.AnnotationQuery, 'target' | 'datasource'> {
  datasource?: DataSourceRef | null;
  target?: TQuery;
}

export interface AnnotationContainer extends Omit<raw.AnnotationContainer, 'list'> {
  list?: AnnotationQuery[]; // use the version from this file
}

export interface FieldConfig<TOptions = Record<string, unknown>> extends raw.FieldConfig {
  custom?: TOptions & Record<string, unknown>;
}

export interface FieldConfigSource<TOptions = Record<string, unknown>> extends raw.FieldConfigSource {
  defaults: FieldConfig<TOptions>;
}

export interface MatcherConfig<TConfig = any> extends raw.MatcherConfig {
  options?: TConfig;
}

export interface DataTransformerConfig<TOptions = any> extends raw.DataTransformerConfig {
  options: TOptions;
}

export const defaultDashboard = raw.defaultDashboard as Dashboard;
export const defaultBaseVariableModel = {
  ...raw.defaultBaseVariableModel,
  rootStateKey: null,
  error: null,
  description: null,
  hide: raw.VariableHide.dontHide,
  state: raw.LoadingState.NotStarted,
} as BaseVariableModel;
export const defaultAdHocVariableModel = {
  ...raw.defaultAdHocVariableModel,
};
export const defaultVariableWithOptions = {
  ...raw.defaultVariableWithOptions,
};

export const defaultPanel: Partial<Panel> = raw.defaultPanel;
export const defaultFieldConfig: Partial<FieldConfig> = raw.defaultFieldConfig;
export const defaultFieldConfigSource: Partial<FieldConfigSource> = raw.defaultFieldConfigSource;
export const defaultMatcherConfig: Partial<MatcherConfig> = raw.defaultMatcherConfig;
export const defaultAnnotationQuery: Partial<AnnotationQuery> = raw.defaultAnnotationQuery as AnnotationQuery;
export const defaultAnnotationContainer: Partial<AnnotationContainer> =
  raw.defaultAnnotationContainer as AnnotationContainer;
