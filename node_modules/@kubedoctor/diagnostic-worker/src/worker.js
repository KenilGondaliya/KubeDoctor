import { Worker } from "bullmq";
import IORedis from "ioredis";

import Incident from "../../apps/api/src/models/incident.model.js";
import {
    collectIncidentEvidence
} from "../../apps/api/src/services/evidence.service.js";

import {
    diagnoseIncident
} from "../../apps/api/src/services/diagnosis.service.js";

const connection =
    new IORedis(
        process.env.REDIS_URL ||
        "redis://127.0.0.1:6379",
        {
            maxRetriesPerRequest: null
        }
    );

const worker =
    new Worker(
        "kubedoctor-diagnosis",

        async (job) => {
            const {
                incidentId
            } = job.data;

            console.log(
                `[Worker] Investigating incident ${incidentId}`
            );

            const incident =
                await Incident.findById(
                    incidentId
                );

            if (!incident) {
                throw new Error(
                    `Incident ${incidentId} not found`
                );
            }

            incident.status =
                "INVESTIGATING";

            await incident.save();

            const evidence =
                await collectIncidentEvidence(
                    incident
                );

            console.log(
                `[Worker] Evidence collected: ${evidence.length}`
            );

            const diagnosis =
                await diagnoseIncident(
                    incident
                );

            incident.status =
                "DIAGNOSED";

            await incident.save();

            console.log(
                `[Worker] Diagnosis: ${diagnosis.rootCause.code}`
            );

            return {
                incidentId,
                diagnosisId:
                    diagnosis._id.toString()
            };
        },

        {
            connection,

            concurrency: 5
        }
    );

worker.on(
    "completed",
    (job) => {
        console.log(
            `[Worker] Job ${job.id} completed`
        );
    }
);

worker.on(
    "failed",
    (job, error) => {
        console.error(
            `[Worker] Job ${job?.id} failed:`,
            error
        );
    }
);

console.log(
    "[Worker] Diagnostic worker started"
);