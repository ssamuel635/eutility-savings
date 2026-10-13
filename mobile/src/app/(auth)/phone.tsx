import { useState } from 'react';
import { View } from 'react-native';
import { router } from 'expo-router';
import { Button, ErrorNote, Field, Screen, Text } from '@/components';
import { api, ApiError } from '@/api';
import { space } from '@/theme';

const valid = (v: string) => /^[689]\d{7}$/.test(v.replace(/\D/g, ''));

export default function Phone() {
  const [phone, setPhone] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [touched, setTouched] = useState(false);

  async function send() {
    setTouched(true);
    if (!valid(phone)) return;
    setBusy(true);
    setError('');
    try {
      await api.auth.requestOtp(phone);
      router.push({ pathname: '/otp', params: { phone } });
    } catch (e) {
      setError(e instanceof ApiError ? e.message : 'We couldn’t send a code. Please try again.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <Screen edges={['bottom']} footer={<Button label="Send code" loading={busy} onPress={send} />}>
      <View style={{ gap: space.sm }}>
        <Text variant="h1">What’s your mobile number?</Text>
        <Text variant="body">We’ll text you a 6-digit code. New here? We’ll set up your account next.</Text>
      </View>
      <Field
        label="Singapore mobile number"
        prefix="+65"
        value={phone}
        onChangeText={(t) => setPhone(t.replace(/[^\d ]/g, '').slice(0, 9))}
        keyboardType="phone-pad"
        textContentType="telephoneNumber"
        autoComplete="tel"
        placeholder="9123 4567"
        autoFocus
        returnKeyType="send"
        onSubmitEditing={send}
        error={touched && !valid(phone) ? 'Enter an 8-digit Singapore mobile number.' : undefined}
      />
      {error ? <ErrorNote message={error} /> : null}
    </Screen>
  );
}
