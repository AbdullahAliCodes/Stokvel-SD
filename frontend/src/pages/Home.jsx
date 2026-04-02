import { Link } from 'react-router-dom'
import { useSession } from '../context/SessionContext'

export default function Home() {
  const { session, backendData, testBackendConnection } = useSession()

  return (
    <div className="bg-white text-black">
      <section className="border-b border-black px-4 py-16">
        <div className="mx-auto max-w-3xl text-center">
          <h1 className="mb-6 text-4xl font-semibold tracking-tight md:text-5xl">
            Start saving Today
          </h1>
          <p className="mb-6 text-gray-600">
            Build wealth together with a trusted stokvel community.
          </p>
          <div
            className="mx-auto mb-2 h-3 max-w-md border border-black bg-gray-200"
            role="progressbar"
            aria-valuenow={40}
            aria-valuemin={0}
            aria-valuemax={100}
          >
            <div className="h-full w-[40%] bg-gray-600" />
          </div>
          <p className="text-xs text-gray-500">Goal progress (placeholder)</p>
        </div>
      </section>

      <section className="border-b border-black px-4 py-12">
        <h2 className="mb-6 text-center text-2xl font-semibold">
          Browse public stokvels
        </h2>
        <ul className="mx-auto max-w-lg space-y-3 border border-black">
          {['Avoille Stokvel', 'Rosebank Savers', 'Midrand Builders'].map(
            (name) => (
              <li
                key={name}
                className="border-b border-black px-4 py-3 last:border-b-0"
              >
                <span className="font-medium">{name}</span>
                <span className="ml-2 text-sm text-gray-600">
                  — Open for interest
                </span>
              </li>
            ),
          )}
        </ul>
        <div className="mt-8 flex flex-col items-center gap-4">
          <Link
            to="/apply"
            className="inline-block border-2 border-black bg-black px-8 py-3 text-center font-semibold text-white hover:bg-gray-900"
          >
            Apply to join
          </Link>
          <p className="text-sm text-gray-600">or browse more groups soon</p>
        </div>
      </section>

      <section className="px-4 py-12">
        <div className="mx-auto max-w-lg border border-black p-4">
          <h3 className="mb-2 text-sm font-semibold uppercase tracking-wide text-gray-600">
            Developer
          </h3>
          <p className="mb-4 text-sm text-gray-600">
            Test the secure Express API (sign in first for a valid session).
          </p>
          <button
            type="button"
            className="border border-black bg-white px-4 py-2 text-black hover:bg-gray-200 disabled:opacity-50"
            onClick={testBackendConnection}
            disabled={!session}
          >
            Test Secure Backend
          </button>
          {!session ? (
            <p className="mt-2 text-xs text-gray-500">
              Log in to send a Bearer token.
            </p>
          ) : null}
          {backendData != null ? (
            <pre className="mt-4 max-h-64 overflow-auto border border-black bg-gray-100 p-4 text-left text-xs">
              {JSON.stringify(backendData, null, 2)}
            </pre>
          ) : null}
        </div>
      </section>
    </div>
  )
}
