'use client'

import { useState } from 'react'

type KeyMeta = {
  id: string
  key_prefix: string
  label: string | null
  last_used_at: string | null
  created_at: string
}

interface Props {
  agentId: string
  initialKeys: KeyMeta[]
}

export function ApiKeysSection({ agentId: _agentId, initialKeys }: Props) {
  const [keys, setKeys] = useState<KeyMeta[]>(initialKeys)
  const [newKey, setNewKey] = useState<string | null>(null)
  const [label, setLabel] = useState('')
  const [pending, setPending] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [copied, setCopied] = useState(false)

  async function createKey() {
    setPending(true)
    setError(null)
    setNewKey(null)

    // Use the current page's session cookie — this is the human owner managing their agent's keys
    const res = await fetch('/api/auth/agent/keys-ui', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ agentId: _agentId, label: label.trim() || null }),
    })
    const data = await res.json()

    if (!res.ok || data.error) {
      setError(data.error ?? 'Failed to create key')
    } else {
      setNewKey(data.apiKey)
      setKeys((prev) => [
        { id: data.id, key_prefix: data.keyPrefix, label: label.trim() || null, last_used_at: null, created_at: new Date().toISOString() },
        ...prev,
      ])
      setLabel('')
    }
    setPending(false)
  }

  async function revokeKey(id: string, prefix: string) {
    if (!confirm(`Revoke key ${prefix}...? This cannot be undone.`)) return

    const res = await fetch('/api/auth/agent/keys-ui', {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ agentId: _agentId, keyId: id }),
    })

    if (res.ok) {
      setKeys((prev) => prev.filter((k) => k.id !== id))
    }
  }

  function copyKey() {
    if (!newKey) return
    navigator.clipboard.writeText(newKey).then(() => {
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    })
  }

  return (
    <div className="rounded-xl border border-zinc-800 bg-zinc-900 p-5 space-y-4 font-mono">
      <div className="flex items-center justify-between">
        <h2 className="text-sm font-semibold text-zinc-300 uppercase tracking-wider">API Keys</h2>
        <span className="text-xs text-zinc-600">{keys.length} active</span>
      </div>

      {/* New key reveal */}
      {newKey && (
        <div className="border border-green-500/30 bg-green-500/5 rounded-lg p-3 space-y-2">
          <p className="text-xs text-green-400 font-semibold">New key created — copy it now, it will not be shown again:</p>
          <div className="flex items-center gap-2">
            <code className="text-xs text-green-300 break-all flex-1">{newKey}</code>
            <button
              onClick={copyKey}
              className="text-xs text-zinc-400 hover:text-white flex-shrink-0 border border-zinc-700 rounded px-2 py-1"
            >
              {copied ? 'Copied!' : 'Copy'}
            </button>
          </div>
        </div>
      )}

      {/* Create key form */}
      <div className="flex items-center gap-2">
        <input
          type="text"
          placeholder="Key label (optional)"
          value={label}
          onChange={(e) => setLabel(e.target.value)}
          className="flex-1 bg-zinc-800 border border-zinc-700 text-xs text-zinc-200 rounded px-2 py-1.5 placeholder:text-zinc-600 focus:outline-none focus:border-zinc-500"
        />
        <button
          onClick={createKey}
          disabled={pending}
          className="text-xs bg-orange-500 hover:bg-orange-400 disabled:opacity-50 text-white px-3 py-1.5 rounded transition-colors"
        >
          {pending ? '...' : '+ New key'}
        </button>
      </div>

      {error && <p className="text-xs text-red-400">{error}</p>}

      {/* Keys list */}
      {keys.length === 0 ? (
        <p className="text-xs text-zinc-600">No active keys. Create one to use the API or MCP server.</p>
      ) : (
        <div className="border border-zinc-800 rounded">
          <div className="px-2 py-1 border-b border-zinc-800 text-xs text-zinc-600">
            prefix · label · last used · actions
          </div>
          {keys.map((k) => (
            <div key={k.id} className="flex items-center gap-2 px-2 py-1.5 border-b border-zinc-800 last:border-0 text-xs hover:bg-zinc-800/50">
              <code className="text-orange-400 w-20 flex-shrink-0">{k.key_prefix}…</code>
              <span className="text-zinc-500 flex-1 truncate">{k.label ?? <span className="text-zinc-700">—</span>}</span>
              <span className="text-zinc-600 flex-shrink-0 w-24 text-right">
                {k.last_used_at
                  ? new Date(k.last_used_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
                  : 'never'}
              </span>
              <button
                onClick={() => revokeKey(k.id, k.key_prefix)}
                className="text-zinc-700 hover:text-red-400 flex-shrink-0 transition-colors"
              >
                revoke
              </button>
            </div>
          ))}
        </div>
      )}

      <p className="text-xs text-zinc-600">
        Use <code className="text-zinc-500">Authorization: Bearer ll_...</code> header.
        {' '}See <a href="/api" className="text-orange-400 hover:text-orange-300">GET /api</a> for full docs.
      </p>
    </div>
  )
}
