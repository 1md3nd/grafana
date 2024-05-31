import { createAction, createReducer } from '@reduxjs/toolkit';
import { remove } from 'lodash';

import { AlertManagerCortexConfig, Receiver, Route } from 'app/plugins/datasource/alertmanager/types';

import initialState from './initialState';

export const addReceiverAction = createAction<Receiver>('receiver/add');
export const updateReceiverAction = createAction<{ name: string; receiver: Receiver }>('receiver/update');
export const deleteReceiverAction = createAction<string>('receiver/delete');

/**
 * This reducer will manage action related to receiver (Contact points) and make sure all operations on the alertmanager
 * configuration happen immutably and only mutate what they need.
 */
export const alertmanagerConfigurationReducer = createReducer<AlertManagerCortexConfig>(initialState, (builder) => {
  builder
    // add a new receiver
    .addCase(addReceiverAction, (draft, { payload: newReceiver }) => {
      const currentReceivers = draft.alertmanager_config.receivers ?? [];

      // check if the name doesn't already exist
      const nameExists = currentReceivers.some((receiver) => receiver.name === newReceiver.name);
      if (nameExists) {
        throw new Error(`Duplicate receiver name ${newReceiver.name}`);
      }

      // add the receiver
      currentReceivers.push(newReceiver);
    })
    // upate an existing receiver
    .addCase(updateReceiverAction, (draft, { payload }) => {
      const { name, receiver } = payload;

      const receivers = draft.alertmanager_config.receivers ?? [];

      const targetIndex = receivers.findIndex((receiver) => receiver.name === name);
      const targetExists = targetIndex > -1;

      // check if the receiver we want to update exists
      if (!targetExists) {
        throw new Error(`Expected receiver ${name} to exist, but did not find it in the config`);
      }

      // check if the new name doesn't already exist
      const nameExists = receivers.some((oldReceiver) => oldReceiver.name === receiver.name);
      if (nameExists) {
        throw new Error(`Duplicate receiver name ${receiver.name}`);
      }

      // overwrite the receiver with the new one
      receivers[targetIndex] = receiver;

      // check if we need to update routes if the contact point was renamed
      // technically we don't have to check for "existingReceiverName" but TypeScript is not able to infer that it can't be undefined
      const renaming = name !== receiver.name;
      const routeTree = draft.alertmanager_config.route;

      if (routeTree && renaming) {
        draft.alertmanager_config.route = renameReceiverInRoute(routeTree, name, receiver.name);
      }
    })
    // delete a receiver from the alertmanager configuration
    .addCase(deleteReceiverAction, (draft, { payload: name }) => {
      remove(draft.alertmanager_config.receivers ?? [], (receiver) => receiver.name === name);
    })
    .addDefaultCase((_state, action) => {
      throw new Error(`Unknown action for receiver reducer: ${action.type}`);
    });
});

// recursive function to rename receivers in all routes (notification policies)
export function renameReceiverInRoute(route: Route, oldName: string, newName: string) {
  const updated: Route = {
    ...route,
  };
  if (updated.receiver === oldName) {
    updated.receiver = newName;
  }
  if (updated.routes) {
    updated.routes = updated.routes.map((route) => renameReceiverInRoute(route, oldName, newName));
  }
  return updated;
}
