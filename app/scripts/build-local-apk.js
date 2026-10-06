/*
 * Builds the Kitchen Display APK on this PC (same setup as the register app's build:local):
 * Java 17 and the Android SDK in %LOCALAPPDATA%\Android\Sdk. The APK is signed with
 * the debug key that prebuild sets up, which is fine for sideloading onto the kitchen tablet.
 *
 *   npm run build:local       -> dist-apk/KitchenDisplay-<version>.apk
 *
 * Bump expo.version in app.json first so the Settings screen and the file name tell builds apart.
 */
const { execFileSync } = require('child_process');
const fs = require('fs');
const path = require('path');

const root = path.join(__dirname, '..');
const win = process.platform === 'win32';
const fail = (m) => { console.error(`\n${m}`); process.exit(1); };

function findJava() {
  if (process.env.JAVA_HOME && fs.existsSync(process.env.JAVA_HOME)) return process.env.JAVA_HOME;
  const base = 'C:\Program Files\Microsoft';
  const jdk = fs.existsSync(base) ? fs.readdirSync(base).find((d) => /^jdk-17/.test(d)) : undefined;
  if (!jdk) fail('Java 17 not found. Install it with: winget install Microsoft.OpenJDK.17');
  return path.join(base, jdk);
}

const javaHome = findJava();
const androidHome = process.env.ANDROID_HOME || path.join(process.env.LOCALAPPDATA || '', 'Android', 'Sdk');
if (!fs.existsSync(path.join(androidHome, 'cmdline-tools'))) fail(`Android SDK not found in ${androidHome}.`);
const env = { ...process.env, JAVA_HOME: javaHome, ANDROID_HOME: androidHome, NODE_ENV: 'production' };
const version = JSON.parse(fs.readFileSync(path.join(root, 'app.json'), 'utf8')).expo.version;
console.log(`Building Kitchen Display ${version} with Java at ${javaHome}`);

// Prebuild rewrites package.json's scripts; put them back afterwards.
const pkgPath = path.join(root, 'package.json');
const pkg = fs.readFileSync(pkgPath, 'utf8');
try {
  execFileSync(win ? 'npx.cmd' : 'npx', ['expo', 'prebuild', '--platform', 'android', '--clean', '--no-install'], {
    cwd: root, env, stdio: 'inherit', shell: win,
  });
} finally {
  fs.writeFileSync(pkgPath, pkg);
}

const androidDir = path.join(root, 'android');
execFileSync(path.join(androidDir, win ? 'gradlew.bat' : 'gradlew'), ['assembleRelease', '--no-daemon'], {
  cwd: androidDir, env, stdio: 'inherit', shell: win,
});

const built = path.join(androidDir, 'app', 'build', 'outputs', 'apk', 'release', 'app-release.apk');
const outDir = path.join(root, 'dist-apk');
fs.mkdirSync(outDir, { recursive: true });
const out = path.join(outDir, `KitchenDisplay-${version}.apk`);
fs.copyFileSync(built, out);
console.log(`\nAPK: ${out} (${fs.statSync(out).size} bytes)`);
