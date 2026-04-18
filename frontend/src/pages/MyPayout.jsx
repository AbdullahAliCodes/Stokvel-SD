import { Wallet } from 'lucide-react'
import { cardLight, pageSubtitle } from '../ui'

export default function MyPayout() {
  return (
    <div>
      <h1 className="mb-2 flex items-center gap-2 text-2xl font-bold text-emerald-800">
        <Wallet className="h-8 w-8 text-emerald-700" aria-hidden />
        My payout
      </h1>
      <p className={pageSubtitle}>Payout history and schedule — coming soon.</p>
      <div className="mt-8 grid gap-4 sm:grid-cols-2">
        <div className={`${cardLight} border-l-4 border-l-emerald-700 p-5`}>
          <p className="text-xs text-stone-500">Next expected</p>
          <p className="text-xl font-bold text-emerald-800">R 50,000.00</p>
          <p className="mt-1 text-[10px] text-stone-500">Placeholder</p>
        </div>
        <div className={`${cardLight} border-l-4 border-l-emerald-600 p-5`}>
          <p className="text-xs text-stone-500">Total received (YTD)</p>
          <p className="text-xl font-bold text-emerald-800">R 0.00</p>
          <p className="mt-1 text-[10px] text-stone-500">Placeholder</p>
        </div>
      </div>
    </div>
  )
}
