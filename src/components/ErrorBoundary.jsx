// ============================================================
// ERROR BOUNDARY COMPONENT
// ============================================================

import React from 'react';

// Matches the errors thrown when a lazy-loaded tab's JS chunk 404s because a newer
// deployment has replaced dist/ with freshly-hashed filenames — the old page (already
// open, or loaded from a stale cache) is asking for a chunk that no longer exists.
const CHUNK_ERROR_RE = /Failed to fetch dynamically imported module|error loading dynamically imported module|Importing a module script failed|Loading chunk [\w-]+ failed|ChunkLoadError/i;
const CHUNK_RELOAD_KEY = 'pta35-chunk-reload-ts';
const CHUNK_RELOAD_COOLDOWN_MS = 10_000;
const isChunkLoadError = (error) => CHUNK_ERROR_RE.test(error?.message || '');

/** True if we haven't already tried an auto-reload for this kind of error recently. */
const canAutoReload = () => {
    let lastReload = 0;
    try { lastReload = Number(sessionStorage.getItem(CHUNK_RELOAD_KEY) || 0); } catch {}
    return Date.now() - lastReload > CHUNK_RELOAD_COOLDOWN_MS;
};

const markReloadAttempted = () => {
    try { sessionStorage.setItem(CHUNK_RELOAD_KEY, String(Date.now())); } catch {}
};

/**
 * Error Boundary - Catches React errors and displays fallback UI.
 *
 * Props:
 *   inline {boolean} - When true, renders a compact "Try Again" fallback
 *                      (for per-tab use). When false (default), renders the
 *                      full-page error screen with a reload button.
 */
class ErrorBoundary extends React.Component {
    constructor(props) {
        super(props);
        this.state = { hasError: false, chunkReloading: false, error: null, errorInfo: null };
        this.reset = this.reset.bind(this);
    }

    reset() {
        this.setState({ hasError: false, chunkReloading: false, error: null, errorInfo: null });
    }

    static getDerivedStateFromError(error) {
        // React only treats an error as "handled" by this boundary if state actually
        // changes here, so a stale-chunk error still needs its own state flag rather
        // than a no-op {} — render() just shows nothing while componentDidCatch below
        // decides whether to reload silently or fall back to the error screen.
        if (isChunkLoadError(error)) return { chunkReloading: true };
        return { hasError: true };
    }

    componentDidCatch(error, errorInfo) {
        if (isChunkLoadError(error)) {
            if (canAutoReload()) {
                markReloadAttempted();
                window.location.reload();
                return;
            }
            // Already tried reloading recently and hit this again — show the real error.
            this.setState({ hasError: true, chunkReloading: false, error, errorInfo });
            console.error('PTA Manager Error:', error, errorInfo);
            return;
        }
        this.setState({ hasError: true, error, errorInfo });
        console.error('PTA Manager Error:', error, errorInfo);
    }

    render() {
        if (this.state.chunkReloading) return null;
        if (this.state.hasError) {
            if (this.props.inline) {
                return (
                    <div style={{
                        padding: '40px 20px',
                        textAlign: 'center',
                        color: 'var(--text-secondary)'
                    }}>
                        <p style={{ marginBottom: '12px', fontSize: '15px' }}>
                            ⚠️ This section encountered an error.
                        </p>
                        <button
                            onClick={this.reset}
                            style={{
                                padding: '8px 18px',
                                background: 'linear-gradient(135deg, #667eea, #764ba2)',
                                color: 'white',
                                border: 'none',
                                borderRadius: '6px',
                                cursor: 'pointer',
                                fontWeight: '600',
                                fontSize: '14px'
                            }}
                        >
                            Try Again
                        </button>
                        <details style={{ marginTop: '16px', textAlign: 'left' }}>
                            <summary style={{ cursor: 'pointer', fontSize: '12px' }}>
                                Technical Details
                            </summary>
                            <pre style={{
                                padding: '8px',
                                background: 'rgba(0,0,0,0.05)',
                                borderRadius: '4px',
                                fontSize: '11px',
                                overflow: 'auto',
                                maxHeight: '150px',
                                marginTop: '6px'
                            }}>
                                {this.state.error?.toString()}
                                {this.state.errorInfo?.componentStack}
                            </pre>
                        </details>
                    </div>
                );
            }

            return (
                <div style={{
                    padding: '40px',
                    textAlign: 'center',
                    background: '#fff3f3',
                    borderRadius: '15px',
                    margin: '20px',
                    border: '2px solid #ff6b6b'
                }}>
                    <h2 style={{ color: '#e53935', marginBottom: '15px' }}>⚠️ Something went wrong</h2>
                    <p style={{ marginBottom: '15px', color: '#666' }}>
                        The application encountered an error. Your data should be safe in storage.
                    </p>
                    <button
                        onClick={() => window.location.reload()}
                        style={{
                            padding: '10px 20px',
                            background: '#f5a623',
                            color: 'white',
                            border: 'none',
                            borderRadius: '8px',
                            cursor: 'pointer',
                            fontWeight: 'bold'
                        }}
                    >
                        🔄 Reload Application
                    </button>
                    <details style={{ marginTop: '20px', textAlign: 'left' }}>
                        <summary style={{ cursor: 'pointer', color: '#888' }}>Technical Details</summary>
                        <pre style={{
                            padding: '10px',
                            background: '#f5f5f5',
                            borderRadius: '5px',
                            fontSize: '11px',
                            overflow: 'auto',
                            maxHeight: '200px',
                            marginTop: '10px'
                        }}>
                            {this.state.error && this.state.error.toString()}
                            {this.state.errorInfo && this.state.errorInfo.componentStack}
                        </pre>
                    </details>
                </div>
            );
        }
        return this.props.children;
    }
}

export default ErrorBoundary;
