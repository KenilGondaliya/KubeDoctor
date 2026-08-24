import * as k8s from "@kubernetes/client-node";

const kc = new k8s.KubeConfig();

kc.loadFromDefault();

const coreApi = kc.makeApiClient(k8s.CoreV1Api);

export async function collectPodEvidence(
    namespace,
    podName
) {
    const response = await coreApi.readNamespacedPod({
        name: podName,
        namespace
    });

    const pod = response;

    return {
        type: "POD_STATE",

        resource: {
            kind: "Pod",
            name: pod.metadata?.name,
            namespace: pod.metadata?.namespace
        },

        phase: pod.status?.phase,

        podIp: pod.status?.podIP,

        nodeName: pod.spec?.nodeName,

        restartCount: (
            pod.status?.containerStatuses ?? []
        ).reduce(
            (total, container) =>
                total + (container.restartCount || 0),
            0
        ),

        containers: (
            pod.status?.containerStatuses ?? []
        ).map((container) => ({
            name: container.name,

            image: container.image,

            ready: container.ready,

            restartCount: container.restartCount,

            state: container.state,

            lastState: container.lastState
        }))
    };
}