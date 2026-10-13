import { useState } from 'react';
import { router } from 'expo-router';
import { Button, ChipGroup, ErrorNote, Field, Screen } from '@/components';
import { ApiError, type Dwelling } from '@/api';
import { useCustomer, useSession } from '@/state/session';

const DWELLINGS: Dwelling[] = ['HDB 1- or 2-room', 'HDB 3-room', 'HDB 4-room', 'HDB 5-room', 'HDB Executive', 'Condominium / Apartment', 'Landed property'];

export default function ProfileEdit() {
  const customer = useCustomer();
  const { update } = useSession();
  const [form, setForm] = useState({ fullName: customer.fullName, email: customer.email, address: customer.address, postal: customer.postal });
  const [dwelling, setDwelling] = useState<Dwelling>(customer.dwelling);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const set = (k: keyof typeof form) => (v: string) => setForm((f) => ({ ...f, [k]: v }));

  const problems = [
    form.fullName.trim().length < 2 && 'Enter your full name.',
    !/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(form.email.trim()) && 'Enter a valid email address.',
    form.address.trim().length < 5 && 'Enter your street address.',
    !/^\d{6}$/.test(form.postal) && 'Singapore postal codes have 6 digits.',
  ].filter(Boolean) as string[];

  async function save() {
    if (problems.length) { setError(problems[0]); return; }
    setBusy(true);
    setError('');
    try {
      await update({ ...form, fullName: form.fullName.trim(), address: form.address.trim(), dwelling });
      router.back();
    } catch (e) {
      setError(e instanceof ApiError ? e.message : 'We couldn’t save your changes. Please try again.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <Screen edges={['bottom']} footer={<Button label="Save changes" loading={busy} onPress={save} />}>
      <Field label="Full name" value={form.fullName} onChangeText={set('fullName')} autoComplete="name" />
      <Field label="Email" value={form.email} onChangeText={set('email')} keyboardType="email-address" autoCapitalize="none" autoComplete="email" />
      <Field label="Address" value={form.address} onChangeText={set('address')} autoComplete="street-address" />
      <Field label="Postal code" value={form.postal} onChangeText={(t) => set('postal')(t.replace(/\D/g, '').slice(0, 6))} keyboardType="number-pad" />
      <ChipGroup label="Home type" options={DWELLINGS.map((d) => ({ value: d, label: d }))} value={dwelling} onChange={setDwelling} />
      {error ? <ErrorNote message={error} /> : null}
    </Screen>
  );
}
