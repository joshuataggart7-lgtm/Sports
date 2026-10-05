// Generates placeholder celebration sounds (synthesized, royalty-free) so the audio path can be
// tested before you drop in your own clips: an air-horn style touchdown blast and a short fanfare.
import fs from "node:fs";
const RATE = 44100;
function wav(samples) {
  const buf = Buffer.alloc(44 + samples.length * 2);
  buf.write("RIFF", 0); buf.writeUInt32LE(36 + samples.length * 2, 4); buf.write("WAVE", 8); buf.write("fmt ", 12);
  buf.writeUInt32LE(16, 16); buf.writeUInt16LE(1, 20); buf.writeUInt16LE(1, 22); buf.writeUInt32LE(RATE, 24); buf.writeUInt32LE(RATE * 2, 28); buf.writeUInt16LE(2, 32); buf.writeUInt16LE(16, 34);
  buf.write("data", 36); buf.writeUInt32LE(samples.length * 2, 40);
  samples.forEach((v, i) => buf.writeInt16LE(Math.max(-1, Math.min(1, v)) * 32767, 44 + i * 2));
  return buf;
}
function horn(seconds, f0) {
  const n = Math.floor(RATE * seconds), out = new Float64Array(n);
  for (let i = 0; i < n; i++) {
    const t = i / RATE, env = Math.min(1, t * 20) * Math.min(1, (seconds - t) * 6);
    let v = 0;
    for (let h = 1; h <= 8; h++) v += Math.sin(2 * Math.PI * f0 * h * t + Math.sin(t * 7) * 0.2) / h;
    out[i] = v * 0.35 * env;
  }
  return out;
}
function fanfare() {
  const notes = [392, 523, 659, 784, 1047], per = 0.18, n = Math.floor(RATE * (notes.length * per + 0.8)), out = new Float64Array(n);
  notes.forEach((f, k) => { const s = Math.floor(k * per * RATE), len = k === notes.length - 1 ? RATE * 0.9 : RATE * per; for (let i = 0; i < len && s + i < n; i++) { const t = i / RATE, env = Math.min(1, t * 60) * Math.exp(-t * (k === notes.length - 1 ? 2.5 : 8)); out[s + i] += (Math.sin(2 * Math.PI * f * t) + 0.5 * Math.sin(2 * Math.PI * f * 2 * t) + 0.25 * Math.sin(2 * Math.PI * f * 3 * t)) * 0.3 * env; } });
  return out;
}
function noiseBurst(seconds, attack, decay, lowpass) {
  // Crowd roar / boom placeholders: filtered noise with an envelope.
  const n = Math.floor(RATE * seconds), out = new Float64Array(n);
  let y = 0;
  for (let i = 0; i < n; i++) {
    const t = i / RATE, env = Math.min(1, t / attack) * Math.exp(-Math.max(0, t - attack) * decay);
    y += (Math.random() * 2 - 1 - y) * lowpass;
    out[i] = y * env * 0.9;
  }
  return out;
}
function boom() {
  const n = Math.floor(RATE * 1.4), out = new Float64Array(n);
  for (let i = 0; i < n; i++) { const t = i / RATE, f = 120 * Math.exp(-t * 6) + 35; out[i] = Math.sin(2 * Math.PI * f * t) * Math.exp(-t * 3.5) * 0.9; }
  const n2 = noiseBurst(0.3, 0.005, 25, 0.5);
  for (let i = 0; i < n2.length; i++) out[i] += n2[i] * 0.4;
  return out;
}
fs.writeFileSync("boom.wav", wav(boom()));
fs.writeFileSync("crowd_roar.wav", wav(noiseBurst(5, 0.8, 0.7, 0.08)));
fs.writeFileSync("horn.wav", wav(horn(2.0, 98)));
fs.writeFileSync("big_play.wav", wav(horn(0.6, 196)));
fs.writeFileSync("touchdown.wav", wav(horn(2.2, 110)));
fs.writeFileSync("miss_celebration.wav", wav(fanfare()));
fs.writeFileSync("celebration.wav", wav(fanfare()));
fs.writeFileSync("field_goal.wav", wav(horn(0.9, 165)));
console.log("wrote placeholder sounds");
