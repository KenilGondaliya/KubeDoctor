export function generateHypotheses({ incident, evidence }) {
  const hypotheses = [];

  if (incident.incident_type === "POD_CRASH_LOOP") {
    hypotheses.push({
      cause: "APPLICATION_CRASH",

      summary: "The container application is repeatedly terminating.",

      baseScore: 0.2,

      reasons: [],
    });

    hypotheses.push({
      cause: "NODE_FAILURE",

      summary: "The Kubernetes node hosting the Pod may be unhealthy.",

      baseScore: 0.1,

      reasons: [],
    });

    hypotheses.push({
      cause: "CONFIGURATION_FAILURE",

      summary:
        "The application may be failing because of invalid configuration.",

      baseScore: 0.1,

      reasons: [],
    });

    hypotheses.push({
      cause: "RESOURCE_EXHAUSTION",

      summary: "The container may be failing because of resource pressure.",

      baseScore: 0.1,

      reasons: [],
    });
  }

  return hypotheses;
}
