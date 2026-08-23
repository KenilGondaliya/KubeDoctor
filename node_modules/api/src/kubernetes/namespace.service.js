import { coreApi } from "./client.js";

export async function getNamespaces() {
  const response = await coreApi.listNamespace();
  return response.items.map((n) => ({
    name: n.metadata?.name,
    status: n.status?.phase,
  }));
}
