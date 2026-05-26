function analyticsPage() {
    return {
        loading: true,
        error: null,
        granularity: 'day',
        usageMetric: 'messageCount',
        engagement: null,
        models: [],
        heatmapData: [],
        latencyStats: null,
        ttftStats: null,
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
                const [usage, heatmap, latency, ttft, models, engagement] = await Promise.all([
                    api.get('/api/telemetry/stats/usage', { granularity: this.granularity }),
                    api.get('/api/telemetry/stats/heatmap'),
                    api.get('/api/telemetry/stats/latency'),
                    api.get('/api/telemetry/stats/ttft'),
                    api.get('/api/telemetry/stats/models'),
                    api.get('/api/telemetry/stats/engagement'),
                ]);
                this.models = models;
                this.engagement = engagement;
                this.latencyStats = latency;
                this.ttftStats = ttft;
                this.heatmapData = heatmap;
                this.loading = false;
                const renderWhenReady = () => {
                    if (this._destroyed) return;
                    const el = this.$refs.usageChart;
                    if (el && el.parentElement && el.parentElement.offsetWidth > 0) {
                        this.renderUsageChart(usage);
                        this.renderLatencyChart(latency);
                        this.renderTtftChart(ttft);
                        this.renderHeatmap();
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

        async changeGranularity(g) {
            this.granularity = g;
            try {
                const usage = await api.get('/api/telemetry/stats/usage', { granularity: g });
                this.renderUsageChart(usage);
            } catch (e) {
                this.error = e.message;
            }
        },

        renderUsageChart(data) {
            this.$el._charts.usage = destroyChart(this.$el._charts.usage);
            const ctx = this.$refs.usageChart;
            if (!ctx || !data.length || !document.body.contains(ctx)) return;

            this.$el._charts.usage = new Chart(ctx, {
                type: 'line',
                data: {
                    labels: data.map(d => formatDateShort(d.period)),
                    datasets: [
                        {
                            label: 'Messages',
                            data: data.map(d => d.messageCount),
                            borderColor: C.cyan,
                            backgroundColor: C.cyanAlpha,
                            fill: true,
                        },
                        {
                            label: 'Tokens',
                            data: data.map(d => d.tokenTotal),
                            borderColor: C.yellow,
                            backgroundColor: C.yellowAlpha,
                            fill: true,
                            yAxisID: 'y1',
                            hidden: true,
                        },
                        {
                            label: 'Users',
                            data: data.map(d => d.uniqueUsers),
                            borderColor: C.magenta,
                            backgroundColor: C.magentaAlpha,
                            fill: true,
                            hidden: true,
                        },
                    ],
                },
                options: {
                    responsive: true,
                    maintainAspectRatio: false,
                    interaction: { mode: 'index', intersect: false },
                    plugins: { legend: { display: true, labels: { usePointStyle: true, padding: 16 } } },
                    scales: {
                        x: { grid: { display: false } },
                        y: { beginAtZero: true, grid: { color: 'rgba(45,55,72,0.3)' } },
                        y1: { position: 'right', beginAtZero: true, grid: { display: false }, display: false },
                    },
                    elements: { point: { radius: 2, hoverRadius: 5 }, line: { tension: 0.3, borderWidth: 2 } },
                },
            });
        },

        renderLatencyChart(data) {
            this.$el._charts.latency = destroyChart(this.$el._charts.latency);
            const ctx = this.$refs.latencyChart;
            if (!ctx || !data || !data.histogram.length) return;
            this.$el._charts.latency = createBarChart(
                ctx,
                data.histogram.map(b => b.bucket + 'ms'),
                data.histogram.map(b => b.count),
                C.blue
            );
        },

        renderTtftChart(data) {
            this.$el._charts.ttft = destroyChart(this.$el._charts.ttft);
            const ctx = this.$refs.ttftChart;
            if (!ctx || !data || !data.histogram.length) return;
            this.$el._charts.ttft = createBarChart(
                ctx,
                data.histogram.map(b => b.bucket + 'ms'),
                data.histogram.map(b => b.count),
                C.cyan
            );
        },

        renderHeatmap() {
            const container = this.$refs.heatmap;
            if (!container || !this.heatmapData.length) return;

            const maxCount = Math.max(...this.heatmapData.map(d => d.messageCount), 1);
            const grid = Array.from({ length: 7 }, () => Array(24).fill(0));
            this.heatmapData.forEach(d => {
                if (d.dayOfWeek >= 0 && d.dayOfWeek < 7 && d.hourOfDay >= 0 && d.hourOfDay < 24) {
                    grid[d.dayOfWeek][d.hourOfDay] = d.messageCount;
                }
            });

            const days = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
            // Clear previous content
            container.replaceChildren();

            const gridEl = document.createElement('div');
            gridEl.className = 'heatmap-grid';

            // Header row - empty corner
            const corner = document.createElement('div');
            corner.className = 'heatmap-label';
            gridEl.appendChild(corner);
            for (let h = 0; h < 24; h++) {
                const lbl = document.createElement('div');
                lbl.className = 'heatmap-label';
                lbl.textContent = String(h);
                gridEl.appendChild(lbl);
            }
            // Data rows
            for (let d = 0; d < 7; d++) {
                const dayLabel = document.createElement('div');
                dayLabel.className = 'heatmap-label';
                dayLabel.textContent = days[d];
                gridEl.appendChild(dayLabel);
                for (let h = 0; h < 24; h++) {
                    const val = grid[d][h];
                    const intensity = val / maxCount;
                    const cell = document.createElement('div');
                    cell.className = 'heatmap-cell';
                    cell.style.background = val === 0
                        ? 'rgba(45, 55, 72, 0.2)'
                        : `rgba(0, 255, 213, ${0.1 + intensity * 0.7})`;
                    cell.title = `${days[d]} ${h}:00 - ${val} messages`;
                    cell.textContent = val || '';
                    gridEl.appendChild(cell);
                }
            }
            container.appendChild(gridEl);
        },

        destroy() {
            this._destroyed = true;
            cancelAnimationFrame(this._rafId);
            if (this.$el._charts) {
                this.$el._charts.usage = destroyChart(this.$el._charts.usage);
                this.$el._charts.latency = destroyChart(this.$el._charts.latency);
                this.$el._charts.ttft = destroyChart(this.$el._charts.ttft);
            }
        },
    };
}
