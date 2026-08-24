import * as k8s from "@kubernetes/client-node";
import { kubernetesEventBus } from "./event-bus.js";

const kc = new k8s.KubeConfig();
kc.loadFromDefault();

const coreApi = kc.makeApiClient(k8s.CoreV1Api);

let stopped = false;
let reconnectTimer = null;
let resourceVersion = null;

function normalizePodEvent(type, pod) {
  return {
    type: `POD_${type}`,

    resource: {
      kind: "Pod",
      name: pod.metadata?.name,
      namespace: pod.metadata?.namespace,
      uid: pod.metadata?.uid,
      resourceVersion: pod.metadata?.resourceVersion,
    },
    object: pod,
    timestamp: new Date(),
  };
}

async function initializeResourceVersion(namespace) {
  const response = await coreApi.listNamespacedPod({
    namespace,
  });

  resourceVersion = response.metadata?.resourceVersion ?? null;

  console.log(`[Observer] Initial Pod resourceVersion: ${resourceVersion}`);
}

async function startWatch(namespace) {
  if (stopped) {
    return;
  }

  const watch = new k8s.Watch(kc);

  const query = {
    timeoutSeconds: 300,
  };

  if (resourceVersion) {
    query.resourceVersion = resourceVersion;
  }

  console.log(
    `[Observer] Starting Pod watch for namespace: ${namespace}` +
      ` from resourceVersion=${resourceVersion}`,
  );

  try {
    await watch.watch(
      `/api/v1/namespaces/${namespace}/pods`,
      query,

      (type, pod) => {
        resourceVersion = pod.metadata?.resourceVersion ?? resourceVersion;

        const event = normalizePodEvent(type, pod);

        console.log(
          `[Observer] ${event.type}: ` +
            `${event.resource.namespace}/` +
            `${event.resource.name} ` +
            `(rv=${resourceVersion})`,
        );

        kubernetesEventBus.emit("kubernetes-event", event);
      },

      (error) => {
        if (stopped) {
          return;
        }

        console.log(
          "[Observer] Pod watch ended:",
          error?.message || "normal completion",
        );

        scheduleReconnect(namespace);
      },
    );
  } catch (error) {
    if (stopped) {
      return;
    }

    console.error("[Observer] Pod watch failed:", error);

    scheduleReconnect(namespace);
  }
}

function scheduleReconnect(namespace) {
  if (stopped || reconnectTimer) {
    return;
  }

  reconnectTimer = setTimeout(async () => {
    reconnectTimer = null;

    try {
      await startWatch(namespace);
    } catch (error) {
      console.error("[Observer] Reconnect failed:", error);
    }
  }, 2000);
}

export async function startPodWatcher(namespace = "default") {
  stopped = false;

  await initializeResourceVersion(namespace);

  await startWatch(namespace);
}

export function stopPodWatcher() {
  stopped = true;

  if (reconnectTimer) {
    clearTimeout(reconnectTimer);
    reconnectTimer = null;
  }

  console.log("[Observer] Pod watcher stopped");
}
