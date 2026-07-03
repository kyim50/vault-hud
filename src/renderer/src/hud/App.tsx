import { useSnapshot } from '../lib/useSnapshot'

export default function App() {
  const snap = useSnapshot()
  if (!snap) return <p>booting…</p>
  return <pre style={{ fontSize: 10 }}>{JSON.stringify(snap, null, 2)}</pre>
}
