import { coreApi } from "./client.js";

function normalizePod(pod) {
  const containers = pod.status?.containerStatuses ?? [];
  const statuses = containers.map((c) => ({
    name: c.name,
    ready: c.ready,
    restartCount: c.restartCount,
    image: c.image,
    state: c.state,
    lastState: c.lastState,
  }));
  return {
    name: pod.metadata?.name,
    namespace: pod.metadata?.namespace,
    phase: pod.status?.phase,
    node: pod.spec?.nodeName,
    podIp: pod.status?.podIP,
    labels: pod.metadata?.labels ?? {},
    createdAt: pod.metadata?.creationTimestamp,
    conditions: pod.status?.conditions ?? [],
    containers: statuses,
  };
}

export async function getPods(namespace = "default") {
  const response = await coreApi.listNamespacedPod({ namespace });
  return response.items.map(normalizePod);
}

export async function getPod(namespace, name) {
  const response = await coreApi.readNamespacedPod({ name, namespace });
  return normalizePod(response);
}

export async function getPodLogs(namespace, name, container, previous = false) {
  try {
    return await coreApi.readNamespacedPodLog({
      name,
      namespace,
      container,
      previous,
      tailLines: 200,
    });
  } catch (error) {
    return `Unable to read logs: ${error.message}`;
  }
}
