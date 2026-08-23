import { diagnoseCrashLoop } from './rules/crash-loop.rule.js';
import { diagnoseImagePull } from './rules/image-pull.rule.js';
import { diagnosePending } from './rules/pending.rule.js';
import { diagnoseProbeFailure } from './rules/probe.rule.js';
import { diagnoseNoEndpoints } from './rules/no-endpoints.rule.js';

export function diagnose(context) {
  const rules = [
    () => diagnoseCrashLoop(context),
    () => diagnoseImagePull(context),
    () => diagnosePending(context),
    () => diagnoseProbeFailure(context),
    () => diagnoseNoEndpoints(context)
  ];

  for (const run of rules) {
    const result = run();
    if (result) return result;
  }

  return {
    rootCause: 'UNKNOWN',
    confidence: 0.1,
    evidence: [],
    recommendations: [{ action: 'COLLECT_MORE_EVIDENCE', risk: 'LOW', reason: 'No high-confidence rule matched the current evidence.' }]
  };
}
