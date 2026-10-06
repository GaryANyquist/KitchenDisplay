import type { TicketsResponse } from './lib/kitchen';

/** Talks to the Kitchen Display server on the PC (see ../../src/server.js). */
export interface Connection {
  base: string;
  key: string;
}

const TIMEOUT_MS = 8000;

async function call(conn: Connection, path: string, init: RequestInit = {}) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
  let res: Response;
  try {
    res = await fetch(`${conn.base}${path}`, {
      ...init,
      signal: controller.signal,
      headers: conn.key ? { Authorization: `Bearer ${conn.key}` } : undefined,
    });
  } catch {
    throw new Error(`Can't reach the kitchen server at ${conn.base}.`);
  } finally {
    clearTimeout(timer);
  }
  if (res.status === 401) throw new Error("The key doesn't match the one on the PC.");
  if (!res.ok) {
    const body = (await res.json().catch(() => ({}))) as { error?: string };
    throw new Error(body.error ?? `Kitchen server error ${res.status}`);
  }
  return res.json();
}

export const fetchTickets = (c: Connection, view: 'active' | 'completed', stations: string[]) =>
  call(c, `/api/tickets?view=${view}${stations.length ? `&stations=${encodeURIComponent(stations.join(','))}` : ''}`) as Promise<TicketsResponse>;

export const fetchCategories = (c: Connection) => call(c, '/api/categories') as Promise<{ id: string; name: string }[]>;

export const orderAction = (c: Connection, id: string, action: 'ready' | 'bump' | 'recall') =>
  call(c, `/api/orders/${encodeURIComponent(id)}/${action}`, { method: 'POST' });

export const lineAction = (c: Connection, uid: string, done: boolean) =>
  call(c, `/api/lines/${encodeURIComponent(uid)}/${done ? 'done' : 'undone'}`, { method: 'POST' });

export async function testConnection(c: Connection): Promise<string> {
  const h = (await call(c, '/api/health')) as { database?: string };
  return `Connected to ${h.database ?? 'the register database'}.`;
}
