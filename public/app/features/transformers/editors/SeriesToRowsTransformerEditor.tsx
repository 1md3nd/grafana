import {
  DataTransformerID,
  standardTransformers,
  TransformerRegistryItem,
  TransformerUIProps,
  TransformerCategory,
} from '@grafana/data';
import { SeriesToRowsTransformerOptions } from '@grafana/data/src/transformations/transformers/seriesToRows';

import { seriesToRows } from '../img';

export const SeriesToRowsTransformerEditor = ({
  input,
  options,
  onChange,
}: TransformerUIProps<SeriesToRowsTransformerOptions>) => {
  return null;
};

export const seriesToRowsTransformerRegistryItem: TransformerRegistryItem<SeriesToRowsTransformerOptions> = {
  id: DataTransformerID.seriesToRows,
  editor: SeriesToRowsTransformerEditor,
  transformation: standardTransformers.seriesToRowsTransformer,
  name: 'Series to rows',
  description: `Merge many series and return a single series with time, metric and value as columns.
                Useful for showing multiple time series visualized in a table.`,
<<<<<<< HEAD
  categories: new Set([TransformerCategory.Combine, TransformerCategory.Reformat]),
  image: seriesToRows,
=======
  categories: new Set(['combine', 'reformat']),
>>>>>>> 96856a1936 (Update)
};
