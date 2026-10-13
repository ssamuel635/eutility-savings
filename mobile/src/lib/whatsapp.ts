// App → WhatsApp handoff. The message carries the context (usage, plans,
// savings, reference) so the agent or chatbot doesn't have to ask again —
// FXMedia request #4. Email is always offered beside it.

import { Linking } from 'react-native';
import { CONFIG, mailLink, waLink } from '@/engine';
import type { Application, Customer, SavingsQuote } from '@/api';
import { money } from './format';

export function quoteMessage(q: SavingsQuote, customer?: Customer | null) {
  const lines = [
    `Hi ${CONFIG.brand}, I'd like to switch my electricity plan.`,
    '',
    `Usage: ${q.input.kwh} kWh/month`,
    `Current plan: ${q.current.plan.retailer} – ${q.current.plan.name}`,
  ];
  if (q.recommended) {
    lines.push(
      `Selected plan: ${q.recommended.plan.retailer} – ${q.recommended.plan.name}`,
      `Estimated savings: ${money(q.recommended.savingYearly)}/year`,
    );
  }
  if (customer) lines.push(`Account: ${customer.id}`);
  lines.push(`Reference: ${q.id} (sent from the Eutility app)`);
  return lines.join('\n');
}

export function applicationMessage(a: Application) {
  const current = a.stages.find((s) => s.state === 'current');
  return [
    `Hi ${CONFIG.brand}, I have a question about my switch.`,
    '',
    `Reference: ${a.reference}`,
    `Plan: ${a.plan ? `${a.plan.retailer} – ${a.plan.name}` : 'Eutility to recommend'}`,
    `Status: ${current?.label ?? 'Activated'}`,
  ].join('\n');
}

export const generalMessage = () => `Hi ${CONFIG.brand}, I have a question (sent from the Eutility app).`;

export async function openWhatsApp(message: string) {
  try {
    await Linking.openURL(waLink(message));
  } catch {
    await openEmail(message);
  }
}

export function openEmail(message: string, subject = 'Electricity savings enquiry') {
  return Linking.openURL(mailLink(message, subject));
}

export const contact = { email: CONFIG.email, phone: CONFIG.phone, whatsapp: CONFIG.whatsappNumber };
