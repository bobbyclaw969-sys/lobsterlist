import Link from 'next/link'

export const metadata = { title: 'Sign-in error — LobsterList' }

export default function AuthErrorPage() {
  return (
    <div className="min-h-screen bg-zinc-950 flex items-center justify-center px-4">
      <div className="max-w-md w-full space-y-6 text-center">
        <div className="space-y-2">
          <p className="text-4xl">🔗</p>
          <h1 className="text-xl font-semibold text-white">
            Something went wrong with your sign-in link.
          </h1>
          <p className="text-zinc-400 text-sm">
            Links expire after 24 hours. Request a new one and you&apos;ll be on your way.
          </p>
        </div>

        <Link
          href="/login"
          className="inline-block bg-orange-500 hover:bg-orange-400 text-white font-medium px-6 py-2.5 rounded-lg transition-colors text-sm"
        >
          Back to sign in
        </Link>
      </div>
    </div>
  )
}
