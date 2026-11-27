import { Router } from "express";
import { authenticate } from "../middleware/auth.middleware.js";
import { db } from "../database/postgres.js";

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

async function listSnapshots(req, res, next, kind) {
  try {
    const clusterId = req.query.clusterId || req.headers["x-cluster-id"];
    const cluster = await resolveAccessibleCluster(req.user.id, clusterId);
    if (!cluster) {
      return res.status(404).json({
        success: false,
        error: { code: "CLUSTER_NOT_FOUND", message: "No accessible cluster found" },
      });
    }

    const namespace = req.query.namespace;
    const params = [cluster.id];
    let kindClause = "";
    if (kind) {
      params.push(kind);
      kindClause = ` AND kind = $${params.length}`;
    }

    let namespaceClause = "";
    if (namespace) {
      params.push(namespace);
      namespaceClause = ` AND namespace = $${params.length}`;
    }

    const result = await db.query(
      `
        SELECT uid, kind, name, namespace, resource_version, labels, annotations, resource, updated_at
        FROM resource_snapshots
        WHERE cluster_id = $1
        ${kindClause}
        ${namespaceClause}
        ORDER BY name ASC
      `,
      params,
    );

    res.json({
      success: true,
      data: {
        clusterId: cluster.id,
        clusterName: cluster.name,
        [kind ? kind.toLowerCase() : "resources"]: result.rows,
      },
    });
  } catch (error) {
    next(error);
  }
}

router.get("/namespaces", (req, res, next) => listSnapshots(req, res, next, "Namespace"));
router.get("/pods", (req, res, next) => listSnapshots(req, res, next, "Pod"));
router.get("/services", (req, res, next) => listSnapshots(req, res, next, "Service"));
router.get("/deployments", (req, res, next) => listSnapshots(req, res, next, "Deployment"));
router.get("/nodes", (req, res, next) => listSnapshots(req, res, next, "Node"));
router.get("/events", (req, res, next) => listSnapshots(req, res, next, "Event"));
router.get("/endpoints", (req, res, next) => listSnapshots(req, res, next, "EndpointSlice"));

export default router;