// js/dashboard.js

let dataUsageChart = null; // Holds the Chart.js instance for the data usage donut chart
let originalUploadBytes = 0;
let originalDownloadBytes = 0;
let originalTotalBytes = 0;

// Cache for data fetched by the dashboard
let dashboardApiDataCache = {
    sessions: null,       // To store rows from /session/search
    voucherStats: null,   // To store { totalVouchers, activeVouchers }
    // totalZones is derived from allConfiguredZones which has its own cache mechanism
};


/**
 * Loads and displays data for the dashboard.
 * Includes statistics like active sessions, configured zones, voucher counts,
 * and a data usage donut chart.
 * @param {boolean} [forceRefresh=false] - If true, forces a re-fetch even if data exists.
 */
async function loadDashboardData(forceRefresh = false) { // Added forceRefresh
    if (!dashboardStatsContainer || !dataUsageCanvas || !donutTotalData || !uploadLegendValue || !downloadLegendValue || !uploadPercentageSpan || !downloadPercentageSpan) {
        console.error("One or more dashboard elements are missing from the DOM.");
        if(dashboardStatsContainer) dashboardStatsContainer.innerHTML = `<p class="text-red-500 col-span-full text-center">Error: Dashboard UI elements missing.</p>`;
        return;
    }

    let sessionDataRows = null;
    let voucherStats = null;
    let totalZonesCount = 0;

    // Try to use cached data if not forcing refresh
    if (!forceRefresh && dashboardApiDataCache.sessions && dashboardApiDataCache.voucherStats !== null) {
        console.log("Using cached dashboard API data.");
        sessionDataRows = dashboardApiDataCache.sessions;
        voucherStats = dashboardApiDataCache.voucherStats;
        // totalZones is typically from allConfiguredZones, which has its own cache.
        // Ensure allConfiguredZones is populated.
        if (allConfiguredZones.length === 0) {
            await fetchAllZoneData(); // fetchAllZoneData has its own cache guard
        }
        totalZonesCount = allConfiguredZones.length;

    } else {
        console.log("Fetching fresh dashboard data.");
        // Show skeleton loaders for stats
        dashboardStatsContainer.innerHTML = `
            <div class="stat-card skeleton-card"></div>
            <div class="stat-card skeleton-card"></div>
            <div class="stat-card skeleton-card"></div>
        `;
        // Reset chart/legend text for fresh load
        donutTotalData.textContent = placeholderValue;
        uploadLegendValue.textContent = placeholderValue;
        downloadLegendValue.textContent = placeholderValue;
        uploadPercentageSpan.textContent = '';
        downloadPercentageSpan.textContent = '';
        // Destroy existing chart if forcing refresh, so it gets recreated with potentially new theme colors
        if (forceRefresh && dataUsageChart) {
            dataUsageChart.destroy();
            dataUsageChart = null;
        }
    }


    try {
        // Fetch data only if not available in cache or if forced
        if (!sessionDataRows || forceRefresh) {
            const sessionData = await callApi('/session/search');
            sessionDataRows = (sessionData && Array.isArray(sessionData.rows)) ? sessionData.rows : [];
            dashboardApiDataCache.sessions = sessionDataRows; // Cache it
        }

        if (allConfiguredZones.length === 0 && totalZonesCount === 0) { // Ensure zone data is available
            await fetchAllZoneData(); // fetchAllZoneData has its own cache guard
        }
        totalZonesCount = allConfiguredZones.length;


        // Fetch voucher statistics only if not available in cache or if forced
        if (!voucherStats || forceRefresh) {
            let totalVouchers = 0, activeVouchers = 0;
            try {
                const providers = await callApi('/voucher/list_providers');
                if (providers && Array.isArray(providers) && providers.length > 0) {
                    for (const provider of providers) {
                        const voucherGroups = await callApi(`/voucher/list_voucher_groups/${provider}`);
                        if (voucherGroups && Array.isArray(voucherGroups)) {
                            for (const group of voucherGroups) {
                                const vouchersInGroup = await callApi(`/voucher/list_vouchers/${provider}/${group}`);
                                if (vouchersInGroup && Array.isArray(vouchersInGroup)) {
                                    totalVouchers += vouchersInGroup.length;
                                    activeVouchers += vouchersInGroup.filter(v => v.state === 'valid').length;
                                }
                            }
                        }
                    }
                }
            } catch (voucherError) {
                console.error("Error fetching voucher stats for dashboard:", voucherError.message);
                showToast("Could not load all voucher statistics for dashboard.", "warning");
            }
            voucherStats = { totalVouchers, activeVouchers };
            dashboardApiDataCache.voucherStats = voucherStats; // Cache it
        }

        const activeSessionCount = sessionDataRows.length;
        const { totalVouchers, activeVouchers } = voucherStats;

        let totalClientUploadBytes = 0, totalClientDownloadBytes = 0;
        sessionDataRows.forEach(s => {
            totalClientUploadBytes += s.bytes_in || 0;
            totalClientDownloadBytes += s.bytes_out || 0;
        });

        // Update dashboard stat cards
        let statsHtml = `
            <div class="stat-card interactive" id="dashboard-active-sessions-card" title="Go to Sessions tab" role="button" tabindex="0">
                <div class="stat-value">${activeSessionCount}</div>
                <div class="stat-label">Active Sessions</div>
            </div>
            <div class="stat-card interactive" id="dashboard-configured-zones-card" title="Go to Zones tab" role="button" tabindex="0">
                <div class="stat-value">${totalZonesCount}</div>
                <div class="stat-label">Configured Zones</div>
            </div>
            <div class="stat-card interactive" id="dashboard-vouchers-card" title="Go to Vouchers tab" role="button" tabindex="0">
                <div class="grid grid-cols-1 sm:grid-cols-2 gap-x-2 items-center">
                    <div class="voucher-stat-card-inner mb-2 sm:mb-0">
                        <div class="stat-value">${totalVouchers}</div>
                        <div class="stat-label">Total Vouchers</div>
                    </div>
                    <div class="voucher-stat-card-inner">
                        <div class="stat-value">${activeVouchers}</div>
                        <div class="stat-label">Active Vouchers</div>
                    </div>
                </div>
            </div>`;
        dashboardStatsContainer.innerHTML = statsHtml;

        // Add event listeners for interactive stat cards (ensure this isn't done redundantly if statsHtml doesn't change)
        // This is safe here as innerHTML replaces previous listeners.
        document.getElementById('dashboard-active-sessions-card')?.addEventListener('click', () => setActiveTab('sessions'));
        document.getElementById('dashboard-configured-zones-card')?.addEventListener('click', () => setActiveTab('info'));
        document.getElementById('dashboard-vouchers-card')?.addEventListener('click', () => setActiveTab('vouchers'));
        ['dashboard-active-sessions-card', 'dashboard-configured-zones-card', 'dashboard-vouchers-card'].forEach(id => {
            const card = document.getElementById(id);
            if (card) {
                card.addEventListener('keydown', (e) => {
                    if (e.key === 'Enter' || e.key === ' ') {
                        e.preventDefault();
                        card.click();
                    }
                });
            }
        });

        // Update data usage donut chart
        const currentTotalData = totalClientUploadBytes + totalClientDownloadBytes;
        // Update chart if data has changed, it's a forced refresh, or chart instance doesn't exist yet
        if (forceRefresh || totalClientUploadBytes !== originalUploadBytes || totalClientDownloadBytes !== originalDownloadBytes || !dataUsageChart) {
            console.log("Updating dashboard chart with new data, force refresh, or because chart doesn't exist.");
            storeOriginalChartData(totalClientUploadBytes, totalClientDownloadBytes, currentTotalData);

            if (donutTotalData) {
                donutTotalData.innerHTML = `
                    <span style="font-weight: bold; display: block; font-size: 1.2em;">${formatBytes(currentTotalData)}</span>
                    <span style="font-size: 0.8em;" class="text-gray-500 dark:text-gray-400">(100.0%)</span>
                `;
            }
            if (uploadLegendValue) uploadLegendValue.textContent = formatBytes(totalClientUploadBytes);
            if (downloadLegendValue) downloadLegendValue.textContent = formatBytes(totalClientDownloadBytes);
            if (uploadPercentageSpan) uploadPercentageSpan.textContent = `(${(currentTotalData > 0 ? (totalClientUploadBytes / currentTotalData) * 100 : 0).toFixed(1)}%)`;
            if (downloadPercentageSpan) downloadPercentageSpan.textContent = `(${(currentTotalData > 0 ? (totalClientDownloadBytes / currentTotalData) * 100 : 0).toFixed(1)}%)`;

            const chartDataValues = [totalClientUploadBytes, totalClientDownloadBytes];
            const isDarkMode = document.body.classList.contains('dark-mode');
            const tooltipBgColor = isDarkMode ? '#334155' : '#1F2937'; // slate-700 vs gray-800
            const tooltipTextColor = isDarkMode ? '#E2E8F0' : '#FFFFFF'; // slate-200 vs white
            const chartBorderColor = isDarkMode ? '#1E293B' : '#FFFFFF'; // slate-800 vs white

            if (dataUsageChart) { // If chart exists, update it.
                dataUsageChart.data.datasets[0].data = chartDataValues;
                dataUsageChart.options.plugins.tooltip.backgroundColor = tooltipBgColor;
                dataUsageChart.options.plugins.tooltip.titleColor = tooltipTextColor;
                dataUsageChart.options.plugins.tooltip.bodyColor = tooltipTextColor;
                dataUsageChart.options.borderColor = chartBorderColor;
                dataUsageChart.update();
            } else { // Create it.
                const chartData = {
                    labels: ['Client Upload', 'Client Download'],
                    datasets: [{
                        data: chartDataValues,
                        backgroundColor: ['#3B82F6', '#10B981'], // blue-500, green-500
                        hoverBackgroundColor: ['#2563EB', '#059669'], // blue-600, green-600
                        borderColor: chartBorderColor,
                        borderWidth: 2,
                        hoverBorderWidth: 3,
                        hoverOffset: 8
                    }]
                };
                const chartConfig = {
                    type: 'doughnut',
                    data: chartData,
                    options: {
                        responsive: true,
                        maintainAspectRatio: false,
                        cutout: '70%',
                        animation: { animateScale: true, animateRotate: true, duration: 1000 },
                        layout: { padding: 10 },
                        plugins: {
                            legend: { display: false },
                            tooltip: {
                                enabled: true,
                                backgroundColor: tooltipBgColor,
                                titleColor: tooltipTextColor,
                                bodyColor: tooltipTextColor,
                                displayColors: false,
                                callbacks: {
                                    label: function(context) {
                                        let label = context.label || '';
                                        if (label) { label += ': '; }
                                        if (context.parsed !== null) {
                                            label += formatBytes(context.parsed);
                                            const totalForPercentage = originalTotalBytes; 
                                            if (totalForPercentage > 0) {
                                                const percentage = (context.parsed / totalForPercentage * 100).toFixed(1);
                                                label += ` (${percentage}%)`;
                                            } else {
                                                label += ` (0.0%)`;
                                            }
                                        }
                                        return label;
                                    }
                                }
                            }
                        }
                    }
                };
                const ctx = dataUsageCanvas.getContext('2d');
                dataUsageChart = new Chart(ctx, chartConfig);
            }
        } else {
            console.log("Dashboard chart data unchanged, not re-rendering chart.");
        }

    } catch (error) {
        console.error("Error loading dashboard data:", error);
        if(dashboardStatsContainer) dashboardStatsContainer.innerHTML = `<p class="text-red-500 col-span-full text-center">Error loading dashboard data. Check console.</p>`;
        if (donutTotalData) donutTotalData.textContent = placeholderValue;
        // Clear cache on significant error
        dashboardApiDataCache = { sessions: null, voucherStats: null };
    }
}

/**
 * Stores the original fetched data for the chart to allow legend interactivity
 * to revert to the total or segment-specific views without re-fetching.
 * @param {number} uploadBytes - Total upload bytes.
 * @param {number} downloadBytes - Total download bytes.
 * @param {number} totalBytes - Sum of upload and download bytes.
 */
function storeOriginalChartData(uploadBytes, downloadBytes, totalBytes) {
    originalUploadBytes = uploadBytes;
    originalDownloadBytes = downloadBytes;
    originalTotalBytes = totalBytes;
}

/**
 * Initializes event listeners for dashboard elements, specifically legend interactivity.
 */
function initializeDashboardEventListeners() {
    if (!legendItems || !donutTotalData) {
        console.warn("Dashboard legend items or donut total display element not found.");
        return;
    }

    legendItems.forEach(item => {
        item.addEventListener('mouseenter', () => {
            let segmentValue, segmentColor;
            const currentTotalForPercentage = originalTotalBytes;
            const isDarkMode = document.body.classList.contains('dark-mode');
            const segmentPercentageColor = isDarkMode ? 'text-slate-400' : 'text-gray-500';


            if (item.textContent.includes('Client Upload')) {
                segmentValue = originalUploadBytes;
                segmentColor = '#3B82F6'; // Tailwind blue-500
            } else if (item.textContent.includes('Client Download')) {
                segmentValue = originalDownloadBytes;
                segmentColor = '#10B981'; // Tailwind green-500
            }

            if (segmentValue !== undefined && donutTotalData) {
                let segmentPercentage = 0;
                if (currentTotalForPercentage > 0) {
                    segmentPercentage = (segmentValue / currentTotalForPercentage) * 100;
                }
                donutTotalData.innerHTML = `
                    <span style="color: ${segmentColor}; font-weight: bold; display: block; font-size: 1.2em;">${formatBytes(segmentValue)}</span>
                    <span style="font-size: 0.8em;" class="${segmentPercentageColor}">(${segmentPercentage.toFixed(1)}%)</span>
                `;
            }
        });

        item.addEventListener('mouseleave', () => {
            if (donutTotalData) {
                 const isDarkMode = document.body.classList.contains('dark-mode');
                 const totalPercentageColor = isDarkMode ? 'text-slate-400' : 'text-gray-500';
                donutTotalData.innerHTML = `
                    <span style="font-weight: bold; display: block; font-size: 1.2em;">${formatBytes(originalTotalBytes)}</span>
                    <span style="font-size: 0.8em;" class="${totalPercentageColor}">(100.0%)</span>
                `;
            }
        });
    });
}
