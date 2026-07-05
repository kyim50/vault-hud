import { describe, it, expect } from 'vitest'
import { resolveScenes, ROTATION_DEFAULT } from '../src/renderer/src/lib/resolveScenes'

const VALID = ['meadow', 'surf', 'garden', 'disco', 'globe', 'night', 'rain', 'rooftop', 'nap']

describe('resolveScenes', () => {
  it('no config → all 8 in order, 22s (264 frames), disco/nap', () => {
    const r = resolveScenes(undefined, VALID, ROTATION_DEFAULT, 12)
    expect(r.rotation).toEqual(ROTATION_DEFAULT)
    expect(r.intervalFrames).toBe(264)
    expect(r.busy).toBe('disco')
    expect(r.nap).toBe('nap')
  })
  it('drops invalid names, keeps order', () => {
    expect(resolveScenes({ rotation: ['meadow', 'nope', 'night'] }, VALID, ROTATION_DEFAULT, 12).rotation).toEqual(['meadow', 'night'])
  })
  it('empty or all-invalid rotation falls back to defaults', () => {
    expect(resolveScenes({ rotation: [] }, VALID, ROTATION_DEFAULT, 12).rotation).toEqual(ROTATION_DEFAULT)
    expect(resolveScenes({ rotation: ['nope', 'zzz'] }, VALID, ROTATION_DEFAULT, 12).rotation).toEqual(ROTATION_DEFAULT)
  })
  it('clamps intervalSec to [3,600] then × fps', () => {
    expect(resolveScenes({ intervalSec: 1 }, VALID, ROTATION_DEFAULT, 12).intervalFrames).toBe(36) // 3×12
    expect(resolveScenes({ intervalSec: 9999 }, VALID, ROTATION_DEFAULT, 12).intervalFrames).toBe(7200) // 600×12
    expect(resolveScenes({ intervalSec: 10 }, VALID, ROTATION_DEFAULT, 12).intervalFrames).toBe(120)
  })
  it('busy/nap: valid custom respected, invalid falls back', () => {
    expect(resolveScenes({ busy: 'night', nap: 'meadow' }, VALID, ROTATION_DEFAULT, 12).busy).toBe('night')
    expect(resolveScenes({ busy: 'night', nap: 'meadow' }, VALID, ROTATION_DEFAULT, 12).nap).toBe('meadow')
    expect(resolveScenes({ busy: 'nope' }, VALID, ROTATION_DEFAULT, 12).busy).toBe('disco')
    expect(resolveScenes({ nap: 'nope' }, VALID, ROTATION_DEFAULT, 12).nap).toBe('nap')
  })
})
