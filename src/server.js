/** Tiny HTTP server: the display page plus a JSON API. No framework. */
import { createHash, timingSafeEqual } from 'node:crypto';
import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import * as db from './db.js';
import { itemTotals } from './tickets.js';

const publicDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', 'public');

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
};

const digest = (v) => createHash('sha256').update(v).digest();

/** With no key configured the API is open (LAN only); with one, the Android app and web page must send it. */
export function authorized(header, queryKey, key) {
  if (!key) return true;
  const m = /^Bearer (.+)$/.exec(header ?? '');
  const given = m ? m[1] : queryKey ?? '';
  return timingSafeEqual(digest(given), digest(key));
}

function send(res, status, body, type = 'application/json; charset=utf-8') {
  res.writeHead(status, { 'content-type': type, 'cache-control': 'no-store' });
  res.end(typeof body === 'string' || Buffer.isBuffer(body) ? body : JSON.stringify(body));
}

export function createKitchenServer(config) {
  return createServer(async (req, res) => {
    try {
      const url = new URL(req.url, 'http://x');
      const parts = url.pathname.split('/').filter(Boolean).map(decodeURIComponent);

      if (parts[0] === 'api' && !authorized(req.headers.authorization, url.searchParams.get('key'), config.key)) {
        return send(res, 401, { error: 'bad key' });
      }
      if (req.method === 'GET' && parts[0] === 'api' && parts[1] === 'health') {
        return send(res, 200, { ok: true, database: config.sql.database });
      }

      if (req.method === 'GET' && parts[0] === 'api' && parts[1] === 'tickets') {
        const view = url.searchParams.get('view') === 'completed' ? 'completed' : 'active';
        const stations = (url.searchParams.get('stations') ?? '').split(',').filter(Boolean);
        const [tickets, now] = await Promise.all([
          db.readTickets(config, {
            view,
            stations,
            windowHours: config.windowHours,
            recallCount: config.recallCount,
          }),
          db.serverNow(config),
        ]);
        return send(res, 200, {
          now,
          view,
          warnMinutes: config.warnMinutes,
          lateMinutes: config.lateMinutes,
          tickets,
          totals: view === 'active' ? itemTotals(tickets) : [],
        });
      }
      if (req.method === 'GET' && parts[0] === 'api' && parts[1] === 'categories') {
        return send(res, 200, await db.readCategories(config));
      }
      if (req.method === 'POST' && parts[0] === 'api' && parts[1] === 'orders' && parts.length === 4) {
        const [, , id, action] = parts;
        if (action === 'ready') await db.markReady(config, id);
        else if (action === 'bump') await db.bump(config, id);
        else if (action === 'recall') await db.recall(config, id);
        else return send(res, 404, { error: 'unknown action' });
        return send(res, 200, { ok: true });
      }
      if (req.method === 'POST' && parts[0] === 'api' && parts[1] === 'lines' && parts.length === 4) {
        const [, , uid, action] = parts;
        if (action !== 'done' && action !== 'undone') return send(res, 404, { error: 'unknown action' });
        await db.setLineDone(config, uid, action === 'done');
        return send(res, 200, { ok: true });
      }

      if (req.method === 'GET') {
        const file = url.pathname === '/' ? 'index.html' : url.pathname.slice(1);
        const full = path.resolve(publicDir, file);
        if (!full.startsWith(publicDir + path.sep)) return send(res, 403, 'forbidden', 'text/plain');
        try {
          return send(res, 200, await readFile(full), MIME[path.extname(full)] ?? 'application/octet-stream');
        } catch {
          return send(res, 404, 'not found', 'text/plain');
        }
      }
      send(res, 404, { error: 'not found' });
    } catch (err) {
      console.error(new Date().toISOString(), req.method, req.url, err.message);
      send(res, 500, { error: err.message });
    }
  });
}
