import type { AudioConfig } from '@shared/types'

// Lo-fi ambient synthesizer: pure Web Audio, no assets, near-zero overhead.
// Two continuous beds (mainframe fan hum · tape hiss) plus a discrete
// square-wave tick pop fired when a directive checkbox is written back.

class LoFiAudio {
  private ctx: AudioContext | null = null
  private master: GainNode | null = null
  private bed: AudioNode[] = []
  private cfg: AudioConfig = { mode: 'off', volume: 40 }

  private ensureCtx(): AudioContext {
    if (!this.ctx) {
      this.ctx = new AudioContext()
      this.master = this.ctx.createGain()
      this.master.connect(this.ctx.destination)
    }
    return this.ctx
  }

  private noiseBuffer(ctx: AudioContext, brown: boolean): AudioBuffer {
    const len = ctx.sampleRate * 2
    const buf = ctx.createBuffer(1, len, ctx.sampleRate)
    const data = buf.getChannelData(0)
    let last = 0
    for (let i = 0; i < len; i++) {
      const white = Math.random() * 2 - 1
      if (brown) {
        // leaky integrator → brown-ish noise, the body of a fan hum
        last = (last + 0.02 * white) / 1.02
        data[i] = last * 3.5
      } else {
        data[i] = white
      }
    }
    return buf
  }

  private stopBed(): void {
    for (const n of this.bed) {
      try {
        if ('stop' in n) (n as OscillatorNode).stop()
        n.disconnect()
      } catch {
        /* already stopped */
      }
    }
    this.bed = []
  }

  private startBed(mode: 'hum' | 'hiss'): void {
    const ctx = this.ensureCtx()
    this.stopBed()
    if (mode === 'hum') {
      // low mainframe fan: brown noise through a low-pass + a faint 55Hz sine
      const noise = ctx.createBufferSource()
      noise.buffer = this.noiseBuffer(ctx, true)
      noise.loop = true
      const lp = ctx.createBiquadFilter()
      lp.type = 'lowpass'
      lp.frequency.value = 110
      const ng = ctx.createGain()
      ng.gain.value = 0.5
      noise.connect(lp).connect(ng).connect(this.master!)
      const osc = ctx.createOscillator()
      osc.type = 'sine'
      osc.frequency.value = 55
      const og = ctx.createGain()
      og.gain.value = 0.05
      osc.connect(og).connect(this.master!)
      noise.start()
      osc.start()
      this.bed = [noise, osc, lp, ng, og]
    } else {
      // soft tape hiss: quiet white noise, band-limited, gently wobbled
      const noise = ctx.createBufferSource()
      noise.buffer = this.noiseBuffer(ctx, false)
      noise.loop = true
      const hp = ctx.createBiquadFilter()
      hp.type = 'highpass'
      hp.frequency.value = 1200
      const lp = ctx.createBiquadFilter()
      lp.type = 'lowpass'
      lp.frequency.value = 7000
      const ng = ctx.createGain()
      ng.gain.value = 0.05
      const lfo = ctx.createOscillator()
      lfo.frequency.value = 0.3
      const lfoG = ctx.createGain()
      lfoG.gain.value = 0.015
      lfo.connect(lfoG).connect(ng.gain)
      noise.connect(hp).connect(lp).connect(ng).connect(this.master!)
      noise.start()
      lfo.start()
      this.bed = [noise, lfo, hp, lp, ng, lfoG]
    }
  }

  apply(cfg: AudioConfig | undefined): void {
    const next = cfg ?? { mode: 'off', volume: 40 }
    const modeChanged = next.mode !== this.cfg.mode
    this.cfg = next
    if (next.mode === 'off') {
      this.stopBed()
      return
    }
    const ctx = this.ensureCtx()
    this.master!.gain.setTargetAtTime((next.volume / 100) * 0.6, ctx.currentTime, 0.1)
    if (modeChanged || this.bed.length === 0) this.startBed(next.mode)
  }

  // quick discrete square-wave tick pop (directive checked off)
  tick(): void {
    if (this.cfg.volume <= 0) return
    const ctx = this.ensureCtx()
    const osc = ctx.createOscillator()
    osc.type = 'square'
    osc.frequency.value = 1800
    const g = ctx.createGain()
    const v = (this.cfg.volume / 100) * 0.25
    g.gain.setValueAtTime(v, ctx.currentTime)
    g.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + 0.05)
    osc.connect(g).connect(ctx.destination)
    osc.start()
    osc.stop(ctx.currentTime + 0.06)
  }
}

export const lofi = new LoFiAudio()
