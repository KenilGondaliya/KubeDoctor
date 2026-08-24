import * as k8s from "@kubernetes/client-node";

const kc = new k8s.KubeConfig();
kc.loadFromDefault();

const coreApi = kc.makeApiClient(k8s.CoreV1Api);

export async function collectPodLogs(
    namespace,
    podName,
    containerName
) {
    let currentLogs = "";

    let previousLogs = "";

    try {
        currentLogs = await coreApi.readNamespacedPodLog({
            name: podName,
            namespace,
            container: containerName,
            tailLines: 200
        });
    } catch (error) {
        currentLogs = `Unable to read current logs: ${error.message}`;
    }

    try {
        previousLogs = await coreApi.readNamespacedPodLog({
            name: podName,
            namespace,
            container: containerName,
            previous: true,
            tailLines: 200
        });
    } catch {
        previousLogs = "";
    }

    return {
        type: "POD_LOGS",

        resource: {
            kind: "Pod",
            name: podName,
            namespace
        },

        containerName,

        currentLogs,

        previousLogs
    };
}