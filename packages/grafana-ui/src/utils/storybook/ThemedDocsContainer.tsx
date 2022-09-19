// This is a temporary workaround to allow theme switching storybook docs
// see https://github.com/storybookjs/storybook/issues/10523 for further details
import { DocsContainer } from '@storybook/addon-docs/blocks';
import React from 'react';
import { useDarkMode } from 'storybook-dark-mode';

import { GrafanaLight, GrafanaDark } from '../../../.storybook/storybookTheme';

type Props = {
  context: any;
};

export const ThemedDocsContainer = ({ children, context }: React.PropsWithChildren<Props>) => {
  const dark = useDarkMode();

  return (
    // @ts-ignore
    <DocsContainer
      context={{
        ...context,
        storyById: (id) => {
          const storyContext = context.storyById(id);
          return {
            ...storyContext,
            parameters: {
              ...storyContext?.parameters,
              docs: {
                ...storyContext?.parameters.docs,
                theme: dark ? GrafanaDark : GrafanaLight,
              },
            },
          };
        },
      }}
    >
      {children}
    </DocsContainer>
  );
};
