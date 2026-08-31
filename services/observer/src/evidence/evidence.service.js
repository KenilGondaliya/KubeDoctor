import {
  collectPodEvidence,
  collectKubernetesEventEvidence,
} from "./evidence.collector.js";

import {
  createEvidence,
  findRelatedKubernetesEvents,
} from "./evidence.repository.js";

import {
  collectContainerLogs,
  buildContainerLogEvidence,
} from "./log.collector.js";

import { env } from "../config/env.js";

export async function collectIncidentEvidence({ incident, snapshot }) {
  if (!incident || !snapshot) {
    throw new Error("Incident and snapshot are required");
  }

  let evidence = [];

  /*
   * ------------------------------------------
   * 1. Pod resource evidence
   * ------------------------------------------
   */

  if (snapshot.kind === "Pod") {
    evidence.push(
      ...collectPodEvidence({
        incident,
        snapshot,
      }),
    );
  }

  /*
   * ------------------------------------------
   * 2. Kubernetes Event evidence
   * ------------------------------------------
   */

  const events = await findRelatedKubernetesEvents({
    clusterId: incident.cluster_id,

    resourceUid: snapshot.uid,
  });

  evidence.push(
    ...collectKubernetesEventEvidence({
      events,
    }),
  );

  /*
   * ------------------------------------------
   * 3. Container logs
   * ------------------------------------------
   */

  if (snapshot.kind === "Pod" && snapshot.namespace && snapshot.name) {
    const containers = snapshot.resource?.spec?.containers || [];

    for (const container of containers) {
      /*
       * Current logs
       */

      try {
        const currentLogs = await collectContainerLogs({
          kubeContext: env.kubeContext,

          namespace: snapshot.namespace,

          podName: snapshot.name,

          containerName: container.name,

          previous: false,

          tailLines: 200,
        });

        if (currentLogs.logs) {
          evidence.push(
            buildContainerLogEvidence({
              pod: snapshot,

              logResult: currentLogs,

              previous: false,
            }),
          );
        }
      } catch (error) {
        console.warn(
          `[Evidence] Could not collect current logs for ` +
            `${snapshot.name}/${container.name}: ` +
            error.message,
        );
      }

      /*
       * Previous container logs
       */

      try {
        const previousLogs = await collectContainerLogs({
          kubeContext: env.kubeContext,

          namespace: snapshot.namespace,

          podName: snapshot.name,

          containerName: container.name,

          previous: true,

          tailLines: 200,
        });

        if (previousLogs.logs) {
          evidence.push(
            buildContainerLogEvidence({
              pod: snapshot,

              logResult: previousLogs,

              previous: true,
            }),
          );
        }
      } catch {
        /*
         * Previous logs may legitimately not
         * exist for a container that has never
         * restarted.
         */
      }
    }
  }

  /*
   * ------------------------------------------
   * 4. Persist evidence
   * ------------------------------------------
   */

  const saved = [];

  for (const item of evidence) {
    const row = await createEvidence({
      incidentId: incident.id,

      clusterId: incident.cluster_id,

      evidence: item,
    });

    saved.push(row);
  }

  console.log(
    `[Evidence] Collected ${saved.length} evidence items ` +
      `for incident ${incident.id}`,
  );

  return saved;
}
