const LIVENESS_FAILURE = "LIVENESS_FAILURE";

function getContainerStatuses(event) {
  return (
    event?.resource?.status?.containerStatuses ||
    event?.resource?.raw?.status?.containerStatuses ||
    []
  );
}

function getKubernetesEvents(event) {
  return event?.kubernetesEvents || event?.evidence?.events || [];
}

function getRawEvent(item) {
  return item?.resource?.raw || item?.resource || item || {};
}

function isLivenessFailureEvent(item) {
  const rawEvent = getRawEvent(item);

  const reason = String(rawEvent.reason || "").toLowerCase();

  const message = String(rawEvent.message || "").toLowerCase();

  return reason === "unhealthy" && message.includes("liveness probe");
}

export function detectLivenessFailure(event) {
  if (event?.resource?.kind !== "Pod") {
    return null;
  }

  const { uid, name, namespace } = event.resource;

  if (!uid || !name) {
    return null;
  }

  const phase =
    event.resource?.status?.phase || event.resource?.raw?.status?.phase || null;

  if (phase !== "Running") {
    return null;
  }

  const containerStatuses = getContainerStatuses(event);

  if (containerStatuses.length === 0) {
    return null;
  }

  /*
   * IMPORTANT:
   *
   * Do NOT reject LivenessFailure merely
   * because the Pod temporarily reports
   * CrashLoopBackOff.
   *
   * A liveness probe failure itself can cause
   * repeated container restarts and eventually
   * produce CrashLoopBackOff.
   */

  const events = getKubernetesEvents(event);

  const livenessEvent = events.find(isLivenessFailureEvent);

  if (!livenessEvent) {
    return null;
  }

  const rawLivenessEvent = getRawEvent(livenessEvent);

  return {
    incidentType: LIVENESS_FAILURE,

    resourceUid: uid,

    resourceKind: "Pod",

    resourceName: name,

    namespace: namespace || null,

    severity: "HIGH",

    title: `Pod ${name} is failing its liveness probe`,

    description:
      `Pod ${name} is running but Kubernetes ` +
      `reports that its liveness probe is failing.`,

    evidence: {
      phase,

      livenessEvent: {
        reason: rawLivenessEvent.reason || null,

        message: rawLivenessEvent.message || null,

        type: rawLivenessEvent.type || null,

        firstTimestamp: rawLivenessEvent.firstTimestamp || null,

        lastTimestamp: rawLivenessEvent.lastTimestamp || null,

        eventTime: rawLivenessEvent.eventTime || null,

        count: rawLivenessEvent.count || null,
      },

      containerStatuses: containerStatuses.map((container) => ({
        name: container.name || null,

        ready: Boolean(container.ready),

        restartCount: Number(container.restartCount || 0),

        state: container.state || {},

        lastState: container.lastState || {},
      })),
    },
  };
}

export const LIVENESS_FAILURE_PRIORITY = 80;
