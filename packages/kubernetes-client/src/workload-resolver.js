import * as k8s from "@kubernetes/client-node";

const kc = new k8s.KubeConfig();
kc.loadFromDefault();

const appsApi = kc.makeApiClient(k8s.AppsV1Api);

export async function resolvePodOwner(
    namespace,
    pod
) {
    const owners =
        pod.metadata?.ownerReferences ?? [];

    const replicasetOwner =
        owners.find(
            (owner) =>
                owner.kind === "ReplicaSet"
        );

    if (!replicasetOwner) {
        return null;
    }

    const rs =
        await appsApi.readNamespacedReplicaSet({
            name: replicasetOwner.name,
            namespace
        });

    const deploymentOwner =
        rs.metadata?.ownerReferences?.find(
            (owner) =>
                owner.kind === "Deployment"
        );

    if (!deploymentOwner) {
        return {
            kind: "ReplicaSet",
            name: rs.metadata?.name,
            namespace
        };
    }

    return {
        kind: "Deployment",
        name: deploymentOwner.name,
        namespace
    };
}