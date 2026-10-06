import * as SecureStore from 'expo-secure-store';

export interface Settings {
  address: string;
  key: string;
  stations: string[];
  sound: boolean;
}

export const DEFAULTS: Settings = { address: '', key: '', stations: [], sound: true };

const K = { address: 'kds.address', key: 'kds.key', stations: 'kds.stations', sound: 'kds.sound' };

export async function loadSettings(): Promise<Settings> {
  const get = (k: string) => SecureStore.getItemAsync(k).catch(() => null);
  const [address, key, stations, sound] = await Promise.all([get(K.address), get(K.key), get(K.stations), get(K.sound)]);
  let st: string[] = [];
  try {
    const parsed = JSON.parse(stations ?? '[]');
    if (Array.isArray(parsed)) st = parsed.filter((x) => typeof x === 'string');
  } catch {}
  return { address: address ?? '', key: key ?? '', stations: st, sound: sound == null ? true : sound === '1' };
}

export async function saveSettings(s: Settings): Promise<void> {
  await Promise.all([
    SecureStore.setItemAsync(K.address, s.address),
    SecureStore.setItemAsync(K.key, s.key),
    SecureStore.setItemAsync(K.stations, JSON.stringify(s.stations)),
    SecureStore.setItemAsync(K.sound, s.sound ? '1' : '0'),
  ]);
}
