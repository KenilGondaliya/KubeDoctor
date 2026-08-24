import mongoose from "mongoose";

const incidentSchema = new mongoose.Schema(
  {
    clusterId: {
      type: String,
      default: "minikube",
      index: true,
    },

    namespace: {
      type: String,
      required: true,
      index: true,
    },

    resource: {
      kind: {
        type: String,
        required: true,
      },

      name: {
        type: String,
        required: true,
      },

      uid: {
        type: String,
      },
    },

    type: {
      type: String,
      required: true,
      index: true,
    },

    severity: {
      type: String,
      enum: ["LOW", "MEDIUM", "HIGH", "CRITICAL"],
      default: "MEDIUM",
    },

    status: {
      type: String,
      enum: [
        "OPEN",
        "INVESTIGATING",
        "DIAGNOSED",
        "REMEDIATING",
        "VERIFYING",
        "RESOLVED",
        "FAILED",
      ],
      default: "OPEN",
      index: true,
    },

    fingerprint: {
      type: String,
      required: true,
      unique: true,
    },

    firstDetectedAt: {
      type: Date,
      default: Date.now,
    },

    lastDetectedAt: {
      type: Date,
      default: Date.now,
    },

    resolvedAt: {
      type: Date,
    },
  },
  {
    timestamps: true,
  },
);

const Incident = mongoose.model("Incident", incidentSchema);

export default Incident;
