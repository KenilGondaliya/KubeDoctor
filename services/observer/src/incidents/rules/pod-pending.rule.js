const POD_PENDING =
  "POD_PENDING";


export function detectPodPending(event) {
  if (
    event?.resource?.kind !==
    "Pod"
  ) {
    return null;
  }


  const {
    uid,
    name,
    namespace,
  } = event.resource;


  if (!uid || !name) {
    return null;
  }


  const phase =
    event.resource?.status?.phase;


  /*
   * Only detect an actual Pending Pod.
   */
  if (
    phase !== "Pending"
  ) {
    return null;
  }


  /*
   * If the Pod has a container already waiting
   * because of a more specific failure, let that
   * specialized rule handle it.
   */
  const containerStatuses =
    event.resource
      ?.status
      ?.containerStatuses ||
    [];


  const hasSpecificContainerFailure =
    containerStatuses.some(
      (container) => {
        const reason =
          container?.state
            ?.waiting
            ?.reason;

        return [
          "CrashLoopBackOff",
          "ImagePullBackOff",
          "ErrImagePull",
          "InvalidImageName",
        ].includes(
          reason,
        );
      },
    );


  if (
    hasSpecificContainerFailure
  ) {
    return null;
  }


  return {
    incidentType:
      POD_PENDING,

    resourceUid:
      uid,

    resourceKind:
      "Pod",

    resourceName:
      name,

    namespace:
      namespace || null,

    severity:
      "MEDIUM",

    title:
      `Pod ${name} is Pending`,

    description:
      `Pod ${name} has remained in the Pending ` +
      `phase and has not become ready to run.`,

    evidence: {
      phase:
        "Pending",

      conditions:
        event.resource
          ?.status
          ?.conditions ||
        [],

      containerStatuses:
        containerStatuses.map(
          (container) => ({
            name:
              container.name ||
              null,

            ready:
              Boolean(
                container.ready,
              ),

            state:
              container.state ||
              {},
          }),
        ),

      nodeName:
        event.resource
          ?.spec
          ?.nodeName ||
        null,
    },
  };
}


export const POD_PENDING_PRIORITY =
  40;