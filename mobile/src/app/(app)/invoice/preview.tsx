// Step 2 — check the file, pick the bill month, confirm, send.
// Sending the bill also starts the switch (an application), unless one is
// already in progress, in which case the bill is added to that.

import { useEffect, useState } from 'react';
import { Image, StyleSheet, View } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import Ionicons from '@expo/vector-icons/Ionicons';
import * as Haptics from 'expo-haptics';
import { Button, Card, ChipGroup, ErrorNote, Screen, Text } from '@/components';
import { api, ApiError, type Plan } from '@/api';
import { money, recentMonths } from '@/lib/format';
import { colors, radius, space } from '@/theme';

type Params = { uri: string; name: string; mime: string; size?: string; planId?: string; quoteId?: string; saving?: string };

export default function InvoicePreview() {
  const p = useLocalSearchParams<Params>();
  const months = recentMonths(4);
  const [month, setMonth] = useState(months[1].value); // last month's bill is the usual one
  const [target, setTarget] = useState<{ plan: Plan | null; quoteId: string | null; saving: number } | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const isImage = p.mime?.startsWith('image/');

  // Which plan this switch is for: the one picked on the savings screen, else
  // the latest check's recommendation, else Eutility recommends one.
  useEffect(() => {
    (async () => {
      const [cat, latest] = await Promise.all([api.plans.catalogue(), api.savings.latest().catch(() => null)]);
      const id = p.planId || latest?.recommended?.plan.id || null;
      // FXMedia's plans aren't in the price sheet: those come from the check itself
      const quoted = latest ? [latest.recommended, ...latest.alternatives].find((x) => x?.plan.id === id)?.plan : undefined;
      const plan = cat.plans.find((x) => x.id === id) ?? quoted ?? null;
      const saving = p.planId ? Number(p.saving) || 0 : latest?.recommended?.savingYearly ?? 0;
      setTarget({ plan, quoteId: p.quoteId || latest?.id || null, saving: plan ? saving : 0 });
    })().catch(() => setTarget({ plan: null, quoteId: null, saving: 0 }));
  }, [p.planId, p.quoteId, p.saving]);

  async function send() {
    if (!target) return;
    setBusy(true);
    setError('');
    try {
      const open = (await api.applications.list()).find((a) => a.status !== 'active');
      const invoice = await api.invoices.submit({ uri: p.uri, fileName: p.name, mimeType: p.mime, size: Number(p.size) || null }, month);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
      if (open) {
        router.replace({ pathname: '/invoice/done', params: { reference: open.reference, mode: 'attached' } });
        return;
      }
      const app = await api.applications.create({
        planId: target.plan?.id ?? null, invoiceId: invoice.id, quoteId: target.quoteId, estimatedSavingYearly: target.saving,
      });
      router.replace({ pathname: '/invoice/done', params: { reference: app.reference, mode: 'new', plan: app.plan ? `${app.plan.retailer} ${app.plan.name}` : '' } });
    } catch (e) {
      setError(e instanceof ApiError ? e.message : 'We couldn’t send your bill. Check your connection and try again.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <Screen
      edges={['bottom']}
      footer={
        <>
          <Text variant="caption" center>By sending, you authorise Eutility to use this bill to arrange your switch with the retailer.</Text>
          <Button label="Send my bill" icon="send" loading={busy} disabled={!target} onPress={send} />
          <Button label="Choose a different file" variant="ghost" small onPress={() => router.back()} />
        </>
      }
    >
      <View style={s.preview}>
        {isImage ? (
          <Image source={{ uri: p.uri }} style={s.image} resizeMode="contain" accessibilityLabel="Your bill" />
        ) : (
          <View style={s.file}>
            <Ionicons name="document-text-outline" size={48} color={colors.blue} />
            <Text variant="bodyStrong" center numberOfLines={2}>{p.name}</Text>
          </View>
        )}
      </View>
      {isImage ? <Text variant="small" center>Can you read the account number and usage? If not, go back and retake it.</Text> : null}

      <ChipGroup label="Which month is this bill for?" options={months} value={month} onChange={setMonth} />

      <Card tone="blue">
        <Text variant="eyebrow">You’re switching to</Text>
        {target === null ? (
          <Text variant="small">Loading…</Text>
        ) : target.plan ? (
          <>
            <Text variant="h3">{target.plan.retailer} · {target.plan.name}</Text>
            <Text variant="small">{target.plan.priceLabel} · {target.plan.contractLabel}</Text>
            {target.saving > 0 ? <Text variant="bodyStrong" color={colors.orangeAA}>Estimated savings {money(target.saving)}/year</Text> : null}
          </>
        ) : (
          <Text variant="small">You haven’t picked a plan yet — that’s fine. We’ll read your bill and recommend the best plan before anything changes.</Text>
        )}
      </Card>
      {error ? <ErrorNote message={error} /> : null}
    </Screen>
  );
}

const s = StyleSheet.create({
  preview: { borderRadius: radius.card, overflow: 'hidden', backgroundColor: colors.white, borderWidth: 1, borderColor: colors.border },
  image: { width: '100%', height: 320, backgroundColor: colors.cloud },
  file: { height: 200, alignItems: 'center', justifyContent: 'center', gap: space.md, padding: space.xl },
});
