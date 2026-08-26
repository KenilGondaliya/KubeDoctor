export function normalizeResourceEvent({ clusterId, type, object }) {
  const metadata = object.metadata || {};

  const resource = {
    apiVersion: object.apiVersion || null,

    kind: object.kind || null,

    name: metadata.name || null,

    namespace: metadata.namespace || null,

    uid: metadata.uid || null,

    resourceVersion: metadata.resourceVersion || null,

    labels: metadata.labels || {},

    annotations: metadata.annotations || {},

    observedAt: new Date().toISOString(),
  };

  return {
    eventType: type,

    clusterId,

    resource,

    source: "kubernetes",
  };
}
