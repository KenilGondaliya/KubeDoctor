import { EvidenceType } from "./evidence.types.js";

export function collectPodEvidence({ incident, snapshot }) {
  const evidence = [];

  const resource = snapshot.resource || {};

  /*
   * 1. Resource state
   */

  evidence.push({
    evidenceType: EvidenceType.RESOURCE_STATE,

    sourceType: "kubernetes.resource",

    sourceUid: snapshot.uid,

    sourceKind: snapshot.kind,

    sourceName: snapshot.name,

    namespace: snapshot.namespace,

    summary: `Current state of Pod ${snapshot.name}`,

    data: {
      phase: resource.status?.phase || null,

      resourceVersion: snapshot.resource_version,

      labels: snapshot.labels || {},

      annotations: snapshot.annotations || {},
    },

    confidence: 1.0,

    supports: true,

    observedAt: new Date(),
  });

  /*
   * 2. Container status
   */

  const containerStatuses = resource.status?.containerStatuses || [];

  if (containerStatuses.length > 0) {
    evidence.push({
      evidenceType: EvidenceType.CONTAINER_STATUS,

      sourceType: "kubernetes.pod",

      sourceUid: snapshot.uid,

      sourceKind: "Pod",

      sourceName: snapshot.name,

      namespace: snapshot.namespace,

      summary: `Container status for Pod ${snapshot.name}`,

      data: {
        containers: containerStatuses.map((container) => ({
          name: container.name || null,

          ready: container.ready ?? false,

          restartCount: container.restartCount || 0,

          state: container.state || {},

          lastState: container.lastState || {},
        })),
      },

      confidence: 1.0,

      supports: true,

      observedAt: new Date(),
    });
  }

  /*
   * 3. Owner chain
   */

  const owners = resource.metadata?.ownerReferences || [];

  if (owners.length > 0) {
    evidence.push({
      evidenceType: EvidenceType.OWNER_CHAIN,

      sourceType: "kubernetes.ownerReferences",

      sourceUid: snapshot.uid,

      sourceKind: snapshot.kind,

      sourceName: snapshot.name,

      namespace: snapshot.namespace,

      summary: `Owner references for ${snapshot.kind}/${snapshot.name}`,

      data: {
        owners: owners.map((owner) => ({
          apiVersion: owner.apiVersion || null,

          kind: owner.kind || null,

          name: owner.name || null,

          uid: owner.uid || null,

          controller: owner.controller ?? false,
        })),
      },

      confidence: 1.0,

      supports: true,

      observedAt: new Date(),
    });
  }

  /*
   * 4. Node context
   */

  const nodeName = resource.spec?.nodeName;

  if (nodeName) {
    evidence.push({
      evidenceType: EvidenceType.NODE_CONTEXT,

      sourceType: "kubernetes.pod",

      sourceUid: snapshot.uid,

      sourceKind: "Pod",

      sourceName: snapshot.name,

      namespace: snapshot.namespace,

      summary: `Pod ${snapshot.name} is scheduled on Node ${nodeName}`,

      data: {
        nodeName,
      },

      /*
       * This evidence by itself does not say
       * whether the node is healthy.
       */
      confidence: 1.0,

      supports: true,

      observedAt: new Date(),
    });
  }

  return evidence;
}

export function collectKubernetesEventEvidence({ events }) {
  return events.map((event) => {
    const rawEvent = event.resource?.raw || event.resource || {};

    const involvedObject = rawEvent.involvedObject || {};

    return {
      evidenceType: EvidenceType.KUBERNETES_EVENT,

      sourceType: "kubernetes.event",

      sourceUid: event.uid,

      sourceKind: "Event",

      sourceName: event.name,

      namespace: event.namespace,

      summary: `${rawEvent.reason || "Kubernetes event"}: ${
        rawEvent.message || "No message"
      }`,

      data: {
        reason: rawEvent.reason || null,

        message: rawEvent.message || null,

        type: rawEvent.type || null,

        involvedObject: {
          uid: involvedObject.uid || null,

          kind: involvedObject.kind || null,

          name: involvedObject.name || null,

          namespace: involvedObject.namespace || null,
        },

        firstTimestamp: rawEvent.firstTimestamp || null,

        lastTimestamp: rawEvent.lastTimestamp || null,

        eventTime: rawEvent.eventTime || null,

        count: rawEvent.count || null,

        series: rawEvent.series || null,
      },

      confidence: 0.95,

      /*
       * Event evidence supports the incident
       * when it is directly associated with
       * the affected resource.
       */
      supports: true,

      observedAt: new Date(),
    };
  });
}
