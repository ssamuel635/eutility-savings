// The demo account a fresh install starts with, part-way through a switch, so
// every screen has something to show. Sign in with phone 9123 4567 (code
// 123456) or demo@eutility.com.sg / getcontrol.

import type { Db } from './db';
import { daysAgo, onSeed } from './db';
import { quote } from './pricing';

export const DEMO = {
  phone: '+6591234567',
  email: 'demo@eutility.com.sg',
  password: 'getcontrol',
  otp: '123456',
};

onSeed((db: Db) => {
  const id = 'CUST-DEMO01';
  const q = quote({ kwh: 450, currentPlanId: 'sp-group-regulated-tariff', contract: '24', greenOnly: false });
  const plan = q.recommended?.plan ?? q.alternatives[0]?.plan;

  db.customers[id] = {
    id,
    fullName: 'Alex Tan',
    phone: DEMO.phone,
    email: DEMO.email,
    address: 'Blk 123 Sample Street 11, #08-45',
    postal: '520123',
    dwelling: 'HDB 4-room',
    monthlyKwh: 450,
    currentPlanId: 'sp-group-regulated-tariff',
    referralCode: 'ALEX24',
    source: 'mobile_app',
    createdAt: daysAgo(3),
    preferences: { pushNotifications: true, whatsappUpdates: true },
  };
  db.byPhone[DEMO.phone] = id;
  db.byEmail[DEMO.email] = { id, password: DEMO.password };
  db.quotes[id] = { ...q, at: daysAgo(1, 2) };

  db.invoices.push({
    id: 'INV-DEMO01', customerId: id, fileName: 'sp-bill-sep-2026.jpg', previewUri: null,
    billingMonth: '2026-09', status: 'accepted', note: null, submittedAt: daysAgo(1, 1),
  });

  if (plan) {
    db.applications.push({
      id: 'APP-DEMO01', customerId: id, reference: 'EU-7K3Q9P', planId: plan.id,
      estimatedSavingYearly: Math.round(q.recommended?.savingYearly ?? 0),
      invoiceId: 'INV-DEMO01', quoteId: q.id, channel: 'mobile_app', createdAt: daysAgo(1, 1),
      reached: { submitted: daysAgo(1, 1), received: daysAgo(0, 20) },
    });
  }

  db.referrals.push(
    { id: 'REF-1', referrerId: id, name: 'Priya S.', status: 'switched', at: daysAgo(12) },
    { id: 'REF-2', referrerId: id, name: 'Marcus L.', status: 'switched', at: daysAgo(8) },
    { id: 'REF-3', referrerId: id, name: 'Wei Ling', status: 'signed_up', at: daysAgo(2) },
  );

  db.notices[id] = [
    { id: 'N-2', title: 'Application received', body: 'We’ve checked your details. Next, the retailer sets up your account.', at: daysAgo(0, 20), read: false, link: '/application' },
    { id: 'N-1', title: 'Marcus switched', body: 'A friend you referred has switched. That counts towards your next reward.', at: daysAgo(8), read: true, link: '/rewards' },
  ];
});
