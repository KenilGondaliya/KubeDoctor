import {
  resolveCausalChain,
} from "./diagnosis/causal-chain.resolver.js";


const INCIDENT_ID =
  "ad139a6d-613a-473b-8ed4-6ac517c429a9";


try {
  const chain =
    await resolveCausalChain({
      incidentId:
        INCIDENT_ID,
    });


  console.log(
    JSON.stringify(
      chain,
      null,
      2,
    ),
  );
} catch (error) {
  console.error(
    "[TEST] Causal chain failed:",
    error,
  );
}