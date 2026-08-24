import { Queue } from "bullmq";
import { redisConnection } from "./redis.js";

export const diagnosisQueue = new Queue("kubedoctor-diagnosis", {
  connection: redisConnection,
});
