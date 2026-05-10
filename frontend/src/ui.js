/** Shared Tailwind class fragments (forms + tables). Landing/auth palette: `styles/tokens.js`. */

export const pageTitle =
  'text-2xl font-bold tracking-wide text-emerald-800 uppercase dark:text-emerald-300 sm:text-3xl'

export const pageSubtitle = 'text-sm text-stone-500 dark:text-stone-400'

export const inputLight =
  'stkg-input w-full rounded-lg border border-stone-300 bg-white px-3 py-2 text-sm text-stone-800 placeholder:text-stone-400 focus:outline-none dark:border-slate-600 dark:bg-slate-800 dark:text-stone-100 dark:placeholder:text-stone-400'

export const labelLight =
  'flex flex-col gap-1.5 text-left text-sm font-medium text-stone-700 dark:text-stone-300'

export const btnPrimary =
  'stkg-btn rounded-lg bg-emerald-700 px-4 py-2.5 text-sm font-bold text-white shadow-sm transition hover:bg-emerald-800 disabled:opacity-50'

export const btnSecondary =
  'stkg-btn rounded-lg border border-stone-300 bg-white px-4 py-2 text-sm font-medium text-stone-700 shadow-sm transition hover:bg-stone-100 disabled:opacity-50 dark:border-slate-600 dark:bg-slate-800 dark:text-stone-200 dark:hover:bg-slate-700'

export const btnGhost =
  'stkg-btn rounded-lg px-3 py-2 text-sm text-stone-600 transition hover:bg-stone-100 hover:text-stone-900 dark:text-stone-300 dark:hover:bg-slate-800 dark:hover:text-stone-100'

/** White card shell (replaces dark “glass” in admin + light surfaces). */
export const cardLight =
  // Note: tests build selectors from this string using `querySelectorAll`.
  // Tailwind `dark:` variants include `:` which breaks those selectors unless escaped.
  'stkg-card rounded-2xl border border-stone-200 bg-white shadow-sm'

export const tableWrap = `${cardLight} overflow-hidden`

export const tableHead =
  'bg-stone-100 text-left text-xs font-semibold uppercase tracking-wide text-stone-600 dark:bg-slate-800 dark:text-stone-300'

export const tableRow =
  'stkg-table-row border-b border-stone-100 transition hover:bg-stone-50/80 dark:border-slate-700 dark:hover:bg-slate-800/60'

export const errorBox =
  'rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800 dark:border-red-900/40 dark:bg-red-950/40 dark:text-red-200'
