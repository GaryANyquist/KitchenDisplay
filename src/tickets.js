/**
 * Pure shaping of database rows into kitchen tickets (no SQL, no I/O), so it
 * can be tested without a database.
 */

const iso = (d) => (d ? new Date(d).toISOString() : null);

/**
 * @param orders   rows from orders (id, number, created_at, customer_name, pager_number, order_up_at, completed_at)
 * @param lines    rows from order_lines (uid, order_id, name, qty, note, line_index, category_id, done_at)
 * @param mods     rows from order_line_modifiers (line_uid, group_name, option_name)
 * @param stations optional array of category ids: only those lines are shown, and
 *                 tickets with no lines at the station are left out
 */
export function buildTickets(orders, lines, mods, stations = null) {
  const modsByLine = new Map();
  for (const m of mods) {
    if (!modsByLine.has(m.line_uid)) modsByLine.set(m.line_uid, []);
    modsByLine.get(m.line_uid).push(m.option_name);
  }
  const linesByOrder = new Map();
  for (const l of lines) {
    if (stations && stations.length && !stations.includes(l.category_id)) continue;
    if (!linesByOrder.has(l.order_id)) linesByOrder.set(l.order_id, []);
    linesByOrder.get(l.order_id).push({
      uid: l.uid,
      name: l.name,
      qty: l.qty,
      note: l.note || null,
      mods: modsByLine.get(l.uid) ?? [],
      done: l.done_at != null,
      _i: l.line_index,
    });
  }
  const tickets = [];
  for (const o of orders) {
    const ls = linesByOrder.get(o.id);
    if (!ls || ls.length === 0) continue;
    ls.sort((a, b) => a._i - b._i);
    for (const l of ls) delete l._i;
    tickets.push({
      id: o.id,
      number: o.number,
      name: o.customer_name || null,
      pager: o.pager_number || null,
      createdAt: iso(o.created_at),
      readyAt: iso(o.order_up_at),
      completedAt: iso(o.completed_at),
      lines: ls,
    });
  }
  return tickets;
}

/** Quantities still to make, by item name, across the tickets given. */
export function itemTotals(tickets) {
  const totals = new Map();
  for (const t of tickets) {
    for (const l of t.lines) {
      if (l.done) continue;
      totals.set(l.name, (totals.get(l.name) ?? 0) + l.qty);
    }
  }
  return [...totals.entries()]
    .map(([name, qty]) => ({ name, qty }))
    .sort((a, b) => b.qty - a.qty || a.name.localeCompare(b.name));
}
