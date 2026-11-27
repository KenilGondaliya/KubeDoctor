import { Router } from "express";
import { authenticate } from "../middleware/auth.middleware.js";
import { db } from "../database/postgres.js";
import { createCoreV1Api, createAppsV1Api, createNetworkingV1Api } from "../config/kubernetes.js";
import { getNatsConnection, stringCodec } from "../config/nats.js";
import { normalizeResourceEvent } from "../../../../packages/kubernetes-observer/src/normalizer.js";

const router = Router();

router.use(authenticate);

async function resolveAccessibleCluster(userId, clusterId) {
  const result = await db.query(
    `
      SELECT c.*
      FROM clusters c
      INNER JOIN workspace_members wm ON wm.workspace_id = c.workspace_id
      WHERE wm.user_id = $1
        AND ($2::text IS NULL OR c.id::text = $2)
      ORDER BY c.created_at ASC
      LIMIT 1
    `,
    [userId, clusterId || null],
  );
  return result.rows[0] || null;
}

router.get("/", async (req, res, next) => {
  try {
    const cluster = await resolveAccessibleCluster(
      req.user.id,
      req.query.clusterId || req.headers["x-cluster-id"],
    );
    if (!cluster) return res.json({ success: true, data: { incidents: [] } });

    const status = req.query.status;
    const params = [cluster.id];
    let statusClause = "";
    if (status) {
      params.push(status);
      statusClause = ` AND i.status = $2`;
    }
    const result = await db.query(
      `
        SELECT i.*
        FROM incidents i
        WHERE i.cluster_id = $1
        ${statusClause}
        ORDER BY
          CASE i.severity WHEN 'CRITICAL' THEN 4 WHEN 'HIGH' THEN 3 WHEN 'MEDIUM' THEN 2 ELSE 1 END DESC,
          i.last_seen_at DESC
      `,
      params,
    );
    res.json({ success: true, data: { incidents: result.rows } });
  } catch (error) {
    next(error);
  }
});

router.post("/scan", async (req, res, next) => {
  try {
    const cluster = await resolveAccessibleCluster(
      req.user.id,
      req.query.clusterId || req.headers["x-cluster-id"],
    );
    if (!cluster) {
      return res.status(404).json({
        success: false,
        error: { code: "CLUSTER_NOT_FOUND", message: "No accessible cluster found" },
      });
    }

    const namespace = req.query.namespace || cluster.namespace || null;
    const core = createCoreV1Api(cluster.kube_context);
    const apps = createAppsV1Api(cluster.kube_context);
    const networking = createNetworkingV1Api(cluster.kube_context);

    const [pods, nodes, services, deployments, replicaSets, endpointSlices] = await Promise.all([
      namespace ? core.listNamespacedPod(namespace) : core.listPodForAllNamespaces(),
      core.listNode(),
      namespace ? core.listNamespacedService(namespace) : core.listServiceForAllNamespaces(),
      namespace ? apps.listNamespacedDeployment(namespace) : apps.listDeploymentForAllNamespaces(),
      namespace ? apps.listNamespacedReplicaSet(namespace) : apps.listReplicaSetForAllNamespaces(),
      namespace ? networking.listNamespacedEndpointSlice(namespace) : networking.listEndpointSliceForAllNamespaces(),
    ]);

    const collections = [
      ["Pod", pods],
      ["Node", nodes],
      ["Service", services],
      ["Deployment", deployments],
      ["ReplicaSet", replicaSets],
      ["EndpointSlice", endpointSlices],
    ];

    let published = 0;
    const connection = getNatsConnection();
    const jetstream = connection.jetstream();
    const manager = await connection.jetstreamManager();
    try {
      await manager.streams.info("KUBEDOCTOR_EVENTS");
    } catch {
      await manager.streams.add({
        name: "KUBEDOCTOR_EVENTS",
        subjects: ["kubedoctor.k8s.>"],
        retention: "limits",
        storage: "file",
      });
    }

    for (const [kind, response] of collections) {
      const items = response?.body?.items || response?.items || [];
      for (const object of items) {
        const event = normalizeResourceEvent({
          clusterId: cluster.id,
          type: "RECONCILE",
          kind,
          object: { ...object, kind: object.kind || kind },
        });
        const resource = event.resource;
        await db.query(
          `
            INSERT INTO resource_snapshots
              (cluster_id, uid, api_version, kind, name, namespace, resource_version, labels, annotations, resource, observed_at, updated_at)
            VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,NOW(),NOW())
            ON CONFLICT (cluster_id, uid) DO UPDATE SET
              api_version=EXCLUDED.api_version,
              kind=EXCLUDED.kind,
              name=EXCLUDED.name,
              namespace=EXCLUDED.namespace,
              resource_version=EXCLUDED.resource_version,
              labels=EXCLUDED.labels,
              annotations=EXCLUDED.annotations,
              resource=EXCLUDED.resource,
              observed_at=NOW(),
              updated_at=NOW()
          `,
          [
            cluster.id,
            resource.uid,
            resource.apiVersion,
            resource.kind,
            resource.name,
            resource.namespace,
            resource.resourceVersion,
            JSON.stringify(resource.labels),
            JSON.stringify(resource.annotations),
            JSON.stringify(resource),
          ],
        );
        await jetstream.publish(
          `kubedoctor.k8s.resource.${kind.toLowerCase()}`,
          stringCodec.encode(JSON.stringify(event)),
        );
        published += 1;
      }
    }

    await db.query(
      "UPDATE clusters SET status='CONNECTED', last_connected_at=NOW(), last_error=NULL, updated_at=NOW() WHERE id=$1",
      [cluster.id],
    );

    res.json({
      success: true,
      data: { clusterId: cluster.id, namespace: namespace || "all", published },
    });
  } catch (error) {
    error.statusCode = error.statusCode || 502;
    next(error);
  }
});

router.get("/stats", async (req, res, next) => {
  try {
    const cluster = await resolveAccessibleCluster(req.user.id, req.query.clusterId);
    if (!cluster) return res.json({ success: true, data: { stats: { open: 0, acknowledged: 0, resolved: 0 } } });
    const result = await db.query(
      `
        SELECT
          COUNT(*) FILTER (WHERE status = 'OPEN')::int AS open,
          COUNT(*) FILTER (WHERE status = 'ACKNOWLEDGED')::int AS acknowledged,
          COUNT(*) FILTER (WHERE status = 'RESOLVED')::int AS resolved,
          COUNT(*) FILTER (WHERE severity = 'CRITICAL')::int AS critical
        FROM incidents
        WHERE cluster_id = $1
      `,
      [cluster.id],
    );
    res.json({ success: true, data: { stats: result.rows[0] } });
  } catch (error) {
    next(error);
  }
});

async function findAccessibleIncident(req, incidentId) {
  const result = await db.query(
    `
      SELECT i.*
      FROM incidents i
      INNER JOIN clusters c ON c.id = i.cluster_id
      INNER JOIN workspace_members wm ON wm.workspace_id = c.workspace_id
      WHERE wm.user_id = $1 AND i.id = $2
      LIMIT 1
    `,
    [req.user.id, incidentId],
  );
  return result.rows[0] || null;
}

router.get("/:id", async (req, res, next) => {
  try {
    const incident = await findAccessibleIncident(req, req.params.id);
    if (!incident) return res.status(404).json({ success: false, error: { code: "INCIDENT_NOT_FOUND", message: "Incident not found" } });
    const [evidence, diagnosis] = await Promise.all([
      db.query("SELECT * FROM incident_evidence WHERE incident_id = $1 ORDER BY observed_at DESC", [incident.id]),
      db.query("SELECT * FROM diagnoses WHERE incident_id = $1 ORDER BY created_at DESC LIMIT 1", [incident.id]),
    ]);
    res.json({
      success: true,
      data: { incident, evidence: evidence.rows, diagnosis: diagnosis.rows[0] || null },
    });
  } catch (error) {
    next(error);
  }
});

router.patch("/:id/status", async (req, res, next) => {
  try {
    const incident = await findAccessibleIncident(req, req.params.id);
    if (!incident) return res.status(404).json({ success: false, error: { code: "INCIDENT_NOT_FOUND", message: "Incident not found" } });
    if (!["OPEN", "ACKNOWLEDGED", "RESOLVED"].includes(req.body.status)) {
      return res.status(400).json({ success: false, error: { code: "INVALID_STATUS", message: "Invalid incident status" } });
    }
    const result = await db.query(
      `
        UPDATE incidents
        SET status = $1,
            resolved_at = CASE WHEN $1 = 'RESOLVED' THEN NOW() ELSE NULL END,
            updated_at = NOW()
        WHERE id = $2
        RETURNING *
      `,
      [req.body.status, incident.id],
    );
    res.json({ success: true, data: { incident: result.rows[0] } });
  } catch (error) {
    next(error);
  }
});

router.get("/:id/evidence", async (req, res, next) => {
  try {
    const incident = await findAccessibleIncident(req, req.params.id);
    if (!incident) return res.status(404).json({ success: false, error: { code: "INCIDENT_NOT_FOUND", message: "Incident not found" } });
    const result = await db.query("SELECT * FROM incident_evidence WHERE incident_id = $1 ORDER BY observed_at DESC", [incident.id]);
    res.json({ success: true, data: { evidence: result.rows } });
  } catch (error) {
    next(error);
  }
});

export default router;