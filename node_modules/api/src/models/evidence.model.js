import mongoose from "mongoose";

const evidenceSchema = new mongoose.Schema(
    {
        incidentId: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "Incident",
            required: true,
            index: true
        },

        type: {
            type: String,
            required: true
        },

        resource: {
            kind: String,
            name: String,
            namespace: String
        },

        data: {
            type: mongoose.Schema.Types.Mixed
        }
    },
    {
        timestamps: true
    }
);

const Evidence = mongoose.model(
    "Evidence",
    evidenceSchema
);

export default Evidence;