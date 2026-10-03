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
fs.writeFileSync("touchdown.wav", wav(horn(2.2, 110)));
fs.writeFileSync("miss_celebration.wav", wav(fanfare()));
fs.writeFileSync("celebration.wav", wav(fanfare()));
fs.writeFileSync("field_goal.wav", wav(horn(0.9, 165)));
console.log("wrote placeholder sounds");
