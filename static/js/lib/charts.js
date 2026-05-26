// Chart.js global defaults for dark theme
Chart.defaults.color = '#a0aec0';
Chart.defaults.borderColor = 'rgba(45, 55, 72, 0.5)';
Chart.defaults.font.family = "'Azeret Mono', 'JetBrains Mono', monospace";
Chart.defaults.font.size = 11;

const C = {
    cyan: '#00ffd5',
    magenta: '#ff006e',
    yellow: '#ffbe0b',
    blue: '#00a7ff',
    purple: '#b388ff',
    cyanAlpha: 'rgba(0, 255, 213, 0.15)',
    magentaAlpha: 'rgba(255, 0, 110, 0.15)',
    yellowAlpha: 'rgba(255, 190, 11, 0.15)',
    blueAlpha: 'rgba(0, 167, 255, 0.15)',
    palette: ['#00ffd5', '#ff006e', '#ffbe0b', '#00a7ff', '#b388ff', '#ff8a65', '#69f0ae'],
};

function isCanvasReady(canvas) {
    return canvas && canvas.getContext && document.body.contains(canvas);
}

function createLineChart(ctx, labels, datasets) {
    if (!isCanvasReady(ctx)) return null;
    return new Chart(ctx, {
        type: 'line',
        data: { labels, datasets },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            interaction: { mode: 'index', intersect: false },
            plugins: { legend: { display: datasets.length > 1, labels: { usePointStyle: true, padding: 16 } } },
            scales: {
                x: { grid: { display: false } },
                y: { beginAtZero: true, grid: { color: 'rgba(45,55,72,0.3)' } },
            },
            elements: { point: { radius: 2, hoverRadius: 5 }, line: { tension: 0.3, borderWidth: 2 } },
        },
    });
}

function createBarChart(ctx, labels, data, color = C.cyan) {
    if (!isCanvasReady(ctx)) return null;
    return new Chart(ctx, {
        type: 'bar',
        data: {
            labels,
            datasets: [{
                data,
                backgroundColor: color + '40',
                borderColor: color,
                borderWidth: 1,
                borderRadius: 4,
            }],
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: { legend: { display: false } },
            scales: {
                x: { grid: { display: false } },
                y: { beginAtZero: true, grid: { color: 'rgba(45,55,72,0.3)' } },
            },
        },
    });
}

function createDoughnutChart(ctx, labels, data) {
    if (!isCanvasReady(ctx)) return null;
    const colors = C.palette.slice(0, labels.length);
    return new Chart(ctx, {
        type: 'doughnut',
        data: {
            labels,
            datasets: [{
                data,
                backgroundColor: colors.map(c => c + '80'),
                borderColor: colors,
                borderWidth: 2,
            }],
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            cutout: '65%',
            plugins: {
                legend: {
                    position: 'right',
                    labels: { usePointStyle: true, padding: 12, font: { size: 10 } },
                },
            },
        },
    });
}

function destroyChart(chart) {
    if (chart) {
        try { chart.destroy(); } catch (_) {}
    }
    return null;
}
