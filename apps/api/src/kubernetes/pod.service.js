import { coreApi } from './client.js';

export async function getPods(namespace = "default") {
    const response = await coreApi.listNamespacedPod({
        namespace
    });

    return response.items.map((pod) => ({
        name: pod.metadata.name,
        namespace: pod.metadata?.namespace,
        phase: pod.status?.phase,
        node: pod.spec?.nodeName,
        podIP: pod.status?.podIP,
        createdAt: pod.metadata?.creationTimestamp,

        containers: (pod.status?.containers ?? []).map((container) => ({
            name: container.name,
            image: container.image,
            restartCount: container.restartCount,
            image: container.image,
            state: container.state,
        }))
    }));
}