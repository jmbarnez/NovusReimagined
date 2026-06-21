import {
  getAudio,
  spatialAtten,
  now,
  connectToMaster,
  _disconnectOnEnd
} from "./core.js";

export function sfxUnderAttackPulse(count = 1, x = 0, y = 0) {
  const { atten, pan } = spatialAtten(x, y, 2200);
  if (atten <= 0.001) return;
  const a = getAudio();
  if (!a) return;
  const { ctx, master } = a;
  const t0 = now();
  const vol = Math.min(0.18, 0.06 + count * 0.02) * atten;

  const osc = ctx.createOscillator();
  osc.type = "sine";
  osc.frequency.setValueAtTime(220, t0);
  osc.frequency.exponentialRampToValueAtTime(180, t0 + 0.14);

  const g = ctx.createGain();
  g.gain.setValueAtTime(vol, t0);
  g.gain.exponentialRampToValueAtTime(0.001, t0 + 0.18);

  const pn = connectToMaster(g, master, pan);
  osc.connect(g);
  osc.start(t0); osc.stop(t0 + 0.18);
  _disconnectOnEnd(osc, g, pn!);
}

export function sfxBlip(pitch = 880, dur = 0.06) {
  const a = getAudio();
  if (!a) return;
  const { ctx, master } = a;
  const t0 = now();
  const osc = ctx.createOscillator();
  osc.type = "square";
  osc.frequency.setValueAtTime(pitch, t0);
  const g = ctx.createGain();
  g.gain.setValueAtTime(0.1, t0);
  g.gain.exponentialRampToValueAtTime(0.001, t0 + dur);
  osc.connect(g).connect(master);
  osc.start(t0);
  osc.stop(t0 + dur);
  _disconnectOnEnd(osc, g);
}

export function sfxConfirm() {
  sfxBlip(1100, 0.05);
  setTimeout(() => sfxBlip(1320, 0.06), 60);
}

export function sfxError() {
  sfxBlip(300, 0.1);
}

