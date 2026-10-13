import { useEffect, useState } from 'react';
import { Pressable, View } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { Button, ErrorNote, Field, Screen, Text } from '@/components';
import { api, ApiError } from '@/api';
import { useSession } from '@/state/session';
import { colors, space } from '@/theme';

const RESEND_AFTER = 60;

export default function Otp() {
  const { phone = '' } = useLocalSearchParams<{ phone: string }>();
  const { begin } = useSession();
  const [code, setCode] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [wait, setWait] = useState(RESEND_AFTER);

  useEffect(() => {
    if (wait <= 0) return;
    const t = setTimeout(() => setWait((w) => w - 1), 1000);
    return () => clearTimeout(t);
  }, [wait]);

  async function verify(value = code) {
    if (value.length !== 6) return;
    setBusy(true);
    setError('');
    try {
      const r = await api.auth.verifyOtp(phone, value);
      if (r.status === 'existing') await begin(r.session);
      else router.replace({ pathname: '/register', params: { token: r.registrationToken, phone } });
    } catch (e) {
      setError(e instanceof ApiError ? e.message : 'Something went wrong. Please try again.');
      setCode('');
    } finally {
      setBusy(false);
    }
  }

  async function resend() {
    setWait(RESEND_AFTER);
    setError('');
    try { await api.auth.requestOtp(phone); } catch { setError('We couldn’t resend the code. Please try again.'); }
  }

  return (
    <Screen edges={['bottom']} footer={<Button label="Verify" loading={busy} disabled={code.length !== 6} onPress={() => verify()} />}>
      <View style={{ gap: space.sm }}>
        <Text variant="h1">Enter your code</Text>
        <Text variant="body">We sent a 6-digit code to +65 {phone}.</Text>
      </View>
      <Field
        label="6-digit code"
        value={code}
        onChangeText={(t) => {
          const v = t.replace(/\D/g, '').slice(0, 6);
          setCode(v);
          if (v.length === 6) verify(v);
        }}
        keyboardType="number-pad"
        textContentType="oneTimeCode"
        autoComplete="sms-otp"
        autoFocus
        maxLength={6}
        style={{ fontSize: 24, letterSpacing: 8 }}
      />
      {error ? <ErrorNote message={error} /> : null}
      {wait > 0 ? (
        <Text variant="small">You can ask for a new code in {wait}s.</Text>
      ) : (
        <Pressable accessibilityRole="button" onPress={resend} hitSlop={8}>
          <Text variant="bodyStrong" color={colors.blue}>Send a new code</Text>
        </Pressable>
      )}
    </Screen>
  );
}
