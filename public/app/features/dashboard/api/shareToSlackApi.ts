import { BaseQueryFn, createApi } from '@reduxjs/toolkit/query/react';
import { lastValueFrom } from 'rxjs';

import { BackendSrvRequest, getBackendSrv } from '@grafana/runtime/src';

import { createSuccessNotification } from '../../../core/copy/appNotification';
import { notifyApp } from '../../../core/reducers/appNotification';

export interface ChannelRS {
  id: string;
  name: string;
}

export interface Channel {
  value: string;
  label: string;
}

export interface SlackShareContent {
  dashboardUid: string;
  channelId: string;
  message?: string;
  imagePreviewUrl: string;
}

const backendSrvBaseQuery =
  ({ baseUrl }: { baseUrl: string }): BaseQueryFn<BackendSrvRequest> =>
  async (requestOptions) => {
    try {
      const { data: responseData, ...meta } = await lastValueFrom(
        getBackendSrv().fetch({
          ...requestOptions,
          url: baseUrl + requestOptions.url,
          showErrorAlert: requestOptions.showErrorAlert,
        })
      );
      return { data: responseData, meta };
    } catch (error) {
      return { error };
    }
  };

export const shareToSlackApi = createApi({
  reducerPath: 'shareToSlackApi',
  baseQuery: backendSrvBaseQuery({ baseUrl: '/api' }),
  tagTypes: ['channels', 'preview'],
  endpoints: (builder) => ({
    getChannels: builder.query<Channel[], void>({
      query: () => ({
        url: `/share/slack/channels`,
      }),
      transformResponse: (response: ChannelRS[], meta, arg) => {
        return response.map((c) => ({ value: c.id, label: `#${c.name}` }));
      },
    }),
    createPreview: builder.query<{ previewUrl: string }, { resourcePath: string }>({
      query: ({ resourcePath }) => ({
        url: `/dashboards/preview`,
        method: 'POST',
        data: { resourcePath },
      }),
    }),
    share: builder.mutation<
      void,
      {
        channels: Channel[];
        message?: string;
        imagePreviewUrl: string;
        dashboardUid: string;
        panelId?: string;
        resourcePath: string;
      }
    >({
      query: (payload) => ({
        url: `/share/${payload.dashboardUid}/slack`,
        method: 'POST',
        data: { ...payload, channelIds: payload.channels.map((c) => c.value) },
      }),
      async onQueryStarted(payload, { dispatch, queryFulfilled }) {
        await queryFulfilled;
        dispatch(
          notifyApp(
            createSuccessNotification(
              'Shared to Slack',
              `Your dashboard has been successfully shared to ${payload.channels.map((c) => c.label).join(' ,')}.`
            )
          )
        );
      },
    }),
  }),
});

export const { useGetChannelsQuery, useCreatePreviewQuery, useShareMutation } = shareToSlackApi;
