// The savings result, as its own sheet that slides up over the calculator:
// the headline figure on a local photo, the plans to pick from, and the next
// step pinned at the bottom. "Edit details" slides it away again.

import { Modal, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Ionicons from '@expo/vector-icons/Ionicons';
import type { PricedPlan, SavingsQuote } from '@/api';
import { money } from '@/lib/format';
import { colors, radius, space } from '@/theme';
import { Button } from './Button';
import { CountUp, FadeIn, PopIn } from './Motion';
import { FadedPhoto } from './Photo';
import { Pill } from './Surfaces';
import { Text } from './Text';

interface Props {
  quote: SavingsQuote | null;
  visible: boolean;
  chosenId: string | null;
  onChoose: (id: string) => void;
  onClose: () => void;
  onSwitch: (chosen: PricedPlan) => void;
  onWhatsApp: (chosen: PricedPlan) => void;
  onEmail: (chosen: PricedPlan) => void;
}

export function SavingsResult({ quote, visible, chosenId, onChoose, onClose, onSwitch, onWhatsApp, onEmail }: Props) {
  if (!quote) return null;
  const options: PricedPlan[] = [quote.recommended, ...quote.alternatives].filter((x): x is PricedPlan => !!x);
  const chosen = options.find((o) => o.plan.id === chosenId) ?? null;
  const rec = quote.recommended;

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="fullScreen" onRequestClose={onClose}>
      <SafeAreaView style={s.wrap} edges={['top', 'bottom']}>
        <View style={s.head}>
          <Pressable accessibilityRole="button" accessibilityLabel="Edit details" onPress={onClose} hitSlop={8} style={s.back}>
            <Ionicons name="chevron-back" size={22} color={colors.blue} />
            <Text variant="bodyStrong" color={colors.blue}>Edit details</Text>
          </Pressable>
          <Text variant="caption">{quote.input.kwh} kWh a month</Text>
        </View>

        <ScrollView contentContainerStyle={s.body}>
          <FadedPhoto name={rec ? 'parkBench' : 'estate'} ratio={16 / 9} style={s.photo} />
          <View style={s.headline} accessibilityLiveRegion="polite">
            {rec ? (
              <>
                <Text variant="eyebrow" color={colors.orangeAA}>You could save</Text>
                <PopIn delay={150}>
                  <View style={{ flexDirection: 'row', alignItems: 'baseline' }}>
                    <CountUp key={quote.id} variant="figure" value={rec.savingYearly} format={(n) => money(n)} style={{ fontSize: 46, lineHeight: 52 }} />
                    <Text variant="bodyStrong"> a year</Text>
                  </View>
                </PopIn>
                <Text variant="small">About {money(rec.savingMonthly)} a month against your {money(quote.current.monthly)} bill today.</Text>
              </>
            ) : (
              <>
                <Text variant="h1">Good news — you’re already on one of the cheapest plans.</Text>
                <Text variant="small">Try a different contract length, or check again when the tariff changes.</Text>
              </>
            )}
          </View>

          {options.length ? (
            <FadeIn delay={250} style={{ gap: space.md }}>
              <Text variant="h3">Pick a plan</Text>
              {options.map((o, i) => (
                <PlanOption key={o.plan.id} option={o} best={i === 0 && !!rec} selected={o.plan.id === chosenId} onPress={() => onChoose(o.plan.id)} />
              ))}
            </FadeIn>
          ) : null}

          <Text variant="caption" center>
            Estimates use retailer rates checked on {quote.ratesAsAt}. Promotions aren’t included in the savings figure.
          </Text>
        </ScrollView>

        {chosen ? (
          <View style={s.footer}>
            <Button label="Switch to this plan" icon="arrow-forward" onPress={() => onSwitch(chosen)} />
            <View style={{ flexDirection: 'row', gap: space.sm }}>
              <Button label="WhatsApp" variant="whatsapp" icon="logo-whatsapp" small style={{ flex: 1 }} onPress={() => onWhatsApp(chosen)} />
              <Button label="Email us" variant="secondary" icon="mail-outline" small style={{ flex: 1 }} onPress={() => onEmail(chosen)} />
            </View>
          </View>
        ) : (
          <View style={s.footer}><Button label="Edit details" variant="secondary" onPress={onClose} /></View>
        )}
      </SafeAreaView>
    </Modal>
  );
}

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
        <View><Text variant="caption">You save</Text><Text variant="bodyStrong" color={option.savingYearly > 0 ? colors.orangeAA : colors.inkSoft}>{money(option.savingYearly)}/yr</Text></View>
      </View>
      <Text variant="caption">{plan.priceLabel} · {plan.contractLabel}</Text>
      <View style={s.tags}>
        {best ? <Pill label="Best saving" tone="orange" icon="star" /> : null}
        {plan.tags.slice(0, 3).map((t) => <Pill key={t} label={t} tone={t === 'Green' ? 'green' : t === 'Promotion' ? 'red' : 'navy'} />)}
      </View>
      {plan.promo && selected ? <Text variant="caption" color={colors.orangeAA}>Promotion: {plan.promo.title}{plan.promo.value ? ` — ${plan.promo.value}` : ''}</Text> : null}
      {selected && (plan.contractMonths || plan.deposit) ? (
        <View style={s.fees}>
          {plan.contractMonths ? <Text variant="caption">Early termination: {plan.earlyTermination || 'see retailer terms'}</Text> : null}
          {plan.deposit ? <Text variant="caption">Deposit: {plan.deposit}</Text> : null}
        </View>
      ) : null}
    </Pressable>
  );
}

const s = StyleSheet.create({
  wrap: { flex: 1, backgroundColor: colors.white },
  head: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: space.lg, paddingVertical: space.sm, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colors.border },
  back: { flexDirection: 'row', alignItems: 'center', gap: 2, minHeight: 44 },
  body: { padding: space.xl, gap: space.xl, paddingBottom: space.x4 },
  photo: { marginTop: -space.xl, marginHorizontal: -space.xl },
  headline: { gap: space.sm, marginTop: -space.x4 },
  option: { backgroundColor: colors.white, borderRadius: radius.card, padding: space.lg, gap: space.sm, borderWidth: 1, borderColor: colors.border },
  optionOn: { borderColor: colors.blue, backgroundColor: '#F3F8FE' },
  optionHead: { flexDirection: 'row', alignItems: 'flex-start', gap: space.md },
  optionNums: { flexDirection: 'row', gap: space.x3 },
  tags: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  fees: { gap: 4, paddingTop: space.sm, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: colors.border },
  footer: { paddingHorizontal: space.xl, paddingTop: space.md, paddingBottom: space.md, gap: space.sm, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: colors.border, backgroundColor: colors.white },
});
