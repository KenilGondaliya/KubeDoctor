import { upsertSnapshot } from "./topology/snapshot.repository.js";
import { db } from "./config/database.js";
import { env } from "./config/env.js";

const testResource = {
  apiVersion: "v1",

  kind: "Pod",

  metadata: {
    name: "kubedoctor-test",
    namespace: "default",
    uid: "kubedoctor-test-001",
    resourceVersion: "1",

    labels: {
      app: "kubedoctor-test",
    },

    annotations: {},
  },

  spec: {},

  status: {},
};

const event = {
  clusterId: env.clusterId,

  resource: {
    apiVersion: testResource.apiVersion,

    kind: testResource.kind,

    name: testResource.metadata.name,

    namespace: testResource.metadata.namespace,

    uid: testResource.metadata.uid,

    resourceVersion: testResource.metadata.resourceVersion,

    labels: testResource.metadata.labels,

    annotations: testResource.metadata.annotations,

    metadata: testResource.metadata,

    spec: testResource.spec,

    status: testResource.status,

    raw: testResource,
  },
};

try {
  await upsertSnapshot(event);

  console.log("[TEST] Snapshot inserted successfully");
} catch (error) {
  console.error("[TEST] Snapshot insert failed:", error);
} finally {
  await db.end();
}
