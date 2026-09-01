const DEPLOYMENT_UNAVAILABLE = "DEPLOYMENT_UNAVAILABLE";

function getStatus(event) {
  return event?.resource?.status || event?.resource?.raw?.status || {};
}

function getSpec(event) {
  return event?.resource?.spec || event?.resource?.raw?.spec || {};
}

function getConditions(event) {
  return (
    event?.resource?.status?.conditions ||
    event?.resource?.raw?.status?.conditions ||
    []
  );
}

function findCondition(conditions, type) {
  return conditions.find((condition) => condition?.type === type);
}

export function detectDeploymentUnavailable(event) {
  if (event?.resource?.kind !== "Deployment") {
    return null;
  }

  const { uid, name, namespace } = event.resource;

  if (!uid || !name) {
    return null;
  }

  const status = getStatus(event);

  const spec = getSpec(event);

  const conditions = getConditions(event);

  const desiredReplicas = Number(status.replicas ?? spec.replicas ?? 0);

  const availableReplicas = Number(status.availableReplicas ?? 0);

  const readyReplicas = Number(status.readyReplicas ?? availableReplicas);

  const unavailableReplicas = Number(
    status.unavailableReplicas ??
      Math.max(desiredReplicas - availableReplicas, 0),
  );

  /*
   * -----------------------------------------
   * Available condition
   * -----------------------------------------
   */
  const availableCondition = findCondition(conditions, "Available");

  /*
   * -----------------------------------------
   * Progressing condition
   * -----------------------------------------
   */
  const progressingCondition = findCondition(conditions, "Progressing");

  const explicitlyUnavailable = availableCondition?.status === "False";

  const replicasUnavailable =
    desiredReplicas > 0 && availableReplicas < desiredReplicas;

  const explicitlyStalled =
    progressingCondition?.status === "False" &&
    (progressingCondition.reason === "ProgressDeadlineExceeded" ||
      progressingCondition.reason === "ReplicaSetUpdated" ||
      progressingCondition.reason === "ProgressDeadlineExceeded");

  /*
   * If Kubernetes explicitly says the
   * Deployment is unavailable, detect it.
   */
  if (!explicitlyUnavailable && !replicasUnavailable && !explicitlyStalled) {
    return null;
  }

  /*
   * A Deployment with zero desired replicas
   * should not be considered unavailable.
   */
  if (desiredReplicas === 0) {
    return null;
  }

  /*
   * -----------------------------------------
   * Severity
   * -----------------------------------------
   */
  const severity =
    availableReplicas === 0 && desiredReplicas > 0 ? "HIGH" : "MEDIUM";

  /*
   * -----------------------------------------
   * Determine primary availability reason
   * -----------------------------------------
   */
  let reason = "MinimumReplicasUnavailable";

  if (progressingCondition?.reason === "ProgressDeadlineExceeded") {
    reason = "ProgressDeadlineExceeded";
  } else if (availableCondition?.reason) {
    reason = availableCondition.reason;
  }

  return {
    incidentType: DEPLOYMENT_UNAVAILABLE,

    resourceUid: uid,

    resourceKind: "Deployment",

    resourceName: name,

    namespace: namespace || null,

    severity,

    title: `Deployment ${name} is unavailable`,

    description:
      `Deployment ${name} has unavailable replicas ` +
      `(${unavailableReplicas}/${desiredReplicas}).`,

    evidence: {
      desiredReplicas,

      availableReplicas,

      readyReplicas,

      unavailableReplicas,

      updatedReplicas: Number(status.updatedReplicas ?? 0),

      availabilityReason: reason,

      availableCondition: availableCondition
        ? {
            status: availableCondition.status,

            reason: availableCondition.reason || null,

            message: availableCondition.message || null,

            lastTransitionTime: availableCondition.lastTransitionTime || null,
          }
        : null,

      progressingCondition: progressingCondition
        ? {
            status: progressingCondition.status,

            reason: progressingCondition.reason || null,

            message: progressingCondition.message || null,

            lastTransitionTime: progressingCondition.lastTransitionTime || null,
          }
        : null,
    },
  };
}

export const DEPLOYMENT_UNAVAILABLE_PRIORITY = 75;
