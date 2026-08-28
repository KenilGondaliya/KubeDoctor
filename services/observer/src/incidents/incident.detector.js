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
   * Current first rule:
   * detect CrashLoopBackOff on Pods.
   */

  if (kind !== "Pod") {
    return null;
  }

  const containerStatuses = getContainerStatuses(event);

  if (containerStatuses.length === 0) {
    return null;
  }

  const crashingContainers = containerStatuses.filter((container) => {
    const waitingReason = container?.state?.waiting?.reason;

    const lastTerminatedReason = container?.lastState?.terminated?.reason;

    return (
      waitingReason === "CrashLoopBackOff" ||
      lastTerminatedReason === "CrashLoopBackOff"
    );
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
      `Pod ${name} has one or more containers repeatedly ` +
      `failing and entering CrashLoopBackOff.`,

    evidence: {
      reason: "CrashLoopBackOff",

      restartCount,

      crashingContainers: crashingContainers.map((container) => ({
        name: container.name || null,

        restartCount: container.restartCount || 0,

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
