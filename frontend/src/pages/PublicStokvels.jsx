import { Link } from 'react-router-dom'
import OpportunityCard from '../components/OpportunityCard'
import { PUBLIC_STOKVEL_OPPORTUNITIES } from '../data/publicStokvelOpportunities'
import {
  bodyMutedLg,
  headingSection,
  publicNavCtaGuest,
  sectionContainer,
} from '../styles/tokens'

export default function PublicStokvels() {
  return (
    <div className="min-h-full bg-[#faf8f5] pb-16 pt-8 text-emerald-950 dark:bg-slate-950 dark:text-stone-100 md:pt-10">
      <div className={sectionContainer}>
        <nav aria-label="Breadcrumb" className="text-sm text-stone-600">
          <Link to="/" className="font-medium text-emerald-800 hover:text-emerald-950 hover:underline">
            Home
          </Link>
          <span className="mx-2 text-stone-400" aria-hidden>
            /
          </span>
          <span className="text-emerald-900">Public stokvels</span>
        </nav>

        <header className="mx-auto mt-6 max-w-2xl text-center md:mt-8">
          <h1 className={headingSection}>Public stokvel directory</h1>
          <p className={`mt-3 ${bodyMutedLg}`}>
            Open groups currently accepting interest from new members.
          </p>
        </header>

        <ul className="mx-auto mt-10 grid max-w-7xl list-none grid-cols-1 gap-6 p-0 md:mt-12 md:grid-cols-2 md:items-stretch lg:grid-cols-3">
          {PUBLIC_STOKVEL_OPPORTUNITIES.map((item) => (
            <li key={item.id} className="min-w-0">
              <OpportunityCard {...item} />
            </li>
          ))}
        </ul>

        <p className="mx-auto mt-10 max-w-xl text-center text-sm text-stone-600">
          Ready to join? Create an account and apply from any card, or return to the homepage.
        </p>
        <div className="mt-6 flex flex-col items-center justify-center gap-3 sm:flex-row sm:gap-4">
          <Link to="/auth" className={publicNavCtaGuest}>
            Log In / Sign up
          </Link>
          <Link
            to="/"
            className="text-sm font-semibold text-emerald-800 underline-offset-4 hover:text-emerald-950 hover:underline"
          >
            Back to home
          </Link>
        </div>
      </div>
    </div>
  )
}
