/** All SQL for the kitchen display. */
import sql from 'mssql';

import { buildTickets } from './tickets.js';

let poolPromise = null;

export function getPool(config) {
  if (!poolPromise) {
    poolPromise = new sql.ConnectionPool(config).connect().catch((err) => {
      poolPromise = null; // try again on the next request
      throw err;
    });
  }
  return poolPromise;
}

const ID = sql.NVarChar(64);

/** Open tickets (view 'active') or the most recently bumped ones (view 'completed'). */
export async function readTickets(config, { view, stations, windowHours, recallCount }) {
  const pool = await getPool(config.sql);
  const req = pool.request();
  let orderSql;
  if (view === 'completed') {
    req.input('n', sql.Int, recallCount);
    orderSql = `SELECT TOP (@n) id, number, created_at, customer_name, pager_number, order_up_at, completed_at
                  FROM dbo.orders WHERE status = N'completed' AND completed_at IS NOT NULL
                 ORDER BY completed_at DESC`;
  } else {
    req.input('h', sql.Int, windowHours);
    orderSql = `SELECT id, number, created_at, customer_name, pager_number, order_up_at, completed_at
                  FROM dbo.orders
                 WHERE status = N'completed' AND completed_at IS NULL
                   AND created_at > DATEADD(hour, -@h, SYSUTCDATETIME())
                 ORDER BY created_at, number`;
  }
  const orders = (await req.query(orderSql)).recordset;
  if (orders.length === 0) return [];

  const lineReq = pool.request();
  const inList = orders
    .map((o, i) => {
      lineReq.input(`o${i}`, ID, o.id);
      return `@o${i}`;
    })
    .join(',');
  const lines = (
    await lineReq.query(
      `SELECT l.uid, l.order_id, l.name, l.qty, l.note, l.line_index, i.category_id, d.done_at
         FROM dbo.order_lines l
         LEFT JOIN dbo.items i ON i.id = l.item_id
         LEFT JOIN dbo.kitchen_line_done d ON d.line_uid = l.uid
        WHERE l.order_id IN (${inList})`,
    )
  ).recordset;
  const mods = (
    await lineReq.query(
      `SELECT m.line_uid, m.group_name, m.option_name
         FROM dbo.order_line_modifiers m
         JOIN dbo.order_lines l ON l.uid = m.line_uid
        WHERE l.order_id IN (${inList})
        ORDER BY m.id`,
    )
  ).recordset;
  const tickets = buildTickets(orders, lines, mods, stations);
  if (view === 'completed') tickets.sort((a, b) => b.completedAt.localeCompare(a.completedAt));
  return tickets;
}

export async function readCategories(config) {
  const pool = await getPool(config.sql);
  const r = await pool.request().query('SELECT id, name FROM dbo.categories ORDER BY sort_order, name');
  return r.recordset;
}

export async function serverNow(config) {
  const pool = await getPool(config.sql);
  const r = await pool.request().query('SELECT SYSUTCDATETIME() AS now');
  return r.recordset[0].now.toISOString();
}

/** Marks the order ready (the pager app's "order up"). Keeps the first time it was set. */
export async function markReady(config, orderId) {
  const pool = await getPool(config.sql);
  await pool
    .request()
    .input('id', ID, orderId)
    .query('UPDATE dbo.orders SET order_up_at = COALESCE(order_up_at, SYSUTCDATETIME()) WHERE id = @id');
}

/** Bump: the order leaves the screen. Also ready, if it wasn't already. */
export async function bump(config, orderId) {
  const pool = await getPool(config.sql);
  await pool
    .request()
    .input('id', ID, orderId)
    .query(`UPDATE dbo.orders
               SET completed_at = COALESCE(completed_at, SYSUTCDATETIME()),
                   order_up_at  = COALESCE(order_up_at, SYSUTCDATETIME())
             WHERE id = @id`);
}

/** Recall a bumped order back onto the screen. Ready stays as it was. */
export async function recall(config, orderId) {
  const pool = await getPool(config.sql);
  await pool.request().input('id', ID, orderId).query('UPDATE dbo.orders SET completed_at = NULL WHERE id = @id');
}

export async function setLineDone(config, lineUid, done) {
  const pool = await getPool(config.sql);
  const req = pool.request().input('uid', ID, lineUid);
  if (done) {
    await req.query(
      `IF NOT EXISTS (SELECT 1 FROM dbo.kitchen_line_done WHERE line_uid = @uid)
         INSERT INTO dbo.kitchen_line_done (line_uid) VALUES (@uid)`,
    );
  } else {
    await req.query('DELETE FROM dbo.kitchen_line_done WHERE line_uid = @uid');
  }
}
