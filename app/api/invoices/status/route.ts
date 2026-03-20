import { NextResponse } from 'next/server'
import { getInvoiceStatus } from '@/lib/bitcoin/strike'

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url)
  const invoiceId = searchParams.get('invoiceId')

  if (!invoiceId) {
    return NextResponse.json({ error: 'invoiceId required' }, { status: 400 })
  }

  const { state, mockMode } = await getInvoiceStatus(invoiceId)

  return NextResponse.json({ state, mockMode })
}
