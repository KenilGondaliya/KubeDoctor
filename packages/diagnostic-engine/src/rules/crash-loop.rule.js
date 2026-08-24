import { confidenceFromWeight } from "../scoring/confidence.js";

export function diagnoseCrashLoop({
  pod,
  previousLogs = "",
  currentLogs = "",
  events = [],
}) {
  if (!pod) return null;

  const containers = pod.containers ?? [];
  const crashContainer =
    containers.find((c) => {
      const state = c.state;
      return (
        state?.waiting?.reason === "CrashLoopBackOff" ||
        state?.waiting?.reason === "CrashLoopBackOff"
      );
    }) ?? containers.find((c) => c.restartCount > 0);

  if (!crashContainer && pod.phase !== "Failed") return null;

  const evidence = [];
  let weight = 20;

  evidence.push({
    type: "POD_STATE",
    summary: `Pod is ${crashContainer?.state?.waiting?.reason ?? pod.phase}`,
    weight: 20,
  });

  if ((crashContainer?.restartCount ?? 0) > 0) {
    evidence.push({
      type: "RESTART_COUNT",
      summary: `Container restarted ${crashContainer.restartCount} times`,
      weight: 15,
    });
    weight += 15;
  }

  if (
    /connection refused|ECONNREFUSED|connect.*failed/i.test(
      previousLogs + "\n" + currentLogs,
    )
  ) {
    evidence.push({
      type: "LOG",
      summary: "Logs contain a connection failure",
      weight: 25,
    });
    weight += 25;
  }

  const oom = containers.some(
    (c) =>
      c.lastState?.terminated?.reason === "OOMKilled" ||
      c.state?.terminated?.reason === "OOMKilled",
  );
  if (oom) {
    evidence.push({
      type: "CONTAINER_STATE",
      summary: "Container was OOMKilled",
      weight: 40,
    });
    weight += 40;
    return {
      rootCause: "CONTAINER_OUT_OF_MEMORY",
      confidence: confidenceFromWeight(weight),
      evidence,
      recommendations: [
        {
          action: "INSPECT_RESOURCE_LIMITS",
          risk: "LOW",
          reason:
            "Check memory request/limit and recent memory usage before changing resources.",
        },
      ],
    };
  }

  if (
    /probe|health/i.test(
      events.map((e) => `${e.reason} ${e.message}`).join("\n"),
    )
  ) {
    evidence.push({
      type: "EVENT",
      summary: "Recent events indicate a health/probe failure",
      weight: 20,
    });
    weight += 20;
    return {
      rootCause: "PROBE_OR_STARTUP_HEALTH_FAILURE",
      confidence: confidenceFromWeight(weight),
      evidence,
      recommendations: [
        {
          action: "INSPECT_PROBES",
          risk: "LOW",
          reason:
            "Inspect liveness/readiness/startup probe configuration and application startup logs.",
        },
      ],
    };
  }

  if (
    /connection refused|ECONNREFUSED/i.test(previousLogs + "\n" + currentLogs)
  ) {
    return {
      rootCause: "DEPENDENCY_UNAVAILABLE",
      confidence: confidenceFromWeight(weight),
      evidence,
      recommendations: [
        {
          action: "INSPECT_DEPENDENCIES",
          risk: "LOW",
          reason:
            "Inspect service endpoints and dependent workloads referenced by the application.",
        },
      ],
    };
  }

  return {
    rootCause: "APPLICATION_OR_CONFIGURATION_FAILURE",
    confidence: confidenceFromWeight(weight),
    evidence,
    recommendations: [
      {
        action: "INSPECT_PREVIOUS_LOGS",
        risk: "LOW",
        reason:
          "Inspect previous container logs and exit code to identify the application failure.",
      },
    ],
  };
}
