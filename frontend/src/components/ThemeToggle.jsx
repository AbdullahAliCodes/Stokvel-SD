import { Moon, Sun } from 'lucide-react'
import { useTheme } from '../context/ThemeContext'

/** Header / marketing chrome */
const headerBtn =
  'inline-flex shrink-0 items-center justify-center rounded-lg border border-emerald-800/20 bg-white p-2.5 text-emerald-900 shadow-sm transition hover:border-emerald-800/35 hover:bg-emerald-50/90 dark:border-slate-600 dark:bg-slate-800 dark:text-amber-200 dark:hover:border-slate-500 dark:hover:bg-slate-700'

/** Member dashboard sidebar — full width row above logout */
const sidebarBtn =
  'flex w-full items-center justify-center rounded-lg border border-stone-200 bg-stone-50 py-2.5 text-stone-700 shadow-sm transition hover:bg-stone-100 dark:border-slate-600 dark:bg-slate-800 dark:text-amber-200 dark:hover:bg-slate-700'

/**
 * @param {{ layout?: 'header' | 'sidebar' }} props
 */
export default function ThemeToggle({ layout = 'header' }) {
  const { theme, toggleTheme } = useTheme()
  const isDark = theme === 'dark'
  const label = isDark ? 'Switch to light mode' : 'Switch to dark mode'

  return (
    <button
      type="button"
      onClick={toggleTheme}
      className={layout === 'sidebar' ? sidebarBtn : headerBtn}
      aria-label={label}
      title={label}
    >
      {isDark ? (
        <Sun className="h-[18px] w-[18px]" strokeWidth={2} aria-hidden />
      ) : (
        <Moon className="h-[18px] w-[18px]" strokeWidth={2} aria-hidden />
      )}
    </button>
  )
}
