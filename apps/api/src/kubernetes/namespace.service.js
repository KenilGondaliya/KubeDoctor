import { coreApi } from './client.js';

export async function getNamespaces() {
    const response = await coreApi.listNamespace();
    return response.items.map((namespace) => {
        return {
            name: namespace.metadata.name,
            uid: namespace.metadata.uid
        };
    });
}