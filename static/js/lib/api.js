const api = {
    async get(url, params = {}) {
        const filtered = Object.fromEntries(
            Object.entries(params).filter(([_, v]) => v != null && v !== '')
        );
        const qs = new URLSearchParams(filtered).toString();
        const res = await fetch(qs ? `${url}?${qs}` : url);
        if (res.status === 401) {
            window.location.href = '/login';
            return;
        }
        if (!res.ok) {
            const body = await res.json().catch(() => ({}));
            throw new Error(body.error || `API error: ${res.status}`);
        }
        return res.json();
    },

    async del(url, params = {}) {
        const qs = new URLSearchParams(params).toString();
        const res = await fetch(qs ? `${url}?${qs}` : url, { method: 'DELETE' });
        if (res.status === 401) {
            window.location.href = '/login';
            return;
        }
        if (!res.ok) {
            const body = await res.json().catch(() => ({}));
            throw new Error(body.error || `API error: ${res.status}`);
        }
        return res.json();
    },

    downloadUrl(url, params = {}) {
        const filtered = Object.fromEntries(
            Object.entries(params).filter(([_, v]) => v != null && v !== '')
        );
        const qs = new URLSearchParams(filtered).toString();
        return qs ? `${url}?${qs}` : url;
    }
};
