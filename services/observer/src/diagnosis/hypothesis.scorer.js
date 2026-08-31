export function scoreHypothesis({ hypothesis, evidence }) {
  let score = hypothesis.baseScore;

  const reasons = [];

  for (const item of evidence) {
    /*
     * =========================================
     * APPLICATION CRASH
     * =========================================
     */
    if (hypothesis.cause === "APPLICATION_CRASH") {
      /*
       * CrashLoopBackOff is strong evidence
       * that the container is repeatedly failing.
       */
      if (item.type === "CONTAINER" && item.reason === "CrashLoopBackOff") {
        score += 0.4;

        reasons.push("Container is repeatedly entering CrashLoopBackOff.");
      }

      /*
       * Exit code 1 indicates that the previous
       * container process terminated unsuccessfully.
       */
      if (item.type === "CONTAINER" && item.exitCode === 1) {
        score += 0.15;

        reasons.push("Previous container exited with code 1.");
      }

      /*
       * Repeated restarts strengthen the
       * application crash hypothesis.
       */
      if (item.type === "CONTAINER" && item.restartCount > 0) {
        score += Math.min(0.2, item.restartCount / 1000);

        reasons.push(`Container has restarted ${item.restartCount} times.`);
      }

      /*
       * Logs provide additional application-level
       * context.
       */
      if (
        item.type === "LOG" &&
        typeof item.logs === "string" &&
        item.logs.length > 0
      ) {
        score += 0.1;

        reasons.push(
          "Container logs provide application-level failure context.",
        );
      }
    }

    /*
     * =========================================
     * RESOURCE EXHAUSTION
     * =========================================
     */
    if (hypothesis.cause === "RESOURCE_EXHAUSTION") {
      /*
       * OOMKilled is strong direct evidence
       * of memory-related container termination.
       */
      if (item.type === "CONTAINER" && item.terminationReason === "OOMKilled") {
        score += 0.7;

        reasons.push("Container was terminated by OOMKilled.");
      }

      /*
       * Kubernetes events can provide supporting
       * memory-related signals.
       */
      if (
        item.type === "KUBERNETES_EVENT" &&
        (item.reason === "OOMKilling" || item.reason === "Killing")
      ) {
        score += 0.15;

        reasons.push(
          `Kubernetes event ${item.reason} supports memory-related failure.`,
        );
      }
    }

    /*
     * =========================================
     * NODE FAILURE
     * =========================================
     */
    if (hypothesis.cause === "NODE_FAILURE") {
      if (item.type === "NODE" && item.nodeName) {
        /*
         * Merely knowing the node name does NOT
         * prove node failure, so we don't add
         * score here.
         */
        reasons.push(`Pod is running on node ${item.nodeName}.`);
      }
    }

    /*
     * =========================================
     * CONFIGURATION FAILURE
     * =========================================
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

    /*
     * =========================================
     * MEMORY LIMIT TOO LOW
     * =========================================
     */
    if (hypothesis.cause === "MEMORY_LIMIT_TOO_LOW") {
      /*
       * We intentionally do not increase the
       * score yet.
       *
       * OOMKilled alone proves memory exhaustion,
       * but does not prove that the configured
       * memory limit was incorrectly sized.
       *
       * We will add this when evidence contains
       * resource requests/limits and memory usage.
       */
    }

    /*
     * =========================================
     * MEMORY LEAK
     * =========================================
     */
    if (hypothesis.cause === "MEMORY_LEAK") {
      /*
       * Not enough evidence yet.
       *
       * A memory leak requires historical memory
       * usage or metrics showing progressive growth.
       */
    }

    /*
     * =========================================
     * NODE MEMORY PRESSURE
     * =========================================
     */
    if (hypothesis.cause === "NODE_MEMORY_PRESSURE") {
      /*
       * Not enough evidence yet.
       *
       * We need Node memory-pressure conditions
       * or metrics before increasing this score.
       */
    }
  }

  return {
    ...hypothesis,

    score: Math.min(score, 1),

    reasons,
  };
}
