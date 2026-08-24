import * as k8s from "@kubernetes/client-node";
import { kubernetesEventBus } from "./event-bus.js";

const kc = new k8s.KubeConfig();
kc.loadFromDefault();

const coreApi = kc.makeApiClient(k8s.CoreV1Api);

let watcher;
let stopped = false;

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

async function watchPods(namespace = "default") {
  if (stopped) {
    return;
  }

  watcher = new k8s.Watch(kc);

  console.log(`Starting to watch pods in namespace: ${namespace}`);

  try {
    await watcher.watch(
      `/api/v1/namespaces/${namespace}/pods`,
      {},
      (type, pod) => {
        const event = normalizePodEvent(type, pod);

        console.log(
          `[Observer] ${event.type}: ${event.resource.namespace}/${event.resource.name}`,
        );

        kubernetesEventBus.emit("kubernetes-event", event);
      },
      async (err) => {
        if (stopped) {
          return;
        }

        console.error("[Observer] Pod watch error:", err);
        setTimeout(() => {
          watchPods(namespace).catch((err) => {
            console.error("[Observer] Failed to restart pod watch:", err);
          });
        }, 5000);
      },
    );
  } catch (err) {
    if (stopped) {
      return;
    }

    console.error("[Observer] Watch connection failed:", err);

    setTimeout(() => {
      watchPods(namespace).catch((err) => {
        console.error("[Observer] Failed to restart Pod watcher:", err);
      });
    }, 3000);
  }
}

export async function startPodWatcher(namespace = "default") {
  stopped = false;

  await watchPods(namespace);
}

export function stopPodWatcher() {
  stopped = true;

  try {
    watcher?.stop();
  } catch (err) {
    console.error("[Observer] Failed to stop Pod watcher:", err);
  }

  watcher = undefined;
}
