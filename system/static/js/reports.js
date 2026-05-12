document.addEventListener('DOMContentLoaded', function () {
    if (typeof Chart === 'undefined') return;

    const chartDataNode = document.getElementById('dashboard-chart-data');
    let dashboardChartData = {};
    if (chartDataNode) {
        try {
            dashboardChartData = JSON.parse(chartDataNode.textContent) || {};
        } catch (error) {
            dashboardChartData = {};
        }
    }

    const toSafePair = (raw) => {
        const arr = Array.isArray(raw) ? raw : [];
        const first = Number(arr[0]) || 0;
        const second = Number(arr[1]) || 0;
        return [Math.max(first, 0), Math.max(second, 0)];
    };

    const renderDoughnut = (canvas, payload, fallbackLabels, colors, options = {}) => {
        if (!canvas) return;

        const labels = Array.isArray(payload.labels) && payload.labels.length === 2 ? payload.labels : fallbackLabels;
        const dataPair = toSafePair(payload.data);
        const total = dataPair[0] + dataPair[1];
        const useEmptyFallback = total === 0;

        new Chart(canvas, {
            type: 'doughnut',
            data: {
                labels: useEmptyFallback ? ['Không có dữ liệu'] : labels,
                datasets: [{
                    data: useEmptyFallback ? [1] : dataPair,
                    backgroundColor: useEmptyFallback ? ['#e5e7eb'] : colors,
                    borderColor: '#ffffff',
                    borderWidth: 2,
                    hoverOffset: 4,
                }],
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                cutout: options.cutout || '62%',
                plugins: {
                    legend: {
                        display: options.showLegend !== false,
                        position: 'top',
                    },
                    tooltip: {
                        callbacks: {
                            label: function (context) {
                                if (useEmptyFallback) return 'Không có dữ liệu';
                                const value = Number(context.parsed) || 0;
                                const percent = total > 0 ? Math.round((value / total) * 100) : 0;
                                return `${context.label}: ${value} (${percent}%)`;
                            },
                        },
                    },
                },
            },
        });
    };

    const booksStatusChart = document.getElementById('booksStatusChart');
    const readersChart = document.getElementById('readersChart');
    const overdueChart = document.getElementById('overdueChart');

    const booksStatus = dashboardChartData.books_status || {};
    renderDoughnut(
        booksStatusChart,
        booksStatus,
        ['Trong kho', 'Đang mượn'],
        ['#36a2eb', '#ff6384']
    );

    const readers = dashboardChartData.readers || {};
    const readerLabels = Array.isArray(readers.labels) && readers.labels.length === 2
        ? readers.labels
        : ['Đang hoạt động', 'Ngừng hoạt động'];
    const readerColors = ['#36a2eb', '#ff6384'];
    renderDoughnut(
        readersChart,
        { labels: readerLabels, data: readers.data || [0, 0] },
        ['Đang hoạt động', 'Ngừng hoạt động'],
        readerColors,
        { cutout: '66%' }
    );

    if (overdueChart) {
        const overdue = dashboardChartData.overdue || {};
        const overdueData = overdue.data || [0, 0, 0, 0, 0, 0, 0];
        const overdueLabels = overdue.labels || ['T2', 'T3', 'T4', 'T5', 'T6', 'T7', 'CN'];

        // Tạo gradient fill
        const ctx = overdueChart.getContext('2d');
        const gradient = ctx.createLinearGradient(0, 0, 0, 220);
        gradient.addColorStop(0, 'rgba(239, 68, 68, 0.25)');
        gradient.addColorStop(1, 'rgba(239, 68, 68, 0.01)');

        new Chart(overdueChart, {
            type: 'line',
            data: {
                labels: overdueLabels,
                datasets: [{
                    label: 'Phiếu quá hạn',
                    data: overdueData,
                    fill: true,
                    backgroundColor: gradient,
                    borderColor: '#ef4444',
                    borderWidth: 2.5,
                    pointBackgroundColor: '#ef4444',
                    pointBorderColor: '#ffffff',
                    pointBorderWidth: 2,
                    pointRadius: 5,
                    pointHoverRadius: 7,
                    tension: 0.35,
                }],
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    legend: {
                        display: true,
                        position: 'top',
                        labels: {
                            usePointStyle: true,
                            pointStyle: 'circle',
                            font: { size: 12 },
                            color: '#374151',
                        },
                    },
                    tooltip: {
                        callbacks: {
                            label: function (context) {
                                const v = context.parsed.y;
                                return ` ${v} phiếu quá hạn`;
                            },
                        },
                    },
                },
                scales: {
                    y: {
                        beginAtZero: true,
                        ticks: {
                            stepSize: 1,
                            precision: 0,
                            color: '#6b7280',
                            font: { size: 11 },
                        },
                        grid: {
                            color: 'rgba(107, 114, 128, 0.12)',
                        },
                    },
                    x: {
                        ticks: {
                            color: '#6b7280',
                            font: { size: 11 },
                        },
                        grid: {
                            display: false,
                        },
                    },
                },
            },
        });
    }
});