const READINESS_FAILURE = "READINESS_FAILURE";

function getConditions(event) {
  return (
    event?.resource?.status?.conditions ||
    event?.resource?.raw?.status?.conditions ||
    []
  );
}

function getContainerStatuses(event) {
  return (
    event?.resource?.status?.containerStatuses ||
    event?.resource?.raw?.status?.containerStatuses ||
    []
  );
}

export function detectReadinessFailure(event) {
  if (event?.resource?.kind !== "Pod") {
    return null;
  }

  const { uid, name, namespace } = event.resource;

  if (!uid || !name) {
    return null;
  }

  const phase =
    event.resource?.status?.phase || event.resource?.raw?.status?.phase || null;

  /*
   * We only care about Pods that actually
   * reached the Running phase.
   *
   * Pending/image-pull/scheduling failures
   * belong to more specific rules.
   */
  if (phase !== "Running") {
    return null;
  }

  const conditions = getConditions(event);

  const readyCondition = conditions.find(
    (condition) => condition?.type === "Ready",
  );

  if (!readyCondition) {
    return null;
  }

  /*
   * Ready=True means the Pod is healthy
   * from Kubernetes' readiness perspective.
   */
  if (readyCondition.status === "True") {
    return null;
  }

  const containerStatuses = getContainerStatuses(event);

  /*
   * A Pod that is not ready because its
   * containers are actively crashing or
   * unable to pull images should be handled
   * by their more specific incident rules.
   */
  const hasSpecificContainerFailure = containerStatuses.some((container) => {
    const waitingReason = container?.state?.waiting?.reason;

    return [
      "CrashLoopBackOff",
      "ImagePullBackOff",
      "ErrImagePull",
      "InvalidImageName",
      "CreateContainerConfigError",
      "CreateContainerError",
    ].includes(waitingReason);
  });

  if (hasSpecificContainerFailure) {
    return null;
  }

  return {
    incidentType: READINESS_FAILURE,

    resourceUid: uid,

    resourceKind: "Pod",

    resourceName: name,

    namespace: namespace || null,

    severity: "HIGH",

    title: `Pod ${name} is not Ready`,

    description:
      `Pod ${name} is running but Kubernetes ` +
      `reports that it is not Ready.`,

    evidence: {
      phase,

      readyCondition: {
        type: readyCondition.type,

        status: readyCondition.status,

        reason: readyCondition.reason || null,

        message: readyCondition.message || null,

        lastTransitionTime: readyCondition.lastTransitionTime || null,
      },

      containerStatuses: containerStatuses.map((container) => ({
        name: container.name || null,

        ready: Boolean(container.ready),

        restartCount: Number(container.restartCount || 0),

        state: container.state || {},
      })),
    },
  };
}

export const READINESS_FAILURE_PRIORITY = 70;
