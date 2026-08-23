import * as k8s from "@kubernetes/client-node";

async function main() {
    const kc = new k8s.KubeConfig();

    kc.loadFromDefault();

    const coreApi = kc.makeApiClient(k8s.CoreV1Api);

    const response = await coreApi.listNamespace();

    console.log("Connected to Kubernetes cluster");

    for (const ns of response.items) {
        console.log(`Namespace: ${ns.metadata.name}`);
    }
}

main().catch((err) => {
    console.error("Error connecting to Kubernetes cluster:", err);
});