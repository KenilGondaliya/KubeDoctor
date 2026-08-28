import crypto from "node:crypto";

export function normalizeResourceEvent({ clusterId, type, kind, object }) {
  const metadata = object?.metadata || {};

  return {
    eventId: crypto.randomUUID(),

    eventType: "kubernetes.resource",

    operation: type,

    clusterId,

    timestamp: new Date().toISOString(),

    resource: {
      apiVersion:
        object?.apiVersion || metadata?.apiVersion || getApiVersion(kind),

      kind: object?.kind || kind || null,

      name: metadata.name || null,

      namespace: metadata.namespace || null,

      uid: metadata.uid || null,

      resourceVersion: metadata.resourceVersion || null,

      labels: metadata.labels || {},

      annotations: metadata.annotations || {},

      metadata,

      spec: object?.spec || {},

      status: object?.status || {},

      raw: object,
    },

    source: {
      system: "kubernetes",

      observer: "kubedoctor-observer",
    },
  };
}

function getApiVersion(kind) {
  switch (kind) {
    case "Pod":
    case "Namespace":
    case "Node":
    case "Service":
    case "Event":
      return "v1";

    case "Deployment":
    case "ReplicaSet":
      return "apps/v1";

    default:
      return null;
  }
}
