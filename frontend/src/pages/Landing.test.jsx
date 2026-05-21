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

vi.mock('../utils/api', () => ({
    apiUrl: (path) => `http://localhost${path}`,
}))

const writeViewCacheMock = vi.fn()
const readViewCacheMock = vi.fn(() => null)

vi.mock('../utils/viewCache', () => ({
    readViewCache: (...args) => readViewCacheMock(...args),
    writeViewCache: (...args) => writeViewCacheMock(...args),
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

vi.mock('../components/OpportunityCard', async () => {
    const actual = await vi.importActual('../components/OpportunityCard')
    return actual
})

vi.mock('../assets/landing', () => ({
    heroDashboardIllustration: 'hero.png',
    testimonialPortrait: 'portrait.png',
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

vi.mock('../styles/tokens', async () => {
    const actual = await vi.importActual('../styles/tokens')
    return actual
})

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
const MEMBER_USER_ID = '11111111-1111-4111-8111-111111111111'

const memberSession = {
    access_token: 'member-token',
    user: { id: MEMBER_USER_ID, email: 'member@test.com' },
}
const adminSession = {
    access_token: 'admin-token',
    user: { id: 'admin-uuid', email: 'admin@test.com' },
}

// ─── Tests ───────────────────────────────────────────────────────────────────

describe('Landing page', () => {
    const mockFetch = vi.fn()
    global.fetch = mockFetch

    beforeEach(() => {
        vi.clearAllMocks()
        writeViewCacheMock.mockReset()
        readViewCacheMock.mockReset()
        readViewCacheMock.mockReturnValue(null)
        mockFetch.mockResolvedValue({
            ok: true,
            text: async () =>
                JSON.stringify([
                    {
                        id: '1',
                        name: 'Savings Circle A',
                        type: 'Rotating',
                        contribution_amount: 500,
                        members_count: 10,
                        cycle_length: 6,
                    },
                    {
                        id: '2',
                        name: 'Savings Circle B',
                        type: 'Fixed',
                        contribution_amount: 300,
                        members_count: 8,
                        cycle_length: 12,
                    },
                    {
                        id: '3',
                        name: 'Savings Circle C',
                        type: 'Rotating',
                        contribution_amount: 700,
                        members_count: 15,
                        cycle_length: 3,
                    },
                    {
                        id: '4',
                        name: 'Savings Circle D',
                        type: 'Fixed',
                        contribution_amount: 900,
                        members_count: 11,
                        cycle_length: 9,
                    },
                ]),
        })
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

        it('signs out from the mobile menu logout control', async () => {
            const { supabase } = await import('../utils/supabase')
            renderLanding({ session: memberSession, userRole: 'member' })

            await act(async () => {
                fireEvent.click(screen.getByRole('button', { name: /Open menu/i }))
            })

            const logoutBtns = screen.getAllByRole('button', { name: /Log out/i })
            await act(async () => {
                fireEvent.click(logoutBtns[logoutBtns.length - 1])
            })

            expect(supabase.auth.signOut).toHaveBeenCalledTimes(1)
            await waitFor(() => {
                expect(mockNavigate).toHaveBeenCalledWith('/', { replace: true })
            })
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

        it('renders only the first 3 opportunity cards', async () => {
            renderLanding()
            await waitFor(() => {
                expect(screen.getAllByRole('button', { name: /Apply to join/i })).toHaveLength(3)
            })
        })

        it('renders real opportunity cards for rotating and fixed stokvel types', async () => {
            mockFetch.mockResolvedValueOnce({
                ok: true,
                text: async () =>
                    JSON.stringify([
                        {
                            id: 'fixed-1',
                            name: 'Fixed Pool',
                            type: 'Fixed',
                            contribution_amount: 1000,
                            members_count: 5,
                            cycle_length: 12,
                        },
                        {
                            id: 'rot-1',
                            name: 'Rotating Circle',
                            type: 'Rotating',
                            contribution_amount: 500,
                            members_count: 8,
                            cycle_length: 6,
                        },
                    ]),
            })

            renderLanding()
            await waitFor(() => {
                expect(screen.getByText('Fixed Pool')).toBeInTheDocument()
                expect(screen.getByText('Rotating Circle')).toBeInTheDocument()
            })
            expect(screen.getByText(/Fixed · 12 month cycle/i)).toBeInTheDocument()
            expect(screen.getByText(/Rotating · 6 month cycle/i)).toBeInTheDocument()
        })

        it('redirects guests to auth when applying from the landing grid', async () => {
            renderLanding({ session: guestSession })

            await waitFor(() => {
                expect(screen.getAllByRole('button', { name: /Apply to join/i })).toHaveLength(3)
            })

            fireEvent.click(screen.getAllByRole('button', { name: /Apply to join/i })[0])

            expect(mockNavigate).toHaveBeenCalledWith('/auth')
        })

        it('renders no opportunity cards when public stokvels request is not ok', async () => {
            mockFetch.mockResolvedValueOnce({
                ok: false,
                text: async () => JSON.stringify({ error: 'Unavailable' }),
            })

            renderLanding()

            await waitFor(() => {
                expect(mockFetch).toHaveBeenCalledWith(
                    'http://localhost/api/public/stokvels',
                    expect.objectContaining({ signal: expect.any(AbortSignal) }),
                )
            })

            expect(screen.queryAllByRole('button', { name: /^Apply to /i })).toHaveLength(0)
        })

        it('renders no opportunity cards when public stokvels payload is not an array', async () => {
            mockFetch.mockResolvedValueOnce({
                ok: true,
                text: async () => JSON.stringify({ items: [] }),
            })

            renderLanding()

            await waitFor(() => {
                expect(mockFetch).toHaveBeenCalled()
            })

            expect(screen.queryAllByRole('button', { name: /^Apply to /i })).toHaveLength(0)
        })

        it('silently handles network errors while loading public stokvels', async () => {
            mockFetch.mockRejectedValueOnce(new Error('network down'))

            renderLanding()

            await waitFor(() => {
                expect(mockFetch).toHaveBeenCalled()
            })

            expect(screen.queryAllByRole('button', { name: /^Apply to /i })).toHaveLength(0)
        })

        it('joins a public stokvel and navigates to the group dashboard', async () => {
            mockFetch.mockImplementation(async (url, init) => {
                const u = String(url)
                if (u.includes('/api/public/stokvels')) {
                    return {
                        ok: true,
                        text: async () =>
                            JSON.stringify([
                                {
                                    id: 'stok-join-1',
                                    name: 'Savings Circle A',
                                    type: 'Rotating',
                                    contribution_amount: 500,
                                    members_count: 10,
                                    cycle_length: 6,
                                },
                            ]),
                    }
                }
                if (u.endsWith('/join') && init?.method === 'POST') {
                    return { ok: true, text: async () => JSON.stringify({ ok: true }) }
                }
                return { ok: true, text: async () => JSON.stringify([]) }
            })

            renderLanding({ session: memberSession })

            fireEvent.click(await screen.findByRole('button', { name: /Apply to join/i }))

            await waitFor(() => {
                expect(mockNavigate).toHaveBeenCalledWith('/group/stok-join-1/dashboard', {
                    replace: true,
                })
            })
        })

        it('still navigates when join fails with already a member', async () => {
            mockFetch.mockImplementation(async (url, init) => {
                const u = String(url)
                if (u.includes('/api/public/stokvels')) {
                    return {
                        ok: true,
                        text: async () =>
                            JSON.stringify([
                                {
                                    id: 'stok-join-1',
                                    name: 'Savings Circle A',
                                    type: 'Rotating',
                                    contribution_amount: 500,
                                    members_count: 10,
                                    cycle_length: 6,
                                },
                            ]),
                    }
                }
                if (u.endsWith('/join') && init?.method === 'POST') {
                    return {
                        ok: false,
                        text: async () =>
                            JSON.stringify({ error: 'You are already a member of this group' }),
                    }
                }
                return { ok: true, text: async () => JSON.stringify([]) }
            })

            renderLanding({ session: memberSession })

            fireEvent.click(await screen.findByRole('button', { name: /Apply to join/i }))

            await waitFor(() => {
                expect(mockNavigate).toHaveBeenCalledWith('/group/stok-join-1/dashboard', {
                    replace: true,
                })
            })
            expect(writeViewCacheMock).toHaveBeenCalled()
        })

        it('does not navigate when join fails with a non-member error', async () => {
            mockFetch.mockImplementation(async (url, init) => {
                const u = String(url)
                if (u.includes('/api/public/stokvels')) {
                    return {
                        ok: true,
                        text: async () =>
                            JSON.stringify([
                                {
                                    id: 'stok-join-1',
                                    name: 'Savings Circle A',
                                    type: 'Rotating',
                                    contribution_amount: 500,
                                    members_count: 10,
                                    cycle_length: 6,
                                },
                            ]),
                    }
                }
                if (u.endsWith('/join') && init?.method === 'POST') {
                    return {
                        ok: false,
                        text: async () => JSON.stringify({ error: 'Forbidden' }),
                    }
                }
                return { ok: true, text: async () => JSON.stringify([]) }
            })

            renderLanding({ session: memberSession })

            fireEvent.click(await screen.findByRole('button', { name: /Apply to join/i }))

            await waitFor(() => {
                expect(mockFetch).toHaveBeenCalledWith(
                    'http://localhost/api/stokvels/stok-join-1/join',
                    expect.objectContaining({ method: 'POST' }),
                )
            })

            expect(mockNavigate).not.toHaveBeenCalledWith(
                '/group/stok-join-1/dashboard',
                expect.anything(),
            )
        })

        it('parses plain-text join errors without navigating', async () => {
            mockFetch.mockImplementation(async (url, init) => {
                const u = String(url)
                if (u.includes('/api/public/stokvels')) {
                    return {
                        ok: true,
                        text: async () =>
                            JSON.stringify([
                                {
                                    id: 'stok-join-1',
                                    name: 'Savings Circle A',
                                    type: 'Rotating',
                                    contribution_amount: 500,
                                    members_count: 10,
                                    cycle_length: 6,
                                },
                            ]),
                    }
                }
                if (u.endsWith('/join') && init?.method === 'POST') {
                    return { ok: false, text: async () => 'Join denied' }
                }
                return { ok: true, text: async () => JSON.stringify([]) }
            })

            renderLanding({ session: memberSession })

            fireEvent.click(await screen.findByRole('button', { name: /Apply to join/i }))

            await waitFor(() => {
                expect(mockFetch).toHaveBeenCalledWith(
                    'http://localhost/api/stokvels/stok-join-1/join',
                    expect.any(Object),
                )
            })
            expect(mockNavigate).not.toHaveBeenCalled()
        })

        it('renders R 0 for invalid contribution amounts on opportunity cards', async () => {
            mockFetch.mockResolvedValueOnce({
                ok: true,
                text: async () =>
                    JSON.stringify([
                        {
                            id: 'bad-amt',
                            name: 'Broken Amount Circle',
                            type: 'Fixed',
                            contribution_amount: 'not-a-number',
                            members_count: 3,
                            cycle_length: 6,
                        },
                    ]),
            })

            renderLanding()
            expect(await screen.findByText('R 0')).toBeInTheDocument()
        })

        it('renders View all public stokvels link', () => {
            renderLanding()
            const link = screen.getByRole('link', { name: /View all public stokvels/i })
            expect(link).toHaveAttribute('href', '/stokvels')
        })

        it('writes optimistic membership cache after a successful join', async () => {
            mockFetch.mockImplementation(async (url, init) => {
                const u = String(url)
                if (u.includes('/api/public/stokvels')) {
                    return {
                        ok: true,
                        text: async () =>
                            JSON.stringify([
                                {
                                    id: 'stok-cache-1',
                                    name: 'Cache Circle',
                                    type: 'Fixed',
                                    contribution_amount: 400,
                                    members_count: 4,
                                    cycle_length: 6,
                                },
                            ]),
                    }
                }
                if (u.endsWith('/join') && init?.method === 'POST') {
                    return { ok: true, text: async () => JSON.stringify({ ok: true }) }
                }
                return { ok: true, text: async () => JSON.stringify([]) }
            })

            renderLanding({ session: memberSession, userRole: 'member' })
            fireEvent.click(await screen.findByRole('button', { name: /Apply to join/i }))

            await waitFor(() => {
                expect(writeViewCacheMock).toHaveBeenCalledWith(
                    `my_stokvels:${MEMBER_USER_ID}`,
                    expect.objectContaining({
                        memberships: [
                            expect.objectContaining({
                                stokvels: expect.objectContaining({
                                    id: 'stok-cache-1',
                                    name: 'Cache Circle',
                                }),
                            }),
                        ],
                    }),
                )
            })
        })

        it('skips cache write when the member is already in the cached list', async () => {
            readViewCacheMock.mockReturnValue({
                memberships: [
                    {
                        group_role: 'member',
                        stokvels: { id: 'stok-cache-1', name: 'Existing' },
                    },
                ],
            })

            mockFetch.mockImplementation(async (url, init) => {
                const u = String(url)
                if (u.includes('/api/public/stokvels')) {
                    return {
                        ok: true,
                        text: async () =>
                            JSON.stringify([
                                {
                                    id: 'stok-cache-1',
                                    name: 'Cache Circle',
                                    type: 'Rotating',
                                    contribution_amount: 400,
                                    members_count: 4,
                                    cycle_length: 6,
                                },
                            ]),
                    }
                }
                if (u.endsWith('/join') && init?.method === 'POST') {
                    return { ok: true, text: async () => JSON.stringify({ ok: true }) }
                }
                return { ok: true, text: async () => JSON.stringify([]) }
            })

            renderLanding({ session: memberSession, userRole: 'member' })
            fireEvent.click(await screen.findByRole('button', { name: /Apply to join/i }))

            await waitFor(() => {
                expect(mockNavigate).toHaveBeenCalled()
            })
            expect(writeViewCacheMock).not.toHaveBeenCalled()
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
