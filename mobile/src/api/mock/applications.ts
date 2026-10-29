// How an application's timeline is shown. The stage list is a proposal —
// confirm the real steps (and how long each takes) with Eutility operations.

import type { Application, Stage, StageKey } from '../types';
import type { ApplicationRow } from './db';
import { planById } from './pricing';

// `doing` is shown while the stage is in progress, `done` once it's reached.
export const STAGES: { key: StageKey; label: string; doing: (retailer: string) => string; done: (retailer: string) => string }[] = [
  { key: 'submitted', label: 'Invoice submitted', doing: () => 'Send us your latest bill to get started.', done: () => 'We have your latest electricity bill.' },
  { key: 'received', label: 'Application received', doing: () => 'Eutility is checking your bill and plan choice.', done: () => 'Eutility has checked your bill and confirmed your plan.' },
  { key: 'retailer', label: 'Retailer processing', doing: (r) => `${r} is setting up your account. This usually takes 5–10 working days.`, done: (r) => `${r} has set up your account.` },
  { key: 'activated', label: 'Contract activated', doing: () => 'Your new plan starts once the retailer confirms the date.', done: () => 'You’re on your new plan. Savings start from your next bill.' },
];

export function toApplication(row: ApplicationRow): Application {
  const plan = row.plan ?? planById(row.planId);
  const retailer = plan?.retailer ?? 'Your new retailer';
  const firstMissing = STAGES.findIndex((s) => !row.reached[s.key]);
  const stages: Stage[] = STAGES.map((s, i) => {
    const state = firstMissing === -1 || i < firstMissing ? 'done' : i === firstMissing ? 'current' : 'upcoming';
    return {
      key: s.key,
      label: s.label,
      detail: state === 'done' ? s.done(retailer) : s.doing(retailer),
      at: row.reached[s.key] ?? null,
      state,
    };
  });
  const times = Object.values(row.reached).filter(Boolean) as string[];
  return {
    id: row.id,
    reference: row.reference,
    plan,
    estimatedSavingYearly: row.estimatedSavingYearly,
    invoiceId: row.invoiceId,
    quoteId: row.quoteId,
    channel: row.channel,
    stages,
    status: row.needsAttention ? 'needs_attention' : firstMissing === -1 ? 'active' : 'in_progress',
    staffNote: row.staffNote || null,
    createdAt: row.createdAt,
    updatedAt: times.sort().at(-1) ?? row.createdAt,
  };
}

/**
 * Bring an application up to the stage staff set in the CRM (the Excel
 * "Stage" column), which says where it is NOW: "Retailer processing" means
 * the steps before it are done and that one is in progress. "Contract
 * activated" is the end, so it counts as done. Returns the stage label if
 * the application moved, for a notification.
 */
export function applyCrmStage(row: ApplicationRow, crm: { stage: string; stageUpdatedAt: string; staffNote: string }) {
  row.staffNote = crm.staffNote || undefined;
  row.needsAttention = crm.stage === 'Needs attention';
  const target = STAGES.findIndex((s) => s.label === crm.stage);
  if (target < 0) return null;
  const doneUpTo = target === STAGES.length - 1 ? target : target - 1;
  // "2026-10-13 09:43:59" is Singapore time.
  const at = /^\d{4}-\d{2}-\d{2} \d{2}:\d{2}/.test(crm.stageUpdatedAt) ? new Date(crm.stageUpdatedAt.replace(' ', 'T') + '+08:00').toISOString() : new Date().toISOString();
  let moved = false;
  STAGES.slice(0, doneUpTo + 1).forEach((s) => { if (!row.reached[s.key]) { row.reached[s.key] = at; moved = true; } });
  return moved ? STAGES[target].label : null;
}

/** Prototype only: move an application to its next stage. */
export function advance(row: ApplicationRow, at = new Date().toISOString()) {
  const next = STAGES.find((s) => !row.reached[s.key]);
  if (next) row.reached[next.key] = at;
  return next?.key ?? null;
}
