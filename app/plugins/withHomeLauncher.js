/**
 * Lets Annaware Kitchen Display be chosen as the tablet's Home app (Android Settings > Apps > Default apps > Home app).
 * Android always starts the Home app when the tablet turns on and is unlocked, which is the dependable way for an app to open
 * by itself at boot: since Android 10 an ordinary app may not start itself from a boot broadcast.
 *
 * This only ADDS the ability. The tablet's own launcher stays the default until someone picks this app, so nothing changes
 * on a tablet where it is not chosen.
 */
const { withAndroidManifest } = require('expo/config-plugins');

const HOME = 'android.intent.category.HOME';

module.exports = function withHomeLauncher(config) {
  return withAndroidManifest(config, (c) => {
    const app = c.modResults.manifest.application && c.modResults.manifest.application[0];
    const main = app && (app.activity || []).find((a) => a.$ && a.$['android:name'] === '.MainActivity');
    if (!main) throw new Error('withHomeLauncher: MainActivity was not found in the manifest');
    main['intent-filter'] = main['intent-filter'] || [];
    const already = main['intent-filter'].some((f) => (f.category || []).some((x) => x.$ && x.$['android:name'] === HOME));
    if (!already) {
      main['intent-filter'].push({
        action: [{ $: { 'android:name': 'android.intent.action.MAIN' } }],
        category: [{ $: { 'android:name': HOME } }, { $: { 'android:name': 'android.intent.category.DEFAULT' } }],
      });
    }
    return c;
  });
};
