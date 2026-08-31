const POD_CRASH_LOOP = "POD_CRASH_LOOP";

function getContainerStatuses(event) {
  return (
    event?.resource?.status?.containerStatuses ||
    event?.resource?.raw?.status?.containerStatuses ||
    []
  );
}

export function detectIncident(event) {
  if (!event?.resource) {
    return null;
  }

  const { kind, uid, name, namespace } = event.resource;

  /*
   * Currently supported incident:
   *
   * Pod → CrashLoopBackOff
   */

  if (kind !== "Pod") {
    return null;
  }

  if (!uid || !name) {
    return null;
  }

  const containerStatuses = getContainerStatuses(event);

  if (containerStatuses.length === 0) {
    return null;
  }

  const crashingContainers = containerStatuses.filter((container) => {
    const waitingReason = container?.state?.waiting?.reason;

    /*
     * Usually CrashLoopBackOff
     * appears here.
     */

    if (waitingReason === "CrashLoopBackOff") {
      return true;
    }

    /*
     * We keep this fallback for
     * normalized historical/container
     * state data.
     */

    const lastTerminationReason = container?.lastState?.terminated?.reason;

    return lastTerminationReason === "CrashLoopBackOff";
  });

  if (crashingContainers.length === 0) {
    return null;
  }

  const restartCount = crashingContainers.reduce(
    (total, container) => total + Number(container?.restartCount || 0),
    0,
  );

  return {
    resourceUid: uid,

    resourceKind: kind,

    resourceName: name,

    namespace: namespace || null,

    incidentType: POD_CRASH_LOOP,

    severity: "HIGH",

    title: `Pod ${name} is in CrashLoopBackOff`,

    description:
      `Pod ${name} has one or more containers ` +
      `repeatedly failing and entering ` +
      `CrashLoopBackOff.`,

    evidence: {
      reason: "CrashLoopBackOff",

      restartCount,

      crashingContainers: crashingContainers.map((container) => ({
        name: container.name || null,

        restartCount: Number(container.restartCount || 0),

        waitingReason: container?.state?.waiting?.reason || null,

        waitingMessage: container?.state?.waiting?.message || null,

        lastTermination: container?.lastState?.terminated
          ? {
              reason: container.lastState.terminated.reason || null,

              exitCode: container.lastState.terminated.exitCode ?? null,

              startedAt: container.lastState.terminated.startedAt || null,

              finishedAt: container.lastState.terminated.finishedAt || null,
            }
          : null,
      })),
    },
  };
}

/**
 * Returns the identity used for resolving
 * CrashLoop incidents.
 */
export function getIncidentKey(event) {
  if (event?.resource?.kind !== "Pod") {
    return null;
  }

  if (!event.resource.uid) {
    return null;
  }

  return {
    resourceUid: event.resource.uid,

    incidentType: POD_CRASH_LOOP,
  };
}

/**
 * Determines whether the current Pod state
 * is no longer in CrashLoopBackOff.
 */
export function isCrashLoopResolved(event) {
  if (event?.resource?.kind !== "Pod") {
    return false;
  }

  const statuses = getContainerStatuses(event);

  if (statuses.length === 0) {
    return false;
  }

  return statuses.every((container) => {
    const waitingReason = container?.state?.waiting?.reason;

    return waitingReason !== "CrashLoopBackOff";
  });
}
