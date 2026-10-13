// Savings check: usage + current plan → recommended plan, then switch or
// continue on WhatsApp with the context already filled in.

import { useEffect, useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import Ionicons from '@expo/vector-icons/Ionicons';
import { Button, Card, ChipGroup, ErrorNote, Pill, Screen, Section, Text, Toggle } from '@/components';
import { UsageSlider } from '@/components/UsageSlider';
import { PlanPicker } from '@/components/PlanPicker';
import { CountUp } from '@/components/Motion';
import { api, type ContractFilter, type Plan, type PlanCatalogue, type PricedPlan, type SavingsQuote } from '@/api';
import { CONFIG } from '@/engine';
import { money } from '@/lib/format';
import { openEmail, openWhatsApp, quoteMessage } from '@/lib/whatsapp';
import { useCustomer, useSession } from '@/state/session';
import { colors, radius, shadow, space } from '@/theme';

const CONTRACTS: { value: ContractFilter; label: string }[] = [
  { value: '24', label: 'Up to 24 months' },
  { value: '12', label: 'Up to 12 months' },
  { value: 'none', label: 'No lock-in' },
  { value: 'any', label: 'Any length' },
];

export default function Savings() {
  const customer = useCustomer();
  const { refresh: refreshCustomer } = useSession();
  const [catalogue, setCatalogue] = useState<PlanCatalogue | null>(null);
  const clampKwh = (v: number) => Math.min(CONFIG.maxKwh, Math.max(CONFIG.minKwh, v));
  const [kwh, setKwh] = useState(clampKwh(customer.monthlyKwh ?? CONFIG.defaultKwh));
  // Opened from a "Homes like yours" card: start from that home's usage.
  const { kwh: kwhParam } = useLocalSearchParams<{ kwh?: string }>();
  useEffect(() => { const v = Number(kwhParam); if (v) setKwh(clampKwh(v)); }, [kwhParam]);
  // Presets are tracked by label: two homes can share a kWh figure (Executive, Condo).
  const [preset, setPreset] = useState('');
  const [currentId, setCurrentId] = useState(customer.currentPlanId ?? 'sp-group-regulated-tariff');
  const [contract, setContract] = useState<ContractFilter>('24');
  const [greenOnly, setGreenOnly] = useState(false);
  const [picking, setPicking] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [quote, setQuote] = useState<SavingsQuote | null>(null);
  const [chosenId, setChosenId] = useState<string | null>(null);

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
      refreshCustomer();
    } catch {
      setError('We couldn’t work out your savings. Please try again.');
    } finally {
      setBusy(false);
    }
  }

  const options: PricedPlan[] = quote ? [quote.recommended, ...quote.alternatives].filter((x): x is PricedPlan => !!x) : [];
  const chosen = options.find((o) => o.plan.id === chosenId) ?? null;

  return (
    <Screen tabs>
      <View style={{ gap: space.sm }}>
        <Text variant="h1">Check your savings</Text>
        <Text variant="body">We compare {catalogue ? `${catalogue.plans.filter((p) => !p.regulated).length} plans` : 'every plan'} from Singapore’s retailers.</Text>
      </View>

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
          <Text variant="small" color={colors.ink} style={{ fontFamily: 'Inter_500Medium' }}>Your current plan</Text>
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

      {quote ? (
        <View style={{ gap: space.xl }}>
          <Card tone={quote.recommended ? 'orange' : 'blue'}>
            {quote.recommended ? (
              <>
                <Text variant="eyebrow" color={colors.orangeAA}>You could save</Text>
                <View style={{ flexDirection: 'row', alignItems: 'baseline' }} accessibilityLiveRegion="polite">
                  <CountUp key={quote.id} variant="figure" value={quote.recommended.savingYearly} format={(n) => money(n)} />
                  <Text variant="body"> a year</Text>
                </View>
                <Text variant="small">That’s about {money(quote.recommended.savingMonthly)} a month against your {money(quote.current.monthly)} bill today.</Text>
              </>
            ) : (
              <>
                <Text variant="h2">Good news — you’re already on one of the cheapest plans.</Text>
                <Text variant="small">Try a different contract length, or check again when the tariff changes.</Text>
              </>
            )}
          </Card>

          {options.length ? (
            <Section title="Pick a plan">
              {options.map((o, i) => (
                <PlanOption key={o.plan.id} option={o} best={i === 0 && !!quote.recommended} selected={o.plan.id === chosenId} onPress={() => setChosenId(o.plan.id)} />
              ))}
            </Section>
          ) : null}

          {chosen ? (
            <View style={{ gap: space.sm }}>
              <Button
                label="Switch to this plan"
                icon="arrow-forward"
                onPress={() => router.push({ pathname: '/invoice', params: { planId: chosen.plan.id, quoteId: quote.id, saving: String(chosen.savingYearly) } })}
              />
              <Button label="Continue on WhatsApp" variant="whatsapp" icon="logo-whatsapp" onPress={() => openWhatsApp(quoteMessage(withChoice(quote, chosen), customer))} />
              <Button label="Email us instead" variant="ghost" small onPress={() => openEmail(quoteMessage(withChoice(quote, chosen), customer))} />
            </View>
          ) : null}

          <Text variant="caption" center>
            Estimates use retailer rates checked on {quote.ratesAsAt}. Promotions aren’t included in the savings figure.
          </Text>
        </View>
      ) : null}

      <PlanPicker visible={picking} plans={catalogue?.plans ?? []} selectedId={currentId} onSelect={setCurrentId} onClose={() => setPicking(false)} />
    </Screen>
  );
}

/** The WhatsApp message should describe the plan the customer actually picked. */
const withChoice = (q: SavingsQuote, chosen: PricedPlan): SavingsQuote => ({ ...q, recommended: chosen });

function PlanOption({ option, best, selected, onPress }: { option: PricedPlan; best: boolean; selected: boolean; onPress: () => void }) {
  const { plan } = option;
  return (
    <Pressable
      accessibilityRole="radio"
      accessibilityState={{ selected }}
      accessibilityLabel={`${plan.retailer} ${plan.name}, about ${money(option.monthly)} a month, saves ${money(option.savingYearly)} a year`}
      onPress={onPress}
      style={[s.option, selected && s.optionOn]}
    >
      <View style={s.optionHead}>
        <View style={{ flex: 1 }}>
          <Text variant="caption">{plan.retailer}</Text>
          <Text variant="h3">{plan.name}</Text>
        </View>
        <Ionicons name={selected ? 'radio-button-on' : 'radio-button-off'} size={24} color={selected ? colors.blue : colors.inkMuted} />
      </View>
      <View style={s.optionNums}>
        <View><Text variant="caption">Est. monthly</Text><Text variant="bodyStrong">{money(option.monthly, 2)}</Text></View>
        <View><Text variant="caption">You save</Text><Text variant="bodyStrong" color={option.savingYearly > 0 ? colors.green : colors.inkSoft}>{money(option.savingYearly)}/yr</Text></View>
      </View>
      <Text variant="caption">{plan.priceLabel} · {plan.contractLabel}</Text>
      <View style={s.tags}>
        {best ? <Pill label="Best saving" tone="orange" icon="star" /> : null}
        {plan.tags.slice(0, 3).map((t) => <Pill key={t} label={t} tone={t === 'Green' ? 'green' : 'grey'} />)}
      </View>
      {plan.promo && selected ? <Text variant="caption" color={colors.orangeAA}>Promotion: {plan.promo.title}{plan.promo.value ? ` — ${plan.promo.value}` : ''}</Text> : null}
    </Pressable>
  );
}

const s = StyleSheet.create({
  picker: { flexDirection: 'row', alignItems: 'center', gap: space.md, borderWidth: 1, borderColor: colors.border, borderRadius: radius.md, padding: space.md, paddingHorizontal: space.lg, backgroundColor: colors.white },
  option: { backgroundColor: colors.white, borderRadius: radius.card, padding: space.lg, gap: space.sm, borderWidth: 1, borderColor: colors.border, ...shadow.card },
  optionOn: { borderColor: colors.blue, backgroundColor: '#F3F8FE' },
  optionHead: { flexDirection: 'row', alignItems: 'flex-start', gap: space.md },
  optionNums: { flexDirection: 'row', gap: space.x3 },
  tags: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
});
