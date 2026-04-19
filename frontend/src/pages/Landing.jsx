import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import BrandLogo from '../components/BrandLogo'
import PublicFooter from '../components/PublicFooter'
import OpportunityCard from '../components/OpportunityCard'
import { heroDashboardIllustration, testimonialPortrait } from '../assets/landing'
import { PUBLIC_STOKVEL_OPPORTUNITIES } from '../data/publicStokvelOpportunities'
import { LANDING_TESTIMONIAL } from '../data/landingTestimonial'
import { LogOut, Menu, ShieldCheck, X } from 'lucide-react'
import { useSession } from '../context/SessionContext'
import { supabase } from '../utils/supabase'
import {
  bodyMuted,
  bodyMutedLg,
  btnPrimary,
  btnSecondaryOnHero,
  captionMuted,
  cardCaptionBar,
  cardCaptionTitle,
  cardMediaPlaceholder,
  headingHero,
  headingHeroAccent,
  headingSection,
  heroGrid,
  heroMediaCard,
  heroRoseCard,
  heroStatCluster,
  iconButton,
  landingPageShell,
  lead,
  marketingNavInnerRow,
  navLink,
  roseBody,
  roseIconBubble,
  roseTitle,
  sectionContainer,
  sectionNarrow,
  statLabel,
  statValue,
  surfaceHero,
  testimonialGrid,
  testimonialKicker,
  testimonialPhotoFrame,
  testimonialQuote,
  testimonialSection,
  topNavBar,
} from '../styles/tokens'

function TopNav() {
  const navigate = useNavigate()
  const { session, userRole } = useSession()
  const isAdmin = String(userRole || '').toLowerCase() === 'admin'
  const appHome = isAdmin ? '/admin/groups' : '/dashboard'
  const [mobileOpen, setMobileOpen] = useState(false)

  const signOutAndHome = async () => {
    await supabase.auth.signOut()
    navigate('/', { replace: true })
  }

  const links = [
    { label: 'How it works', href: '#how' },
    { label: 'Public stokvels', href: '/stokvels' },
    { label: 'Stories', href: '#stories' },
    { label: 'Support', href: '#footer-support' },
  ]

  const closeMobile = () => setMobileOpen(false)

  return (
    <header className={`${topNavBar} relative`}>
      <div className={`${sectionContainer} ${marketingNavInnerRow}`}>
        <div className="flex min-h-0 max-h-full min-w-0 shrink-0 self-stretch items-center">
          <BrandLogo
            to="/"
            className="h-full min-h-0 max-h-full"
            imgClassName="max-h-full w-auto max-w-[min(58vw,360px)] object-contain object-left sm:max-w-[min(50vw,400px)] md:max-w-[min(44vw,440px)]"
            onClick={closeMobile}
          />
        </div>

        <nav className="hidden flex-1 justify-center gap-6 md:flex md:gap-8" aria-label="Primary">
          {links.map(({ label, href }) =>
            href.startsWith('#') ? (
              <a key={label} href={href} className={navLink}>
                {label}
              </a>
            ) : (
              <Link key={label} to={href} className={navLink}>
                {label}
              </Link>
            ),
          )}
        </nav>

        <div className="flex shrink-0 items-center gap-1 sm:gap-2 md:gap-3">
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
                className={`${btnSecondaryOnHero} hidden items-center gap-1.5 px-4 py-2 sm:inline-flex`}
                onClick={signOutAndHome}
              >
                <LogOut className="h-4 w-4 shrink-0" strokeWidth={1.75} aria-hidden />
                Log out
              </button>
              <Link
                to={appHome}
                className={`${btnPrimary} hidden px-4 py-2 sm:inline-flex`}
              >
                {isAdmin ? 'Admin' : 'Dashboard'}
              </Link>
            </>
          ) : (
            <Link to="/auth" className={`${btnPrimary} hidden px-4 py-2 sm:inline-flex`}>
              Log In / Sign up
            </Link>
          )}
        </div>
      </div>

      {mobileOpen ? (
        <div className="border-t border-emerald-900/10 bg-[#faf8f5]/98 shadow-lg backdrop-blur-md md:hidden">
          <nav
            className={`${sectionContainer} flex max-w-7xl flex-col gap-1 py-3`}
            aria-label="Mobile primary"
          >
            {links.map(({ label, href }) =>
              href.startsWith('#') ? (
                <a
                  key={label}
                  href={href}
                  className="rounded-lg px-3 py-2.5 text-sm font-medium text-emerald-900 hover:bg-emerald-900/5"
                  onClick={closeMobile}
                >
                  {label}
                </a>
              ) : (
                <Link
                  key={label}
                  to={href}
                  className="rounded-lg px-3 py-2.5 text-sm font-medium text-emerald-900 hover:bg-emerald-900/5"
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
                  className={`${btnSecondaryOnHero} mt-2 flex w-full items-center justify-center gap-2 px-4 py-3 text-center font-semibold`}
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
                  className={`${btnPrimary} mt-2 px-4 py-3 text-center`}
                  onClick={closeMobile}
                >
                  {isAdmin ? 'Admin dashboard' : 'Dashboard'}
                </Link>
              </>
            ) : (
              <Link
                to="/auth"
                className={`${btnPrimary} mt-2 px-4 py-3 text-center`}
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

function Hero() {
  return (
    <section id="how" className={`${surfaceHero} isolate`}>
      <div
        className="pointer-events-none absolute -left-40 top-10 h-72 w-72 rounded-full bg-emerald-300/35 blur-3xl"
        aria-hidden
      />
      <div
        className="pointer-events-none absolute -right-32 bottom-0 h-80 w-80 rounded-full bg-teal-200/40 blur-3xl"
        aria-hidden
      />

      <div className={`${sectionContainer} ${heroGrid} max-w-7xl`}>
        <div className="flex max-w-xl flex-col justify-center md:max-w-none">
          <h1 className={headingHero}>
            Save together.
            <br />
            <span className={headingHeroAccent}>Grow together.</span>
          </h1>
          <p className={`mt-5 max-w-lg ${lead}`}>
            Join trusted stokvel circles, track contributions transparently, and reach shared goals
            with a community that has your back.
          </p>

          <div className={heroStatCluster}>
            <div className="min-w-[7rem]">
              <p className={statValue}>12+</p>
              <p className={statLabel}>Active public groups</p>
            </div>
            <div
              className="hidden h-10 w-px shrink-0 bg-emerald-900/15 sm:block"
              aria-hidden
            />
            <div className="min-w-[7rem]">
              <p className={statValue}>R2.4M+</p>
              <p className={statLabel}>Cycled fairly (demo)</p>
            </div>
          </div>

          <div className="mt-8 flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:gap-4">
            <Link
              to="/auth"
              className={`${btnPrimary} w-full justify-center px-6 py-3.5 sm:w-auto sm:min-w-[11rem] sm:inline-flex`}
            >
              Start saving
            </Link>
            <Link
              to="/stokvels"
              className={`${btnSecondaryOnHero} w-full justify-center px-6 py-3.5 sm:w-auto sm:min-w-[11rem] sm:inline-flex`}
            >
              Browse groups
            </Link>
          </div>
        </div>

        <div className="relative mx-auto flex w-full min-h-0 max-w-md items-center justify-center pb-16 sm:min-h-[260px] sm:pb-14 md:min-h-[280px] lg:max-w-lg lg:min-h-[300px] lg:pb-0">
          <div className="relative w-full">
            <div className={heroMediaCard}>
              <div className={`${cardMediaPlaceholder} isolate`}>
                <img
                  src={heroDashboardIllustration}
                  alt=""
                  width={800}
                  height={600}
                  className="absolute inset-0 h-full w-full object-cover object-center"
                  loading="lazy"
                  decoding="async"
                />
                <div
                  className="pointer-events-none absolute inset-0 bg-gradient-to-t from-emerald-900/[0.07] to-transparent"
                  aria-hidden
                />
              </div>
              <div className={cardCaptionBar}>
                <p className={cardCaptionTitle}>Your next payout window</p>
                <p className={captionMuted}>Track meetings and rotations in one place.</p>
              </div>
            </div>

            <div className={heroRoseCard}>
              <div className="flex items-start gap-3">
                <div className={roseIconBubble}>
                  <ShieldCheck className="h-5 w-5" strokeWidth={1.75} />
                </div>
                <div>
                  <p className={roseTitle}>Bank-grade security</p>
                  <p className={roseBody}>
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

function Testimonial() {
  const { quote, author, role, organization, location } = LANDING_TESTIMONIAL

  return (
    <section
      id="stories"
      className={testimonialSection}
      aria-labelledby="testimonial-heading"
    >
      <div className={`${sectionContainer} ${testimonialGrid} max-w-7xl`}>
        <div className={testimonialPhotoFrame}>
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
            className="pointer-events-none absolute inset-0 rounded-2xl ring-1 ring-inset ring-emerald-900/10"
            aria-hidden
          />
        </div>

        <div className="flex flex-col justify-center">
          <h2 id="testimonial-heading" className={testimonialKicker}>
            Member stories
          </h2>
          <blockquote className="mt-4">
            <p className={testimonialQuote}>
              <span className="text-emerald-700/50" aria-hidden>
                &ldquo;
              </span>
              {quote}
              <span className="text-emerald-700/50" aria-hidden>
                &rdquo;
              </span>
            </p>
            <footer className="mt-8 border-l-2 border-emerald-700/40 pl-4">
              <p className="text-sm font-semibold text-emerald-900 sm:text-base">
                {author}
                <span className="font-normal text-emerald-800/80"> · {role}</span>
              </p>
              <p className={`mt-1 text-sm ${bodyMuted}`}>
                {organization} · {location}
              </p>
            </footer>
          </blockquote>
        </div>
      </div>
    </section>
  )
}

export default function Landing() {
  return (
    <div className={landingPageShell}>
      <TopNav />
      <main>
        <Hero />
        <section
          id="opportunities"
          className={`${sectionContainer} py-12 md:py-20`}
          aria-labelledby="opportunities-heading"
        >
          <div className={sectionNarrow}>
            <h2 id="opportunities-heading" className={headingSection}>
              Browse public stokvels
            </h2>
            <p className={`mt-3 ${bodyMutedLg}`}>
              Discover open circles looking for reliable members and find a group that fits your goals.
            </p>
            <p className="mt-4">
              <Link
                to="/stokvels"
                className="text-sm font-semibold text-emerald-800 underline-offset-4 hover:text-emerald-950 hover:underline"
              >
                View all public stokvels →
              </Link>
            </p>
          </div>
          <ul className="mt-10 grid list-none grid-cols-1 gap-6 p-0 md:mt-12 md:grid-cols-2 md:items-stretch lg:grid-cols-3">
            {PUBLIC_STOKVEL_OPPORTUNITIES.slice(0, 3).map((item) => (
              <li key={item.id} className="min-w-0">
                <OpportunityCard {...item} />
              </li>
            ))}
          </ul>
        </section>
        <Testimonial />
      </main>
      <PublicFooter />
    </div>
  )
}
