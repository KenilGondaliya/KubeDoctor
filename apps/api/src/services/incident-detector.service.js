import { kubernetesEventBus } from "@kubedoctor/kubernetes-observer/src/index.js";

import { detectPodIncident } from "@kubedoctor/diagnostic-engine";

let unsubscribe = null;

export function startIncidentDetector() {
  if (unsubscribe) {
    return;
  }

  const handler = async (event) => {
    if (event.resource.kind !== "Pod") {
      return;
    }

    const detection = detectPodIncident(event.object);

    if (!detection) {
      return;
    }

    console.log(
      `[IncidentDetector] ${detection.type}: ` +
        `${event.resource.namespace}/${event.resource.name}`,
    );

    try {
      const incident = await createDetectedIncident({
        namespace: event.resource.namespace,
        resource: {
          kind: "Pod",
          name: event.resource.name,
        },
        type: detection.type,
        severity: detection.severity,
      });

      kubernetesEventBus.emit("incident-detected", {
        incident,
        detection,
        event,
      });
    } catch (error) {
      console.error("[IncidentDetector] Failed to create incident:", error);
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
