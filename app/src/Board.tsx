import { useAudioPlayer } from 'expo-audio';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { AppState, Modal, Pressable, ScrollView, Text, View, useWindowDimensions } from 'react-native';

import { fetchCategories, fetchTickets, lineAction, orderAction, type Connection } from './api';
import { ageState, formatAge, newTicketIds, primaryAction, type AgeState, type Ticket, type TicketsResponse } from './lib/kitchen';
import type { Settings } from './settings';
import { c } from './theme';

const POLL_MS = 3000;
const stateColor: Record<AgeState, string> = { fresh: c.ok, warn: c.warn, late: c.late, ready: c.ready, done: c.done };
const fmtTime = (iso: string) => new Date(iso).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });

export function Board({
  conn,
  settings,
  onSettings,
  onChange,
}: {
  conn: Connection;
  settings: Settings;
  onSettings: () => void;
  onChange: (s: Settings) => void;
}) {
  const { width } = useWindowDimensions();
  const [view, setView] = useState<'active' | 'completed'>('active');
  const [data, setData] = useState<TicketsResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [offset, setOffset] = useState(0); // PC clock minus this tablet's clock
  const [, setTick] = useState(0);
  const [categories, setCategories] = useState<{ id: string; name: string }[]>([]);
  const [picking, setPicking] = useState(false);
  const busy = useRef(0);
  const known = useRef<Set<string> | null>(null);
  const chime = useAudioPlayer(require('../assets/chime.wav'));

  const playChime = useCallback(() => {
    if (!settings.sound) return;
    try {
      chime.seekTo(0);
      chime.play();
    } catch {}
  }, [chime, settings.sound]);

  const load = useCallback(async () => {
    if (busy.current) return;
    try {
      const d = await fetchTickets(conn, view, settings.stations);
      if (busy.current) return;
      setOffset(new Date(d.now).getTime() - Date.now());
      setData(d);
      setError(null);
      if (view === 'active') {
        if (newTicketIds(known.current, d.tickets)) playChime();
        known.current = new Set(d.tickets.map((t) => t.id));
      }
    } catch (e) {
      setError((e as Error).message);
    }
  }, [conn, view, settings.stations, playChime]);

  useEffect(() => {
    known.current = null;
    void load();
    const poll = setInterval(() => void load(), POLL_MS);
    const sub = AppState.addEventListener('change', (s) => s === 'active' && void load());
    return () => {
      clearInterval(poll);
      sub.remove();
    };
  }, [load]);

  useEffect(() => {
    const t = setInterval(() => setTick((n) => n + 1), 1000);
    return () => clearInterval(t);
  }, []);

  useEffect(() => {
    fetchCategories(conn).then(setCategories).catch(() => {});
  }, [conn]);

  const write = async (job: () => Promise<unknown>) => {
    busy.current++;
    try {
      await job();
      setError(null);
    } catch (e) {
      setError(`Not saved: ${(e as Error).message}`);
    } finally {
      busy.current--;
    }
    void load();
  };

  const toggleLine = (t: Ticket, uid: string) => {
    if (view !== 'active' || !data) return;
    const done = !t.lines.find((l) => l.uid === uid)!.done;
    setData({
      ...data,
      tickets: data.tickets.map((x) =>
        x.id === t.id ? { ...x, lines: x.lines.map((l) => (l.uid === uid ? { ...l, done } : l)) } : x
      ),
    });
    void write(() => lineAction(conn, uid, done));
  };

  const press = (t: Ticket) => {
    if (!data) return;
    const action = primaryAction(t, view === 'completed');
    setData({
      ...data,
      tickets:
        action === 'ready'
          ? data.tickets.map((x) => (x.id === t.id ? { ...x, readyAt: new Date(Date.now() + offset).toISOString() } : x))
          : data.tickets.filter((x) => x.id !== t.id),
    });
    void write(() => orderAction(conn, t.id, action));
  };

  const now = Date.now() + offset;
  const tickets = data?.tickets ?? [];
  const perRow = Math.max(1, Math.floor((width - 32 + 14) / (270 + 14)));
  const cardWidth = Math.floor((width - 32 - 14 * (perRow - 1)) / perRow);
  const stationLabel = useMemo(() => {
    if (!settings.stations.length) return 'All items';
    return (
      categories.filter((x) => settings.stations.includes(x.id)).map((x) => x.name).join(', ') ||
      `${settings.stations.length} categories`
    );
  }, [settings.stations, categories]);

  return (
    <View style={{ flex: 1, backgroundColor: c.bg }}>
      <View
        style={{
          flexDirection: 'row',
          alignItems: 'center',
          gap: 10,
          padding: 10,
          paddingHorizontal: 16,
          backgroundColor: c.panel,
          borderBottomWidth: 1,
          borderColor: c.line,
        }}
      >
        <Text style={{ color: c.text, fontSize: 20, fontWeight: '800', marginRight: 6 }}>Kitchen</Text>
        <Tab label={view === 'active' ? `Open (${tickets.length})` : 'Open'} on={view === 'active'} onPress={() => setView('active')} />
        <Tab label="Completed" on={view === 'completed'} onPress={() => setView('completed')} />
        <Chip label={stationLabel} on={settings.stations.length > 0} onPress={() => setPicking(true)} />
        <View style={{ flex: 1 }} />
        {error ? (
          <Text style={{ color: c.late, fontWeight: '700', flexShrink: 1 }} numberOfLines={1}>
            {error}
          </Text>
        ) : null}
        <Chip
          label={settings.sound ? 'Sound on' : 'Sound off'}
          on={settings.sound}
          onPress={() => onChange({ ...settings, sound: !settings.sound })}
        />
        <Chip label="Settings" onPress={onSettings} />
        <Text style={{ color: c.muted, fontSize: 18, minWidth: 80, textAlign: 'right' }}>
          {new Date().toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })}
        </Text>
      </View>

      {view === 'active' && data && data.totals.length > 0 ? (
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          style={{ flexGrow: 0, backgroundColor: '#181b20' }}
          contentContainerStyle={{ gap: 8, padding: 8, paddingHorizontal: 16 }}
        >
          {data.totals.map((x) => (
            <View
              key={x.name}
              style={{ flexDirection: 'row', alignItems: 'baseline', backgroundColor: c.panel2, borderRadius: 999, paddingVertical: 6, paddingHorizontal: 14 }}
            >
              <Text style={{ color: '#fff', fontSize: 17, fontWeight: '800', marginRight: 6 }}>{x.qty}</Text>
              <Text style={{ color: c.text, fontSize: 15 }}>{x.name}</Text>
            </View>
          ))}
        </ScrollView>
      ) : null}

      <ScrollView contentContainerStyle={{ padding: 16, flexDirection: 'row', flexWrap: 'wrap', gap: 14, alignItems: 'flex-start' }}>
        {data && tickets.length === 0 ? (
          <Text style={{ color: c.muted, fontSize: 24, textAlign: 'center', width: '100%', marginTop: 100 }}>
            {view === 'active' ? 'No open orders' : 'Nothing bumped yet'}
          </Text>
        ) : null}
        {tickets.map((t) => (
          <TicketCard
            key={t.id}
            t={t}
            width={cardWidth}
            nowMs={now}
            view={view}
            warn={settings.warnSeconds}
            late={settings.lateSeconds}
            onLine={toggleLine}
            onPress={press}
          />
        ))}
      </ScrollView>

      <Modal visible={picking} transparent animationType="fade" onRequestClose={() => setPicking(false)}>
        <View style={{ flex: 1, backgroundColor: 'rgba(0,0,0,.6)', justifyContent: 'center', alignItems: 'center' }}>
          <View style={{ backgroundColor: c.panel, borderRadius: 14, padding: 20, width: 420, maxHeight: '85%' }}>
            <Text style={{ color: c.text, fontSize: 20, fontWeight: '800' }}>Show these categories</Text>
            <Text style={{ color: c.muted, marginBottom: 10 }}>Pick the ones for this screen. Nothing picked shows every item.</Text>
            <ScrollView>
              {categories.map((cat) => {
                const on = settings.stations.includes(cat.id);
                return (
                  <Pressable
                    key={cat.id}
                    onPress={() =>
                      onChange({
                        ...settings,
                        stations: on ? settings.stations.filter((s) => s !== cat.id) : [...settings.stations, cat.id],
                      })
                    }
                    style={{ flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 14, borderBottomWidth: 1, borderColor: c.line }}
                  >
                    <View
                      style={{
                        width: 24,
                        height: 24,
                        borderRadius: 6,
                        borderWidth: 2,
                        borderColor: on ? c.accent : c.line,
                        backgroundColor: on ? c.accent : 'transparent',
                        alignItems: 'center',
                        justifyContent: 'center',
                      }}
                    >
                      {on ? <Text style={{ color: '#fff', fontWeight: '800' }}>✓</Text> : null}
                    </View>
                    <Text style={{ color: c.text, fontSize: 18 }}>{cat.name}</Text>
                  </Pressable>
                );
              })}
            </ScrollView>
            <Pressable onPress={() => setPicking(false)} style={{ backgroundColor: c.accent, borderRadius: 10, padding: 14, marginTop: 14 }}>
              <Text style={{ color: '#fff', fontSize: 18, fontWeight: '700', textAlign: 'center' }}>Done</Text>
            </Pressable>
          </View>
        </View>
      </Modal>
    </View>
  );
}

function TicketCard({
  t,
  width,
  nowMs,
  view,
  warn,
  late,
  onLine,
  onPress,
}: {
  t: Ticket;
  width: number;
  nowMs: number;
  view: 'active' | 'completed';
  warn: number;
  late: number;
  onLine: (t: Ticket, uid: string) => void;
  onPress: (t: Ticket) => void;
}) {
  const state = ageState(t, nowMs, warn, late, view === 'completed');
  const action = primaryAction(t, view === 'completed');
  const age =
    view === 'completed' && t.completedAt
      ? formatAge(new Date(t.completedAt).getTime() - new Date(t.createdAt).getTime())
      : formatAge(nowMs - new Date(t.createdAt).getTime());
  const headText = state === 'warn' ? '#1a1400' : '#fff';
  return (
    <View style={{ width, backgroundColor: c.panel, borderRadius: 12, overflow: 'hidden' }}>
      <View
        style={{
          flexDirection: 'row',
          alignItems: 'baseline',
          gap: 8,
          padding: 10,
          paddingHorizontal: 14,
          backgroundColor: stateColor[state],
        }}
      >
        <Text style={{ color: headText, fontSize: 28, fontWeight: '800' }}>{t.pager ? `Pager ${t.pager}` : `#${t.number}`}</Text>
        <Text style={{ color: headText, fontSize: 16, fontWeight: '600', flex: 1 }} numberOfLines={1}>
          {t.name ?? ''}
        </Text>
        <Text style={{ color: headText, fontSize: 20, fontWeight: '700', fontVariant: ['tabular-nums'] }}>{age}</Text>
      </View>
      <View style={{ flexDirection: 'row', gap: 8, paddingHorizontal: 14, paddingVertical: 6, borderBottomWidth: 1, borderColor: c.line }}>
        <Text style={{ color: c.muted, fontSize: 13 }}>{fmtTime(t.createdAt)}</Text>
        {t.pager ? <Pill text={`Order #${t.number}`} /> : null}
        {t.readyAt && view === 'active' ? <Pill text="Ready" /> : null}
      </View>
      {t.lines.map((l) => (
        <Pressable
          key={l.uid}
          onPress={() => onLine(t, l.uid)}
          style={{
            flexDirection: 'row',
            gap: 12,
            padding: 12,
            paddingHorizontal: 14,
            borderBottomWidth: 1,
            borderColor: c.line,
            opacity: l.done ? 0.55 : 1,
          }}
        >
          <Text style={[{ color: c.text, fontSize: 22, fontWeight: '800', minWidth: 28 }, l.done && strike]}>{l.qty}</Text>
          <View style={{ flex: 1 }}>
            <Text style={[{ color: c.text, fontSize: 20, fontWeight: '600' }, l.done && strike]}>{l.name}</Text>
            {l.mods.map((m, i) => (
              <Text key={i} style={[{ color: '#c7cdd6', fontSize: 16, marginTop: 2 }, l.done && strike]}>
                + {m}
              </Text>
            ))}
            {l.note ? (
              <Text style={[{ color: c.note, fontSize: 16, fontStyle: 'italic', marginTop: 2 }, l.done && strike]}>
                “{l.note}”
              </Text>
            ) : null}
          </View>
          <View
            style={{
              width: 26,
              height: 26,
              borderRadius: 13,
              borderWidth: 2,
              borderColor: l.done ? c.ok : c.line,
              backgroundColor: l.done ? c.ok : 'transparent',
              alignSelf: 'center',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            {l.done ? <Text style={{ color: '#fff', fontSize: 15, fontWeight: '800' }}>✓</Text> : null}
          </View>
        </Pressable>
      ))}
      <Pressable
        onPress={() => onPress(t)}
        style={{ margin: 10, padding: 14, borderRadius: 10, backgroundColor: action === 'bump' ? c.ok : action === 'recall' ? c.done : c.accent }}
      >
        <Text style={{ color: '#fff', fontSize: 18, fontWeight: '700', textAlign: 'center' }}>
          {action === 'ready' ? 'Ready' : action === 'bump' ? 'Complete' : 'Recall'}
        </Text>
      </Pressable>
    </View>
  );
}

const strike = { textDecorationLine: 'line-through', color: c.muted } as const;

function Pill({ text }: { text: string }) {
  return (
    <Text style={{ color: c.text, backgroundColor: c.panel2, borderRadius: 999, paddingHorizontal: 8, fontSize: 13, fontWeight: '600', overflow: 'hidden' }}>
      {text}
    </Text>
  );
}

function Tab({ label, on, onPress }: { label: string; on: boolean; onPress: () => void }) {
  return (
    <Pressable onPress={onPress} style={{ paddingVertical: 10, paddingHorizontal: 18, borderRadius: 8, backgroundColor: on ? c.accent : c.panel2 }}>
      <Text style={{ color: on ? '#fff' : c.muted, fontSize: 16, fontWeight: '700' }}>{label}</Text>
    </Pressable>
  );
}

function Chip({ label, on, onPress }: { label: string; on?: boolean; onPress: () => void }) {
  return (
    <Pressable
      onPress={onPress}
      style={{ paddingVertical: 10, paddingHorizontal: 14, borderRadius: 8, borderWidth: 1, borderColor: on ? c.accent : c.line, backgroundColor: c.panel2, maxWidth: 260 }}
    >
      <Text style={{ color: c.text, fontSize: 15 }} numberOfLines={1}>
        {label}
      </Text>
    </Pressable>
  );
}
