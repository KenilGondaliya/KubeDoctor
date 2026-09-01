const DEPLOYMENT_UNAVAILABLE = "DEPLOYMENT_UNAVAILABLE";

function getConditions(event) {
  return (
    event?.resource?.status?.conditions ||
    event?.resource?.raw?.status?.conditions ||
    []
  );
}

export function detectDeploymentUnavailable(event) {
  if (event?.resource?.kind !== "Deployment") {
    return null;
  }

  const { uid, name, namespace } = event.resource;

  if (!uid || !name) {
    return null;
  }

  const status = event.resource?.status || event.resource?.raw?.status || {};

  const desiredReplicas = Number(status.replicas ?? 0);

  const availableReplicas = Number(status.availableReplicas ?? 0);

  const unavailableReplicas = Number(status.unavailableReplicas ?? 0);

  /*
   * No unavailable replicas means the
   * Deployment is currently available.
   */
  if (unavailableReplicas <= 0 && availableReplicas >= desiredReplicas) {
    return null;
  }

  /*
   * A zero-replica Deployment is not
   * automatically an incident.
   */
  if (desiredReplicas === 0) {
    return null;
  }

  const conditions = getConditions(event);

  const availableCondition = conditions.find(
    (condition) => condition?.type === "Available",
  );

  const progressingCondition = conditions.find(
    (condition) => condition?.type === "Progressing",
  );

  return {
    incidentType: DEPLOYMENT_UNAVAILABLE,

    resourceUid: uid,

    resourceKind: "Deployment",

    resourceName: name,

    namespace: namespace || null,

    severity: unavailableReplicas >= desiredReplicas ? "HIGH" : "MEDIUM",

    title: `Deployment ${name} is unavailable`,

    description:
      `Deployment ${name} has unavailable replicas ` +
      `(${unavailableReplicas}/${desiredReplicas}).`,

    evidence: {
      desiredReplicas,

      availableReplicas,

      unavailableReplicas,

      updatedReplicas: Number(status.updatedReplicas ?? 0),

      availableCondition: availableCondition
        ? {
            status: availableCondition.status,

            reason: availableCondition.reason || null,

            message: availableCondition.message || null,
          }
        : null,

      progressingCondition: progressingCondition
        ? {
            status: progressingCondition.status,

            reason: progressingCondition.reason || null,

            message: progressingCondition.message || null,
          }
        : null,
    },
  };
}

export const DEPLOYMENT_UNAVAILABLE_PRIORITY = 75;
