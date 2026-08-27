import { connect, StringCodec } from "nats";

const nc = await connect({
  servers: "nats://localhost:4222",
});

const sc = StringCodec();

console.log("[Test NATS] Connected");
console.log("[Test NATS] Listening on kubedoctor.k8s.>");

const subscription = nc.subscribe("kubedoctor.k8s.>");

for await (const message of subscription) {
  console.log("\n================================");
  console.log("[Test NATS] Subject:", message.subject);
  console.log("[Test NATS] Event:");
  console.log(sc.decode(message.data));
  console.log("================================");
}