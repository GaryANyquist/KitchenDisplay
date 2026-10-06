import { useState } from 'react';
import { Pressable, ScrollView, Text, TextInput, View } from 'react-native';

import { testConnection } from './api';
import { baseUrl, parseSeconds } from './lib/kitchen';
import type { Settings } from './settings';
import { c } from './theme';

export function SettingsSheet({
  initial,
  firstRun,
  onSave,
  onCancel,
}: {
  initial: Settings;
  firstRun: boolean;
  onSave: (s: Settings) => void;
  onCancel: () => void;
}) {
  const [address, setAddress] = useState(initial.address);
  const [key, setKey] = useState(initial.key);
  const [warn, setWarn] = useState(String(initial.warnSeconds));
  const [late, setLate] = useState(String(initial.lateSeconds));
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const base = baseUrl(address);
  const warnS = parseSeconds(warn);
  const lateS = parseSeconds(late);
  const timesOk = warnS !== null && lateS !== null && lateS > warnS;

  const test = async () => {
    if (!base) return setMsg({ ok: false, text: 'Enter the PC name or address, e.g. CYMENUDISPLAY:8790' });
    setMsg({ ok: true, text: 'Testing…' });
    try {
      setMsg({ ok: true, text: await testConnection({ base, key: key.replace(/\s+/g, '') }) });
    } catch (e) {
      setMsg({ ok: false, text: (e as Error).message });
    }
  };

  return (
    <ScrollView contentContainerStyle={{ padding: 32, maxWidth: 640, alignSelf: 'center', width: '100%' }}>
      <Text style={{ color: c.text, fontSize: 28, fontWeight: '800', marginBottom: 6 }}>Kitchen Display</Text>
      <Text style={{ color: c.muted, fontSize: 16, marginBottom: 24 }}>
        {firstRun ? 'Connect to the PC that runs the Kitchen Display server.' : 'Settings'}
      </Text>
      <Text style={{ color: c.muted, marginBottom: 6 }}>PC name or address</Text>
      <TextInput
        value={address}
        onChangeText={setAddress}
        placeholder="CYMENUDISPLAY:8790"
        placeholderTextColor={c.muted}
        autoCapitalize="none"
        autoCorrect={false}
        style={input}
      />
      <Text style={{ color: c.muted, margin: 6, marginTop: 16 }}>Key (only if the PC has KDS_KEY set)</Text>
      <TextInput
        value={key}
        onChangeText={setKey}
        placeholder="optional"
        placeholderTextColor={c.muted}
        autoCapitalize="none"
        autoCorrect={false}
        style={input}
      />
      <Text style={{ color: c.text, fontSize: 20, fontWeight: '800', marginTop: 28, marginBottom: 4 }}>Ticket colours</Text>
      <Text style={{ color: c.muted, marginBottom: 10 }}>The ticket header is green, then turns yellow and then red as the order waits.</Text>
      <View style={{ flexDirection: 'row', gap: 16 }}>
        <View style={{ flex: 1 }}>
          <Text style={{ color: c.muted, marginBottom: 6 }}>Turns yellow after (seconds)</Text>
          <TextInput value={warn} onChangeText={setWarn} keyboardType="number-pad" style={input} />
        </View>
        <View style={{ flex: 1 }}>
          <Text style={{ color: c.muted, marginBottom: 6 }}>Turns red after (seconds)</Text>
          <TextInput value={late} onChangeText={setLate} keyboardType="number-pad" style={input} />
        </View>
      </View>
      {!timesOk ? <Text style={{ color: c.late, marginTop: 10 }}>Enter whole seconds, with red later than yellow.</Text> : null}
      {msg ? <Text style={{ color: msg.ok ? c.muted : c.late, marginTop: 14, fontSize: 16 }}>{msg.text}</Text> : null}
      <View style={{ flexDirection: 'row', gap: 12, marginTop: 24 }}>
        <Btn label="Test connection" onPress={test} />
        <Btn
          label="Save"
          primary
          onPress={() =>
            base &&
            warnS !== null &&
            lateS !== null &&
            timesOk &&
            onSave({ ...initial, address: base, key: key.replace(/\s+/g, ''), warnSeconds: warnS, lateSeconds: lateS })
          }
          disabled={!base || !timesOk}
        />
        {!firstRun ? <Btn label="Cancel" onPress={onCancel} /> : null}
      </View>
    </ScrollView>
  );
}

function Btn({ label, onPress, primary, disabled }: { label: string; onPress: () => void; primary?: boolean; disabled?: boolean }) {
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      style={{ backgroundColor: primary ? c.accent : c.panel2, paddingVertical: 14, paddingHorizontal: 22, borderRadius: 10, opacity: disabled ? 0.4 : 1 }}
    >
      <Text style={{ color: c.text, fontSize: 17, fontWeight: '700' }}>{label}</Text>
    </Pressable>
  );
}

const input = {
  backgroundColor: c.panel,
  color: c.text,
  fontSize: 18,
  padding: 14,
  borderRadius: 10,
  borderWidth: 1,
  borderColor: c.line,
} as const;
