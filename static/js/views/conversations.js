function conversationsPage() {
    return {
        conversations: [],
        detail: null,
        detailLogs: [],
        loading: true,
        detailLoading: false,
        error: null,
        search: '',
        sortBy: 'lastMessageAt',
        sortDir: 'desc',
        limit: 100,

        get activeTraceId() {
            const route = Alpine.store('router').current;
            const parts = route.split('/');
            return parts.length > 1 ? parts.slice(1).join('/') : null;
        },

        get showDetail() {
            return this.activeTraceId !== null;
        },

        get filteredConversations() {
            let list = this.conversations;
            if (this.search) {
                const q = this.search.toLowerCase();
                list = list.filter(c =>
                    (c.traceId && c.traceId.toLowerCase().includes(q)) ||
                    (c.userId && c.userId.toLowerCase().includes(q)) ||
                    (c.modelName && c.modelName.toLowerCase().includes(q))
                );
            }
            list = [...list].sort((a, b) => {
                let va = a[this.sortBy], vb = b[this.sortBy];
                if (va == null) return 1;
                if (vb == null) return -1;
                if (typeof va === 'string') {
                    return this.sortDir === 'asc' ? va.localeCompare(vb) : vb.localeCompare(va);
                }
                return this.sortDir === 'asc' ? va - vb : vb - va;
            });
            return list;
        },

        async init() {
            if (this.showDetail) {
                await this.loadDetail(this.activeTraceId);
            }
            await this.loadList();

            this.$watch('activeTraceId', async (id) => {
                if (id) await this.loadDetail(id);
                else this.detail = null;
            });
        },

        async loadList() {
            this.loading = true;
            try {
                this.conversations = await api.get('/api/telemetry/conversations', { limit: this.limit });
            } catch (e) {
                this.error = e.message;
            }
            this.loading = false;
        },

        async loadDetail(traceId) {
            this.detailLoading = true;
            try {
                this.detailLogs = await api.get(`/api/telemetry/trace/${traceId}`);
                if (this.detailLogs.length > 0) {
                    const log = this.detailLogs[0];
                    this.detail = {
                        traceId,
                        userId: log.userId,
                        modelName: log.modelName,
                        startedAt: this.detailLogs[0].timestamp,
                        lastMessageAt: this.detailLogs[this.detailLogs.length - 1].timestamp,
                        messageCount: this.detailLogs.length,
                        totalTokens: this.detailLogs.reduce((s, l) => s + (l.tokenCount || 0), 0),
                    };
                }
            } catch (e) {
                this.error = e.message;
            }
            this.detailLoading = false;
        },

        openConversation(traceId) {
            Alpine.store('router').navigate('conversations/' + traceId);
        },

        backToList() {
            Alpine.store('router').navigate('conversations');
        },

        async deleteConversation(traceId) {
            if (!confirm('Delete this conversation? This cannot be undone.')) return;
            try {
                await api.del(`/api/telemetry/trace/${traceId}`);
                this.backToList();
                await this.loadList();
                if (window.announce) window.announce('Conversation deleted.');
            } catch (e) {
                this.error = e.message;
            }
        },

        toggleSort(col) {
            if (this.sortBy === col) {
                this.sortDir = this.sortDir === 'asc' ? 'desc' : 'asc';
            } else {
                this.sortBy = col;
                this.sortDir = 'desc';
            }
            if (window.announce) {
                const labels = {
                    lastMessageAt: 'Time',
                    userId: 'User',
                    messageCount: 'Messages',
                    totalTokens: 'Tokens',
                    modelName: 'Model',
                    avgLatencyMs: 'Latency',
                };
                window.announce('Sorted by ' + (labels[this.sortBy] || this.sortBy) + ' ' +
                    (this.sortDir === 'asc' ? 'ascending' : 'descending'));
            }
        },

        sortIcon(col) {
            if (this.sortBy !== col) return '';
            return this.sortDir === 'asc' ? ' ▲' : ' ▼';
        },
    };
}
