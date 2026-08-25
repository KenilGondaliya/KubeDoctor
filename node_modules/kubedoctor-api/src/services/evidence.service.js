import Evidence from "../models/evidence.model.js";

import {
    collectPodEvidence,
    collectPodLogs,
    collectNamespaceEvents
} from "@kubedoctor/evidence-engine";

export async function collectIncidentEvidence(
    incident
) {
    const namespace = incident.namespace;
    const podName = incident.resource.name;

    const evidence = [];

    // 1. Pod state

    const podState = await collectPodEvidence(
        namespace,
        podName
    );

    const podDocument = await Evidence.create({
        incidentId: incident._id,

        type: "POD_STATE",

        resource: {
            kind: "Pod",
            name: podName,
            namespace
        },

        data: podState
    });

    evidence.push(podDocument);

    // 2. Container logs

    for (const container of podState.containers) {
        const logs = await collectPodLogs(
            namespace,
            podName,
            container.name
        );

        const logDocument = await Evidence.create({
            incidentId: incident._id,

            type: "POD_LOGS",

            resource: {
                kind: "Pod",
                name: podName,
                namespace
            },

            data: logs
        });

        evidence.push(logDocument);
    }

    // --------------------------------------------------
    // 3. Kubernetes events
    // --------------------------------------------------

    const events =
        await collectNamespaceEvents(namespace);

    const eventDocument = await Evidence.create({
        incidentId: incident._id,

        type: "KUBERNETES_EVENTS",

        resource: {
            kind: "Namespace",
            name: namespace,
            namespace
        },

        data: events
    });

    evidence.push(eventDocument);

    return evidence;
}