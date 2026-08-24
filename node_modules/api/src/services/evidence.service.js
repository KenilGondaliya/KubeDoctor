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

    const podEvidence = await collectPodEvidence(
        namespace,
        podName
    );

    const evidenceDocuments = [];

    evidenceDocuments.push(
        await Evidence.create({
            incidentId: incident._id,
            type: podEvidence.type,
            resource: podEvidence.resource,
            data: podEvidence
        })
    );

    for (
        const container of podEvidence.containers
    ) {
        const logs = await collectPodLogs(
            namespace,
            podName,
            container.name
        );

        evidenceDocuments.push(
            await Evidence.create({
                incidentId: incident._id,
                type: logs.type,
                resource: logs.resource,
                data: logs
            })
        );
    }

    const events =
        await collectNamespaceEvents(namespace);

    evidenceDocuments.push(
        await Evidence.create({
            incidentId: incident._id,
            type: events.type,
            resource: {
                kind: "Namespace",
                name: namespace,
                namespace
            },
            data: events
        })
    );

    return evidenceDocuments;
}