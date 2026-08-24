import Diagnosis from "../models/diagnosis.model.js";

export async function getDiagnosis(
    req,
    res
) {
    try {
        const diagnosis =
            await Diagnosis.findOne({
                incidentId:
                    req.params.incidentId
            }).populate(
                "evidenceIds"
            );

        if (!diagnosis) {
            return res.status(404).json({
                success: false,
                message:
                    "Diagnosis not found"
            });
        }

        res.json({
            success: true,
            data: diagnosis
        });

    } catch (error) {
        console.error(error);

        res.status(500).json({
            success: false,
            message:
                "Failed to fetch diagnosis"
        });
    }
}