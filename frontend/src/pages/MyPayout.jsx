import { Wallet } from 'lucide-react'
import { pageSubtitle } from '../ui'

export default function MyPayout() {
  return (
    <div>
      <h1 className="mb-2 flex items-center gap-2 text-2xl font-bold text-cyan-400">
        <Wallet className="h-8 w-8 text-emerald-400" aria-hidden />
        My payout
      </h1>
      <p className={pageSubtitle}>Payout history and schedule — coming soon.</p>
      <div className="mt-8 grid gap-4 sm:grid-cols-2">
        <div className="glass card-accent p-5">
          <p className="text-xs text-slate-400">Next expected</p>
          <p className="text-xl font-bold text-cyan-400">R 50,000.00</p>
          <p className="mt-1 text-[10px] text-slate-500">Placeholder</p>
        </div>
        <div className="glass card-green p-5">
          <p className="text-xs text-slate-400">Total received (YTD)</p>
          <p className="text-xl font-bold text-emerald-400">R 0.00</p>
          <p className="mt-1 text-[10px] text-slate-500">Placeholder</p>
        </div>
      </div>
    </div>
  )
}
