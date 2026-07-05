import { describe, it, expect } from 'vitest'
import { detectVaultPath, buildDefaultConfig, mergeConfig } from '../src/main/config'

describe('detectVaultPath', () => {
  it('returns the open vault path from obsidian.json', () => {
    const json = JSON.stringify({
      vaults: {
        abc: { path: '/Users/k/vaultA', ts: 1, open: true },
        def: { path: '/Users/k/vaultB', ts: 2 }
      }
    })
    expect(detectVaultPath(json)).toBe('/Users/k/vaultA')
  })
  it('falls back to first vault when none marked open', () => {
    const json = JSON.stringify({ vaults: { abc: { path: '/x', ts: 1 } } })
    expect(detectVaultPath(json)).toBe('/x')
  })
  it('returns null on malformed json', () => {
    expect(detectVaultPath('not json')).toBeNull()
  })
})

describe('buildDefaultConfig', () => {
  it('builds config with detected repos and vault', () => {
    const cfg = buildDefaultConfig({
      home: '/Users/k',
      vaultPath: '/Users/k/vault',
      repoDirs: ['/Users/k/Desktop/proj-a', '/Users/k/Desktop/proj-b']
    })
    expect(cfg.appName).toBe('vault')
    expect(cfg.vaultPath).toBe('/Users/k/vault')
    expect(cfg.dashboardFolder).toBe('Dashboard')
    expect(cfg.repos).toEqual([
      { name: 'proj-a', path: '/Users/k/Desktop/proj-a' },
      { name: 'proj-b', path: '/Users/k/Desktop/proj-b' }
    ])
    expect(cfg.ai.provider).toBe('anthropic')
    expect(cfg.ai.windowHours).toBe(5)
    expect(cfg.ai.windowTokenLimit).toBeGreaterThan(0)
    expect(cfg.primaryDirective.source).toBe('commitsThisWeek')
  })
  it('uses empty vaultPath when null', () => {
    const cfg = buildDefaultConfig({ home: '/u', vaultPath: null, repoDirs: [] })
    expect(cfg.vaultPath).toBe('')
  })
})

describe('mergeConfig', () => {
  const defaults = buildDefaultConfig({ home: '/u', vaultPath: '/u/vault', repoDirs: [] })

  it('fills missing primaryDirective/ai keys from defaults', () => {
    const merged = mergeConfig({ appName: 'Custom', ai: { windowHours: 8 } }, defaults)
    expect(merged.appName).toBe('Custom')
    expect(merged.ai.windowHours).toBe(8)
    expect(merged.ai.windowTokenLimit).toBe(defaults.ai.windowTokenLimit)
    expect(merged.primaryDirective).toEqual(defaults.primaryDirective)
  })

  it('migrates legacy claude config into the ai block', () => {
    const merged = mergeConfig({ claude: { windowHours: 8, windowTokenLimit: 500 } }, defaults)
    expect(merged.ai.windowHours).toBe(8)
    expect(merged.ai.windowTokenLimit).toBe(500)
    expect(merged.ai.provider).toBe('anthropic')
    expect('claude' in merged).toBe(false)
  })

  it('returns defaults when input is not a plain object', () => {
    expect(mergeConfig(null, defaults)).toEqual(defaults)
    expect(mergeConfig('not an object', defaults)).toEqual(defaults)
    expect(mergeConfig(42, defaults)).toEqual(defaults)
    expect(mergeConfig(['a', 'b'], defaults)).toEqual(defaults)
  })

  it('keeps provided repos array and appName', () => {
    const repos = [{ name: 'foo', path: '/u/foo' }]
    const merged = mergeConfig({ appName: 'Mine', repos }, defaults)
    expect(merged.appName).toBe('Mine')
    expect(merged.repos).toEqual(repos)
  })
})
