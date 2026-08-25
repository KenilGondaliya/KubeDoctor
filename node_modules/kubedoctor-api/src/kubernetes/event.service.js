import { coreApi } from "./client.js";

export async function getEvents(namespace = "default") {
  const response = await coreApi.listNamespacedEvent({ namespace });
  return response.items.map((e) => ({
    name: e.metadata?.name,
    type: e.type,
    reason: e.reason,
    message: e.message,
    involvedObject: e.involvedObject,
    firstTimestamp: e.firstTimestamp,
    lastTimestamp: e.lastTimestamp,
    count: e.count,
  }));
}
