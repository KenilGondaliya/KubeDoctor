const POD_CRASH_LOOP = "POD_CRASH_LOOP";
export const POD_CRASH_LOOP_PRIORITY = 50;

function getContainerStatuses(event) {
  return (
    event?.resource?.status?.containerStatuses ||
    event?.resource?.raw?.status?.containerStatuses ||
    []
  );
}

export function detectPodCrashLoop(event) {
  if (hasLivenessProbeFailure(event)) {
    return null;
  }
  if (event?.resource?.kind !== "Pod") {
    return null;
  }

  const { uid, name, namespace } = event.resource;

  if (!uid || !name) {
    return null;
  }

  const containers = getContainerStatuses(event);

  if (containers.length === 0) {
    return null;
  }

  const crashingContainers = containers.filter((container) => {
    const waitingReason = container?.state?.waiting?.reason;

    const lastTerminationReason = container?.lastState?.terminated?.reason;

    return (
      waitingReason === "CrashLoopBackOff" ||
      lastTerminationReason === "CrashLoopBackOff"
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
    incidentType: POD_CRASH_LOOP,

    resourceUid: uid,

    resourceKind: "Pod",

    resourceName: name,

    namespace: namespace || null,

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

export function isPodCrashLoopResolved(event) {
  if (event?.resource?.kind !== "Pod") {
    return false;
  }

  const containers = getContainerStatuses(event);

  /*
   * Missing state does not mean healthy.
   */
  if (containers.length === 0) {
    return false;
  }

  return containers.every((container) => {
    const waitingReason = container?.state?.waiting?.reason;

    return waitingReason !== "CrashLoopBackOff";
  });
}

function hasLivenessProbeFailure(event) {
  const events = event?.kubernetesEvents || [];

  return events.some((item) => {
    const rawEvent = item?.resource?.raw || item?.resource || item || {};

    const reason = String(rawEvent.reason || "").toLowerCase();

    const message = String(rawEvent.message || "").toLowerCase();

    return reason === "unhealthy" && message.includes("liveness probe");
  });
}

export { POD_CRASH_LOOP };
