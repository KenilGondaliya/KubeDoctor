import { connect, StringCodec } from "nats";

import { env } from "../config/env.js";

import {
  upsertSnapshot,
  deleteSnapshot,
} from "../topology/snapshot.repository.js";

const codec = StringCodec();

let connection;

let jetstream;

let manager;

export async function connectNats() {
  connection = await connect({
    servers: env.natsUrl,

    name: "kubedoctor-observer",
  });

  manager = await connection.jetstreamManager();

  jetstream = connection.jetstream();

  console.log("[Observer/NATS] Connected");

  await ensureStream();
}

async function ensureStream() {
  try {
    await manager.streams.info("KUBEDOCTOR_EVENTS");

    console.log("[Observer/NATS] Stream exists");
  } catch {
    await manager.streams.add({
      name: "KUBEDOCTOR_EVENTS",

      subjects: ["kubedoctor.k8s.>"],

      retention: "limits",

      max_msgs: -1,

      max_bytes: -1,

      max_age: 7 * 24 * 60 * 60 * 1_000_000_000,

      storage: "file",

      num_replicas: 1,
    });

    console.log("[Observer/NATS] Stream created");
  }
}

export async function publishEvent(subject, event) {
  if (!jetstream) {
    throw new Error("NATS JetStream is not initialized");
  }

  const payload = codec.encode(JSON.stringify(event));

  await jetstream.publish(subject, payload);
}

export async function closeNats() {
  if (connection) {
    await connection.drain();
  }

  connection = undefined;

  jetstream = undefined;

  manager = undefined;
}
export function getJetStream() {
  if (!jetstream) {
    throw new Error("NATS JetStream is not initialized");
  }

  return jetstream;
}

export async function publishResourceEvent(event) {
  if (!event) {
    throw new Error("[Observer] Cannot publish empty event");
  }

  if (!event.resource) {
    throw new Error(
      `[Observer] Event is missing resource: ${JSON.stringify(event)}`,
    );
  }

  if (!event.resource.kind) {
    throw new Error(
      `[Observer] Resource is missing kind: ${JSON.stringify(event)}`,
    );
  }

  if (!event.resource.name) {
    throw new Error(
      `[Observer] Resource is missing name: ${JSON.stringify(event)}`,
    );
  }

  /*
   * DELETE events must remove the resource
   * from our current-state snapshot.
   */
  if (event.operation === "DELETED") {
    if (event.resource.uid) {
      await deleteSnapshot({
        clusterId: event.clusterId,

        uid: event.resource.uid,
      });
    }
  } else {
    /*
     * ADDED / MODIFIED / RECONCILE
     */
    await upsertSnapshot(event);
  }

  const subject =
    `kubedoctor.k8s.resource.` + `${event.resource.kind.toLowerCase()}`;

  await publishEvent(subject, event);

  console.log(
    `[Observer] Published ` +
      `${event.operation} ` +
      `${event.resource.kind}/` +
      `${event.resource.name}`,
  );
}
