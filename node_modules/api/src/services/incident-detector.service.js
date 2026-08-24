import { kubernetesEventBus } from "@kubedoctor/kubernetes-observer/src/index.js";

import { detectPodIncident } from "@kubedoctor/diagnostic-engine";

import { createOrUpdateIncident } from "./incident.service.js";

let unsubscribe = null;

export function startIncidentDetector() {
  if (unsubscribe) {
    return;
  }

  const handler = async (event) => {
    if (event.resource?.kind !== "Pod") {
      return;
    }

    try {
      const detection = detectPodIncident(event.object);

      if (!detection) {
        return;
      }

      console.log(
        `[IncidentDetector] ${detection.type} detected: ` +
          `${event.resource.namespace}/${event.resource.name}`,
      );

      const incident = await createOrUpdateIncident({
        namespace: event.resource.namespace,

        resource: {
          kind: "Pod",
          name: event.resource.name,
          uid: event.resource.uid,
        },

        type: detection.type,
        severity: detection.severity,
      });

      kubernetesEventBus.emit("incident-detected", {
        incident,
        detection,
        sourceEvent: event,
      });

      console.log(`[IncidentDetector] Incident ${incident._id}`);
    } catch (error) {
      console.error("[IncidentDetector] Failed:", error);
    }
  };

  kubernetesEventBus.on("kubernetes-event", handler);

  unsubscribe = () => {
    kubernetesEventBus.off("kubernetes-event", handler);

    unsubscribe = null;
  };

  console.log("[IncidentDetector] Started");
}

export function stopIncidentDetector() {
  unsubscribe?.();
}
