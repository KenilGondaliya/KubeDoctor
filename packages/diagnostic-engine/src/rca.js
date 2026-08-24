function calculateConfidence(score) {
  const normalized = Math.max(0, Math.min(score, 100));

  const score01 = normalized / 100;

  let level = "LOW";

  if (score01 >= 0.85) {
    level = "VERY_HIGH";
  } else if (score01 >= 0.65) {
    level = "HIGH";
  } else if (score01 >= 0.4) {
    level = "MEDIUM";
  }

  return {
    score: score01,
    level,
  };
}

function findEvidence(evidence, type) {
  return evidence.filter((item) => item.type === type);
}

function getPodState(evidence) {
  const item = evidence.find((entry) => entry.type === "POD_STATE");

  return item?.data;
}

function getLogs(evidence) {
  return findEvidence(evidence, "POD_LOGS");
}

function getEvents(evidence) {
  const item = evidence.find((entry) => entry.type === "KUBERNETES_EVENTS");

  return item?.data?.events ?? [];
}

function hasKeyword(text, keywords) {
  const normalized = String(text || "").toLowerCase();

  return keywords.some((keyword) => normalized.includes(keyword.toLowerCase()));
}
function diagnoseOomKilled(podState, logs) {
  if (!podState) {
    return null;
  }

  const containers = podState.containers ?? [];

  const oomKilled = containers.some(
    (container) =>
      container.state?.terminated?.reason === "OOMKilled" ||
      container.lastState?.terminated?.reason === "OOMKilled",
  );

  if (!oomKilled) {
    return null;
  }

  return {
    code: "OOM_KILLED",

    title: "Container terminated because of memory exhaustion",

    description:
      "The container was terminated by Kubernetes " +
      "because it exceeded its available memory.",

    score: 95,

    recommendation: {
      action: "INVESTIGATE_MEMORY_USAGE",

      description:
        "Inspect memory usage, container memory limits, " +
        "and application memory behavior.",

      risk: "LOW",
    },
  };
}

function diagnoseDatabaseUnavailable(podState, logs, events) {
  const combinedLogs = logs
    .map(
      (entry) =>
        `${entry.data?.currentLogs || ""}\n` +
        `${entry.data?.previousLogs || ""}`,
    )
    .join("\n");

  const connectionFailure = hasKeyword(combinedLogs, [
    "connection refused",
    "econnrefused",
    "connection timed out",
    "database connection failed",
    "could not connect",
  ]);

  if (!connectionFailure) {
    return null;
  }

  const relevantEvents = events.filter((event) =>
    hasKeyword(event.message, ["connection", "refused", "timeout"]),
  );

  let score = 55;

  if (relevantEvents.length > 0) {
    score += 15;
  }

  return {
    code: "DATABASE_UNAVAILABLE",

    title: "Application dependency may be unavailable",

    description:
      "The container logs indicate that the application " +
      "cannot establish a connection to a dependency, " +
      "possibly a database or backend service.",

    score,

    recommendation: {
      action: "INSPECT_DEPENDENCY",

      description:
        "Inspect the application's dependency Service, " +
        "EndpointSlices, and backing Pods.",

      risk: "LOW",
    },
  };
}

function diagnoseApplicationCrash(podState, logs) {
  if (!podState) {
    return null;
  }

  const containers = podState.containers ?? [];

  const exitedWithError = containers.some((container) => {
    const current = container.state?.terminated;

    const previous = container.lastState?.terminated;

    return (
      (current?.exitCode && current.exitCode !== 0) ||
      (previous?.exitCode && previous.exitCode !== 0)
    );
  });

  if (!exitedWithError) {
    return null;
  }

  const combinedLogs = logs
    .map(
      (entry) =>
        `${entry.data?.currentLogs || ""}\n` +
        `${entry.data?.previousLogs || ""}`,
    )
    .join("\n");

  const hasApplicationError = hasKeyword(combinedLogs, [
    "error",
    "exception",
    "failed",
    "fatal",
    "panic",
  ]);

  let score = 50;

  if (hasApplicationError) {
    score += 20;
  }

  return {
    code: "APPLICATION_CRASH",

    title: "Application container is exiting with an error",

    description:
      "The container is terminating with a non-zero " +
      "exit code, indicating an application-level failure.",

    score,

    recommendation: {
      action: "INSPECT_APPLICATION_LOGS",

      description:
        "Inspect current and previous container logs " +
        "to identify the application failure.",

      risk: "LOW",
    },
  };
}

export function analyzeCrashLoop(evidence) {
  const podState = getPodState(evidence);

  const logs = getLogs(evidence);

  const events = getEvents(evidence);

  const hypotheses = [];

  const oom = diagnoseOomKilled(podState, logs);

  if (oom) {
    hypotheses.push(oom);
  }

  const database = diagnoseDatabaseUnavailable(podState, logs, events);

  if (database) {
    hypotheses.push(database);
  }

  const application = diagnoseApplicationCrash(podState, logs);

  if (application) {
    hypotheses.push(application);
  }

  if (hypotheses.length === 0) {
    return {
      rootCause: {
        code: "UNKNOWN",
        title: "Root cause could not be determined",
        description:
          "The currently collected evidence is " +
          "insufficient to determine a reliable root cause.",
      },

      confidence: {
        score: 0.2,
        level: "LOW",
      },

      evidenceIds: [],

      alternatives: [],

      recommendation: {
        action: "COLLECT_MORE_EVIDENCE",

        description:
          "Collect additional application logs, " +
          "events, resource metrics, and dependency state.",

        risk: "LOW",
      },
    };
  }

  hypotheses.sort((a, b) => b.score - a.score);

  const [primary, ...alternatives] = hypotheses;

  const confidence = calculateConfidence(primary.score);

  return {
    rootCause: {
      code: primary.code,
      title: primary.title,
      description: primary.description,
    },

    confidence,

    evidenceIds: [],

    alternatives: alternatives.map((item) => ({
      code: item.code,
      title: item.title,
      confidence: calculateConfidence(item.score).score,
    })),

    recommendation: primary.recommendation,
  };
}
