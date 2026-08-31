export function scoreHypothesis({ hypothesis, evidence }) {
  let score = hypothesis.baseScore;

  const reasons = [];

  for (const item of evidence) {
    /*
     * Application crash
     */

    if (hypothesis.cause === "APPLICATION_CRASH") {
      if (item.type === "CONTAINER" && item.reason === "CrashLoopBackOff") {
        score += 0.4;

        reasons.push("Container is repeatedly entering CrashLoopBackOff.");
      }

      if (item.type === "CONTAINER" && item.exitCode === 1) {
        score += 0.15;

        reasons.push("Previous container exited with code 1.");
      }

      if (item.type === "CONTAINER" && item.restartCount > 0) {
        score += Math.min(0.2, item.restartCount / 1000);

        reasons.push(`Container has restarted ${item.restartCount} times.`);
      }

      if (item.type === "LOG" && item.logs) {
        score += 0.1;

        reasons.push(
          "Container logs provide application-level failure context.",
        );
      }
    }

    /*
     * Node failure.
     */

    if (hypothesis.cause === "NODE_FAILURE") {
      if (item.type === "NODE" && item.nodeName) {
        reasons.push(`Pod is running on node ${item.nodeName}.`);
      }
    }

    /*
     * Resource exhaustion.
     */

    if (hypothesis.cause === "RESOURCE_EXHAUSTION") {
      if (item.type === "CONTAINER" && item.terminationReason === "OOMKilled") {
        score += 0.7;

        reasons.push("Container termination reason is OOMKilled.");
      }
    }

    /*
     * Configuration failure.
     */

    if (hypothesis.cause === "CONFIGURATION_FAILURE") {
      if (
        item.type === "KUBERNETES_EVENT" &&
        (item.reason === "FailedMount" ||
          item.reason === "Failed" ||
          item.reason === "Unhealthy")
      ) {
        score += 0.3;

        reasons.push(
          `Kubernetes event ${item.reason} may indicate configuration or startup failure.`,
        );
      }
    }
  }

  return {
    ...hypothesis,

    score: Math.min(score, 1),

    reasons,
  };
}
