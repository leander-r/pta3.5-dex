// ============================================================
// PTA MANAGER - ENTRY POINT
// ============================================================
// Created by: leander_rsr | All Rights Reserved

import React from 'react';
import ReactDOM from 'react-dom/client';
import ErrorBoundary from './components/ErrorBoundary.jsx';
import App from './App.jsx';
import './styles/global.css';

// Register service worker for PWA support
if ('serviceWorker' in navigator) {
    window.addEventListener('load', () => {
        navigator.serviceWorker.register(
            import.meta.env.PROD ? '/pta3.5-dex/sw.js' : '/sw.js'
        ).catch(() => {});
    });
}

// Render the application with Error Boundary
const root = ReactDOM.createRoot(document.getElementById('root'));
root.render(
    <ErrorBoundary>
        <App />
    </ErrorBoundary>
);
