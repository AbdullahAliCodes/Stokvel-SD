import React from 'react';
import { render, screen } from '@testing-library/react';
import { MemoryRouter, Routes, Route } from 'react-router-dom';
import { describe, it, expect, beforeEach } from 'vitest';
import {
    GroupScopeIndexRedirect,
    LegacyStokvelToGroup,
    LegacyMyPayoutRedirect,
    LegacyMeetingsListRedirect,
    LegacyMeetingDetailRedirect,
} from './LegacyMemberRedirects';

// A simple dummy component to catch the redirect destination
const DestinationPage = ({ name }) => <div data-testid="location">{name}</div>;

describe('LegacyMemberRedirects', () => {
    // Setup a custom mock for localStorage that doesn't rely on global mocks
    let mockStorage = {};
    beforeEach(() => {
        mockStorage = {};
        Object.defineProperty(window, 'localStorage', {
            value: {
                getItem: (key) => mockStorage[key] || null,
                setItem: (key, value) => { mockStorage[key] = value; }
            },
            writable: true,
        });
    });

    describe('GroupScopeIndexRedirect', () => {
        it('redirects to the specific group dashboard when stokvel_id is present', () => {
            render(
                <MemoryRouter initialEntries={['/legacy/group/stok123']}>
                    <Routes>
                        <Route path="/legacy/group/:stokvel_id" element={<GroupScopeIndexRedirect />} />
                        <Route path="/group/stok123/dashboard" element={<DestinationPage name="GroupDashboard" />} />
                    </Routes>
                </MemoryRouter>
            );
            expect(screen.getByTestId('location')).toHaveTextContent('GroupDashboard');
        });

        it('falls back to the main dashboard when stokvel_id is missing', () => {
            render(
                <MemoryRouter initialEntries={['/legacy/group/']}>
                    <Routes>
                        <Route path="/legacy/group/" element={<GroupScopeIndexRedirect />} />
                        <Route path="/dashboard" element={<DestinationPage name="MainDashboard" />} />
                    </Routes>
                </MemoryRouter>
            );
            expect(screen.getByTestId('location')).toHaveTextContent('MainDashboard');
        });
    });

    describe('LegacyStokvelToGroup', () => {
        it('redirects to the group payments page when id is present', () => {
            render(
                <MemoryRouter initialEntries={['/stokvels/group456']}>
                    <Routes>
                        <Route path="/stokvels/:id" element={<LegacyStokvelToGroup />} />
                        <Route path="/group/group456/payments" element={<DestinationPage name="GroupPayments" />} />
                    </Routes>
                </MemoryRouter>
            );
            expect(screen.getByTestId('location')).toHaveTextContent('GroupPayments');
        });

        it('falls back to the main dashboard when id is missing', () => {
            render(
                <MemoryRouter initialEntries={['/stokvels/']}>
                    <Routes>
                        <Route path="/stokvels/" element={<LegacyStokvelToGroup />} />
                        <Route path="/dashboard" element={<DestinationPage name="MainDashboard" />} />
                    </Routes>
                </MemoryRouter>
            );
            expect(screen.getByTestId('location')).toHaveTextContent('MainDashboard');
        });
    });

    describe('LegacyMyPayoutRedirect', () => {
        it('redirects to payments for the last known stokvel if found in localStorage', () => {
            window.localStorage.setItem('last_stokvel_id', 'lastGroup789');
            render(
                <MemoryRouter initialEntries={['/mypayout']}>
                    <Routes>
                        <Route path="/mypayout" element={<LegacyMyPayoutRedirect />} />
                        <Route path="/group/lastGroup789/payments" element={<DestinationPage name="LastGroupPayments" />} />
                    </Routes>
                </MemoryRouter>
            );
            expect(screen.getByTestId('location')).toHaveTextContent('LastGroupPayments');
        });

        it('falls back to the main dashboard if no last_stokvel_id is in localStorage', () => {
            render(
                <MemoryRouter initialEntries={['/mypayout']}>
                    <Routes>
                        <Route path="/mypayout" element={<LegacyMyPayoutRedirect />} />
                        <Route path="/dashboard" element={<DestinationPage name="MainDashboard" />} />
                    </Routes>
                </MemoryRouter>
            );
            expect(screen.getByTestId('location')).toHaveTextContent('MainDashboard');
        });
    });

    describe('LegacyMeetingsListRedirect', () => {
        it('always redirects unconditionally to the main dashboard', () => {
            render(
                <MemoryRouter initialEntries={['/meetings']}>
                    <Routes>
                        <Route path="/meetings" element={<LegacyMeetingsListRedirect />} />
                        <Route path="/dashboard" element={<DestinationPage name="MainDashboard" />} />
                    </Routes>
                </MemoryRouter>
            );
            expect(screen.getByTestId('location')).toHaveTextContent('MainDashboard');
        });
    });

    describe('LegacyMeetingDetailRedirect', () => {
        it('redirects to the scoped meeting URL when both meeting id and last_stokvel_id exist', () => {
            window.localStorage.setItem('last_stokvel_id', 'groupABC');
            render(
                <MemoryRouter initialEntries={['/meetings/meet001']}>
                    <Routes>
                        <Route path="/meetings/:id" element={<LegacyMeetingDetailRedirect />} />
                        <Route path="/group/groupABC/meetings/meet001" element={<DestinationPage name="ScopedMeeting" />} />
                    </Routes>
                </MemoryRouter>
            );
            expect(screen.getByTestId('location')).toHaveTextContent('ScopedMeeting');
        });

        it('falls back to the main dashboard when the meeting id is missing', () => {
            window.localStorage.setItem('last_stokvel_id', 'groupABC');
            render(
                <MemoryRouter initialEntries={['/meetings/']}>
                    <Routes>
                        <Route path="/meetings/" element={<LegacyMeetingDetailRedirect />} />
                        <Route path="/dashboard" element={<DestinationPage name="MainDashboard" />} />
                    </Routes>
                </MemoryRouter>
            );
            expect(screen.getByTestId('location')).toHaveTextContent('MainDashboard');
        });

        it('falls back to the main dashboard when last_stokvel_id is missing from localStorage', () => {
            render(
                <MemoryRouter initialEntries={['/meetings/meet001']}>
                    <Routes>
                        <Route path="/meetings/:id" element={<LegacyMeetingDetailRedirect />} />
                        <Route path="/dashboard" element={<DestinationPage name="MainDashboard" />} />
                    </Routes>
                </MemoryRouter>
            );
            expect(screen.getByTestId('location')).toHaveTextContent('MainDashboard');
        });
    });
});