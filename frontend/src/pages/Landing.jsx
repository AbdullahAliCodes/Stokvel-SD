import { useState } from 'react'
import { Link, useNavigate, useLocation } from 'react-router-dom'
import { motion as M, useReducedMotion } from 'framer-motion'
import BrandLogo from '../components/BrandLogo'
import ThemeToggle from '../components/ThemeToggle'
import PublicFooter from '../components/PublicFooter'
import OpportunityCard from '../components/OpportunityCard'
import LiveMoneyCounter from '../components/landing/LiveMoneyCounter'
import { testimonialPortrait } from '../assets/landing'
import { PUBLIC_STOKVEL_OPPORTUNITIES } from '../data/publicStokvelOpportunities'
import { LANDING_TESTIMONIAL } from '../data/landingTestimonial'
import {
  ChevronDown,
  Landmark,
  LineChart,
  LogOut,
  Menu,
  ShieldCheck,
  Sparkles,
  Users,
  X,
} from 'lucide-react'
import { useSession } from '../context/SessionContext'
import { supabase } from '../utils/supabase'
import { usePublicStokvelMonthlyFlow } from '../hooks/usePublicStokvelMonthlyFlow'
import {
  btnPrimary,
  btnSecondaryOnHero,
  iconButton,
  marketingNavInnerRow,
  navLink,
  sectionContainer,
  topNavBar,
} from '../styles/tokens'
import RandRain from '../components/animations/RandRain'
import HeroBackground from '../components/animations/HeroBackground'
import heroLogoAsset from '../assets/stokgeld-logo.png'

const navFocus =
  'cursor-pointer rounded-md focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-emerald-700'

function TopNav() {
  const navigate = useNavigate()
  const location = useLocation()
  const { session, userRole } = useSession()
  const isAdmin = String(userRole || '').toLowerCase() === 'admin'
  const appHome = isAdmin ? '/admin/groups' : '/dashboard'
  const [mobileOpen, setMobileOpen] = useState(false)

  const navHrefClass = (href, { isHash = false } = {}) => {
    const active =
      !isHash && typeof href === 'string' && href === location.pathname ? ' stkg-nav-link--active' : ''
    return `${navLink} ${navFocus}${active}`
  }

  const signOutAndHome = async () => {
    await supabase.auth.signOut()
    navigate('/', { replace: true })
  }

  const links = [
    { label: 'Features', href: '#features' },
    { label: 'Public stokvels', href: '/stokvels' },
    { label: 'Stories', href: '#stories' },
    { label: 'Support', href: '#footer-support' },
  ]

  const closeMobile = () => setMobileOpen(false)

  return (
    <header className={`${topNavBar} relative z-30`}>
      <div className={`${sectionContainer} ${marketingNavInnerRow}`}>
        <div className="flex min-w-0 shrink-0 items-center">
          <BrandLogo
            to="/"
            className="flex shrink-0 items-center"
            imgClassName="h-24 w-auto max-h-[7rem] object-contain object-left sm:h-28 sm:max-h-[7.5rem] md:h-[7.75rem] md:max-h-[7.75rem] max-w-[min(92vw,620px)] sm:max-w-[min(85vw,720px)] md:max-w-[780px]"
            onClick={closeMobile}
          />
        </div>

        <nav className="hidden flex-1 justify-center gap-8 md:flex" aria-label="Primary">
          {links.map(({ label, href }) =>
            href.startsWith('#') ? (
              <a
                key={label}
                href={href}
                className={navHrefClass(href, { isHash: href.startsWith('#') })}
              >
                {label}
              </a>
            ) : (
              <Link
                key={label}
                to={href}
                className={navHrefClass(href, { isHash: href.startsWith('#') })}
              >
                {label}
              </Link>
            ),
          )}
        </nav>

        <div className="flex shrink-0 items-center gap-2 sm:gap-3">
          <ThemeToggle />
          <button
            type="button"
            className={`${iconButton} md:hidden`}
            aria-label={mobileOpen ? 'Close menu' : 'Open menu'}
            aria-expanded={mobileOpen}
            onClick={() => setMobileOpen((o) => !o)}
          >
            {mobileOpen ? (
              <X className="h-5 w-5" strokeWidth={1.75} />
            ) : (
              <Menu className="h-5 w-5" strokeWidth={1.75} />
            )}
          </button>
          {session ? (
            <>
              <button
                type="button"
                className={`${btnSecondaryOnHero} hidden items-center gap-1.5 px-4 py-2 sm:inline-flex ${navFocus}`}
                onClick={signOutAndHome}
              >
                <LogOut className="h-4 w-4 shrink-0" strokeWidth={1.75} aria-hidden />
                Log out
              </button>
              <Link to={appHome} className={`${btnPrimary} hidden px-4 py-2 sm:inline-flex ${navFocus}`}>
                {isAdmin ? 'Admin' : 'Dashboard'}
              </Link>
            </>
          ) : (
            <Link to="/auth" className={`${btnPrimary} hidden px-4 py-2 sm:inline-flex ${navFocus}`}>
              Log In / Sign up
            </Link>
          )}
        </div>
      </div>

      {mobileOpen ? (
        <div className="border-t border-emerald-900/10 bg-[#faf8f5]/98 shadow-lg backdrop-blur-md dark:border-slate-800 dark:bg-slate-950/98 md:hidden">
          <nav
            className={`${sectionContainer} flex max-w-7xl flex-col gap-1 py-3`}
            aria-label="Mobile primary"
          >
            {links.map(({ label, href }) =>
              href.startsWith('#') ? (
                <a
                  key={label}
                  href={href}
                  className={`${navHrefClass(href, { isHash: true })} cursor-pointer rounded-lg px-3 py-2.5 font-medium`}
                  onClick={closeMobile}
                >
                  {label}
                </a>
              ) : (
                <Link
                  key={label}
                  to={href}
                  className={`${navHrefClass(href, { isHash: false })} cursor-pointer rounded-lg px-3 py-2.5 font-medium`}
                  onClick={closeMobile}
                >
                  {label}
                </Link>
              ),
            )}
            {session ? (
              <>
                <button
                  type="button"
                  className={`${btnSecondaryOnHero} mt-2 flex w-full items-center justify-center gap-2 px-4 py-3 text-center font-semibold ${navFocus}`}
                  onClick={() => {
                    closeMobile()
                    void signOutAndHome()
                  }}
                >
                  <LogOut className="h-4 w-4 shrink-0" strokeWidth={1.75} aria-hidden />
                  Log out
                </button>
                <Link
                  to={appHome}
                  className={`${btnPrimary} mt-2 px-4 py-3 text-center ${navFocus}`}
                  onClick={closeMobile}
                >
                  {isAdmin ? 'Admin dashboard' : 'Dashboard'}
                </Link>
              </>
            ) : (
              <Link
                to="/auth"
                className={`${btnPrimary} mt-2 px-4 py-3 text-center ${navFocus}`}
                onClick={closeMobile}
              >
                Log In / Sign up
              </Link>
            )}
          </nav>
        </div>
      ) : null}
    </header>
  )
}

function scrollToId(id) {
  const el = document.getElementById(id)
  el?.scrollIntoView({ behavior: 'smooth', block: 'start' })
}

function Hero() {
  const reduce = useReducedMotion()
  const { amount, loading, isFallback } = usePublicStokvelMonthlyFlow()
  const flowLabel = 'Community pot in motion'
  const counterAria = isFallback
    ? `${flowLabel}: indicative total across public stokvel listings`
    : `${flowLabel}: summed monthly commitments from public stokvels`

  return (
    <section
      className={`relative isolate flex min-h-[100vh] flex-col justify-center overflow-hidden bg-gradient-to-b from-[#FFFFFF] to-[#F0FAF4] pt-2 pb-16 sm:pb-20`}
      aria-labelledby="hero-heading"
    >
      <HeroBackground />
      <div
        className="pointer-events-none absolute -left-40 top-10 z-[1] h-72 w-72 rounded-full bg-emerald-300/35 blur-3xl"
        aria-hidden
      />
      <div
        className="pointer-events-none absolute -right-32 bottom-0 z-[1] h-80 w-80 rounded-full bg-teal-200/40 blur-3xl"
        aria-hidden
      />

      <div
        className="pointer-events-none absolute inset-0 z-[2] [perspective:1600px]"
        style={{ perspectiveOrigin: '50% 35%' }}
        aria-hidden
      >
        <div className={`absolute inset-0 overflow-hidden`}>
          <RandRain />
        </div>
      </div>

      <div
        className="pointer-events-none absolute inset-0 z-[3] bg-gradient-to-b from-white/38 via-emerald-50/18 to-teal-50/30"
        aria-hidden
      />
      <div
        className="pointer-events-none absolute inset-0 z-[4]"
        style={{
          background:
            'radial-gradient(ellipse 85% 70% at 50% 45%, transparent 35%, rgba(250,248,245,0.5) 75%, rgba(237,244,240,0.92) 100%)',
        }}
        aria-hidden
      />

      <div className={`${sectionContainer} relative z-10 max-w-7xl py-10 sm:py-14 lg:py-16`}>
        <M.div
          initial={reduce ? false : { opacity: 0, y: 24 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, ease: [0.22, 1, 0.36, 1] }}
          className="relative mx-auto flex max-w-5xl flex-col items-center text-center"
        >
          <div className="flex w-full flex-col items-center">
            {reduce ? (
              <div className="relative mx-auto flex origin-center justify-center">
                <BrandLogo
                  src={heroLogoAsset}
                  to="/"
                  className="block justify-center"
                  imgClassName="hero-logo-mark object-contain object-center [filter:drop-shadow(0_10px_36px_rgba(165,214,167,0.82))_drop-shadow(0_3px_14px_rgba(165,214,167,0.45))]"
                />
              </div>
            ) : (
              <div className="hero-logo-breath relative mx-auto flex origin-center justify-center">
                <BrandLogo
                  src={heroLogoAsset}
                  to="/"
                  className="block justify-center"
                  imgClassName="hero-logo-mark object-contain object-center [filter:drop-shadow(0_10px_36px_rgba(165,214,167,0.82))_drop-shadow(0_3px_14px_rgba(165,214,167,0.45))]"
                />
              </div>
            )}
            <div
              className="mt-9 h-0.5 w-[60px] shrink-0 rounded-full bg-[#2E7D32]"
              aria-hidden
            />
          </div>
          <h1
            id="hero-heading"
            className="mt-10 font-serif text-5xl font-semibold leading-[1.08] tracking-tight text-emerald-950 drop-shadow-[0_1px_14px_rgba(255,255,255,0.9)] sm:text-6xl"
          >
            Your Community.
            <br />
            <span className="text-emerald-800/95">Your Wealth.</span>
          </h1>
          <p className="mt-6 max-w-xl text-base leading-relaxed text-stone-600 sm:text-lg dark:text-stone-300">
            Join trusted stokvel circles, track contributions transparently, and reach shared goals with a
            community that has your back—all in South African Rands.
          </p>

          <div className="mt-10 min-h-[5.5rem]">
            <LiveMoneyCounter
              value={amount ?? 0}
              loading={loading}
              label={flowLabel}
              aria-label={counterAria}
              tone="light"
            />
            <p className="mt-2 max-w-md text-xs leading-snug text-stone-500">
              {isFallback
                ? 'Indicative total when live public listings are unavailable; replaces with live sums from active public groups when data is present.'
                : 'Live sum of each public group’s monthly contribution commitment (contribution × members).'}
            </p>
          </div>

          <div className="mt-10 flex w-full max-w-xl flex-col items-center gap-3 sm:flex-row sm:flex-wrap sm:justify-center">
            <Link to="/auth" className={`${btnPrimary} w-full justify-center px-6 py-3.5 sm:w-auto sm:min-w-[11rem] sm:inline-flex ${navFocus}`}>
              Start saving
            </Link>
            <Link
              to="/stokvels"
              className={`${btnSecondaryOnHero} w-full justify-center px-6 py-3.5 sm:w-auto sm:min-w-[11rem] sm:inline-flex ${navFocus}`}
            >
              Browse groups
            </Link>
            <button
              type="button"
              className={`${navFocus} mt-1 flex cursor-pointer items-center justify-center gap-2 px-1 py-2 text-sm font-semibold text-emerald-800 transition duration-200 hover:text-emerald-950 sm:mt-0`}
              onClick={() => scrollToId('features')}
            >
              See how it works
              <ChevronDown className="h-4 w-4" strokeWidth={2} aria-hidden />
            </button>
          </div>
        </M.div>
      </div>
    </section>
  )
}

const featureItems = [
  {
    title: 'Bank-grade trust',
    body: 'Encrypted sessions and role-based access keep every member and treasurer aligned.',
    icon: ShieldCheck,
  },
  {
    title: 'Transparent flows',
    body: 'See contributions, meetings, and payouts with a clear record the whole circle can rely on.',
    icon: LineChart,
  },
  {
    title: 'Built for community',
    body: 'Invite members, run rotations, and stay on track together—without losing the human touch.',
    icon: Users,
  },
  {
    title: 'SA-first money',
    body: 'Amounts are shown in rands and cents, formatted for everyday South African banking clarity.',
    icon: Landmark,
  },
]

function FeaturesSection() {
  const reduce = useReducedMotion()

  return (
    <section
      id="features"
      className="scroll-mt-28 border-t border-emerald-900/10 bg-white py-16 md:py-24"
      aria-labelledby="features-heading"
    >
      <div className={`${sectionContainer} max-w-7xl`}>
        <div className="mx-auto max-w-2xl text-center">
          <p className="text-xs font-semibold uppercase tracking-[0.26em] text-emerald-800/85">Features</p>
          <h2
            id="features-heading"
            className="mt-3 font-serif text-3xl font-semibold tracking-tight text-emerald-950 sm:text-4xl"
          >
            Everything your stokvel needs
          </h2>
          <p className="mt-4 text-base leading-relaxed text-stone-600">
            Designed for treasurers and members—fast on mobile, clear on desktop, and respectful of reduced
            motion preferences.
          </p>
        </div>

        <ul className="mt-12 grid list-none grid-cols-1 gap-5 p-0 sm:grid-cols-2 lg:grid-cols-4 lg:gap-6">
          {featureItems.map((f, i) => {
            const Icon = f.icon
            return (
              <M.li
                key={f.title}
                initial={reduce ? false : { opacity: 0, y: 28 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true, margin: '-8%' }}
                transition={{ duration: 0.45, delay: i * 0.08, ease: [0.22, 1, 0.36, 1] }}
                className="min-w-0"
              >
                <article className="group relative h-full cursor-default overflow-hidden rounded-2xl border border-emerald-900/10 bg-[#faf8f5] p-6 shadow-sm shadow-emerald-900/[0.06] transition duration-200 hover:-translate-y-1 hover:border-emerald-800/25 hover:shadow-md">
                  <div className="flex h-11 w-11 items-center justify-center rounded-xl border border-emerald-900/10 bg-emerald-50 text-emerald-800 transition duration-200 group-hover:border-emerald-700/30">
                    <Icon className="h-5 w-5" strokeWidth={1.75} aria-hidden />
                  </div>
                  <h3 className="mt-4 font-serif text-lg font-semibold text-emerald-950">{f.title}</h3>
                  <p className="mt-2 text-sm leading-relaxed text-stone-600">{f.body}</p>
                </article>
              </M.li>
            )
          })}
        </ul>
      </div>
    </section>
  )
}

function OpportunitiesSection() {
  const reduce = useReducedMotion()

  return (
    <section
      id="opportunities"
      className="border-t border-emerald-900/10 bg-[#f0f4ef] py-14 md:py-20"
      aria-labelledby="opportunities-heading"
    >
      <div className={`${sectionContainer} max-w-7xl`}>
        <M.div
          initial={reduce ? false : { opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: '-10%' }}
          transition={{ duration: 0.5 }}
          className="mx-auto max-w-2xl text-center"
        >
          <p className="flex items-center justify-center gap-2 text-xs font-semibold uppercase tracking-[0.26em] text-emerald-800/85">
            <Sparkles className="h-4 w-4 text-emerald-700" strokeWidth={1.75} aria-hidden />
            <span>Open circles</span>
          </p>
          <h2
            id="opportunities-heading"
            className="mt-3 font-serif text-3xl font-semibold tracking-tight text-emerald-950 sm:text-4xl"
          >
            Browse public stokvels
          </h2>
          <p className="mt-4 text-base leading-relaxed text-stone-600">
            Discover groups looking for reliable members and find a circle that fits your goals.
          </p>
          <p className="mt-6">
            <Link
              to="/stokvels"
              className={`${navFocus} cursor-pointer text-sm font-semibold text-emerald-800 underline-offset-4 transition duration-200 hover:text-emerald-950 hover:underline`}
            >
              View all public stokvels
            </Link>
          </p>
        </M.div>
        <ul className="mt-12 grid list-none grid-cols-1 gap-6 p-0 md:mt-14 md:grid-cols-2 md:items-stretch lg:grid-cols-3">
          {PUBLIC_STOKVEL_OPPORTUNITIES.slice(0, 3).map((item, i) => (
            <M.li
              key={item.id}
              initial={reduce ? false : { opacity: 0, y: 22 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, margin: '-8%' }}
              transition={{ duration: 0.45, delay: i * 0.1 }}
              className="min-w-0"
            >
              <div className="h-full rounded-2xl [&_article]:ring-1 [&_article]:ring-emerald-900/10 dark:[&_article]:ring-0">
                <OpportunityCard {...item} />
              </div>
            </M.li>
          ))}
        </ul>
      </div>
    </section>
  )
}

function Testimonial() {
  const { quote, author, role, organization, location } = LANDING_TESTIMONIAL
  const reduce = useReducedMotion()

  return (
    <section
      id="stories"
      className="scroll-mt-24 border-y border-emerald-900/10 bg-[#faf8f5] py-14 md:py-24"
      aria-labelledby="testimonial-heading"
    >
      <div className={`${sectionContainer} grid max-w-7xl gap-10 sm:gap-14 lg:grid-cols-2 lg:items-center lg:gap-16`}>
        <M.div
          initial={reduce ? false : { opacity: 0, x: -16 }}
          whileInView={{ opacity: 1, x: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.55 }}
          className="relative mx-auto aspect-square w-full max-w-[min(100%,420px)] overflow-hidden rounded-2xl border border-emerald-900/10 bg-white shadow-xl shadow-emerald-900/10 ring-1 ring-white/70 md:mx-0"
        >
          <img
            src={testimonialPortrait}
            alt=""
            width={480}
            height={480}
            className="absolute inset-0 h-full w-full object-cover object-center"
            loading="lazy"
            decoding="async"
          />
          <div
            className="pointer-events-none absolute inset-0 rounded-2xl bg-transparent ring-1 ring-inset ring-emerald-900/10"
            aria-hidden
          />
        </M.div>

        <M.div
          initial={reduce ? false : { opacity: 0, x: 16 }}
          whileInView={{ opacity: 1, x: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.55 }}
          className="flex flex-col justify-center"
        >
          <h2 id="testimonial-heading" className="text-xs font-semibold uppercase tracking-[0.26em] text-emerald-800/80">
            Member stories
          </h2>
          <blockquote className="mt-4">
            <p className="font-serif text-xl font-medium leading-relaxed text-emerald-950 sm:text-2xl lg:text-[1.65rem] lg:leading-snug">
              <span className="text-emerald-700/45" aria-hidden>
                &ldquo;
              </span>
              {quote}
              <span className="text-emerald-700/45" aria-hidden>
                &rdquo;
              </span>
            </p>
            <footer className="mt-8 border-l-2 border-emerald-700/40 pl-4">
              <p className="text-sm font-semibold text-emerald-900 sm:text-base">
                {author}
                <span className="font-normal text-emerald-800/80"> · {role}</span>
              </p>
              <p className="mt-1 text-sm text-stone-600">
                {organization} · {location}
              </p>
            </footer>
          </blockquote>
        </M.div>
      </div>
    </section>
  )
}

export default function Landing() {
  return (
    <div className="min-h-full bg-[#faf8f5] text-emerald-950">
      <TopNav />
      <main>
        <Hero />
        <FeaturesSection />
        <OpportunitiesSection />
        <Testimonial />
      </main>
      <PublicFooter />
    </div>
  )
}
