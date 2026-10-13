// Fallback sign-in for people who can't receive an SMS.

import { useState } from 'react';
import { Pressable, View } from 'react-native';
import { router } from 'expo-router';
import { Button, ErrorNote, Field, Screen, Text } from '@/components';
import { api, ApiError } from '@/api';
import { useSession } from '@/state/session';
import { colors, space } from '@/theme';

export default function EmailSignIn() {
  const { begin } = useSession();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  async function signIn() {
    if (!email.trim() || !password) {
      setError('Enter your email and password.');
      return;
    }
    setBusy(true);
    setError('');
    try {
      await begin(await api.auth.signInWithEmail(email, password));
    } catch (e) {
      setError(e instanceof ApiError ? e.message : 'Something went wrong. Please try again.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <Screen edges={['bottom']} footer={<Button label="Sign in" loading={busy} onPress={signIn} />}>
      <View style={{ gap: space.sm }}>
        <Text variant="h1">Sign in with email</Text>
        <Text variant="body">For accounts that have a password set. New customers start with their phone number.</Text>
      </View>
      <Field label="Email" value={email} onChangeText={setEmail} keyboardType="email-address" autoCapitalize="none" autoComplete="email" textContentType="emailAddress" autoFocus />
      <Field label="Password" value={password} onChangeText={setPassword} secureTextEntry autoComplete="current-password" textContentType="password" returnKeyType="go" onSubmitEditing={signIn} />
      {error ? <ErrorNote message={error} /> : null}
      <Pressable accessibilityRole="button" onPress={() => router.replace('/phone')} hitSlop={8}>
        <Text variant="bodyStrong" color={colors.blue}>Use my phone number instead</Text>
      </Pressable>
    </Screen>
  );
}
