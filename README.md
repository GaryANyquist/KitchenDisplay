# Kitchen Display

A Square-KDS-style kitchen screen for the Comfortably Yum register. It reads the register's orders from the
**KFDisplay SQL Server** database (the one `kfdisplay-sync` fills from the tablet).

```
register tablet --kfdisplay-sync--> SQL Server <--- server (this repo, src/) <--- Android app (app/)
                     tablet <--/v1/kitchen-status-- kfdisplay-sync <---'          or any browser
```

- **`app/`** is the **Android app** for the kitchen tablet (Expo / React Native, landscape, keeps the screen awake,
  chimes on new orders). It talks to the server below over the truck's Wi-Fi; an Android app can't reach SQL Server directly.
- **`src/` + `public/`** is the server on the PC. It also serves the same screen as a web page for a TV or phone.

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
- **Voice commands (Android app, off by default):** Settings → Voice commands. The app listens through the microphone and
  completes orders you speak: "complete pager 12", "pager 12 done", "order 41 complete"; "pager 12 ready" marks it ready.
  A bare number means the pager number on the ticket (the order number if the ticket has no pager). It works on the Open tab,
  shows what it did at the bottom of the screen, and a mistake is fixed with Completed → Recall. Uses Android's speech service
  (`expo-speech-recognition`), which normally needs internet; the phrase parser is `app/src/lib/voice.ts` (tested).
- Refunded orders never show. Open orders older than 12 hours are hidden.

## Android app

1. On the PC: `npm run build:local` inside `app/` (needs Java 17 and the Android SDK, like the register app). Bump `expo.version`
   in `app/app.json` first. The APK lands in `app/dist-apk/KitchenDisplay-<version>.apk`; copy it to the kitchen tablet and install it
   (allow installs from that source).
2. Open the app. First time it asks for the PC (`CYMENUDISPLAY:8790`, or the PC's IP) and the key if `KDS_KEY` is set. **Test connection**, then Save.
3. Station and sound settings are on the top bar; Settings reopens the connection screen.

The tablet needs to be on the same Wi-Fi as the PC, and the PC must allow port 8790 through the firewall.

## Server setup (on the PC)

1. In SSMS (as administrator) run `setup/01-create-kitchen-login.sql` after replacing `CHANGE_ME`. It creates
   `dbo.kitchen_line_done` (the ticked-off items) and a `kitchen_display` login that can read the register tables
   and change only `orders.order_up_at`, `orders.completed_at` and that one table.
2. `copy .env.example .env` and fill in `DB_*` (same server settings as `kfdisplay-sync`).
3. `npm install`, then `npm start`.
4. Open `http://<this PC's name>:8790` on the kitchen screen (allow the port through Windows Firewall).
   Try `http://localhost:8790/?demo=1` to see the screen with made-up orders and no database.

### Run at startup

In an **administrator** Command Prompt (once):

```
schtasks /Create /TN "Kitchen Display" /TR "C:SourceKitchenDisplaystart-kitchen.cmd" /SC ONSTART /RU SYSTEM /RL HIGHEST /F
schtasks /Run /TN "Kitchen Display"
```

Output goes to `logskitchen.log`. Restart it with `schtasks /End /TN "Kitchen Display"` (and stop the `node.exe` using port 8790 if it stays up), then `schtasks /Run /TN "Kitchen Display"`.

Set `KDS_KEY` in `.env` to require a key (the Android app asks for it; for the web page add `?key=...`). With no key the server is open to the LAN.

## Files

- `src/tickets.js` – pure: rows → tickets, item totals (tested: `npm test`)
- `src/db.js` – all SQL; `src/server.js` – static page + JSON API; `public/index.html` – the whole UI
