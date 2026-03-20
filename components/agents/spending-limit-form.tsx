'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'

interface SpendingLimitFormProps {
  agentId:      string
  currentLimit: number
}

export function SpendingLimitForm({ agentId, currentLimit }: SpendingLimitFormProps) {
  const [editing, setEditing] = useState(false)
  const [value, setValue] = useState(currentLimit > 0 ? String(currentLimit) : '')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function save() {
    setError(null)
    setSaving(true)
    const newLimit = parseInt(value, 10)
    if (isNaN(newLimit) || newLimit < 0) {
      setError('Enter a valid number of sats (0 = no limit)')
      setSaving(false)
      return
    }

    try {
      const res = await fetch(`/api/agents/${agentId}/spending-limit`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ spendingLimitSats: newLimit }),
      })
      if (!res.ok) {
        const d = await res.json()
        setError(d.error ?? 'Failed to update limit')
      } else {
        setEditing(false)
        // Refresh to show updated values
        window.location.reload()
      }
    } catch {
      setError('Network error')
    } finally {
      setSaving(false)
    }
  }

  if (!editing) {
    return (
      <button
        onClick={() => setEditing(true)}
        className="text-xs text-orange-400 hover:text-orange-300 transition-colors"
      >
        Edit spending limit →
      </button>
    )
  }

  return (
    <div className="space-y-2">
      {error && <p className="text-xs text-red-400">{error}</p>}
      <div className="flex gap-2">
        <Input
          type="number"
          min={0}
          value={value}
          onChange={(e) => setValue(e.target.value)}
          placeholder="sats (0 = no limit)"
          className="bg-zinc-800 border-zinc-600 text-white text-sm"
        />
        <Button
          onClick={save}
          disabled={saving}
          size="sm"
          className="bg-orange-500 hover:bg-orange-400 text-white"
        >
          {saving ? '…' : 'Save'}
        </Button>
        <Button
          onClick={() => setEditing(false)}
          variant="outline"
          size="sm"
          className="border-zinc-600 text-zinc-300"
        >
          Cancel
        </Button>
      </div>
      <p className="text-xs text-zinc-500">0 = no spending limit for this agent</p>
    </div>
  )
}
