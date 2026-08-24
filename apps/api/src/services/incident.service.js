import crypto from "node:crypto";
import Incident from "../models/incident.model.js";
import { Diagnosis } from "../models/diagnosis.model.js";
import { getPods, getPod, getPodLogs } from "../kubernetes/pod.service.js";
import { getEvents } from "../kubernetes/event.service.js";
import { getServices, getEndpoints } from "../kubernetes/service.service.js";
import { diagnose } from "@kubedoctor/diagnostic-engine";

function createFingerprint({ clusterId, namespace, kind, name, type }) {
  const value = [clusterId, namespace, kind, name, type].join(":");

  return crypto.createHash("sha256").update(value).digest("hex");
}

async function diagnosePod(namespace, name) {
  const pod = await getPod(namespace, name);
  const events = await getEvents(namespace);
  const container = pod.containers?.[0];
  const currentLogs = container
    ? await getPodLogs(namespace, name, container.name, false)
    : "";
  const previousLogs = container
    ? await getPodLogs(namespace, name, container.name, true)
    : "";
  return { pod, events, currentLogs, previousLogs };
}

export async function scanNamespace(namespace = "default") {
  const pods = await getPods(namespace);
  const events = await getEvents(namespace).catch(() => []);
  const incidents = [];

  for (const pod of pods) {
    const reasons = (pod.containers ?? [])
      .map((c) => c.state?.waiting?.reason)
      .filter(Boolean);
    let type = null;
    let severity = "MEDIUM";
    if (reasons.includes("CrashLoopBackOff")) {
      type = "CRASH_LOOP_BACKOFF";
      severity = "HIGH";
    } else if (
      reasons.some((r) => ["ImagePullBackOff", "ErrImagePull"].includes(r))
    ) {
      type = "IMAGE_PULL_FAILURE";
      severity = "HIGH";
    } else if (pod.phase === "Pending") {
      type = "POD_PENDING";
      severity = "MEDIUM";
    }

    if (!type) continue;

    const fp = fingerprint({ namespace, pod: pod.name, type });
    let incident = null;
    try {
      incident = await Incident.findOneAndUpdate(
        { fingerprint: fp },
        {
          $setOnInsert: {
            fingerprint: fp,
            cluster: "minikube",
            namespace,
            resource: { kind: "Pod", name: pod.name },
            type,
            severity,
          },
        },
        { upsert: true, new: true },
      );
    } catch {
      incident = {
        _id: null,
        fingerprint: fp,
        namespace,
        resource: { kind: "Pod", name: pod.name },
        type,
        severity,
      };
    }

    let context = {
      pod,
      events: events.filter((e) => e.involvedObject?.name === pod.name),
    };
    if (type === "CRASH_LOOP_BACKOFF")
      context = await diagnosePod(namespace, pod.name);
    const result = diagnose(context);
    incidents.push({ incident, diagnosis: result });

    if (incident._id) {
      await Diagnosis.findOneAndUpdate(
        { incidentId: incident._id },
        {
          incidentId: incident._id,
          rootCause: result.rootCause,
          confidence: result.confidence,
          evidence: result.evidence,
          recommendations: result.recommendations,
        },
        { upsert: true, new: true },
      );
    }
  }

  // Detect Services with no endpoints.
  const services = await getServices(namespace).catch(() => []);
  const endpoints = await getEndpoints(namespace).catch(() => []);
  const endpointMap = new Map(endpoints.map((e) => [e.name, e]));
  for (const service of services) {
    if (!service.name || service.type === "ExternalName") continue;
    const endpoint = endpointMap.get(service.name);
    const ready =
      endpoint?.subsets?.reduce((n, s) => n + (s.addresses?.length ?? 0), 0) ??
      0;
    if (ready !== 0) continue;
    const type = "SERVICE_NO_ENDPOINTS";
    const fp = fingerprint({ namespace, pod: service.name, type });
    try {
      const incident = await Incident.findOneAndUpdate(
        { fingerprint: fp },
        {
          $setOnInsert: {
            fingerprint: fp,
            cluster: "minikube",
            namespace,
            resource: { kind: "Service", name: service.name },
            type,
            severity: "HIGH",
          },
        },
        { upsert: true, new: true },
      );
      const result = diagnose({ service, endpoint });
      await Diagnosis.findOneAndUpdate(
        { incidentId: incident._id },
        {
          incidentId: incident._id,
          rootCause: result.rootCause,
          confidence: result.confidence,
          evidence: result.evidence,
          recommendations: result.recommendations,
        },
        { upsert: true, new: true },
      );
      incidents.push({ incident, diagnosis: result });
    } catch {}
  }
  return incidents;
}

export async function listIncidents(limit = 100) {
  if (!process.env.MONGO_URI) return [];
  return Incident.find().sort({ detectedAt: -1 }).limit(limit).lean();
}

export async function createOrUpdateIncident({
  clusterId = "minikube",
  namespace,
  resource,
  type,
  severity,
}) {
  const fingerprint = createFingerprint({
    clusterId,
    namespace,
    kind: resource.kind,
    name: resource.name,
    type,
  });

  const now = new Date();

  const incident = await Incident.findOneAndUpdate(
    { fingerprint },
    {
      $set: {
        lastDetectedAt: now,
        severity,
      },

      $setOnInsert: {
        clusterId,
        namespace,
        resource,
        type,
        fingerprint,
        status: "OPEN",
        firstDetectedAt: now,
      },
    },
    {
      upsert: true,
      returnDocument: "after"
    },
  );

  return incident;
}

export async function getIncidents({
    status,
    namespace,
    limit = 50
} = {}) {
    const filter = {};

    if (status) {
        filter.status = status;
    }

    if (namespace) {
        filter.namespace = namespace;
    }

    return Incident.find(filter)
        .sort({ lastDetectedAt: -1 })
        .limit(limit)
        .lean();
}


export async function getIncidentById(id) {
  return Incident.findById(id).lean();
}
