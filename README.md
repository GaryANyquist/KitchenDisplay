# Kitchen Display

A Square-KDS-style kitchen screen for the Comfortably Yum register. It reads the register's orders from the
**KFDisplay SQL Server** database (the one `kfdisplay-sync` fills from the tablet) and shows them as tickets in
any browser: a kitchen TV, a tablet, a phone.

## How it works like Square's Kitchen Display

- Every paid order appears as a ticket (order #, name, pager, time, items, modifiers, notes). New tickets chime.
- The ticket header goes **green → yellow → red** as it ages (5 / 10 minutes by default), with a running timer.
- **Tap an item** to tick it off (it is struck through). Tap again to undo.
- **Ready** marks the order up (header turns blue; sets `orders.order_up_at`, which the pager app can use).
  **Complete** bumps it off the screen (`orders.completed_at`). Once every item is ticked, the button becomes Complete.
- **Completed** tab shows the last bumped tickets; **Recall** puts one back.
- The bar under the header totals what is still to make ("6 Tomato Soup, 4 Cheeseburger").
- **Stations:** the category button picks which categories this screen shows (e.g. a Soups screen and a
  Grill screen). Remembered per browser, or put `?stations=cat1,cat2` in the URL.
- Refunded orders never show. Open orders older than 12 hours are hidden.

## Setup

1. In SSMS (as administrator) run `setup/01-create-kitchen-login.sql` after replacing `CHANGE_ME`. It creates
   `dbo.kitchen_line_done` (the ticked-off items) and a `kitchen_display` login that can read the register tables
   and change only `orders.order_up_at`, `orders.completed_at` and that one table.
2. `copy .env.example .env` and fill in `DB_*` (same server settings as `kfdisplay-sync`).
3. `npm install`, then `npm start`.
4. Open `http://<this PC's name>:8790` on the kitchen screen (allow the port through Windows Firewall).
   Try `http://localhost:8790/?demo=1` to see the screen with made-up orders and no database.

The server has no login: keep it on the truck's own network.

## Files

- `src/tickets.js` – pure: rows → tickets, item totals (tested: `npm test`)
- `src/db.js` – all SQL; `src/server.js` – static page + JSON API; `public/index.html` – the whole UI
