import { Link } from 'react-router-dom'
import { useSession } from '../context/SessionContext'
import { sectionContainer } from '../styles/tokens'
import { btnPrimary, btnSecondary, cardLight, pageSubtitle, pageTitle } from '../ui'

export default function Home() {
  const { session, backendData, testBackendConnection } = useSession()

  return (
    <div className={`${sectionContainer} pb-16 pt-8 text-emerald-950`}>
      <section className="mx-auto max-w-4xl text-center">
        <h1 className={`${pageTitle} normal-case tracking-tight md:text-5xl`}>
          Start saving today
        </h1>
        <p className={`mx-auto mt-4 max-w-xl ${pageSubtitle}`}>
          Build wealth together with a trusted stokvel community.
        </p>
        <div className="mx-auto mt-8 max-w-md">
          <div
            className="h-3 w-full overflow-hidden rounded-full bg-emerald-900/10"
            role="progressbar"
            aria-valuenow={40}
            aria-valuemin={0}
            aria-valuemax={100}
          >
            <div className="h-full w-[40%] rounded-full bg-gradient-to-r from-emerald-600 to-teal-500" />
          </div>
          <p className="mt-2 text-xs text-stone-500">Goal progress (placeholder)</p>
        </div>
      </section>

      <section className="mx-auto mt-16 max-w-3xl">
        <h2 className="mb-2 text-center text-lg font-semibold text-emerald-900">
          <Link
            to="/stokvels"
            className="inline-flex items-center justify-center gap-2 rounded-md text-emerald-900 outline-none transition hover:text-emerald-700 hover:underline focus-visible:ring-2 focus-visible:ring-emerald-600/40"
          >
            <i className="fa-solid fa-users text-emerald-600" aria-hidden />
            Browse public stokvels
          </Link>
        </h2>
        <ul className={`${cardLight} mt-6 divide-y divide-stone-100 overflow-hidden p-0`}>
          {['Avoille Stokvel', 'Rosebank Savers', 'Midrand Builders'].map((name) => (
            <li
              key={name}
              className="flex flex-col gap-1 px-5 py-4 sm:flex-row sm:items-center sm:justify-between"
            >
              <span className="font-semibold text-emerald-950">{name}</span>
              <span className="text-sm text-stone-500">Open for interest</span>
            </li>
          ))}
        </ul>
        <div className="mt-8 flex flex-col items-center gap-4">
          <Link to="/apply" className={`${btnPrimary} inline-flex px-10 py-3 text-base`}>
            Apply to join
          </Link>
          <p className="text-sm text-stone-500">or browse more groups soon</p>
        </div>
      </section>

      <section className="mx-auto mt-16 max-w-lg">
        <div className={`${cardLight} p-6`}>
          <h3 className="mb-1 flex items-center gap-2 text-sm font-bold uppercase tracking-widest text-emerald-700">
            <i className="fa-solid fa-code text-stone-400" aria-hidden />
            Developer
          </h3>
          <p className={`mb-4 ${pageSubtitle}`}>
            Test the secure Express API (sign in first for a valid session).
          </p>
          <button
            type="button"
            className={btnSecondary}
            onClick={testBackendConnection}
            disabled={!session}
          >
            Test Secure Backend
          </button>
          {!session ? (
            <p className="mt-3 text-xs text-stone-500">Log in to send a Bearer token.</p>
          ) : null}
          {backendData != null ? (
            <pre className="mt-4 max-h-64 overflow-auto rounded-lg border border-stone-200 bg-stone-50 p-4 text-left text-xs text-emerald-900">
              {JSON.stringify(backendData, null, 2)}
            </pre>
          ) : null}
        </div>
      </section>
    </div>
  )
}
