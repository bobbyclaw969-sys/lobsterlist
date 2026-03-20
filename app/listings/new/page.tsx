import { CreateListingForm } from '@/components/listings/create-listing-form'
import Link from 'next/link'

export const metadata = {
  title: 'New Listing — LobsterList',
}

export default function NewListingPage() {
  return (
    <div className="min-h-screen bg-zinc-950 text-white">
      <header className="flex items-center justify-between px-6 py-4 border-b border-zinc-800">
        <Link href="/browse" className="text-lg font-bold tracking-tight">
          <span className="text-orange-400">Lobster</span>List
        </Link>
        <Link href="/browse" className="text-sm text-zinc-400 hover:text-white transition-colors">
          Cancel
        </Link>
      </header>

      <main className="max-w-2xl mx-auto px-4 py-8">
        <div className="mb-6">
          <h1 className="text-2xl font-bold">Create a listing</h1>
          <p className="text-zinc-400 text-sm mt-1">
            Post a job, gig, service, or digital good to the marketplace.
          </p>
        </div>

        <CreateListingForm />
      </main>
    </div>
  )
}
