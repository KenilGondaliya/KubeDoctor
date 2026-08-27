import crypto from "node:crypto";

export function normalizeResourceEvent({
  clusterId,
  type,
  kind,
  object
}) {
  const metadata = object?.metadata || {};

  return {
    eventId: crypto.randomUUID(),

    eventType: "kubernetes.resource",

    operation: type,

    clusterId,

    timestamp: new Date().toISOString(),

    resource: {
      apiVersion: object?.apiVersion || null,

      kind: kind || object?.kind || null,

      name: metadata.name || null,

      namespace: metadata.namespace || null,

      uid: metadata.uid || null,

      resourceVersion: metadata.resourceVersion || null,

      labels: metadata.labels || {},

      annotations: metadata.annotations || {}
    },

    source: {
      system: "kubernetes",

      observer: "kubedoctor-observer"
    }
  };
}