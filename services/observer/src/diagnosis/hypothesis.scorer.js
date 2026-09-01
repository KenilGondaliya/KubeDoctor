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

    /*
     * =========================================
     * IMAGE NOT FOUND
     * =========================================
     */
    if (hypothesis.cause === "IMAGE_NOT_FOUND") {
      if (
        item.type === "KUBERNETES_EVENT" &&
        (item.reason === "ErrImagePull" || item.reason === "ImagePullBackOff")
      ) {
        score += 0.6;

        reasons.push(
          `Kubernetes event ${item.reason} indicates image pull failure.`,
        );
      }
    }

    /*
     * =========================================
     * INVALID IMAGE REFERENCE
     * =========================================
     */
    if (hypothesis.cause === "INVALID_IMAGE_REFERENCE") {
      if (
        item.type === "KUBERNETES_EVENT" &&
        item.reason === "InvalidImageName"
      ) {
        score += 0.7;

        reasons.push("Kubernetes reported an invalid image name.");
      }
    }

    /*
     * =========================================
     * REGISTRY AUTHENTICATION
     * =========================================
     */
    if (hypothesis.cause === "IMAGE_REGISTRY_AUTHENTICATION") {
      if (
        item.type === "KUBERNETES_EVENT" &&
        typeof item.message === "string" &&
        (item.message.toLowerCase().includes("unauthorized") ||
          item.message.toLowerCase().includes("authentication required"))
      ) {
        score += 0.7;

        reasons.push("Registry authentication failure detected.");
      }
    }

    /*
     * =========================================
     * REGISTRY NETWORK FAILURE
     * =========================================
     */
    if (hypothesis.cause === "REGISTRY_NETWORK_FAILURE") {
      if (
        item.type === "KUBERNETES_EVENT" &&
        typeof item.message === "string" &&
        (item.message.toLowerCase().includes("timeout") ||
          item.message.toLowerCase().includes("connection refused") ||
          item.message.toLowerCase().includes("no route"))
      ) {
        score += 0.5;

        reasons.push(
          "Container registry network connectivity failure detected.",
        );
      }
    }

    /*
     * =========================================
     * SCHEDULING FAILURE
     * =========================================
     */
    if (hypothesis.cause === "SCHEDULING_FAILURE") {
      if (
        item.type === "KUBERNETES_EVENT" &&
        item.reason === "FailedScheduling"
      ) {
        score += 0.6;

        reasons.push("Kubernetes scheduler reported FailedScheduling.");
      }
    }

    /*
     * =========================================
     * RESOURCE CONSTRAINT
     * =========================================
     */
    if (hypothesis.cause === "RESOURCE_CONSTRAINT") {
      if (
        item.type === "KUBERNETES_EVENT" &&
        typeof item.message === "string" &&
        (item.message.toLowerCase().includes("insufficient cpu") ||
          item.message.toLowerCase().includes("insufficient memory") ||
          item.message.toLowerCase().includes("insufficient"))
      ) {
        score += 0.65;

        reasons.push("Scheduler reported insufficient cluster resources.");
      }
    }

    /*
     * =========================================
     * NODE SELECTOR MISMATCH
     * =========================================
     */
    if (hypothesis.cause === "NODE_SELECTOR_MISMATCH") {
      if (
        item.type === "KUBERNETES_EVENT" &&
        typeof item.message === "string" &&
        item.message.toLowerCase().includes("didn't match node selector")
      ) {
        score += 0.6;

        reasons.push(
          "Scheduler reported that nodes did not match the Pod node selector.",
        );
      }
    }

    /*
     * =========================================
     * AFFINITY CONSTRAINT
     * =========================================
     */
    if (hypothesis.cause === "AFFINITY_CONSTRAINT") {
      if (
        item.type === "KUBERNETES_EVENT" &&
        typeof item.message === "string" &&
        (item.message.toLowerCase().includes("affinity") ||
          item.message.toLowerCase().includes("anti-affinity"))
      ) {
        score += 0.5;

        reasons.push("Scheduler evidence indicates an affinity constraint.");
      }
    }

    /*
     * =========================================
     * APPLICATION NOT READY
     * =========================================
     */
    if (hypothesis.cause === "APPLICATION_NOT_READY") {
      if (
        item.type === "KUBERNETES_EVENT" &&
        (item.reason === "Unhealthy" || item.reason === "Failed")
      ) {
        score += 0.35;

        reasons.push(`Kubernetes reported ${item.reason} for the Pod.`);
      }
    }

    /*
     * =========================================
     * READINESS PROBE FAILURE
     * =========================================
     */
    if (hypothesis.cause === "READINESS_PROBE_FAILURE") {
      if (
        item.type === "KUBERNETES_EVENT" &&
        typeof item.message === "string" &&
        (item.message.toLowerCase().includes("readiness probe") ||
          item.message.toLowerCase().includes("readiness"))
      ) {
        score += 0.65;

        reasons.push(
          "Kubernetes evidence indicates a readiness probe failure.",
        );
      }
    }

    /*
     * =========================================
     * DEPENDENCY UNAVAILABLE
     * =========================================
     */
    if (hypothesis.cause === "DEPENDENCY_UNAVAILABLE") {
      if (
        item.type === "KUBERNETES_EVENT" &&
        typeof item.message === "string" &&
        (item.message.toLowerCase().includes("connection refused") ||
          item.message.toLowerCase().includes("timeout"))
      ) {
        score += 0.4;

        reasons.push(
          "Evidence suggests the application may be unable to reach a required dependency.",
        );
      }
    }

    /*
     * =========================================
     * APPLICATION HUNG
     * =========================================
     */
    if (hypothesis.cause === "APPLICATION_HUNG") {
      if (
        item.type === "KUBERNETES_EVENT" &&
        typeof item.message === "string" &&
        item.message.toLowerCase().includes("liveness probe")
      ) {
        score += 0.45;

        reasons.push("Kubernetes reported a liveness probe failure.");
      }
    }

    /*
     * =========================================
     * LIVENESS PROBE MISCONFIGURATION
     * =========================================
     */
    if (hypothesis.cause === "LIVENESS_PROBE_MISCONFIGURATION") {
      if (
        item.type === "KUBERNETES_EVENT" &&
        typeof item.message === "string" &&
        item.message.toLowerCase().includes("liveness probe")
      ) {
        score += 0.2;

        reasons.push("The workload is failing its configured liveness probe.");
      }
    }

    /*
     * =========================================
     * APPLICATION DEADLOCK
     * =========================================
     */
    if (hypothesis.cause === "APPLICATION_DEADLOCK") {
      if (
        item.type === "KUBERNETES_EVENT" &&
        typeof item.message === "string" &&
        (item.message.toLowerCase().includes("timeout") ||
          item.message.toLowerCase().includes("timed out"))
      ) {
        score += 0.35;

        reasons.push("The liveness check appears to be timing out.");
      }
    }

    if (hypothesis.cause === "APPLICATION_HUNG") {
      if (
        item.type === "KUBERNETES_EVENT" &&
        typeof item.message === "string" &&
        item.message.toLowerCase().includes("liveness probe")
      ) {
        score += 0.45;

        reasons.push("Kubernetes reported a liveness probe failure.");
      }
    }

    if (hypothesis.cause === "LIVENESS_PROBE_MISCONFIGURATION") {
      if (
        item.type === "KUBERNETES_EVENT" &&
        typeof item.message === "string" &&
        item.message.toLowerCase().includes("liveness probe")
      ) {
        score += 0.2;

        reasons.push("The workload is failing its configured liveness probe.");
      }
    }
  }

  return {
    ...hypothesis,

    score: Math.min(score, 1),

    reasons,
  };
}
