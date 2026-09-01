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

  if (incident.incident_type === "IMAGE_PULL_FAILURE") {
    hypotheses.push(
      {
        cause: "IMAGE_NOT_FOUND",

        summary: "The configured container image could not be found or pulled.",

        baseScore: 0.3,

        reasons: [],
      },

      {
        cause: "IMAGE_REGISTRY_AUTHENTICATION",

        summary:
          "The container registry may require authentication that is missing or invalid.",

        baseScore: 0.2,

        reasons: [],
      },

      {
        cause: "INVALID_IMAGE_REFERENCE",

        summary: "The configured image reference may be invalid.",

        baseScore: 0.2,

        reasons: [],
      },

      {
        cause: "REGISTRY_NETWORK_FAILURE",

        summary:
          "The Kubernetes node may be unable to reach the container registry.",

        baseScore: 0.1,

        reasons: [],
      },
    );
  }

  if (incident.incident_type === "POD_PENDING") {
    hypotheses.push(
      {
        cause: "SCHEDULING_FAILURE",

        summary:
          "The Pod may be unable to obtain a suitable node for scheduling.",

        baseScore: 0.25,

        reasons: [],
      },

      {
        cause: "RESOURCE_CONSTRAINT",

        summary:
          "The Pod may be waiting because available cluster resources are insufficient.",

        baseScore: 0.15,

        reasons: [],
      },

      {
        cause: "NODE_SELECTOR_MISMATCH",

        summary:
          "The Pod scheduling constraints may not match any available node.",

        baseScore: 0.15,

        reasons: [],
      },

      {
        cause: "AFFINITY_CONSTRAINT",

        summary: "Pod affinity or anti-affinity rules may prevent scheduling.",

        baseScore: 0.1,

        reasons: [],
      },
    );
  }

  if (incident.incident_type === "READINESS_FAILURE") {
    hypotheses.push(
      {
        cause: "APPLICATION_NOT_READY",

        summary:
          "The application is running but is failing its readiness condition.",

        baseScore: 0.25,

        reasons: [],
      },

      {
        cause: "READINESS_PROBE_FAILURE",

        summary: "The Kubernetes readiness probe may be failing.",

        baseScore: 0.2,

        reasons: [],
      },

      {
        cause: "DEPENDENCY_UNAVAILABLE",

        summary:
          "The application may not be ready because a required dependency is unavailable.",

        baseScore: 0.15,

        reasons: [],
      },

      {
        cause: "APPLICATION_STARTUP_DELAY",

        summary:
          "The application may still be initializing and has not become ready.",

        baseScore: 0.1,

        reasons: [],
      },
    );
  }

  if (incident.incident_type === "LIVENESS_FAILURE") {
    hypotheses.push(
      {
        cause: "APPLICATION_HUNG",

        summary:
          "The application may be running but unable to respond correctly to liveness checks.",

        baseScore: 0.25,

        reasons: [],
      },

      {
        cause: "LIVENESS_PROBE_MISCONFIGURATION",

        summary:
          "The liveness probe configuration may not correctly represent application health.",

        baseScore: 0.2,

        reasons: [],
      },

      {
        cause: "APPLICATION_DEADLOCK",

        summary:
          "The application may be blocked or deadlocked and unable to respond to health checks.",

        baseScore: 0.15,

        reasons: [],
      },

      {
        cause: "DEPENDENCY_FAILURE",

        summary:
          "The application may be failing its liveness check because a required dependency is unavailable.",

        baseScore: 0.1,

        reasons: [],
      },
    );
  }

  if (incident.incident_type === "DEPLOYMENT_UNAVAILABLE") {
    hypotheses.push(
      {
        cause: "POD_FAILURE",

        summary:
          "The Deployment may be unavailable because its Pods are failing.",

        baseScore: 0.25,

        reasons: [],
      },

      {
        cause: "READINESS_FAILURE",

        summary:
          "The Deployment may be unavailable because its Pods are not Ready.",

        baseScore: 0.2,

        reasons: [],
      },

      {
        cause: "SCHEDULING_FAILURE",

        summary:
          "The Deployment may be unavailable because its Pods cannot be scheduled.",

        baseScore: 0.15,

        reasons: [],
      },

      {
        cause: "ROLLOUT_STALLED",

        summary: "The Deployment rollout may have stopped progressing.",

        baseScore: 0.15,

        reasons: [],
      },
    );
  }

  if (incident.incident_type === "SERVICE_NO_ENDPOINTS") {
    hypotheses.push(
      {
        cause: "NO_MATCHING_PODS",

        summary: "The Service may not have any Pods matching its selector.",

        baseScore: 0.2,

        reasons: [],
      },

      {
        cause: "READINESS_FAILURE",

        summary: "The Service may have matching Pods, but they are not Ready.",

        baseScore: 0.25,

        reasons: [],
      },

      {
        cause: "POD_FAILURE",

        summary: "The Service may have backends that are failing.",

        baseScore: 0.15,

        reasons: [],
      },

      {
        cause: "ENDPOINT_DISCOVERY_FAILURE",

        summary:
          "The Kubernetes endpoint discovery state may not contain usable backends.",

        baseScore: 0.15,

        reasons: [],
      },
    );
  }

  return hypotheses;
}
