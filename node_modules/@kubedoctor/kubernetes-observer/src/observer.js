import { startPodWatcher } from "./pod.watcher.js";
import { kubernetesEventBus } from "./event-bus.js";

export async function startObserver({ namespace = "default", onEvent } = {}) {
  if (onEvent) {
    kubernetesEventBus.on("kubernetes-event", onEvent);
  }

  console.log(
    `[Observer] Starting Kubernetes observer for namespace: ${namespace}`,
  );

  await startPodWatcher(namespace);
}

export async function subscribeToKubernetesEvents(handler) {
  kubernetesEventBus.on("kubernetes-event", handler);

  return () => {
    kubernetesEventBus.off("kubernetes-event", handler);
  };
}
