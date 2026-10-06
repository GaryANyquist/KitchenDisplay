// Writes assets/chime.wav: two soft bell notes, 16-bit mono. Run once: node scripts/make-chime.js
const fs = require('fs');
const path = require('path');
const rate = 22050;
const notes = [[880, 0], [1175, 0.18]];
const total = Math.floor(rate * 0.8);
const samples = new Int16Array(total);
for (const [f, start] of notes) {
  for (let i = 0; i < rate * 0.5; i++) {
    const idx = Math.floor(start * rate) + i;
    if (idx >= total) break;
    const t = i / rate;
    const env = Math.min(1, t / 0.01) * Math.exp(-t * 7);
    samples[idx] += Math.round(Math.sin(2 * Math.PI * f * t) * env * 12000);
  }
}
const data = Buffer.from(samples.buffer);
const h = Buffer.alloc(44);
h.write('RIFF', 0); h.writeUInt32LE(36 + data.length, 4); h.write('WAVEfmt ', 8);
h.writeUInt32LE(16, 16); h.writeUInt16LE(1, 20); h.writeUInt16LE(1, 22);
h.writeUInt32LE(rate, 24); h.writeUInt32LE(rate * 2, 28); h.writeUInt16LE(2, 32); h.writeUInt16LE(16, 34);
h.write('data', 36); h.writeUInt32LE(data.length, 40);
fs.writeFileSync(path.join(__dirname, '..', 'assets', 'chime.wav'), Buffer.concat([h, data]));
