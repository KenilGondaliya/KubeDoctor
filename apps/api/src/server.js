import dotenv from "dotenv";
import app from "./app.js";
import { connectDatabase } from "./config/database.js";
import { startObserver } from "@kubedoctor/kubernetes-observer/src/index.js";
import { startIncidentDetector } from "./services/incident-detector.service.js";

dotenv.config();

const PORT = process.env.PORT || 5000;

await connectDatabase();

await startIncidentDetector();

await startObserver({
  namespace: process.env.KUBERNETES_NAMESPACE || "default",
  onEvent: (event) => {
    console.log(
      `[KubeDoctor] Event received: ${event.type} - ${event.resource.name}`,
    );
  }
});

app.listen(PORT, () => {
  console.log(`KubeDoctor API running on port  ${PORT}`);
});
