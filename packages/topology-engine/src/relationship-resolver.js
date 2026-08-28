import { RelationshipType } from "./relationship-types.js";

import { labelsMatch } from "./selector.js";

export function resolveRelationships(resources) {
  const relationships = [];

  const resourcesByUid = new Map(
    resources.map((resource) => [resource.uid, resource]),
  );

  for (const resource of resources) {
    /*
     * OWNER REFERENCES
     */

    const owners = resource.resource?.metadata?.ownerReferences || [];

    for (const owner of owners) {
      const ownerResource = resourcesByUid.get(owner.uid);

      if (!ownerResource) {
        continue;
      }

      relationships.push({
        sourceUid: ownerResource.uid,

        targetUid: resource.uid,

        type: RelationshipType.OWNS,

        confidence: 1.0,
      });
    }

    /*
     * SERVICE SELECTOR
     */

    if (resource.kind === "Service") {
      const selector = resource.resource?.spec?.selector || {};

      for (const target of resources) {
        if (target.kind !== "Pod") {
          continue;
        }

        if (target.namespace !== resource.namespace) {
          continue;
        }

        if (labelsMatch(selector, target.labels)) {
          relationships.push({
            sourceUid: resource.uid,

            targetUid: target.uid,

            type: RelationshipType.SELECTS,

            confidence: 0.95,
          });
        }
      }
    }

    /*
     * POD → NODE
     */

    if (resource.kind === "Pod") {
      const nodeName = resource.resource?.spec?.nodeName;

      if (nodeName) {
        const node = resources.find(
          (candidate) =>
            candidate.kind === "Node" && candidate.name === nodeName,
        );

        if (node) {
          relationships.push({
            sourceUid: resource.uid,

            targetUid: node.uid,

            type: RelationshipType.RUNS_ON,

            confidence: 1.0,
          });
        }
      }
    }
  } 

  return deduplicateRelationships(relationships);
}

function deduplicateRelationships(relationships) {
  const map = new Map();

  for (const relationship of relationships) {
    const key = [
      relationship.sourceUid,
      relationship.targetUid,
      relationship.type,
    ].join(":");

    map.set(key, relationship);
  }

  return [...map.values()];
}
