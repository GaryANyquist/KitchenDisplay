import * as SecureStore from 'expo-secure-store';

export interface Settings {
  address: string;
  key: string;
  stations: string[];
  sound: boolean;
  /** Seconds until the badge turns yellow / red. */
  warnSeconds: number;
  lateSeconds: number;
}

export const DEFAULTS: Settings = { address: '', key: '', stations: [], sound: true, warnSeconds: 300, lateSeconds: 600 };

const K = { address: 'kds.address', key: 'kds.key', stations: 'kds.stations', sound: 'kds.sound', warn: 'kds.warnSeconds', late: 'kds.lateSeconds' };

export async function loadSettings(): Promise<Settings> {
  const get = (k: string) => SecureStore.getItemAsync(k).catch(() => null);
  const [address, key, stations, sound, warn, late] = await Promise.all([
    get(K.address), get(K.key), get(K.stations), get(K.sound), get(K.warn), get(K.late),
  ]);
  const secs = (v: string | null, d: number) => (v && /^[0-9]+$/.test(v) && Number(v) >= 1 ? Number(v) : d);
  let st: string[] = [];
  try {
    const parsed = JSON.parse(stations ?? '[]');
    if (Array.isArray(parsed)) st = parsed.filter((x) => typeof x === 'string');
  } catch {}
  return { address: address ?? '', key: key ?? '', stations: st, sound: sound == null ? true : sound === '1',
    warnSeconds: secs(warn, DEFAULTS.warnSeconds),
    lateSeconds: secs(late, DEFAULTS.lateSeconds),
  };
}

export async function saveSettings(s: Settings): Promise<void> {
  await Promise.all([
    SecureStore.setItemAsync(K.address, s.address),
    SecureStore.setItemAsync(K.key, s.key),
    SecureStore.setItemAsync(K.stations, JSON.stringify(s.stations)),
    SecureStore.setItemAsync(K.sound, s.sound ? '1' : '0'),
    SecureStore.setItemAsync(K.warn, String(s.warnSeconds)),
    SecureStore.setItemAsync(K.late, String(s.lateSeconds)),
  ]);
}
