import mongoose from "mongoose";

const incidentSchema = new mongoose.Schema(
  {
    fingerprint: { type: String, required: true, unique: true },
    cluster: { type: String, default: "minikube" },
    namespace: String,
    resource: { kind: String, name: String },
    type: String,
    severity: {
      type: String,
      enum: ["LOW", "MEDIUM", "HIGH", "CRITICAL"],
      default: "MEDIUM",
    },
    status: {
      type: String,
      enum: ["OPEN", "DIAGNOSED", "RESOLVED"],
      default: "OPEN",
    },
    detectedAt: { type: Date, default: Date.now },
    resolvedAt: Date,
  },
  { timestamps: true },
);

export const Incident =
  mongoose.models.Incident || mongoose.model("Incident", incidentSchema);
