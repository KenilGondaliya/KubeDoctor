const OOM_KILLED = "OOM_KILLED";

function getContainerStatuses(event) {
  return (
    event?.resource?.status?.containerStatuses ||
    event?.resource?.raw?.status?.containerStatuses ||
    []
  );
}

export const OOM_KILLED_PRIORITY = 100;

export function detectOomKilled(event) {
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

  const oomContainers = containers.filter((container) => {
    const currentReason = container?.state?.terminated?.reason;

    const previousReason = container?.lastState?.terminated?.reason;

    return currentReason === "OOMKilled" || previousReason === "OOMKilled";
  });

  if (oomContainers.length === 0) {
    return null;
  }

  return {
    incidentType: OOM_KILLED,

    resourceUid: uid,

    resourceKind: "Pod",

    resourceName: name,

    namespace: namespace || null,

    severity: "CRITICAL",

    title: `Pod ${name} container was OOMKilled`,

    description:
      `One or more containers in Pod ${name} ` +
      `were terminated because of memory exhaustion.`,

    evidence: {
      reason: "OOMKilled",

      containers: oomContainers.map((container) => ({
        name: container.name || null,

        restartCount: Number(container.restartCount || 0),

        currentTermination: container?.state?.terminated
          ? {
              reason: container.state.terminated.reason || null,

              exitCode: container.state.terminated.exitCode ?? null,

              signal: container.state.terminated.signal ?? null,

              startedAt: container.state.terminated.startedAt || null,

              finishedAt: container.state.terminated.finishedAt || null,
            }
          : null,

        previousTermination: container?.lastState?.terminated
          ? {
              reason: container.lastState.terminated.reason || null,

              exitCode: container.lastState.terminated.exitCode ?? null,

              signal: container.lastState.terminated.signal ?? null,

              startedAt: container.lastState.terminated.startedAt || null,

              finishedAt: container.lastState.terminated.finishedAt || null,
            }
          : null,
      })),
    },
  };
}
