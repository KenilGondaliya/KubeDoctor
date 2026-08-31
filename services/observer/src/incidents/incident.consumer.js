import { StringCodec } from "nats";

import { getJetStream } from "../infrastructure/nats.js";

import { processResourceEvent } from "./incident.service.js";

const STREAM_NAME = "KUBEDOCTOR_EVENTS";

const CONSUMER_NAME = "incident-detector";

const SUBJECT = "kubedoctor.k8s.resource.>";

const codec = StringCodec();

let running = false;

export async function startIncidentConsumer() {
  if (running) {
    return;
  }

  const js = getJetStream();

  const jsm = await js.jetstreamManager();

  let consumer;

  try {
    consumer = await js.consumers.get(STREAM_NAME, CONSUMER_NAME);

    console.log("[IncidentConsumer] Existing consumer found");
  } catch {
    consumer = await jsm.consumers.add(STREAM_NAME, {
      durable_name: CONSUMER_NAME,

      filter_subject: SUBJECT,

      ack_policy: "explicit",
    });

    console.log("[IncidentConsumer] Consumer created");
  }

  running = true;

  consumeMessages(consumer).catch((error) => {
    console.error("[IncidentConsumer] Consumer failed:", error);

    running = false;
  });

  console.log("[IncidentConsumer] Running");
}

async function consumeMessages(consumer) {
  const messages = await consumer.consume();

  for await (const message of messages) {
    if (!running) {
      break;
    }

    try {
      const event = JSON.parse(codec.decode(message.data));

      console.log(
        `[IncidentConsumer] Received ` +
          `${event.operation} ` +
          `${event.resource?.kind}/` +
          `${event.resource?.name} ` +
          `uid=${event.resource?.uid}`,
      );

      const result = await processResourceEvent(event);

      console.log(
        `[IncidentConsumer] Processed ` +
          `${event.resource?.kind}/` +
          `${event.resource?.name}:`,
        result,
      );

      message.ack();
    } catch (error) {
      console.error("[IncidentConsumer] Event processing failed:", error);

      /*
       * Deliberately don't ACK failed messages.
       * JetStream can redeliver them.
       */
    }
  }
}

export async function stopIncidentConsumer() {
  running = false;

  console.log("[IncidentConsumer] Stopped");
}
