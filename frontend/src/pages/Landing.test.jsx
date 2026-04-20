import { render, screen, fireEvent, waitFor, act } from '@testing-library/react'
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { MemoryRouter } from 'react-router-dom'
import Landing from './Landing'
import { SessionContext } from '../context/SessionContext'

// ─── Mocks ───────────────────────────────────────────────────────────────────

const mockNavigate = vi.fn()

vi.mock('react-router-dom', async () => {
    const actual = await vi.importActual('react-router-dom')
    return { ...actual, useNavigate: () => mockNavigate }
})

vi.mock('../utils/supabase', () => ({
    supabase: {
        auth: {
            signOut: vi.fn().mockResolvedValue({}),
        },
    },
}))

vi.mock('../components/BrandLogo', () => ({
    default: ({ to, onClick }) => (
        <a href={to} onClick={onClick} data-testid="brand-logo">
            BrandLogo
        </a>
    ),
}))

vi.mock('../components/ThemeToggle', () => ({
    default: () => <button type="button">Toggle theme</button>,
}))

vi.mock('../components/PublicFooter', () => ({
    default: () => <footer data-testid="public-footer">Footer</footer>,
}))

vi.mock('../components/OpportunityCard', () => ({
    default: ({ name }) => <div data-testid="opportunity-card">{name}</div>,
}))

vi.mock('../assets/landing', () => ({
    heroDashboardIllustration: 'hero.png',
    testimonialPortrait: 'portrait.png',
}))

vi.mock('../data/publicStokvelOpportunities', () => ({
    PUBLIC_STOKVEL_OPPORTUNITIES: [
        { id: '1', name: 'Savings Circle A' },
        { id: '2', name: 'Savings Circle B' },
        { id: '3', name: 'Savings Circle C' },
        { id: '4', name: 'Savings Circle D' },
    ],
}))

vi.mock('../data/landingTestimonial', () => ({
    LANDING_TESTIMONIAL: {
        quote: 'This platform changed my life.',
        author: 'Jane Doe',
        role: 'Member',
        organization: 'Test Org',
        location: 'Cape Town',
    },
}))

vi.mock('../styles/tokens', () => ({
    bodyMuted: '',
    bodyMutedLg: '',
    btnPrimary: '',
    btnSecondaryOnHero: '',
    captionMuted: '',
    cardCaptionBar: '',
    cardCaptionTitle: '',
    cardMediaPlaceholder: '',
    headingHero: '',
    headingHeroAccent: '',
    headingSection: '',
    heroGrid: '',
    heroMediaCard: '',
    heroRoseCard: '',
    heroStatCluster: '',
    iconButton: '',
    landingPageShell: '',
    lead: '',
    marketingNavInnerRow: '',
    navLink: '',
    roseBody: '',
    roseIconBubble: '',
    roseTitle: '',
    sectionContainer: '',
    sectionNarrow: '',
    statLabel: '',
    statValue: '',
    surfaceHero: '',
    testimonialGrid: '',
    testimonialKicker: '',
    testimonialPhotoFrame: '',
    testimonialQuote: '',
    testimonialSection: '',
    topNavBar: '',
}))

// ─── Helpers ─────────────────────────────────────────────────────────────────

const renderLanding = ({ session = null, userRole = null } = {}) =>
    render(
        <MemoryRouter>
            <SessionContext.Provider value={{ session, userRole }}>
                <Landing />
            </SessionContext.Provider>
        </MemoryRouter>,
    )

const guestSession = null
const memberSession = {
    access_token: 'member-token',
    user: { id: 'member-uuid', email: 'member@test.com' },
}
const adminSession = {
    access_token: 'admin-token',
    user: { id: 'admin-uuid', email: 'admin@test.com' },
}

// ─── Tests ───────────────────────────────────────────────────────────────────

describe('Landing page', () => {
    beforeEach(() => {
        vi.clearAllMocks()
    })

    afterEach(() => {
        vi.clearAllMocks()
    })

    // ── Rendering ──────────────────────────────────────────────────────────────

    describe('Basic rendering', () => {
        it('renders the hero headline', () => {
            renderLanding()
            expect(screen.getByText('Save together.')).toBeInTheDocument()
            expect(screen.getByText('Grow together.')).toBeInTheDocument()
        })

        it('renders the hero lead paragraph', () => {
            renderLanding()
            expect(screen.getByText(/Join trusted stokvel circles/i)).toBeInTheDocument()
        })

        it('renders the hero stat figures', () => {
            renderLanding()
            expect(screen.getByText('12+')).toBeInTheDocument()
            expect(screen.getByText('R2.4M+')).toBeInTheDocument()
        })

        it('renders the public footer', () => {
            renderLanding()
            expect(screen.getByTestId('public-footer')).toBeInTheDocument()
        })

        it('renders the brand logo', () => {
            renderLanding()
            expect(screen.getByTestId('brand-logo')).toBeInTheDocument()
        })
    })

    // ── Nav: guest ─────────────────────────────────────────────────────────────

    describe('TopNav — guest (not logged in)', () => {
        it('shows Log In / Sign up button', () => {
            renderLanding({ session: guestSession })
            expect(screen.getAllByRole('link', { name: /Log In \/ Sign up/i })[0]).toBeInTheDocument()
        })

        it('does not show Log out button', () => {
            renderLanding({ session: guestSession })
            expect(screen.queryByRole('button', { name: /Log out/i })).not.toBeInTheDocument()
        })

        it('does not show Dashboard link', () => {
            renderLanding({ session: guestSession })
            expect(screen.queryByRole('link', { name: /Dashboard/i })).not.toBeInTheDocument()
        })
    })

    // ── Nav: logged-in member ──────────────────────────────────────────────────

    describe('TopNav — logged in member', () => {
        it('shows Dashboard link pointing to /dashboard', () => {
            renderLanding({ session: memberSession, userRole: 'member' })
            const dashboardLinks = screen.getAllByRole('link', { name: /Dashboard/i })
            expect(dashboardLinks.length).toBeGreaterThan(0)
            expect(dashboardLinks[0]).toHaveAttribute('href', '/dashboard')
        })

        it('shows Log out button', () => {
            renderLanding({ session: memberSession, userRole: 'member' })
            expect(screen.getAllByRole('button', { name: /Log out/i })[0]).toBeInTheDocument()
        })

        it('does not show Log In / Sign up button', () => {
            renderLanding({ session: memberSession, userRole: 'member' })
            expect(screen.queryByRole('link', { name: /Log In \/ Sign up/i })).not.toBeInTheDocument()
        })
    })

    // ── Nav: admin ─────────────────────────────────────────────────────────────

    describe('TopNav — logged in admin', () => {
        it('shows Admin link pointing to /admin/groups', () => {
            renderLanding({ session: adminSession, userRole: 'admin' })
            const adminLinks = screen.getAllByRole('link', { name: /Admin/i })
            expect(adminLinks.length).toBeGreaterThan(0)
            expect(adminLinks[0]).toHaveAttribute('href', '/admin/groups')
        })
    })

    // ── Sign out ───────────────────────────────────────────────────────────────

    describe('Sign out', () => {
        it('calls supabase.auth.signOut and navigates to / on log out', async () => {
            const { supabase } = await import('../utils/supabase')
            renderLanding({ session: memberSession, userRole: 'member' })

            await act(async () => {
                fireEvent.click(screen.getAllByRole('button', { name: /Log out/i })[0])
            })

            expect(supabase.auth.signOut).toHaveBeenCalledTimes(1)
            await waitFor(() => {
                expect(mockNavigate).toHaveBeenCalledWith('/', { replace: true })
            })
        })
    })

    // ── Mobile nav ─────────────────────────────────────────────────────────────

    describe('Mobile nav', () => {
        it('opens the mobile menu when hamburger is clicked', async () => {
            renderLanding({ session: guestSession })

            await act(async () => {
                fireEvent.click(screen.getByRole('button', { name: /Open menu/i }))
            })

            expect(screen.getByRole('navigation', { name: /Mobile primary/i })).toBeInTheDocument()
        })

        it('closes the mobile menu when close button is clicked', async () => {
            renderLanding({ session: guestSession })

            await act(async () => {
                fireEvent.click(screen.getByRole('button', { name: /Open menu/i }))
            })

            expect(screen.getByRole('navigation', { name: /Mobile primary/i })).toBeInTheDocument()

            await act(async () => {
                fireEvent.click(screen.getByRole('button', { name: /Close menu/i }))
            })

            expect(screen.queryByRole('navigation', { name: /Mobile primary/i })).not.toBeInTheDocument()
        })

        it('shows Log In / Sign up in mobile menu when guest', async () => {
            renderLanding({ session: guestSession })

            await act(async () => {
                fireEvent.click(screen.getByRole('button', { name: /Open menu/i }))
            })

            const loginLinks = screen.getAllByRole('link', { name: /Log In \/ Sign up/i })
            expect(loginLinks.length).toBeGreaterThan(0)
        })

        it('shows Log out in mobile menu when logged in', async () => {
            renderLanding({ session: memberSession, userRole: 'member' })

            await act(async () => {
                fireEvent.click(screen.getByRole('button', { name: /Open menu/i }))
            })

            const logoutBtns = screen.getAllByRole('button', { name: /Log out/i })
            expect(logoutBtns.length).toBeGreaterThan(0)
        })
    })

    // ── Hero CTAs ──────────────────────────────────────────────────────────────

    describe('Hero CTAs', () => {
        it('renders Start saving link pointing to /auth', () => {
            renderLanding()
            const links = screen.getAllByRole('link', { name: /Start saving/i })
            expect(links[0]).toHaveAttribute('href', '/auth')
        })

        it('renders Browse groups link pointing to /stokvels', () => {
            renderLanding()
            const links = screen.getAllByRole('link', { name: /Browse groups/i })
            expect(links[0]).toHaveAttribute('href', '/stokvels')
        })
    })

    // ── Opportunities section ──────────────────────────────────────────────────

    describe('Public stokvel opportunities', () => {
        it('renders the section heading', () => {
            renderLanding()
            expect(screen.getByText(/Browse public stokvels/i)).toBeInTheDocument()
        })

        it('renders only the first 3 opportunity cards', () => {
            renderLanding()
            expect(screen.getAllByTestId('opportunity-card')).toHaveLength(3)
        })

        it('renders View all public stokvels link', () => {
            renderLanding()
            const link = screen.getByRole('link', { name: /View all public stokvels/i })
            expect(link).toHaveAttribute('href', '/stokvels')
        })
    })

    // ── Testimonial ────────────────────────────────────────────────────────────

    describe('Testimonial section', () => {
        it('renders the testimonial quote', () => {
            renderLanding()
            expect(screen.getByText(/This platform changed my life/i)).toBeInTheDocument()
        })

        it('renders the testimonial author', () => {
            renderLanding()
            expect(screen.getByText(/Jane Doe/i)).toBeInTheDocument()
        })

        it('renders the testimonial location', () => {
            renderLanding()
            expect(screen.getByText(/Cape Town/i)).toBeInTheDocument()
        })
    })

    // ── Nav links ──────────────────────────────────────────────────────────────

    describe('Nav links', () => {
        it('renders How it works anchor link', () => {
            renderLanding()
            const links = screen.getAllByRole('link', { name: /How it works/i })
            expect(links[0]).toHaveAttribute('href', '#how')
        })

        it('renders Public stokvels link pointing to /stokvels', () => {
            renderLanding()
            const links = screen.getAllByRole('link', { name: /Public stokvels/i })
            expect(links[0]).toHaveAttribute('href', '/stokvels')
        })
    })
})
