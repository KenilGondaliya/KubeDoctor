const IMAGE_PULL_FAILURE = "IMAGE_PULL_FAILURE";

function getContainerStatuses(event) {
  return (
    event?.resource?.status?.containerStatuses ||
    event?.resource?.raw?.status?.containerStatuses ||
    []
  );
}

export function detectImagePullFailure(event) {
  if (event?.resource?.kind !== "Pod") {
    return null;
  }

  const { uid, name, namespace } = event.resource;

  if (!uid || !name) {
    return null;
  }

  const containers = getContainerStatuses(event);

  const waitingContainers = containers.filter((container) => {
    const reason = container?.state?.waiting?.reason;

    return (
      reason === "ImagePullBackOff" ||
      reason === "ErrImagePull" ||
      reason === "InvalidImageName"
    );
  });

  if (waitingContainers.length === 0) {
    return null;
  }

  return {
    incidentType: IMAGE_PULL_FAILURE,

    resourceUid: uid,

    resourceKind: "Pod",

    resourceName: name,

    namespace: namespace || null,

    severity: "HIGH",

    title: `Pod ${name} cannot pull its container image`,

    description:
      `One or more containers in Pod ${name} ` +
      `cannot start because the configured container ` +
      `image could not be pulled.`,

    evidence: {
      reason: "IMAGE_PULL_FAILURE",

      containers: waitingContainers.map((container) => ({
        name: container.name || null,

        waitingReason: container?.state?.waiting?.reason || null,

        waitingMessage: container?.state?.waiting?.message || null,

        image: container.image || null,
      })),
    },
  };
}

export const IMAGE_PULL_FAILURE_PRIORITY = 90;
