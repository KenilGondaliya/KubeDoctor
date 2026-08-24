import * as k8s from "@kubernetes/client-node";

const kc = new k8s.KubeConfig();

kc.loadFromDefault();

const coreApi = kc.makeApiClient(k8s.CoreV1Api);

export async function collectNamespaceEvents(namespace) {
  const response = await coreApi.listNamespacedEvent({
    namespace,
  });

  return {
    type: "KUBERNETES_EVENTS",

    namespace,

    events: response.items
      .sort(
        (a, b) =>
          new Date(b.lastTimestamp ?? b.eventTime ?? 0) -
          new Date(a.lastTimestamp ?? a.eventTime ?? 0),
      )
      .slice(0, 50)
      .map((event) => ({
        reason: event.reason,
        type: event.type,
        message: event.message,
        count: event.count,
        firstTimestamp: event.firstTimestamp,
        lastTimestamp: event.lastTimestamp,
        involvedObject: {
          kind: event.involvedObject?.kind,

          name: event.involvedObject?.name,
        },
      })),
  };
}

export async function collectPodEvents(
    namespace,
    podName
) {
    const response =
        await coreApi.listNamespacedEvent({
            namespace
        });

    const events =
        response.items
            .filter(
                (event) =>
                    event.involvedObject?.kind ===
                        "Pod" &&
                    event.involvedObject?.name ===
                        podName
            )
            .sort(
                (a, b) =>
                    new Date(
                        b.lastTimestamp ??
                        b.eventTime ??
                        0
                    ) -
                    new Date(
                        a.lastTimestamp ??
                        a.eventTime ??
                        0
                    )
            )
            .slice(0, 50);

    return {
        type: "POD_EVENTS",

        resource: {
            kind: "Pod",
            name: podName,
            namespace
        },

        events: events.map(
            (event) => ({
                reason: event.reason,
                type: event.type,
                message: event.message,
                count: event.count,
                firstTimestamp:
                    event.firstTimestamp,
                lastTimestamp:
                    event.lastTimestamp,

                involvedObject: {
                    kind:
                        event.involvedObject?.kind,

                    name:
                        event.involvedObject?.name
                }
            })
        )
    };
}   