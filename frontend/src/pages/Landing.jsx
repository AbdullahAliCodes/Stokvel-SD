import { Link } from 'react-router-dom'
import {
  Facebook,
  Instagram,
  Linkedin,
  Menu,
  Search,
  ShieldCheck,
  Twitter,
  Users,
} from 'lucide-react'
import { useSession } from '../context/SessionContext'
import { btnPrimary, btnSecondary } from '../ui'

const OPPORTUNITIES = [
  {
    id: '1',
    name: 'Avoille Stokvel',
    subtitle: 'Monthly savings · Cape Town',
    members: 24,
    target: 'R12k cycle',
    icon: Users,
  },
  {
    id: '2',
    name: 'Rosebank Savers',
    subtitle: 'Rotating payouts · Gauteng',
    members: 18,
    target: 'R8k cycle',
    icon: Users,
  },
  {
    id: '3',
    name: 'Midrand Builders',
    subtitle: 'Property focus · Hybrid',
    members: 32,
    target: 'R20k cycle',
    icon: Users,
  },
]

function TopNav() {
  const { session, userRole } = useSession()
  const isAdmin = String(userRole || '').toLowerCase() === 'admin'
  const appHome = isAdmin ? '/admin/groups' : '/dashboard'

  const links = [
    { label: 'How it works', href: '#how' },
    { label: 'Browse groups', href: '#opportunities' },
    { label: 'Stories', href: '#stories' },
    { label: 'Support', href: '#footer-support' },
  ]

  return (
    <header className="sticky top-0 z-20 border-b border-emerald-900/10 bg-[#faf8f5]/90 backdrop-blur-md">
      <div className="mx-auto flex max-w-7xl items-center justify-between gap-4 px-4 py-4 md:px-8">
        <Link
          to="/"
          className="shrink-0 text-lg font-bold tracking-tight text-emerald-950"
        >
          Sawubona Stokvel
        </Link>

        <nav className="hidden flex-1 justify-center gap-8 md:flex">
          {links.map(({ label, href }) =>
            href.startsWith('#') ? (
              <a
                key={label}
                href={href}
                className="text-sm font-medium text-emerald-900/70 transition hover:text-emerald-900"
              >
                {label}
              </a>
            ) : (
              <Link
                key={label}
                to={href}
                className="text-sm font-medium text-emerald-900/70 transition hover:text-emerald-900"
              >
                {label}
              </Link>
            ),
          )}
        </nav>

        <div className="flex shrink-0 items-center gap-2 md:gap-3">
          <button
            type="button"
            className="rounded-full p-2 text-emerald-900/60 transition hover:bg-emerald-900/5 hover:text-emerald-900"
            aria-label="Search"
          >
            <Search className="h-5 w-5" strokeWidth={1.75} />
          </button>
          <a
            href="https://twitter.com"
            className="hidden rounded-full p-2 text-emerald-900/50 transition hover:bg-emerald-900/5 hover:text-emerald-900 sm:inline-flex"
            aria-label="Twitter"
          >
            <Twitter className="h-5 w-5" strokeWidth={1.75} />
          </a>
          <button
            type="button"
            className="rounded-full p-2 text-emerald-900/60 md:hidden"
            aria-label="Menu"
          >
            <Menu className="h-5 w-5" strokeWidth={1.75} />
          </button>
          {session ? (
            <Link
              to={appHome}
              className={`${btnPrimary} hidden px-4 py-2 sm:inline-flex`}
            >
              {isAdmin ? 'Admin' : 'Dashboard'}
            </Link>
          ) : (
            <Link to="/auth" className={`${btnPrimary} hidden px-4 py-2 sm:inline-flex`}>
              Log in
            </Link>
          )}
        </div>
      </div>
    </header>
  )
}

function Hero() {
  return (
    <section
      id="how"
      className="relative overflow-hidden bg-gradient-to-br from-emerald-50/90 via-[#f0f4ef] to-teal-50/80"
    >
      <div className="mx-auto grid max-w-7xl gap-10 px-4 py-16 md:grid-cols-2 md:gap-12 md:px-8 md:py-20 lg:py-24">
        <div className="flex flex-col justify-center">
          <h1 className="text-4xl font-semibold leading-[1.1] tracking-tight text-emerald-950 md:text-5xl lg:text-[3.25rem]">
            Save together.
            <br />
            <span className="text-emerald-800/90">Grow together.</span>
          </h1>
          <p className="mt-5 max-w-lg text-base leading-relaxed text-stone-600 md:text-lg">
            Join trusted stokvel circles, track contributions transparently, and reach shared
            goals with a community that has your back.
          </p>
          <div className="mt-8 flex flex-wrap gap-6 border-t border-emerald-900/10 pt-8">
            <div>
              <p className="text-2xl font-semibold text-emerald-900">12+</p>
              <p className="text-sm text-stone-500">Active public groups</p>
            </div>
            <div>
              <p className="text-2xl font-semibold text-emerald-900">R2.4M+</p>
              <p className="text-sm text-stone-500">Cycled fairly (demo)</p>
            </div>
          </div>
          <div className="mt-8 flex flex-col gap-3 sm:flex-row sm:flex-wrap">
            <Link to="/auth" className={`${btnPrimary} inline-flex justify-center px-6 py-3`}>
              Start saving
            </Link>
            <a
              href="#opportunities"
              className={`${btnSecondary} inline-flex justify-center border-emerald-900/15 px-6 py-3 text-emerald-900`}
            >
              Browse groups
            </a>
          </div>
        </div>

        <div className="relative flex min-h-[280px] items-center justify-center md:min-h-[360px]">
          <div className="relative w-full max-w-md">
            <div className="overflow-hidden rounded-2xl border border-white/80 bg-white/60 shadow-lg shadow-emerald-900/10 backdrop-blur-sm">
              <div className="aspect-[4/3] bg-gradient-to-br from-emerald-200/40 via-stone-100 to-teal-100/50" />
              <div className="border-t border-emerald-900/5 bg-white/80 px-4 py-3">
                <p className="text-sm font-medium text-emerald-900">Your next payout window</p>
                <p className="text-xs text-stone-500">Track meetings and rotations in one place.</p>
              </div>
            </div>
            <div className="absolute -bottom-4 -right-2 max-w-[220px] rounded-xl border border-rose-200/80 bg-gradient-to-br from-rose-50 to-rose-100/90 p-4 shadow-md shadow-rose-900/10 md:-right-6">
              <div className="flex items-start gap-3">
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-rose-200/60 text-rose-800">
                  <ShieldCheck className="h-5 w-5" strokeWidth={1.75} />
                </div>
                <div>
                  <p className="text-sm font-semibold text-rose-950">Bank-grade security</p>
                  <p className="mt-1 text-xs leading-snug text-rose-900/70">
                    Encrypted sessions and role-based access for every member.
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  )
}

function OpportunityCard({ name, subtitle, members, target, icon: Icon }) {
  return (
    <article className="flex flex-col rounded-2xl border border-emerald-900/10 bg-white p-6 shadow-sm shadow-emerald-900/5 transition hover:border-emerald-800/20 hover:shadow-md">
      <div className="flex items-start gap-4">
        <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-emerald-100 text-emerald-800">
          <Icon className="h-6 w-6" strokeWidth={1.75} />
        </div>
        <div className="min-w-0 flex-1">
          <h3 className="font-semibold text-emerald-950">{name}</h3>
          <p className="mt-0.5 text-sm text-stone-500">{subtitle}</p>
        </div>
      </div>
      <div className="mt-5 flex gap-6 text-sm">
        <div>
          <p className="font-medium text-emerald-900">{members}</p>
          <p className="text-xs text-stone-500">Members</p>
        </div>
        <div>
          <p className="font-medium text-emerald-900">{target}</p>
          <p className="text-xs text-stone-500">Target</p>
        </div>
      </div>
      <Link
        to="/auth"
        className={`${btnPrimary} mt-6 inline-flex w-full items-center justify-center sm:mt-auto`}
      >
        Apply to join
      </Link>
    </article>
  )
}

function Testimonial() {
  return (
    <section
      id="stories"
      className="border-y border-emerald-900/10 bg-[#faf8f5] py-16 md:py-20"
    >
      <div className="mx-auto grid max-w-7xl gap-10 px-4 md:grid-cols-2 md:items-center md:gap-16 md:px-8">
        <div className="aspect-square max-h-80 overflow-hidden rounded-2xl bg-gradient-to-br from-emerald-200/50 to-stone-200/60 md:max-h-none" />
        <div>
          <blockquote className="text-xl font-medium leading-relaxed text-emerald-950 md:text-2xl">
            &ldquo;We finally replaced the spreadsheet chaos. Everyone sees the same numbers, and
            payouts feel fair.&rdquo;
          </blockquote>
          <p className="mt-6 text-sm font-semibold text-emerald-900">Nomsa K. · Treasurer</p>
          <p className="text-sm text-stone-500">Rosebank Savers, Johannesburg</p>
        </div>
      </div>
    </section>
  )
}

function Footer() {
  return (
    <footer className="bg-emerald-950 text-emerald-50">
      <div className="mx-auto max-w-7xl px-4 py-14 md:px-8">
        <div className="grid gap-10 md:grid-cols-3 md:gap-8">
          <div>
            <p className="text-lg font-bold text-white">Sawubona Stokvel</p>
            <p className="mt-3 text-sm leading-relaxed text-emerald-100/80">
              Community-first savings circles with transparent tools for members and admins.
            </p>
          </div>
          <div>
            <p className="text-xs font-semibold uppercase tracking-wider text-emerald-400/90">
              Company
            </p>
            <ul className="mt-4 space-y-2 text-sm text-emerald-100/85">
              <li>
                <a href="#how" className="transition hover:text-white">
                  How it works
                </a>
              </li>
              <li>
                <Link to="/auth" className="transition hover:text-white">
                  Create account
                </Link>
              </li>
              <li>
                <a href="#footer-support" className="transition hover:text-white">
                  Contact
                </a>
              </li>
            </ul>
          </div>
          <div id="footer-support">
            <p className="text-xs font-semibold uppercase tracking-wider text-emerald-400/90">
              Support
            </p>
            <ul className="mt-4 space-y-2 text-sm text-emerald-100/85">
              <li>
                <Link to="/auth" className="transition hover:text-white">
                  Help centre (sign in)
                </Link>
              </li>
              <li>
                <a href="#opportunities" className="transition hover:text-white">
                  Browse groups
                </a>
              </li>
            </ul>
          </div>
        </div>
        <div className="mt-12 flex flex-col gap-4 border-t border-emerald-800/80 pt-8 md:flex-row md:items-center md:justify-between">
          <p className="text-xs text-emerald-200/70">
            © {new Date().getFullYear()} Sawubona Stokvel. All rights reserved.
          </p>
          <div className="flex gap-3">
            <a
              href="https://facebook.com"
              className="rounded-full p-2 text-emerald-200/80 transition hover:bg-emerald-900/50 hover:text-white"
              aria-label="Facebook"
            >
              <Facebook className="h-4 w-4" strokeWidth={1.75} />
            </a>
            <a
              href="https://instagram.com"
              className="rounded-full p-2 text-emerald-200/80 transition hover:bg-emerald-900/50 hover:text-white"
              aria-label="Instagram"
            >
              <Instagram className="h-4 w-4" strokeWidth={1.75} />
            </a>
            <a
              href="https://linkedin.com"
              className="rounded-full p-2 text-emerald-200/80 transition hover:bg-emerald-900/50 hover:text-white"
              aria-label="LinkedIn"
            >
              <Linkedin className="h-4 w-4" strokeWidth={1.75} />
            </a>
          </div>
        </div>
      </div>
    </footer>
  )
}

export default function Landing() {
  return (
    <div className="min-h-screen bg-[#faf8f5] text-emerald-950">
      <TopNav />
      <main>
        <Hero />
        <section id="opportunities" className="mx-auto max-w-7xl px-4 py-16 md:px-8 md:py-20">
          <div className="mx-auto max-w-2xl text-center">
            <h2 className="text-2xl font-semibold tracking-tight text-emerald-950 md:text-3xl">
              Browse public stokvels
            </h2>
            <p className="mt-3 text-stone-600">
              Discover open circles looking for reliable members. Swap this list for live API data
              when your backend is ready.
            </p>
          </div>
          <div className="mt-12 grid gap-6 md:grid-cols-3">
            {OPPORTUNITIES.map((item) => (
              <OpportunityCard key={item.id} {...item} />
            ))}
          </div>
        </section>
        <Testimonial />
      </main>
      <Footer />
    </div>
  )
}
