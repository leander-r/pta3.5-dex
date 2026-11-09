import React from 'react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import ErrorBoundary from '../ErrorBoundary.jsx';

const Boom = ({ message }) => {
    throw new Error(message);
};

describe('ErrorBoundary — stale-chunk auto-reload', () => {
    const originalLocation = window.location;
    let reloadSpy;

    beforeEach(() => {
        sessionStorage.clear();
        reloadSpy = vi.fn();
        Object.defineProperty(window, 'location', {
            configurable: true,
            value: { ...originalLocation, reload: reloadSpy },
        });
        vi.spyOn(console, 'error').mockImplementation(() => {});
    });

    afterEach(() => {
        Object.defineProperty(window, 'location', { configurable: true, value: originalLocation });
        vi.restoreAllMocks();
    });

    it('reloads once and does not show the error screen for a stale dynamic-import failure', () => {
        render(
            <ErrorBoundary>
                <Boom message="Failed to fetch dynamically imported module: https://example.com/assets/tab-inventory-XYZ.js" />
            </ErrorBoundary>
        );

        expect(reloadSpy).toHaveBeenCalledTimes(1);
        expect(screen.queryByText(/Something went wrong/i)).not.toBeInTheDocument();
    });

    it('falls back to the error screen (no second reload) if the same chunk error recurs within the cooldown', () => {
        sessionStorage.setItem('pta35-chunk-reload-ts', String(Date.now()));

        render(
            <ErrorBoundary>
                <Boom message="Failed to fetch dynamically imported module: https://example.com/assets/tab-inventory-XYZ.js" />
            </ErrorBoundary>
        );

        expect(reloadSpy).not.toHaveBeenCalled();
        expect(screen.getByText(/Something went wrong/i)).toBeInTheDocument();
    });

    it('shows the normal error screen immediately for a non-chunk error, without reloading', () => {
        render(
            <ErrorBoundary>
                <Boom message="Cannot read properties of undefined (reading 'foo')" />
            </ErrorBoundary>
        );

        expect(reloadSpy).not.toHaveBeenCalled();
        expect(screen.getByText(/Something went wrong/i)).toBeInTheDocument();
    });

    it('renders the compact inline fallback (not the full-page screen) when inline', () => {
        render(
            <ErrorBoundary inline>
                <Boom message="Cannot read properties of undefined (reading 'foo')" />
            </ErrorBoundary>
        );

        expect(reloadSpy).not.toHaveBeenCalled();
        expect(screen.getByText(/encountered an error/i)).toBeInTheDocument();
        expect(screen.getByRole('button', { name: 'Try Again' })).toBeInTheDocument();
    });
});
