import { coreApi } from './client.js';

export async function getServices(namespace = 'default') {
  const response = await coreApi.listNamespacedService({ namespace });
  return response.items.map(s => ({
    name: s.metadata?.name,
    namespace: s.metadata?.namespace,
    selector: s.spec?.selector ?? {},
    ports: s.spec?.ports ?? {},
    type: s.spec?.type
  }));
}

export async function getEndpoints(namespace = 'default') {
  const response = await coreApi.listNamespacedEndpoints({ namespace });
  return response.items.map(e => ({
    name: e.metadata?.name,
    namespace: e.metadata?.namespace,
    subsets: e.subsets ?? []
  }));
}
