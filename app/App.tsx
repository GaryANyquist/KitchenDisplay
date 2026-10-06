import { useKeepAwake } from 'expo-keep-awake';
import { StatusBar } from 'expo-status-bar';
import { useEffect, useMemo, useState } from 'react';
import { SafeAreaView, Text } from 'react-native';

import { Board } from './src/Board';
import { baseUrl } from './src/lib/kitchen';
import { loadSettings, saveSettings, type Settings } from './src/settings';
import { SettingsSheet } from './src/SettingsSheet';
import { c } from './src/theme';

export default function App() {
  useKeepAwake(); // the kitchen screen must never sleep
  const [settings, setSettings] = useState<Settings | null>(null);
  const [editing, setEditing] = useState(false);

  useEffect(() => {
    void loadSettings().then(setSettings);
  }, []);

  const change = (s: Settings) => {
    setSettings(s);
    void saveSettings(s);
  };

  const base = settings ? baseUrl(settings.address) : null;
  const key = settings?.key ?? '';
  const conn = useMemo(() => (base ? { base, key } : null), [base, key]);

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: c.bg }}>
      <StatusBar style="light" hidden />
      {!settings ? (
        <Text style={{ color: c.muted, padding: 24 }}>Loading…</Text>
      ) : !conn || editing ? (
        <SettingsSheet
          initial={settings}
          firstRun={!conn}
          onSave={(s) => {
            change(s);
            setEditing(false);
          }}
          onCancel={() => setEditing(false)}
        />
      ) : (
        <Board conn={conn} settings={settings} onSettings={() => setEditing(true)} onChange={change} />
      )}
    </SafeAreaView>
  );
}
