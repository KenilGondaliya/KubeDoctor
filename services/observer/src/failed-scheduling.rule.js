const FAILED_SCHEDULING = "FAILED_SCHEDULING";

function getConditions(event) {
  return (
    event?.resource?.status?.conditions ||
    event?.resource?.raw?.status?.conditions ||
    []
  );
}

export function detectFailedScheduling(event) {
  if (event?.resource?.kind !== "Pod") {
    return null;
  }

  const { uid, name, namespace } = event.resource;

  if (!uid || !name) {
    return null;
  }

  const conditions = getConditions(event);

  const scheduledCondition = conditions.find(
    (condition) => condition?.type === "PodScheduled",
  );

  if (
    scheduledCondition?.status !== "False" ||
    scheduledCondition?.reason !== "Unschedulable"
  ) {
    return null;
  }

  return {
    incidentType: FAILED_SCHEDULING,

    resourceUid: uid,

    resourceKind: "Pod",

    resourceName: name,

    namespace: namespace || null,

    severity: "HIGH",

    title: `Pod ${name} failed scheduling`,

    description:
      `Pod ${name} could not be scheduled onto ` +
      `an available Kubernetes node.`,

    evidence: {
      reason: "FailedScheduling",

      scheduledCondition: {
        type: scheduledCondition.type,

        status: scheduledCondition.status,

        reason: scheduledCondition.reason,

        message: scheduledCondition.message || null,

        lastTransitionTime: scheduledCondition.lastTransitionTime || null,
      },

      nodeName: event.resource?.spec?.nodeName || null,
    },
  };
}

export const FAILED_SCHEDULING_PRIORITY = 60;
