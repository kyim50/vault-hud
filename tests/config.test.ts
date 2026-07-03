import { describe, it, expect } from 'vitest'
import { detectVaultPath, buildDefaultConfig } from '../src/main/config'

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
    expect(cfg.appName).toBe('V.A.U.L.T.')
    expect(cfg.vaultPath).toBe('/Users/k/vault')
    expect(cfg.dashboardFolder).toBe('Dashboard')
    expect(cfg.repos).toEqual([
      { name: 'proj-a', path: '/Users/k/Desktop/proj-a' },
      { name: 'proj-b', path: '/Users/k/Desktop/proj-b' }
    ])
    expect(cfg.claude.windowHours).toBe(5)
    expect(cfg.claude.windowTokenLimit).toBeGreaterThan(0)
    expect(cfg.primaryDirective.source).toBe('commitsThisWeek')
  })
  it('uses empty vaultPath when null', () => {
    const cfg = buildDefaultConfig({ home: '/u', vaultPath: null, repoDirs: [] })
    expect(cfg.vaultPath).toBe('')
  })
})
