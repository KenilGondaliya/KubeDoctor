import { coreApi } from "./client.js";

export async function getNodes() {
  const response = await coreApi.listNode();
  return response.items.map((n) => ({
    name: n.metadata?.name,
    conditions: n.status?.conditions ?? [],
    addresses: n.status?.addresses ?? [],
    capacity: n.status?.capacity ?? {},
    allocatable: n.status?.allocatable ?? {},
  }));
}
