import { execFile } from 'node:child_process'
import { promisify } from 'node:util'
import type { RepoConfig, RepoStats } from '@shared/types'

const run = promisify(execFile)

export function parseCommitTimestamps(gitLogOutput: string): number[] {
  return gitLogOutput
    .split('\n')
    .map((l) => l.trim())
    .filter(Boolean)
    .map((l) => Number(l) * 1000)
    .filter((n) => Number.isFinite(n))
}

function startOfLocalDay(ts: number): number {
  const d = new Date(ts)
  d.setHours(0, 0, 0, 0)
  return d.getTime()
}

export function bucketDaily(tsMs: number[], now: number): number[] {
  const buckets = new Array(7).fill(0)
  const today = startOfLocalDay(now)
  for (const ts of tsMs) {
    const dayDiff = Math.floor((today - startOfLocalDay(ts)) / 86_400_000)
    if (dayDiff >= 0 && dayDiff < 7) buckets[6 - dayDiff] += 1
  }
  return buckets
}

export function countSince(tsMs: number[], sinceMs: number): number {
  return tsMs.filter((t) => t >= sinceMs).length
}

async function git(repoPath: string, args: string[]): Promise<string> {
  const { stdout } = await run('git', ['-C', repoPath, ...args], { timeout: 10_000 })
  return stdout
}

export async function collectRepoStats(repo: RepoConfig): Promise<RepoStats> {
  const empty: RepoStats = {
    name: repo.name, path: repo.path, branch: '—',
    commitsToday: 0, commitsWeek: 0, dirtyFiles: 0,
    lastCommit: '', daily: new Array(7).fill(0)
  }
  try {
    const now = Date.now()
    const [branch, log, status, last] = await Promise.all([
      git(repo.path, ['rev-parse', '--abbrev-ref', 'HEAD']),
      git(repo.path, ['log', '--since=7.days', '--pretty=%ct']).catch(() => ''),
      git(repo.path, ['status', '--porcelain']),
      git(repo.path, ['log', '-1', '--pretty=%s']).catch(() => '')
    ])
    const ts = parseCommitTimestamps(log)
    const midnight = new Date(now)
    midnight.setHours(0, 0, 0, 0)
    return {
      ...empty,
      branch: branch.trim(),
      commitsToday: countSince(ts, midnight.getTime()),
      commitsWeek: ts.length,
      dirtyFiles: status.split('\n').filter((l) => l.trim()).length,
      lastCommit: last.trim(),
      daily: bucketDaily(ts, now)
    }
  } catch {
    return empty
  }
}
