import Diagnosis from "../models/diagnosis.model.js";
import Evidence from "../models/evidence.model.js";

import {
    analyzeCrashLoop
} from "@kubedoctor/diagnostic-engine";

export async function diagnoseIncident(
    incident
) {
    const evidence =
        await Evidence.find({
            incidentId: incident._id
        }).lean();

    let result;

    switch (incident.type) {
        case "CRASH_LOOP_BACKOFF":
            result =
                analyzeCrashLoop(
                    evidence
                );
            break;

        default:
            throw new Error(
                `Unsupported incident type: ${incident.type}`
            );
    }

    const diagnosis =
        await Diagnosis.findOneAndUpdate(
            {
                incidentId: incident._id
            },
            {
                $set: {
                    ...result,
                    evidenceIds:
                        evidence.map(
                            (item) =>
                                item._id
                        ),
                    analyzedAt: new Date()
                },

                $setOnInsert: {
                    incidentId: incident._id
                }
            },
            {
                upsert: true,
                returnDocument: "after"
            }
        );

    return diagnosis;
}