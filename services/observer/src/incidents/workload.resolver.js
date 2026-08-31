function getMetadata(resource) {
  if (!resource) {
    return {};
  }

  /*
   * Normalized event/resource shape:
   *
   * resource.metadata
   *
   * PostgreSQL snapshot shape:
   *
   * resource.resource.metadata
   */
  return resource.metadata || resource.resource?.metadata || {};
}

function getOwnerReferences(resource) {
  return getMetadata(resource).ownerReferences || [];
}

function getIdentity(resource) {
  const metadata = getMetadata(resource);

  return {
    uid: resource.uid || resource.resource?.uid || metadata.uid || null,

    kind: resource.kind || resource.resource?.kind || null,

    name: resource.name || resource.resource?.name || metadata.name || null,
  };
}

/**
 * Resolve the highest useful workload owner.
 *
 * Example:
 *
 * Pod
 *   ↓
 * ReplicaSet
 *   ↓
 * Deployment
 *
 * Result:
 *
 * {
 *   uid: Deployment UID,
 *   kind: "Deployment",
 *   name: "kubedoctor-crash-test"
 * }
 */
export function resolveWorkloadIdentity({ resource, resources = [] }) {
  if (!resource) {
    return null;
  }

  const resourcesByUid = new Map();

  for (const item of resources) {
    const identity = getIdentity(item);

    if (identity.uid) {
      resourcesByUid.set(identity.uid, item);
    }
  }

  let current = resource;

  const visited = new Set();

  while (true) {
    const identity = getIdentity(current);

    if (!identity.uid) {
      break;
    }

    if (visited.has(identity.uid)) {
      break;
    }

    visited.add(identity.uid);

    const owners = getOwnerReferences(current);

    if (owners.length === 0) {
      break;
    }

    /*
     * Prefer the Kubernetes controller owner.
     */
    const controllerOwner =
      owners.find((owner) => owner.controller === true) || owners[0];

    const owner = resourcesByUid.get(controllerOwner.uid);

    /*
     * Owner has not been stored yet.
     */
    if (!owner) {
      break;
    }

    current = owner;
  }

  const finalIdentity = getIdentity(current);

  const workloadKinds = new Set([
    "Deployment",
    "StatefulSet",
    "DaemonSet",
    "Job",
    "CronJob",
  ]);

  /*
   * We reached a logical workload.
   */
  if (workloadKinds.has(finalIdentity.kind)) {
    return {
      uid: finalIdentity.uid,

      kind: finalIdentity.kind,

      name: finalIdentity.name,
    };
  }

  /*
   * No workload owner was available.
   *
   * For example:
   *
   * standalone Pod
   *
   * In that case the Pod itself becomes
   * the logical subject.
   */
  const original = getIdentity(resource);

  return {
    uid: original.uid,

    kind: original.kind,

    name: original.name,
  };
}
