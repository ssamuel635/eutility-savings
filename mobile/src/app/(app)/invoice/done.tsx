// Step 3 — sent. Point to tracking; offer WhatsApp with the reference.

import { StyleSheet, View } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import Ionicons from '@expo/vector-icons/Ionicons';
import { Button, Card, Screen, Text } from '@/components';
import { PopIn } from '@/components/Motion';
import { CONFIG } from '@/engine';
import { openWhatsApp } from '@/lib/whatsapp';
import { colors, space } from '@/theme';

export default function InvoiceDone() {
  const { reference = '', mode = 'new', plan = '' } = useLocalSearchParams<{ reference: string; mode: 'new' | 'attached'; plan?: string }>();

  function track() {
    router.dismissAll();
    router.navigate('/application');
  }

  return (
    <Screen
      edges={['bottom']}
      footer={
        <>
          <Button label="Track my switch" onPress={track} />
          <Button
            label="Continue on WhatsApp"
            variant="whatsapp"
            icon="logo-whatsapp"
            onPress={() => openWhatsApp(`Hi ${CONFIG.brand}, I've just sent my bill in the app. Reference: ${reference}`)}
          />
        </>
      }
    >
      <View style={s.hero}>
        <PopIn><View style={s.tick}><Ionicons name="checkmark" size={40} color={colors.white} /></View></PopIn>
        <Text variant="h1" center>{mode === 'attached' ? 'Bill added' : 'Bill received'}</Text>
        <Text variant="body" center>
          {mode === 'attached'
            ? `We’ve added it to your application ${reference}.`
            : plan
              ? `We’ve started your switch to ${plan}.`
              : 'We’ll read your bill and recommend the best plan for you.'}
        </Text>
      </View>
      <Card>
        <Text variant="caption">Your reference</Text>
        <Text variant="h2" selectable>{reference}</Text>
        <Text variant="small">We’ll check your details and let you know here and on WhatsApp as your switch moves along.</Text>
      </Card>
    </Screen>
  );
}

const s = StyleSheet.create({
  hero: { alignItems: 'center', gap: space.md, paddingTop: space.x3 },
  tick: { width: 80, height: 80, borderRadius: 40, backgroundColor: colors.blue, alignItems: 'center', justifyContent: 'center' },
});
