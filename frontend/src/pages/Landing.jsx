import { useState } from 'react'
import { Link } from 'react-router-dom'
import BrandLogo from '../components/BrandLogo'
import OpportunityCard from '../components/OpportunityCard'
import { heroDashboardIllustration, testimonialPortrait } from '../assets/landing'
import { PUBLIC_STOKVEL_OPPORTUNITIES } from '../data/publicStokvelOpportunities'
import { LANDING_TESTIMONIAL } from '../data/landingTestimonial'
import {
  ExternalLink,
  Globe,
  Menu,
  Search,
  ShieldCheck,
  X,
} from 'lucide-react'
import { useSession } from '../context/SessionContext'
import {
  bodyMuted,
  bodyMutedLg,
  btnPrimary,
  btnSecondaryOnHero,
  captionMuted,
  cardCaptionBar,
  cardCaptionTitle,
  cardMediaPlaceholder,
  dividerFooter,
  footerBody,
  footerColTitle,
  footerLegal,
  footerLegalLink,
  footerLink,
  footerLinkList,
  footerSocialButton,
  footerSocialRow,
  headingHero,
  headingHeroAccent,
  headingSection,
  heroGrid,
  heroMediaCard,
  heroRoseCard,
  heroStatCluster,
  iconButton,
  iconButtonSubtle,
  landingPageShell,
  lead,
  navLink,
  roseBody,
  roseIconBubble,
  roseTitle,
  sectionContainer,
  sectionNarrow,
  statLabel,
  statValue,
  surfaceFooter,
  surfaceHero,
  testimonialGrid,
  testimonialKicker,
  testimonialPhotoFrame,
  testimonialQuote,
  testimonialSection,
  topNavBar,
} from '../styles/tokens'

function TopNav() {
  const { session, userRole } = useSession()
  const isAdmin = String(userRole || '').toLowerCase() === 'admin'
  const appHome = isAdmin ? '/admin/groups' : '/dashboard'
  const [mobileOpen, setMobileOpen] = useState(false)

  const links = [
    { label: 'How it works', href: '#how' },
    { label: 'Browse groups', href: '/stokvels' },
    { label: 'Stories', href: '#stories' },
    { label: 'Support', href: '#footer-support' },
  ]

  const closeMobile = () => setMobileOpen(false)

  return (
    <header className={`${topNavBar} relative`}>
      <div
        className={`${sectionContainer} flex max-w-7xl items-center justify-between gap-2 py-4 sm:gap-4 sm:py-5`}
      >
        <BrandLogo
          to="/"
          imgClassName="h-24 w-auto sm:h-28 md:h-32 lg:h-40 xl:h-44 2xl:h-52"
          onClick={closeMobile}
        />

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
            className={`${iconButton} hidden sm:inline-flex`}
            aria-label="Search"
          >
            <Search className="h-5 w-5" strokeWidth={1.75} />
          </button>
          <a
            href="https://twitter.com"
            className={`hidden sm:inline-flex ${iconButtonSubtle}`}
            aria-label="Social (opens X)"
          >
            <Globe className="h-5 w-5" strokeWidth={1.75} />
          </a>
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
              <Link
                to={appHome}
                className={`${btnPrimary} mt-2 px-4 py-3 text-center`}
                onClick={closeMobile}
              >
                {isAdmin ? 'Admin dashboard' : 'Dashboard'}
              </Link>
            ) : (
              <Link
                to="/auth"
                className={`${btnPrimary} mt-2 px-4 py-3 text-center`}
                onClick={closeMobile}
              >
                Log in
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

function Footer() {
  return (
    <footer className={`${surfaceFooter} mt-auto`}>
        <div className={`${sectionContainer} py-12 md:py-16`}>
        <div className="grid grid-cols-1 gap-10 sm:grid-cols-2 sm:gap-10 lg:grid-cols-3 lg:gap-12">
          <div className="min-w-0">
            <BrandLogo to="/" variant="onDark" imgClassName="h-24 w-auto sm:h-28 md:h-36" />
            <p className={footerBody}>
              Community-first savings circles with transparent tools for members and admins.
            </p>
          </div>
          <nav aria-label="Company" className="min-w-0">
            <p className={footerColTitle}>Company</p>
            <ul className={footerLinkList}>
              <li>
                <a href="#how" className={footerLink}>
                  How it works
                </a>
              </li>
              <li>
                <Link to="/auth" className={footerLink}>
                  Create account
                </Link>
              </li>
              <li>
                <a href="#footer-support" className={footerLink}>
                  Contact
                </a>
              </li>
            </ul>
          </nav>
          <nav id="footer-support" aria-label="Support" className="min-w-0 scroll-mt-24">
            <p className={footerColTitle}>Support</p>
            <ul className={footerLinkList}>
              <li>
                <Link to="/auth" className={footerLink}>
                  Help centre (sign in)
                </Link>
              </li>
                           <li>
                <Link to="/stokvels" className={footerLink}>
                  Browse groups
                </Link>
              </li>
            </ul>
          </nav>
        </div>

        <div
          className={`mt-12 flex flex-col gap-6 ${dividerFooter} pt-8 md:flex-row md:items-center md:justify-between md:gap-8`}
        >
          <div className="flex min-w-0 flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-center sm:gap-x-6">
            <p className={`${footerLegal} shrink-0`}>
              © {new Date().getFullYear()} StokGeld. All rights reserved.
            </p>
            <nav className="flex flex-wrap gap-x-4 gap-y-1" aria-label="Legal">
              <a href="#privacy" className={footerLegalLink}>
                Privacy
              </a>
              <a href="#terms" className={footerLegalLink}>
                Terms
              </a>
            </nav>
          </div>
          <div className={footerSocialRow}>
            <a
              href="https://facebook.com"
              className={footerSocialButton}
              aria-label="Facebook"
            >
              <ExternalLink className="h-3.5 w-3.5 sm:h-4 sm:w-4" strokeWidth={1.75} />
            </a>
            <a
              href="https://instagram.com"
              className={footerSocialButton}
              aria-label="Instagram"
            >
              <ExternalLink className="h-3.5 w-3.5 sm:h-4 sm:w-4" strokeWidth={1.75} />
            </a>
            <a
              href="https://linkedin.com"
              className={footerSocialButton}
              aria-label="LinkedIn"
            >
              <ExternalLink className="h-3.5 w-3.5 sm:h-4 sm:w-4" strokeWidth={1.75} />
            </a>
          </div>
        </div>
      </div>
    </footer>
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
              Discover open circles looking for reliable members. The cards read from demo data in{' '}
              <span className="whitespace-nowrap font-medium text-emerald-900">
                src/data/publicStokvelOpportunities.js
              </span>
              —swap that for your API when you wire the backend.
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
      <Footer />
    </div>
  )
}
