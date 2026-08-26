import {
  connect,
  StringCodec
} from "nats";

import { env } from "./env.js";

let connection = null;

export const stringCodec = StringCodec();

export async function connectNats() {
  connection = await connect({
    servers: env.natsUrl,
    name: "kubedoctor-api"
  });

  console.log("[NATS] Connected");

  return connection;
}

export function getNatsConnection() {
  if (!connection) {
    throw new Error("NATS connection has not been initialized");
  }

  return connection;
}

export async function closeNats() {
  if (connection) {
    await connection.drain();
    connection = null;
  }
}