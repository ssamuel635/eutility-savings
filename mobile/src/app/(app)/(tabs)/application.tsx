// Track: where the switch is up to, the bill we have, and help with context.

import { View } from 'react-native';
import { router } from 'expo-router';
import { Button, Card, ListRow, LoadFailed, Loading, Pill, Screen, Section, Text, Timeline } from '@/components';
import { api, type Application, type Invoice, type InvoiceStatus } from '@/api';
import { useQuery } from '@/hooks/useQuery';
import { longDate, monthLabel, money } from '@/lib/format';
import { applicationMessage, openWhatsApp } from '@/lib/whatsapp';
import { colors, space } from '@/theme';
import { PhotoHeader } from '@/components/PhotoHeader';

const INVOICE_STATUS: Record<InvoiceStatus, { label: string; tone: 'blue' | 'success' | 'orange' | 'red' }> = {
  received: { label: 'Received', tone: 'blue' },
  reviewing: { label: 'Reviewing', tone: 'orange' },
  accepted: { label: 'Accepted', tone: 'success' },
  needs_attention: { label: 'Needs attention', tone: 'red' },
};

export default function Track() {
  const { data, error, loading, refreshing, refresh } = useQuery(async () => {
    const [apps, invoices] = await Promise.all([api.applications.list(), api.invoices.list()]);
    return { apps, invoices };
  });

  if (loading) return <Screen tabs><Loading label="Loading your application…" /></Screen>;
  if (error || !data) return <Screen tabs><LoadFailed onRetry={refresh} /></Screen>;

  const [app, ...past] = data.apps;

  if (!app) {
    return (
      <Screen tabs edges={[]} refreshing={refreshing} onRefresh={refresh}>
        <PhotoHeader photo="mrtPark" title="Track your switch" subtitle="Every step, from your bill to your new plan." />
        <Card>
          <View style={{ gap: space.md }}>
          <Text variant="h3">No switch in progress yet</Text>
          <Text variant="small">Check your savings and send us your latest bill. We’ll show every step here until your new plan starts.</Text>
          <Button label="Check my savings" onPress={() => router.navigate('/savings')} />
          <Button label="I already have my bill" variant="secondary" icon="camera-outline" onPress={() => router.push('/invoice')} />
          </View>
        </Card>
      </Screen>
    );
  }

  const invoice = data.invoices.find((i) => i.id === app.invoiceId) ?? null;

  return (
    <Screen tabs edges={[]} refreshing={refreshing} onRefresh={refresh}>
      <PhotoHeader photo="mrtPark" title="Track your switch" ratio={16 / 9} />

      <Card>
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
          <Text variant="caption">Ref {app.reference}</Text>
          <StatusPill app={app} />
        </View>
        <Text variant="h2">{app.plan ? `${app.plan.retailer} · ${app.plan.name}` : 'Eutility will recommend your plan'}</Text>
        {app.plan ? <Text variant="small">{app.plan.priceLabel} · {app.plan.contractLabel}</Text> : null}
        {app.estimatedSavingYearly > 0 ? (
          <Text variant="bodyStrong" color={colors.orangeAA}>Estimated savings {money(app.estimatedSavingYearly)}/year</Text>
        ) : null}
        <Text variant="caption">Started {longDate(app.createdAt)}</Text>
      </Card>

      {app.staffNote ? (
        <Card tone={app.status === 'needs_attention' ? 'orange' : 'blue'}>
          <Text variant="eyebrow">{app.status === 'needs_attention' ? 'We need something from you' : 'A note from Eutility'}</Text>
          <Text variant="body" color={colors.ink}>{app.staffNote}</Text>
          {app.status === 'needs_attention' ? <Button label="Send a new photo of your bill" small icon="camera-outline" onPress={() => router.push('/invoice')} /> : null}
        </Card>
      ) : null}

      <Section title="Progress">
        <Card><Timeline stages={app.stages} /></Card>
      </Section>

      {invoice ? <InvoiceCard invoice={invoice} /> : null}

      <Section title="Questions about your switch?">
        <Button label="Ask us on WhatsApp" variant="whatsapp" icon="logo-whatsapp" onPress={() => openWhatsApp(applicationMessage(app))} />
      </Section>

      {past.length ? (
        <Section title="Earlier applications">
          <Card>
            {past.map((a, i) => (
              <ListRow key={a.id} icon="document-text-outline" label={`Ref ${a.reference} · ${longDate(a.createdAt)}`} value={a.plan ? `${a.plan.retailer} ${a.plan.name}` : 'Plan to be recommended'} last={i === past.length - 1} />
            ))}
          </Card>
        </Section>
      ) : null}

    </Screen>
  );
}

function StatusPill({ app }: { app: Application }) {
  if (app.status === 'active') return <Pill label="Active" tone="success" icon="checkmark-circle" />;
  if (app.status === 'needs_attention') return <Pill label="Action needed" tone="red" icon="alert-circle" />;
  return <Pill label="In progress" tone="success" />;
}

function InvoiceCard({ invoice }: { invoice: Invoice }) {
  const st = INVOICE_STATUS[invoice.status];
  return (
    <Section title="Your bill">
      <Card>
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: space.md }}>
          <View style={{ flex: 1 }}>
            <Text variant="bodyStrong" numberOfLines={1}>{invoice.fileName}</Text>
            <Text variant="caption">{monthLabel(invoice.billingMonth)} bill · sent {longDate(invoice.submittedAt)}</Text>
          </View>
          <Pill label={st.label} tone={st.tone} />
        </View>
        {invoice.note ? <Text variant="small" color={colors.red}>{invoice.note}</Text> : null}
        {invoice.status === 'needs_attention' ? <Button label="Send a new photo" small onPress={() => router.push('/invoice')} /> : null}
      </Card>
    </Section>
  );
}
