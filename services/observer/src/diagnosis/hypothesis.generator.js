export function generateHypotheses({ incident }) {
  const hypotheses = [];

  if (incident.incident_type === "POD_CRASH_LOOP") {
    hypotheses.push(
      {
        cause: "APPLICATION_CRASH",

        summary: "The container application is repeatedly terminating.",

        baseScore: 0.2,

        reasons: [],
      },

      {
        cause: "NODE_FAILURE",

        summary: "The Kubernetes node hosting the Pod may be unhealthy.",

        baseScore: 0.1,

        reasons: [],
      },

      {
        cause: "CONFIGURATION_FAILURE",

        summary:
          "The application may be failing because of invalid configuration.",

        baseScore: 0.1,

        reasons: [],
      },

      {
        cause: "RESOURCE_EXHAUSTION",

        summary: "The container may be failing because of resource pressure.",

        baseScore: 0.1,

        reasons: [],
      },
    );
  }

  if (incident.incident_type === "OOM_KILLED") {
    hypotheses.push(
      {
        cause: "RESOURCE_EXHAUSTION",

        summary:
          "The container exceeded its available memory and was terminated by the runtime.",

        baseScore: 0.3,

        reasons: [],
      },

      {
        cause: "MEMORY_LIMIT_TOO_LOW",

        summary: "The container memory limit may be too low for the workload.",

        baseScore: 0.2,

        reasons: [],
      },

      {
        cause: "MEMORY_LEAK",

        summary: "The application may have progressively consumed memory.",

        baseScore: 0.1,

        reasons: [],
      },

      {
        cause: "NODE_MEMORY_PRESSURE",

        summary: "The Kubernetes node may be experiencing memory pressure.",

        baseScore: 0.1,

        reasons: [],
      },
    );
  }

  return hypotheses;
}
