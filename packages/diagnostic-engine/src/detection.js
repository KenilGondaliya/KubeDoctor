function getContainerReasons(pod) {
  return (pod.status?.containerStatuses || []).flatMap((container) => {
    const reasons = [];
    const waitingReason = container.state?.waiting?.reason;

    if (waitingReason) {
      reasons.push(waitingReason);
    }

    const terminatedReason = container.state?.terminated?.reason;

    if (terminatedReason) {
      reasons.push(terminatedReason);
    }

    const previousTerminatedReason = container.lastState?.terminated?.reason;

    if (previousTerminatedReason) {
      reasons.push(previousTerminatedReason);
    }

    return reasons;
  });
}

export function detectPodIncident(pod) {
  if (!pod) {
    return null;
  }

  const containerStatuses = pod.status?.containerStatuses ?? [];

  const reasons = containerStatuses.flatMap((container) => {
    const result = [];

    const waitingReason = container.state?.waiting?.reason;

    if (waitingReason) {
      result.push(waitingReason);
    }

    const terminatedReason = container.state?.terminated?.reason;

    if (terminatedReason) {
      result.push(terminatedReason);
    }

    const previousTerminatedReason = container.lastState?.terminated?.reason;

    if (previousTerminatedReason) {
      result.push(previousTerminatedReason);
    }

    return result;
  });

  if (reasons.includes("CrashLoopBackOff")) {
    return {
      type: "CRASH_LOOP_BACKOFF",
      severity: "HIGH",
    };
  }

  if (
    reasons.includes("ImagePullBackOff") ||
    reasons.includes("ErrImagePull")
  ) {
    return {
      type: "IMAGE_PULL_FAILURE",
      severity: "HIGH",
    };
  }

  if (pod.status?.phase === "Pending") {
    return {
      type: "POD_PENDING",
      severity: "MEDIUM",
    };
}

  const probeFailure = containerStatuses.some((container) => {
    const waitingReason = container.state?.waiting?.reason;

    return (
      waitingReason === "CrashLoopBackOff" || waitingReason === "Unhealthy"
    );
  });

  if (probeFailure) {
    return {
      type: "PROBE_FAILURE",
      severity: "MEDIUM",
    };
  }

  return null;
}
