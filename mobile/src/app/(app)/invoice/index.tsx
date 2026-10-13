// Step 1 — photograph or upload the bill.

import { useState } from 'react';
import { Platform, View } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import * as ImagePicker from 'expo-image-picker';
import * as DocumentPicker from 'expo-document-picker';
import { Button, Card, ErrorNote, ListRow, Screen, Text } from '@/components';
import { space } from '@/theme';

type Params = { planId?: string; quoteId?: string; saving?: string };

const TIPS = [
  'Lay the bill flat in good light',
  'Make sure your name, address and account number are readable',
  'The page with “Electricity usage (kWh)” is the one we need',
];

export default function InvoiceStart() {
  const params = useLocalSearchParams<Params>();
  const [error, setError] = useState('');

  function next(file: { uri: string; name: string; mime: string; size?: number | null }) {
    router.push({ pathname: '/invoice/preview', params: { ...params, uri: file.uri, name: file.name, mime: file.mime, size: String(file.size ?? '') } });
  }

  async function camera() {
    setError('');
    const perm = await ImagePicker.requestCameraPermissionsAsync();
    if (!perm.granted) { setError('Camera access is off. Allow it in Settings, or choose a photo or PDF instead.'); return; }
    const r = await ImagePicker.launchCameraAsync({ mediaTypes: ['images'], quality: 0.7 });
    const a = r.canceled ? null : r.assets[0];
    if (a) next({ uri: a.uri, name: a.fileName ?? 'bill-photo.jpg', mime: a.mimeType ?? 'image/jpeg', size: a.fileSize });
  }

  async function library() {
    setError('');
    const r = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images'], quality: 0.7 });
    const a = r.canceled ? null : r.assets[0];
    if (a) next({ uri: a.uri, name: a.fileName ?? 'bill-photo.jpg', mime: a.mimeType ?? 'image/jpeg', size: a.fileSize });
  }

  async function pdf() {
    setError('');
    const r = await DocumentPicker.getDocumentAsync({ type: ['application/pdf', 'image/*'], copyToCacheDirectory: true });
    const a = r.canceled ? null : r.assets[0];
    if (!a) return;
    if (a.size && a.size > 10 * 1024 * 1024) { setError('That file is over 10 MB. Try a photo of the bill instead.'); return; }
    next({ uri: a.uri, name: a.name, mime: a.mimeType ?? 'application/pdf', size: a.size });
  }

  return (
    <Screen edges={['bottom']}>
      <View style={{ gap: space.sm }}>
        <Text variant="h1">Send us your latest bill</Text>
        <Text variant="body">We use it to confirm your account details and usage, then arrange the switch for you.</Text>
      </View>

      <View style={{ gap: space.sm }}>
        {Platform.OS !== 'web' ? <Button label="Take a photo" icon="camera-outline" onPress={camera} /> : null}
        <Button label="Choose a photo" icon="image-outline" variant="secondary" onPress={library} />
        <Button label="Upload a PDF" icon="document-outline" variant="secondary" onPress={pdf} />
      </View>
      {error ? <ErrorNote message={error} /> : null}

      <Card>
        <Text variant="h3">For a clear photo</Text>
        {TIPS.map((t, i) => <ListRow key={t} icon="checkmark-circle-outline" label={t} last={i === TIPS.length - 1} />)}
      </Card>
      <Text variant="caption" center>Your bill is only used to arrange your switch.</Text>
    </Screen>
  );
}
