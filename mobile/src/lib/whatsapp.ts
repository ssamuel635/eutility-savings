// App → WhatsApp handoff. App customers are signed in, so FXMedia's chatbot
// finds their details in the CRM by the number they message from (Monika,
// 28 Oct 2026): the WhatsApp message only says what they want. The email
// version carries the details, since staff reading an email can't look the
// customer up by phone. Email is always offered beside WhatsApp.

import { Linking } from 'react-native';
import { CONFIG, mailLink, waLink } from '@/engine';
import type { Application, Customer, SavingsQuote } from '@/api';
import { money } from './format';

/** WhatsApp: just the request; the chatbot has the rest. */
export function quoteMessage(q: SavingsQuote) {
  return q.recommended
    ? `Hi ${CONFIG.brand}, I'd like to switch my electricity plan to ${q.recommended.plan.retailer} ${q.recommended.plan.name}. (sent from the Eutility app)`
    : `Hi ${CONFIG.brand}, I'd like to check my electricity plan. (sent from the Eutility app)`;
}

/** Email: the full details, for staff who can't look the customer up by phone. */
export function quoteEmail(q: SavingsQuote, customer?: Customer | null) {
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
