import { publishEvent } from "../infrastructure/nats.js";

export async function publishResourceEvent(event) {
  const subject = `kubedoctor.k8s.resource.${event.resource.kind.toLowerCase()}`;

  await publishEvent(subject, event);

  console.log(
    `[Observer] Published ${event.operation} ${event.resource.kind}/${event.resource.name}`,
  );
}
