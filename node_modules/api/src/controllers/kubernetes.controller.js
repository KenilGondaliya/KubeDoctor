import { getNamespaces } from "../kubernetes/namespace.service.js";
import { getPods } from "../kubernetes/pod.service.js";


export async function getNamespacesController(req, res) {
    try {
        const namespaces = await getNamespaces();

        res.json({
            success: true,
            data: namespaces
        });
    } catch (error) {
        console.error(error);

        res.status(500).json({
            success: false,
            message: "Failed to fetch namespaces"
        });
    }
}

export async function getPodsController(req, res) {
    try {
        const namespace = req.query.namespace || "default";

        const pods = await getPods(namespace);

        res.json({
            success: true,
            namespace,
            data: pods
        });
    } catch (error) {
        console.error(error);

        res.status(500).json({
            success: false,
            message: "Failed to fetch pods"
        });
    }
}
