import { appsApi } from "./client.js";

export async function getDeployments(namespace = "default") {
  const response = await appsApi.listNamespacedDeployment({ namespace });
  return response.items.map((d) => ({
    name: d.metadata?.name,
    namespace: d.metadata?.namespace,
    replicas: d.spec?.replicas ?? 0,
    readyReplicas: d.status?.readyReplicas ?? 0,
    availableReplicas: d.status?.availableReplicas ?? 0,
    updatedReplicas: d.status?.updatedReplicas ?? 0,
    conditions: d.status?.conditions ?? [],
  }));
}
