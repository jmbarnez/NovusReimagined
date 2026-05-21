import { G } from "../../state.js";

export let _ctx: AudioContext | null = null;
export let _master: GainNode | null = null;
export let _sfxVolume = 1.0;

export function getAudio(): { ctx: AudioContext; master: GainNode } | null {
  if (_ctx && _master) {
    if (_ctx.state === "suspended") _ctx.resume();
    return { ctx: _ctx, master: _master };
  }
  try {
    const AC = window.AudioContext || (window as any).webkitAudioContext;
    if (!AC) return null;
    const newCtx = new AC();
    const newMaster = newCtx.createGain();
    newMaster.gain.value = 0.42 * _sfxVolume;
    newMaster.connect(newCtx.destination);
    _ctx = newCtx;
    _master = newMaster;
    return { ctx: newCtx, master: newMaster };
  } catch {
    return null;
  }
}

export function resumeAudio() {
  const a = getAudio();
  if (a && a.ctx.state === "suspended") a.ctx.resume();
}

export function setSfxVolume(v: number) {
  _sfxVolume = v;
  if (_master) _master.gain.value = 0.42 * v;
}

export function spatialAtten(x: number, y: number, maxDist = 3000) {
  if (!G.P) return { atten: 1, pan: 0 };
  const dx = x - G.P.x;
  const dy = y - G.P.y;
  const dist = Math.hypot(dx, dy);
  const atten = Math.max(0, 1 - dist / maxDist);
  const pan = Math.max(-1, Math.min(1, dx / 600));
  return { atten, pan };
}

export function now(): number {
  const a = getAudio();
  return a ? a.ctx.currentTime : 0;
}

export function connectToMaster(node: AudioNode, master: GainNode, pan = 0): StereoPannerNode | null {
  if (!_ctx) return null;
  try {
    const panner = _ctx.createStereoPanner();
    panner.pan.value = pan;
    node.connect(panner);
    panner.connect(master);
    return panner;
  } catch {
    node.connect(master);
    return null;
  }
}

export function _disconnectOnEnd(source: AudioScheduledSourceNode, ...nodes: AudioNode[]) {
  const all = [source, ...nodes];
  source.onended = () => {
    for (const n of all) {
      try { n.disconnect(); } catch {}
    }
  };
}

export function makeNoiseBuffer(ctx: AudioContext, duration: number): AudioBuffer {
  const samples = ctx.sampleRate * duration;
  const buf = ctx.createBuffer(1, samples, ctx.sampleRate);
  const d = buf.getChannelData(0);
  for (let i = 0; i < samples; i++) d[i] = Math.random() * 2 - 1;
  return buf;
}

export function makeBrownNoiseBuffer(ctx: AudioContext, duration: number): AudioBuffer {
  const samples = ctx.sampleRate * duration;
  const buf = ctx.createBuffer(1, samples, ctx.sampleRate);
  const d = buf.getChannelData(0);
  let last = 0;
  for (let i = 0; i < samples; i++) {
    const white = Math.random() * 2 - 1;
    last = (last + white * 0.02) / 1.02;
    d[i] = last * 3.5;
  }
  return buf;
}