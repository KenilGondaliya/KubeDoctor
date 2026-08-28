import { resolveRelationships } from "./relationship-resolver.js";

export function buildTopology(snapshots) {
  const resources = snapshots.map((snapshot) => ({
    uid: snapshot.uid,

    kind: snapshot.kind,

    name: snapshot.name,

    namespace: snapshot.namespace,

    labels: snapshot.labels || {},

    annotations: snapshot.annotations || {},

    resource: snapshot.resource,
  }));

  const relationships = resolveRelationships(resources);

  return {
    resources,

    relationships,
  };
}
