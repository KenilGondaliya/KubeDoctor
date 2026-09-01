import crypto from "node:crypto";

export function normalizeResourceEvent({
  clusterId,
  type,
  kind = null,
  object = null,
}) {
  if (!object) {
    throw new Error("Cannot normalize empty Kubernetes resource");
  }

  const metadata = object?.metadata || {};

  /*
   * Explicit kind is authoritative.
   *
   * This is important for Reconciler calls,
   * because the collection itself tells us
   * the resource kind.
   */
  const resolvedKind = kind ?? object?.kind ?? null;

  if (!resolvedKind) {
    throw new Error(
      `Cannot normalize Kubernetes resource without kind: ${
        metadata?.name || "unknown"
      }`,
    );
  }

  const resolvedApiVersion =
    object?.apiVersion ?? metadata?.apiVersion ?? getApiVersion(resolvedKind);

  return {
    eventId: crypto.randomUUID(),

    eventType: "kubernetes.resource",

    operation: type,

    clusterId,

    timestamp: new Date().toISOString(),

    resource: {
      apiVersion: resolvedApiVersion,

      kind: resolvedKind,

      name: metadata?.name ?? null,

      namespace: metadata?.namespace ?? null,

      uid: metadata?.uid ?? null,

      resourceVersion: metadata?.resourceVersion ?? null,

      labels: metadata?.labels ?? {},

      annotations: metadata?.annotations ?? {},

      metadata,

      spec: object?.spec ?? {},

      status: object?.status ?? {},

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

    case "EndpointSlice":
      return "discovery.k8s.io/v1";

    default:
      return null;
  }
}
