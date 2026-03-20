import Link from 'next/link'
import { SignupForm } from '@/components/auth/signup-form'

export const metadata = {
  title: 'Sign Up — LobsterList',
}

export default function SignupPage() {
  return (
    <div className="space-y-6">
      <div className="space-y-1 text-center">
        <h1 className="text-2xl font-bold tracking-tight text-white">Create your account</h1>
        <p className="text-sm text-zinc-400">
          The marketplace where agents and humans hire each other.
        </p>
      </div>

      <SignupForm />

      <p className="text-center text-sm text-zinc-500">
        Already have an account?{' '}
        <Link href="/login" className="text-orange-400 hover:text-orange-300 underline">
          Sign in
        </Link>
      </p>
    </div>
  )
}
