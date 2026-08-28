import { publishEvent } from "../infrastructure/nats.js";
import { upsertSnapshot } from "../topology/snapshot.repository.js";

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
      `[Observer] Resource is missing kind: ${JSON.stringify(event.resource)}`,
    );
  }

  if (!event.resource.name) {
    throw new Error(
      `[Observer] Resource is missing name: ${JSON.stringify(event.resource)}`,
    );
  }

  await upsertSnapshot(event);

  const subject = `kubedoctor.k8s.resource.${event.resource.kind.toLowerCase()}`;

  await publishEvent(subject, event);

  console.log(
    `[Observer] Published ${event.operation} ${event.resource.kind}/${event.resource.name}`,
  );
}
