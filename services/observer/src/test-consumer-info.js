import {
  connect,
} from "nats";

import {
  env,
} from "./config/env.js";


const nc =
  await connect({
    servers:
      env.natsUrl,
  });


try {

  const jsm =
    await nc.jetstreamManager();


  const info =
    await jsm.consumers.info(
      "KUBEDOCTOR_EVENTS",
      "incident-detector",
    );


  console.log(
    JSON.stringify(
      info,
      null,
      2,
    ),
  );

} catch (error) {

  console.error(
    "[TEST] Consumer info failed:",
    error,
  );

} finally {

  await nc.close();
}