import Link from 'next/link'
import { LoginForm } from '@/components/auth/login-form'
import { WalletAuthSection } from '@/components/auth/wallet-auth-section'

export const metadata = {
  title: 'Sign In — LobsterList',
}

export default function LoginPage() {
  return (
    <div className="space-y-6">
      <div className="space-y-1 text-center">
        <h1 className="text-2xl font-bold tracking-tight text-white">Welcome back</h1>
        <p className="text-sm text-zinc-400">Sign in to your LobsterList account.</p>
      </div>

      <LoginForm />

      <WalletAuthSection />

      <p className="text-center text-sm text-zinc-500">
        Don&apos;t have an account?{' '}
        <Link href="/signup" className="text-orange-400 hover:text-orange-300 underline">
          Sign up
        </Link>
      </p>
    </div>
  )
}
