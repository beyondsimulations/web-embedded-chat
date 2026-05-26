// Map the route key to a human-readable page title for SPA title updates.
function _routeTitle(route) {
    const key = (route || 'overview').split('/')[0];
    const titles = {
        overview: 'Overview',
        conversations: 'Conversations',
        analytics: 'Analytics',
        operations: 'Operations',
    };
    return 'Telemetry — ' + (titles[key] || 'Dashboard');
}

document.addEventListener('alpine:init', () => {
    Alpine.store('router', {
        current: location.hash.slice(2) || 'overview',
        navigate(view) {
            this.current = view;
            location.hash = '#/' + view;
            document.title = _routeTitle(view);
            if (window.announce) window.announce('Navigated to ' + _routeTitle(view));
        },
        startsWith(prefix) {
            return this.current.startsWith(prefix);
        },
    });
    // Apply initial title based on current hash
    document.title = _routeTitle(Alpine.store('router').current);

    Alpine.store('ui', {
        sidebarCollapsed: false,
        mobileOpen: false,
        autoRefresh: false,
        _interval: null,
        toggleSidebar() {
            this.sidebarCollapsed = !this.sidebarCollapsed;
        },
        toggleAutoRefresh() {
            this.autoRefresh = !this.autoRefresh;
        },
    });
});

window.addEventListener('hashchange', () => {
    const route = location.hash.slice(2) || 'overview';
    Alpine.store('router').current = route;
    document.title = _routeTitle(route);
});

// Screen-reader announcement helper. Writes to the #sr-live aria-live region
// so dynamic status changes (sort, search, export, cleanup, errors) are
// announced to assistive tech. Briefly clearing the node before writing
// forces VoiceOver/NVDA to re-read even if the message is identical.
window.announce = function (msg) {
    const el = document.getElementById('sr-live');
    if (!el) return;
    el.textContent = '';
    setTimeout(() => { el.textContent = msg; }, 50);
};

// Utility functions
function formatNumber(n) {
    if (n == null) return '-';
    if (n >= 1000000) return (n / 1000000).toFixed(1) + 'M';
    if (n >= 1000) return (n / 1000).toFixed(1) + 'K';
    return n.toLocaleString();
}

function formatMs(ms) {
    if (ms == null) return '-';
    if (ms >= 1000) return (ms / 1000).toFixed(1) + 's';
    return Math.round(ms) + 'ms';
}

function formatDate(ts) {
    if (!ts) return '-';
    return new Date(ts).toLocaleString(undefined, {
        month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit'
    });
}

function formatDateShort(ts) {
    if (!ts) return '-';
    return new Date(ts).toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
}

function truncate(str, len = 16) {
    if (!str) return '-';
    return str.length > len ? str.slice(0, len) + '...' : str;
}

function escapeHtml(str) {
    const div = document.createElement('div');
    div.textContent = str;
    return div.innerHTML;
}

function timeSince(ts) {
    const secs = Math.floor((Date.now() - new Date(ts)) / 1000);
    if (secs < 60) return secs + 's ago';
    if (secs < 3600) return Math.floor(secs / 60) + 'm ago';
    if (secs < 86400) return Math.floor(secs / 3600) + 'h ago';
    return Math.floor(secs / 86400) + 'd ago';
}

function durationBetween(start, end) {
    const secs = Math.floor((new Date(end) - new Date(start)) / 1000);
    if (secs < 60) return secs + 's';
    if (secs < 3600) return Math.floor(secs / 60) + 'm ' + (secs % 60) + 's';
    return Math.floor(secs / 3600) + 'h ' + Math.floor((secs % 3600) / 60) + 'm';
}
