import { kubernetesEventBus } from "@kubedoctor/kubernetes-observer";

import { detectPodIncident } from "@kubedoctor/diagnostic-engine";

import { createOrUpdateIncident } from "./incident.service.js";

import { collectIncidentEvidence } from "./evidence.service.js";

import { diagnoseIncident } from "./diagnosis.service.js";

import { diagnosisQueue } from "@kubedoctor/shared/queues";

let unsubscribe = null;

await diagnosisQueue.add(
  "investigate-incident",
  {
    incidentId: incident._id.toString(),
  },
  {
    jobId: `incident:${incident._id}`,
    attempts: 3,
    backoff: {
      type: "exponential",
      delay: 2000,
    },

    removeOnComplete: 100,
    removeOnFail: 500,
  },
);

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
        `[IncidentDetector] ` +
          `${detection.type} detected: ` +
          `${event.resource.namespace}/` +
          `${event.resource.name}`,
      );

      const result = await createOrUpdateIncident({
        namespace: event.resource.namespace,

        resource: {
          kind: "Pod",
          name: event.resource.name,
          uid: event.resource.uid,
        },

        type: detection.type,

        severity: detection.severity,
      });

      const incident = result.incident;

      const isNew = result.isNew;

      console.log(`[IncidentDetector] Incident ${incident._id}`);

      if (!isNew) {
        return;
      }

      // -----------------------------------------
      // Don't immediately re-analyze every
      // repeated Kubernetes event.
      // Only investigate a newly created/open
      // incident for this MVP.
      // -----------------------------------------

      if (incident.status !== "OPEN") {
        return;
      }

      // -----------------------------------------
      // Move incident into investigation state
      // -----------------------------------------

      incident.status = "INVESTIGATING";

      await incident.save();

      // -----------------------------------------
      // Evidence collection
      // -----------------------------------------

      console.log(
        `[Evidence] Collecting evidence ` + `for incident ${incident._id}`,
      );

      const evidence = await collectIncidentEvidence(incident);

      console.log(
        `[Evidence] Collected ` + `${evidence.length} evidence records`,
      );

      // -----------------------------------------
      // Diagnosis
      // -----------------------------------------

      const diagnosis = await diagnoseIncident(incident);

      incident.status = "DIAGNOSED";

      await incident.save();

      console.log(
        `[RCA] ${diagnosis.rootCause.code} ` +
          `confidence=${diagnosis.confidence.score}`,
      );

      kubernetesEventBus.emit("incident-diagnosed", {
        incident,
        diagnosis,
      });
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
