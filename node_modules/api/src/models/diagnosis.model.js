import mongoose from "mongoose";

const diagnosisSchema = new mongoose.Schema(
    {
        incidentId: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "Incident",
            required: true,
            unique: true,
            index: true
        },

        rootCause: {
            code: {
                type: String,
                required: true
            },

            title: {
                type: String,
                required: true
            },

            description: {
                type: String,
                required: true
            }
        },

        confidence: {
            score: {
                type: Number,
                required: true,
                min: 0,
                max: 1
            },

            level: {
                type: String,
                enum: [
                    "LOW",
                    "MEDIUM",
                    "HIGH",
                    "VERY_HIGH"
                ],
                required: true
            }
        },

        evidenceIds: [
            {
                type: mongoose.Schema.Types.ObjectId,
                ref: "Evidence"
            }
        ],

        alternatives: [
            {
                code: String,
                title: String,
                confidence: Number
            }
        ],

        recommendation: {
            action: {
                type: String,
                required: true
            },

            description: {
                type: String,
                required: true
            },

            risk: {
                type: String,
                enum: [
                    "LOW",
                    "MEDIUM",
                    "HIGH",
                    "CRITICAL"
                ],
                default: "LOW"
            }
        },

        analyzedAt: {
            type: Date,
            default: Date.now
        }
    },
    {
        timestamps: true
    }
);

const Diagnosis = mongoose.model(
    "Diagnosis",
    diagnosisSchema
);

export default Diagnosis;