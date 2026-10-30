// Savings check: usage + current plan → recommended plan. The result slides
// up over the form in its own sheet; switch or continue on WhatsApp from there.

import { useEffect, useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import Ionicons from '@expo/vector-icons/Ionicons';
import { Button, Card, ChipGroup, ErrorNote, Screen, Text, Toggle } from '@/components';
import { UsageSlider } from '@/components/UsageSlider';
import { PlanPicker } from '@/components/PlanPicker';
import { PhotoHeader } from '@/components/PhotoHeader';
import { SavingsResult } from '@/components/SavingsResult';
import { api, type ContractFilter, type Dwelling, type Plan, type PlanCatalogue, type PricedPlan, type SavingsQuote } from '@/api';
import { CONFIG } from '@/engine';
import { money } from '@/lib/format';
import { openEmail, openWhatsApp, quoteEmail, quoteMessage } from '@/lib/whatsapp';
import { useCustomer, useSession } from '@/state/session';
import { colors, fonts, radius, space } from '@/theme';

const CONTRACTS: { value: ContractFilter; label: string }[] = [
  { value: '24', label: 'Up to 24 months' },
  { value: '12', label: 'Up to 12 months' },
  { value: 'none', label: 'No lock-in' },
  { value: 'any', label: 'Any length' },
];

/** Registration's home type → the matching "Pick your home" chip. */
const presetFor = (d: Dwelling | null) =>
  d ? (({ 'HDB Executive': 'Executive', 'Condominium / Apartment': 'Condo', 'Landed property': 'Landed' } as Record<string, string>)[d] ?? d) : undefined;

export default function Savings() {
  const customer = useCustomer();
  const { refresh: refreshCustomer } = useSession();
  const [catalogue, setCatalogue] = useState<PlanCatalogue | null>(null);
  const clampKwh = (v: number) => Math.min(CONFIG.maxKwh, Math.max(CONFIG.minKwh, v));
  // No usage on file yet: start from the typical figure for the home they registered.
  const homePreset = customer.monthlyKwh ? undefined : CONFIG.homePresets.find((p) => p.label === presetFor(customer.dwelling));
  const [kwh, setKwh] = useState(clampKwh(customer.monthlyKwh ?? homePreset?.kwh ?? CONFIG.defaultKwh));
  // Opened from a "Homes like yours" card: start from that home's usage.
  const { kwh: kwhParam } = useLocalSearchParams<{ kwh?: string }>();
  useEffect(() => { const v = Number(kwhParam); if (v) { setKwh(clampKwh(v)); setPreset(''); } }, [kwhParam]);
  // Presets are tracked by label: two homes can share a kWh figure (Executive, Condo).
  const [preset, setPreset] = useState(homePreset?.label ?? '');
  const [currentId, setCurrentId] = useState(customer.currentPlanId ?? 'sp-group-regulated-tariff');
  const [contract, setContract] = useState<ContractFilter>('24');
  const [greenOnly, setGreenOnly] = useState(false);
  const [picking, setPicking] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [quote, setQuote] = useState<SavingsQuote | null>(null);
  const [chosenId, setChosenId] = useState<string | null>(null);
  const [showResult, setShowResult] = useState(false);

  useEffect(() => { api.plans.catalogue().then(setCatalogue, () => setError('Couldn’t load plans. Pull down to retry.')); }, []);

  const usage = kwh;
  const currentPlan: Plan | undefined = catalogue?.plans.find((p) => p.id === currentId);

  async function check() {
    setBusy(true);
    setError('');
    try {
      const q = await api.savings.quote({ kwh: usage, currentPlanId: currentId, contract, greenOnly });
      setQuote(q);
      setChosenId(q.recommended?.plan.id ?? null);
      setShowResult(true);
      refreshCustomer();
    } catch {
      setError('We couldn’t work out your savings. Please try again.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <Screen tabs edges={[]}>
      <PhotoHeader
        photo="hdbBlocks"
        title="Check your savings"
        subtitle={`We compare ${catalogue ? `${catalogue.plans.filter((p) => !p.regulated).length} plans` : 'every plan'} from Singapore’s retailers.`}
      />

      <Card>
        <ChipGroup
          label="Not sure of your usage? Pick your home"
          options={CONFIG.homePresets.map((p) => ({ value: p.label, label: p.label }))}
          value={preset}
          onChange={(label) => {
            setPreset(label);
            const hit = CONFIG.homePresets.find((p) => p.label === label);
            if (hit) setKwh(hit.kwh);
          }}
        />
        <UsageSlider
          value={kwh}
          min={CONFIG.minKwh}
          max={CONFIG.maxKwh}
          onChange={(v) => {
            setKwh(v);
            // Keep the home chip lit only while the figure still matches it.
            if (preset && CONFIG.homePresets.find((p) => p.label === preset)?.kwh !== v) setPreset('');
          }}
        />
        <View style={{ gap: 6 }}>
          <Text variant="small" color={colors.ink} style={{ fontFamily: fonts.medium }}>Your current plan</Text>
          <Pressable accessibilityRole="button" accessibilityLabel={`Current plan: ${currentPlan ? `${currentPlan.retailer} ${currentPlan.name}` : 'choose'}. Change`} onPress={() => setPicking(true)} style={s.picker}>
            <View style={{ flex: 1 }}>
              <Text variant="caption">{currentPlan?.retailer ?? 'Loading plans…'}</Text>
              <Text variant="bodyStrong">{currentPlan?.name ?? ''}</Text>
            </View>
            <Text variant="bodyStrong" color={colors.blue}>Change</Text>
          </Pressable>
        </View>
        <ChipGroup label="Contract length" options={CONTRACTS} value={contract} onChange={setContract} />
        <Toggle label="Green plans only" hint="Plans backed by renewable energy certificates." value={greenOnly} onChange={setGreenOnly} />
        {error ? <ErrorNote message={error} /> : null}
        <Button label={busy ? 'Comparing plans…' : 'Show my savings'} loading={busy} onPress={check} />
      </Card>

      {quote && !showResult ? (
        <Pressable accessibilityRole="button" accessibilityLabel="Show my last result again" onPress={() => setShowResult(true)} style={s.again}>
          <Ionicons name="flash" size={20} color={colors.orangeAA} />
          <Text variant="bodyStrong" style={{ flex: 1 }}>
            {quote.recommended ? `Your result: save ${money(quote.recommended.savingYearly)} a year` : 'Your result: already on a cheap plan'}
          </Text>
          <Text variant="bodyStrong" color={colors.blue}>View</Text>
        </Pressable>
      ) : null}

      <SavingsResult
        quote={quote}
        visible={showResult}
        chosenId={chosenId}
        onChoose={setChosenId}
        onClose={() => setShowResult(false)}
        onSwitch={(chosen) => {
          setShowResult(false);
          router.push({ pathname: '/invoice', params: { planId: chosen.plan.id, quoteId: quote!.id, saving: String(chosen.savingYearly) } });
        }}
        onWhatsApp={(chosen) => openWhatsApp(quoteMessage(withChoice(quote!, chosen)))}
        onEmail={(chosen) => openEmail(quoteEmail(withChoice(quote!, chosen), customer))}
      />

      <PlanPicker visible={picking} plans={catalogue?.plans ?? []} selectedId={currentId} onSelect={setCurrentId} onClose={() => setPicking(false)} />
    </Screen>
  );
}

/** The WhatsApp message should describe the plan the customer actually picked. */
const withChoice = (q: SavingsQuote, chosen: PricedPlan): SavingsQuote => ({ ...q, recommended: chosen });

const s = StyleSheet.create({
  picker: { flexDirection: 'row', alignItems: 'center', gap: space.md, borderWidth: 1, borderColor: colors.border, borderRadius: radius.md, padding: space.md, paddingHorizontal: space.lg, backgroundColor: colors.white },
  again: { flexDirection: 'row', alignItems: 'center', gap: space.md, padding: space.lg, borderWidth: 1, borderColor: colors.border, borderLeftWidth: 3, borderLeftColor: colors.orange, borderRadius: radius.card, backgroundColor: colors.white },
});
