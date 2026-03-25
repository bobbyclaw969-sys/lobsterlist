'use client'

import { useActionState } from 'react'
import Link from 'next/link'
import { completeOnboarding } from '@/app/actions/profile'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'

interface OnboardingFormProps {
  defaultName?: string
}

const SKILL_SUGGESTIONS = [
  'Writing', 'Research', 'Data Entry', 'Translation', 'Coding',
  'Design', 'Video', 'Audio', 'Customer Support', 'Testing',
]

export function OnboardingForm({ defaultName = '' }: OnboardingFormProps) {
  const [state, action, pending] = useActionState(completeOnboarding, undefined)

  return (
    <form action={action} className="space-y-6">
      {state?.error && (
        <p className="rounded-md bg-red-50 border border-red-200 px-3 py-2 text-sm text-red-700">
          {state.error}
        </p>
      )}

      {/* Name */}
      <div className="space-y-1.5">
        <Label htmlFor="name" className="text-zinc-800 font-medium">
          What&apos;s your name?
        </Label>
        <Input
          id="name"
          name="name"
          type="text"
          defaultValue={defaultName}
          placeholder="Your name or nickname"
          required
          autoComplete="name"
          autoFocus
          className="bg-white border-zinc-300 text-zinc-900 placeholder:text-zinc-400 focus:border-orange-400 focus:ring-orange-400"
        />
      </div>

      {/* Skills */}
      <div className="space-y-2">
        <Label htmlFor="skills" className="text-zinc-800 font-medium">
          What can you do?
          <span className="text-zinc-400 font-normal ml-1">(optional)</span>
        </Label>
        <Input
          id="skills"
          name="skills"
          type="text"
          placeholder="Writing, Research, Data Entry…"
          className="bg-white border-zinc-300 text-zinc-900 placeholder:text-zinc-400 focus:border-orange-400 focus:ring-orange-400"
        />
        <div className="flex flex-wrap gap-1.5">
          {SKILL_SUGGESTIONS.map((skill) => (
            <button
              key={skill}
              type="button"
              onClick={(e) => {
                const input = (e.currentTarget.closest('form') as HTMLFormElement)
                  ?.elements.namedItem('skills') as HTMLInputElement | null
                if (!input) return
                const current = input.value.split(',').map((s) => s.trim()).filter(Boolean)
                if (!current.includes(skill)) {
                  input.value = [...current, skill].join(', ')
                }
              }}
              className="text-xs text-zinc-500 bg-zinc-100 hover:bg-orange-100 hover:text-orange-700 border border-zinc-200 px-2 py-0.5 rounded-full transition-colors"
            >
              + {skill}
            </button>
          ))}
        </div>
      </div>

      {/* Location */}
      <div className="space-y-1.5">
        <Label htmlFor="location" className="text-zinc-800 font-medium">
          Where are you located?
          <span className="text-zinc-400 font-normal ml-1">(optional)</span>
        </Label>
        <Input
          id="location"
          name="location"
          type="text"
          placeholder="City, Country"
          autoComplete="address-level2"
          className="bg-white border-zinc-300 text-zinc-900 placeholder:text-zinc-400 focus:border-orange-400 focus:ring-orange-400"
        />
      </div>

      <div className="flex flex-col gap-2 pt-2">
        <Button
          type="submit"
          disabled={pending}
          className="w-full bg-orange-500 hover:bg-orange-400 text-white font-semibold min-h-[48px]"
        >
          {pending ? 'Saving…' : 'Complete profile'}
        </Button>

        <Link
          href="/browse"
          className="block w-full text-center text-sm text-zinc-400 hover:text-zinc-600 py-2 transition-colors"
        >
          I&apos;ll fill this in later →
        </Link>
      </div>
    </form>
  )
}
