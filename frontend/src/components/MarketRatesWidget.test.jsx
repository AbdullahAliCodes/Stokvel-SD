import React from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import MarketRatesWidget from './MarketRatesWidget';

// 1. Mock the API URL builder
vi.mock('../utils/api', () => ({
    apiUrl: (path) => `http://localhost${path}`,
}));

// 2. Mock Recharts to avoid ResizeObserver / JSDOM dimension errors
vi.mock('recharts', () => ({
    ResponsiveContainer: ({ children }) => <div data-testid="responsive-container">{children}</div>,
    LineChart: ({ children }) => <div data-testid="line-chart">{children}</div>,
    Line: () => <div data-testid="line-mock" />,
    XAxis: () => <div data-testid="xaxis-mock" />,
    YAxis: () => <div data-testid="yaxis-mock" />,
    CartesianGrid: () => <div data-testid="grid-mock" />,
    Tooltip: () => <div data-testid="tooltip-mock" />,
}));

describe('MarketRatesWidget', () => {
    const mockFetch = vi.fn();
    global.fetch = mockFetch;

    const validRates = {
        repo_rate: 7.75,
        prime_rate: 11.25,
        last_updated: '2026-04-20T10:00:00Z',
    };

    beforeEach(() => {
        vi.clearAllMocks();
        // Default success mock
        mockFetch.mockResolvedValue({
            ok: true,
            text: async () => JSON.stringify(validRates),
        });
    });

    describe('Loading and Error States', () => {
        it('displays the loading state initially', () => {
            // Act
            render(<MarketRatesWidget />);

            // Assert
            expect(screen.getByText('Loading rates…')).toBeInTheDocument();
        });

        it('displays an error message when the API fetch fails (Network Error)', async () => {
            // Arrange
            mockFetch.mockRejectedValueOnce(new Error('Failed to connect'));

            // Act
            render(<MarketRatesWidget />);

            // Assert
            await waitFor(() => {
                expect(screen.getByText('Failed to connect')).toBeInTheDocument();
            });
            expect(screen.getByText('SA reference rates')).toBeInTheDocument();
        });

        it('displays an error message when the API returns a non-ok HTTP status', async () => {
            // Arrange
            mockFetch.mockResolvedValueOnce({
                ok: false,
                status: 500,
                text: async () => JSON.stringify({ error: 'Internal Server Error' }),
            });

            // Act
            render(<MarketRatesWidget />);

            // Assert
            await waitFor(() => {
                expect(screen.getByText('Internal Server Error')).toBeInTheDocument();
            });
        });

        it('displays a generic HTTP error if the API fails without a JSON error message', async () => {
            // Arrange
            mockFetch.mockResolvedValueOnce({
                ok: false,
                status: 404,
                text: async () => '', // Empty body
            });

            // Act
            render(<MarketRatesWidget />);

            // Assert
            await waitFor(() => {
                expect(screen.getByText('HTTP 404')).toBeInTheDocument();
            });
        });
    });

    describe('Success States', () => {
        it('renders market rates successfully with formatted dates', async () => {
            // Act
            render(<MarketRatesWidget />);

            // Assert
            await waitFor(() => {
                expect(screen.getByText('7.75%')).toBeInTheDocument(); // Repo
                expect(screen.getByText('11.25%')).toBeInTheDocument(); // Prime
            });

            // Should show the updated date text
            expect(screen.getByText(/Updated/i)).toBeInTheDocument();
        });

        it('renders an empty dash if last_updated is missing from the API', async () => {
            // Arrange
            mockFetch.mockResolvedValueOnce({
                ok: true,
                text: async () => JSON.stringify({ repo_rate: 7, prime_rate: 10, last_updated: null }),
            });

            // Act
            render(<MarketRatesWidget />);

            // Assert
            await waitFor(() => {
                expect(screen.getByText('Updated —')).toBeInTheDocument();
            });
        });
    });

    describe('Chart Projections', () => {
        it('displays a prompt to add a contribution if contribution is 0', async () => {
            // Act
            render(<MarketRatesWidget memberMonthlyContribution={0} />);

            // Assert
            await waitFor(() => {
                expect(screen.getByText(/Set a monthly contribution/i)).toBeInTheDocument();
            });
            // Ensure chart is not rendered
            expect(screen.queryByTestId('line-chart')).not.toBeInTheDocument();
        });

        it('renders the chart container when a valid contribution is provided', async () => {
            // Act (passing a string to ensure Number() coercion works)
            render(<MarketRatesWidget memberMonthlyContribution="1000" />);

            // Assert
            await waitFor(() => {
                expect(screen.getByTestId('line-chart')).toBeInTheDocument();
            });
            expect(screen.queryByText(/Set a monthly contribution/i)).not.toBeInTheDocument();
        });

        it('clears projections and shows no chart if the API returns an invalid prime rate', async () => {
            // Arrange
            mockFetch.mockResolvedValueOnce({
                ok: true,
                text: async () => JSON.stringify({ repo_rate: 7, prime_rate: null }),
            });

            // Act
            render(<MarketRatesWidget memberMonthlyContribution={1000} />);

            // Assert
            await waitFor(() => {
                expect(screen.queryByTestId('line-chart')).not.toBeInTheDocument();
            });

            // Because projection is cleared but contribution is > 0, it technically renders 
            // the empty container. Let's make sure it doesn't crash.
            expect(screen.getByText('SA reference rates')).toBeInTheDocument();
        });
    });
});