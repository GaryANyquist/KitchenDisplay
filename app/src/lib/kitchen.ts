/** Pure helpers for the kitchen board (no React, no native modules): tested in test/kitchen.test.ts. */

export interface Line {
  uid: string;
  name: string;
  qty: number;
  note: string | null;
  mods: string[];
  done: boolean;
}

export interface Ticket {
  id: string;
  number: number;
  name: string | null;
  pager: string | null;
  createdAt: string;
  readyAt: string | null;
  completedAt: string | null;
  lines: Line[];
}

export interface TicketsResponse {
  now: string;
  view: 'active' | 'completed';
  warnMinutes: number;
  lateMinutes: number;
  tickets: Ticket[];
  totals: { name: string; qty: number }[];
}

export type AgeState = 'fresh' | 'warn' | 'late' | 'ready' | 'done';

/** Header colour state: green → yellow → red as the order ages; blue once ready; grey in Completed. */
export function ageState(
  t: Pick<Ticket, 'createdAt' | 'readyAt'>,
  nowMs: number,
  warnMinutes: number,
  lateMinutes: number,
  completedView = false
): AgeState {
  if (completedView) return 'done';
  if (t.readyAt) return 'ready';
  const mins = (nowMs - new Date(t.createdAt).getTime()) / 60000;
  return mins >= lateMinutes ? 'late' : mins >= warnMinutes ? 'warn' : 'fresh';
}

export function formatAge(ms: number): string {
  const s = Math.max(0, Math.floor(ms / 1000));
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
}

/** The big action button: Ready first, then Complete (or Complete straight away once every item is ticked). */
export function primaryAction(t: Pick<Ticket, 'readyAt' | 'lines'>, completedView: boolean): 'ready' | 'bump' | 'recall' {
  if (completedView) return 'recall';
  if (!t.readyAt && !t.lines.every((l) => l.done)) return 'ready';
  return 'bump';
}

/** Normalises what the user typed for the PC address: "pc:8790", "http://pc:8790/" → "http://pc:8790". */
export function baseUrl(input: string): string | null {
  const v = input.trim().replace(/\/+$/, '');
  if (!v) return null;
  const url = /^https?:\/\//i.test(v) ? v : `http://${v}`;
  return /^https?:\/\/[^\s/]+$/i.test(url) ? url : null;
}

/** Tickets with ids the board hasn't seen before (for the new-order chime). */
export function newTicketIds(known: Set<string> | null, tickets: Pick<Ticket, 'id'>[]): boolean {
  return known !== null && tickets.some((t) => !known.has(t.id));
}
