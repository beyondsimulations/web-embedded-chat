function operationsPage() {
    return {
        loading: true,
        error: null,
        errors: [],
        models: [],
        severityFilter: '',
        searchQuery: '',
        searchResults: null,
        searchLoading: false,
        exportStart: '',
        exportEnd: '',
        exportFormat: 'csv',
        cleanupBefore: '',
        cleanupResult: null,
        _destroyed: false,
        _rafId: null,

        async init() {
            this.$el._charts = {};
            await this.load();
        },

        async load() {
            this.loading = true;
            this.error = null;
            try {
                const [errors, models] = await Promise.all([
                    api.get('/api/telemetry/stats/errors', { granularity: 'day' }),
                    api.get('/api/telemetry/stats/models'),
                ]);
                this.errors = errors;
                this.models = models;
                this.loading = false;
                const renderWhenReady = () => {
                    if (this._destroyed) return;
                    const el = this.$refs.errorChart;
                    if (el && el.parentElement && el.parentElement.offsetWidth > 0) {
                        this.renderErrorChart(errors);
                    } else {
                        this._rafId = requestAnimationFrame(renderWhenReady);
                    }
                };
                this._rafId = requestAnimationFrame(renderWhenReady);
            } catch (e) {
                this.error = e.message;
                this.loading = false;
            }
        },

        renderErrorChart(data) {
            this.$el._charts.error = destroyChart(this.$el._charts.error);
            const ctx = this.$refs.errorChart;
            if (!ctx || !data.length) return;
            this.$el._charts.error = createLineChart(
                ctx,
                data.map(d => formatDateShort(d.period)),
                [
                    {
                        label: 'Errors',
                        data: data.map(d => d.errorCount),
                        borderColor: C.magenta,
                        backgroundColor: C.magentaAlpha,
                        fill: true,
                    },
                    {
                        label: 'Total',
                        data: data.map(d => d.totalCount),
                        borderColor: C.cyan,
                        backgroundColor: C.cyanAlpha,
                        fill: true,
                    },
                ]
            );
        },

        async doSearch() {
            if (!this.searchQuery.trim()) return;
            this.searchLoading = true;
            try {
                this.searchResults = await api.get('/api/telemetry/search', {
                    q: this.searchQuery,
                    pageSize: 50,
                });
                if (window.announce) {
                    window.announce(this.searchResults.totalCount + ' results found');
                }
            } catch (e) {
                this.error = e.message;
                if (window.announce) window.announce('Search failed: ' + e.message);
            }
            this.searchLoading = false;
        },

        doExport() {
            const params = { format: this.exportFormat };
            if (this.exportStart) params.start = new Date(this.exportStart).toISOString();
            if (this.exportEnd) params.end = new Date(this.exportEnd).toISOString();
            window.location.href = api.downloadUrl('/api/telemetry/export', params);
            if (window.announce) window.announce('Export download started');
        },

        async doCleanup() {
            if (!this.cleanupBefore) return;
            const before = new Date(this.cleanupBefore).toISOString();
            try {
                const result = await api.del('/api/telemetry/logs/cleanup', { before });
                this.cleanupResult = result;
                if (window.announce) window.announce(result.deleted + ' logs deleted');
            } catch (e) {
                this.error = e.message;
                if (window.announce) window.announce('Cleanup failed: ' + e.message);
            }
        },

        destroy() {
            this._destroyed = true;
            cancelAnimationFrame(this._rafId);
            if (this.$el._charts) {
                this.$el._charts.error = destroyChart(this.$el._charts.error);
            }
        },
    };
}
