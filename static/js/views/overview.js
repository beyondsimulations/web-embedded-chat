function overviewPage() {
    return {
        stats: null,
        recentConversations: [],
        loading: true,
        error: null,
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
                const [stats, conversations, usage, models] = await Promise.all([
                    api.get('/api/telemetry/stats/overview'),
                    api.get('/api/telemetry/conversations', { limit: 10 }),
                    api.get('/api/telemetry/stats/usage', { granularity: 'day' }),
                    api.get('/api/telemetry/stats/models'),
                ]);
                this.stats = stats;
                this.recentConversations = conversations;
                this.loading = false;
                const renderWhenReady = () => {
                    if (this._destroyed) return;
                    const el = this.$refs.usageChart;
                    if (el && el.parentElement && el.parentElement.offsetWidth > 0) {
                        this.renderUsageChart(usage);
                        this.renderModelChart(models);
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

        renderUsageChart(data) {
            this.$el._charts.usage = destroyChart(this.$el._charts.usage);
            const ctx = this.$refs.usageChart;
            if (!ctx || !data.length) return;
            this.$el._charts.usage = createLineChart(
                ctx,
                data.map(d => formatDateShort(d.period)),
                [{
                    label: 'Messages',
                    data: data.map(d => d.messageCount),
                    borderColor: C.cyan,
                    backgroundColor: C.cyanAlpha,
                    fill: true,
                }]
            );
        },

        renderModelChart(data) {
            this.$el._charts.model = destroyChart(this.$el._charts.model);
            const ctx = this.$refs.modelChart;
            if (!ctx || !data.length) return;
            this.$el._charts.model = createDoughnutChart(
                ctx,
                data.map(d => d.modelName || 'unknown'),
                data.map(d => d.messageCount)
            );
        },

        destroy() {
            this._destroyed = true;
            cancelAnimationFrame(this._rafId);
            if (this.$el._charts) {
                this.$el._charts.usage = destroyChart(this.$el._charts.usage);
                this.$el._charts.model = destroyChart(this.$el._charts.model);
            }
        },

        goToConversation(traceId) {
            Alpine.store('router').navigate('conversations/' + traceId);
        },
    };
}
