import { connect, StringCodec } from "nats";

const nc = await connect({
  servers: process.env.NATS_URL || "nats://localhost:4222",
});

const js = nc.jetstream();

const codec = StringCodec();

const consumer = await js.consumers
  .get("KUBEDOCTOR_EVENTS", "observer-test")
  .catch(async () => {
    return js.consumers.add("KUBEDOCTOR_EVENTS", {
      durable_name: "observer-test",

      filter_subject: "kubedoctor.k8s.>",
    });
  });

console.log("[Subscriber] Listening...");

const messages = await consumer.consume();

for await (const message of messages) {
  const data = JSON.parse(codec.decode(message.data));

  console.log(JSON.stringify(data, null, 2));

  message.ack();
}
