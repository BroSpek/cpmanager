// js/dashboard.js

(function (CPManager) {
	CPManager.dashboard = {
		/**
		 * Loads and displays data for the dashboard.
		 * Includes statistics like active sessions, configured zones, voucher counts,
		 * and a data usage donut chart.
		 * @param {boolean} [forceRefresh=false] - If true, forces a re-fetch even if data exists.
		 */
		loadDashboardData: async function (forceRefresh = false) {
			if (
				!CPManager.elements.dashboardStatsContainer ||
				!CPManager.elements.dataUsageCanvas ||
				!CPManager.elements.donutTotalData ||
				!CPManager.elements.uploadLegendValue ||
				!CPManager.elements.downloadLegendValue ||
				!CPManager.elements.uploadPercentageSpan ||
				!CPManager.elements.downloadPercentageSpan
			) {
				console.error("One or more dashboard elements are missing from the DOM.");
				if (CPManager.elements.dashboardStatsContainer)
					CPManager.elements.dashboardStatsContainer.innerHTML = `<p class="text-red-500 col-span-full text-center">Error: Dashboard UI elements missing.</p>`;
				return;
			}

			let sessionDataRows = null;
			let voucherStats = null;
			let totalZonesCount = 0;

			// Try to use cached data if not forcing refresh
			if (
				!forceRefresh &&
				CPManager.state.dashboard.apiDataCache.sessions &&
				CPManager.state.dashboard.apiDataCache.voucherStats !== null
			) {
				console.log("Using cached dashboard API data.");
				sessionDataRows = CPManager.state.dashboard.apiDataCache.sessions;
				voucherStats = CPManager.state.dashboard.apiDataCache.voucherStats;
				// totalZones is typically from allConfiguredZones, which has its own cache.
				// Ensure allConfiguredZones is populated.
				if (CPManager.state.zones.allConfigured.length === 0) {
					await CPManager.zones.fetchAllZoneData(); // fetchAllZoneData has its own cache guard
				}
				totalZonesCount = CPManager.state.zones.allConfigured.length;
			} else {
				console.log("Fetching fresh dashboard data.");
				// Show skeleton loaders for stats
				CPManager.elements.dashboardStatsContainer.innerHTML = `
			<div class="stat-card skeleton-card"></div>
			<div class="stat-card skeleton-card"></div>
			<div class="stat-card skeleton-card"></div>
		`;
				// Reset chart/legend text for fresh load
				CPManager.elements.donutTotalData.textContent = CPManager.config.placeholderValue;
				CPManager.elements.uploadLegendValue.textContent = CPManager.config.placeholderValue;
				CPManager.elements.downloadLegendValue.textContent = CPManager.config.placeholderValue;
				CPManager.elements.uploadPercentageSpan.textContent = "";
				CPManager.elements.downloadPercentageSpan.textContent = "";
				// Destroy existing chart if forcing refresh, so it gets recreated with potentially new theme colors
				if (forceRefresh && CPManager.state.dashboard.chartInstance) {
					CPManager.state.dashboard.chartInstance.destroy();
					CPManager.state.dashboard.chartInstance = null;
				}
			}

			try {
				// Fetch data only if not available in cache or if forced
				if (!sessionDataRows || forceRefresh) {
					const sessionData = await CPManager.api.callApi("/session/search");
					sessionDataRows = sessionData && Array.isArray(sessionData.rows) ? sessionData.rows : [];
					CPManager.state.dashboard.apiDataCache.sessions = sessionDataRows; // Cache it
				}

				if (CPManager.state.zones.allConfigured.length === 0 && totalZonesCount === 0) {
					// Ensure zone data is available
					await CPManager.zones.fetchAllZoneData(); // fetchAllZoneData has its own cache guard
				}
				totalZonesCount = CPManager.state.zones.allConfigured.length;

				// Fetch voucher statistics only if not available in cache or if forced
				if (!voucherStats || forceRefresh) {
					let totalVouchers = 0,
						activeVouchers = 0;
					try {
						const providers = await CPManager.api.callApi("/voucher/list_providers");
						if (providers && Array.isArray(providers) && providers.length > 0) {
							for (const provider of providers) {
								const voucherGroups = await CPManager.api.callApi(
									`/voucher/list_voucher_groups/${provider}`
								);
								if (voucherGroups && Array.isArray(voucherGroups)) {
									for (const group of voucherGroups) {
										const vouchersInGroup = await CPManager.api.callApi(
											`/voucher/list_vouchers/${provider}/${group}`
										);
										if (vouchersInGroup && Array.isArray(vouchersInGroup)) {
											totalVouchers += vouchersInGroup.length;
											activeVouchers += vouchersInGroup.filter((v) => v.state === "valid").length;
										}
									}
								}
							}
						}
					} catch (voucherError) {
						console.error("Error fetching voucher stats for dashboard:", voucherError.message);
						CPManager.ui.showToast("Could not load all voucher statistics for dashboard.", "warning");
					}
					voucherStats = { totalVouchers, activeVouchers };
					CPManager.state.dashboard.apiDataCache.voucherStats = voucherStats; // Cache it
				}

				const activeSessionCount = sessionDataRows.length;
				const { totalVouchers, activeVouchers } = voucherStats;

				let totalClientUploadBytes = 0,
					totalClientDownloadBytes = 0;
				sessionDataRows.forEach((s) => {
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
				<div class="grid grid-cols-2 gap-x-2 items-center">
					<div class="voucher-stat-card-inner mb-0">
						<div class="stat-value">${totalVouchers}</div>
						<div class="stat-label">Total Vouchers</div>
					</div>
					<div class="voucher-stat-card-inner">
						<div class="stat-value">${activeVouchers}</div>
						<div class="stat-label">Active Vouchers</div>
					</div>
				</div>
			</div>`;
				CPManager.elements.dashboardStatsContainer.innerHTML = statsHtml;

				// Add event listeners for interactive stat cards (ensure this isn't done redundantly if statsHtml doesn't change)
				// This is safe here as innerHTML replaces previous listeners.
				document
					.getElementById("dashboard-active-sessions-card")
					?.addEventListener("click", () => CPManager.tabs.setActiveTab("sessions"));
				document
					.getElementById("dashboard-configured-zones-card")
					?.addEventListener("click", () => CPManager.tabs.setActiveTab("info"));
				document
					.getElementById("dashboard-vouchers-card")
					?.addEventListener("click", () => CPManager.tabs.setActiveTab("vouchers"));
				[
					"dashboard-active-sessions-card",
					"dashboard-configured-zones-card",
					"dashboard-vouchers-card",
				].forEach((id) => {
					const card = document.getElementById(id);
					if (card) {
						card.addEventListener("keydown", (e) => {
							if (e.key === "Enter" || e.key === " ") {
								e.preventDefault();
								card.click();
							}
						});
					}
				});

				// Update data usage donut chart
				const currentTotalData = totalClientUploadBytes + totalClientDownloadBytes;
				// Update chart if data has changed, it's a forced refresh, or chart instance doesn't exist yet
				if (
					forceRefresh ||
					totalClientUploadBytes !== CPManager.state.dashboard.originalUploadBytes ||
					totalClientDownloadBytes !== CPManager.state.dashboard.originalDownloadBytes ||
					!CPManager.state.dashboard.chartInstance
				) {
					console.log(
						"Updating dashboard chart with new data, force refresh, or because chart doesn't exist."
					);
					CPManager.dashboard.storeOriginalChartData(
						totalClientUploadBytes,
						totalClientDownloadBytes,
						currentTotalData
					);

					if (CPManager.elements.donutTotalData) {
						CPManager.elements.donutTotalData.innerHTML = `
					<span style="font-weight: bold; display: block; font-size: 1.2em;">${CPManager.utils.formatBytes(
						currentTotalData
					)}</span>
					<span style="font-size: 0.8em;" class="text-gray-500 dark:text-gray-400">(100.0%)</span>
				`;
					}
					if (CPManager.elements.uploadLegendValue)
						CPManager.elements.uploadLegendValue.textContent =
							CPManager.utils.formatBytes(totalClientUploadBytes);
					if (CPManager.elements.downloadLegendValue)
						CPManager.elements.downloadLegendValue.textContent =
							CPManager.utils.formatBytes(totalClientDownloadBytes);
					if (CPManager.elements.uploadPercentageSpan)
						CPManager.elements.uploadPercentageSpan.textContent = `(${(currentTotalData > 0
							? (totalClientUploadBytes / currentTotalData) * 100
							: 0
						).toFixed(1)}%)`;
					if (CPManager.elements.downloadPercentageSpan)
						CPManager.elements.downloadPercentageSpan.textContent = `(${(currentTotalData > 0
							? (totalClientDownloadBytes / currentTotalData) * 100
							: 0
						).toFixed(1)}%)`;

					const chartDataValues = [totalClientUploadBytes, totalClientDownloadBytes];
					const isDarkMode = document.body.classList.contains("dark-mode");
					const tooltipBgColor = isDarkMode ? "#334155" : "#1F2937"; // slate-700 vs gray-800
					const tooltipTextColor = isDarkMode ? "#E2E8F0" : "#FFFFFF"; // slate-200 vs white
					const chartBorderColor = isDarkMode ? "#1E293B" : "#FFFFFF"; // slate-800 vs white

					if (CPManager.state.dashboard.chartInstance) {
						// If chart exists, update it.
						CPManager.state.dashboard.chartInstance.data.datasets[0].data = chartDataValues;
						CPManager.state.dashboard.chartInstance.options.plugins.tooltip.backgroundColor =
							tooltipBgColor;
						CPManager.state.dashboard.chartInstance.options.plugins.tooltip.titleColor = tooltipTextColor;
						CPManager.state.dashboard.chartInstance.options.plugins.tooltip.bodyColor = tooltipTextColor;
						CPManager.state.dashboard.chartInstance.options.borderColor = chartBorderColor;
						CPManager.state.dashboard.chartInstance.update();
					} else {
						// Create it.
						const chartData = {
							labels: ["Client Upload", "Client Download"],
							datasets: [
								{
									data: chartDataValues,
									backgroundColor: ["#3B82F6", "#10B981"], // blue-500, green-500
									hoverBackgroundColor: ["#2563EB", "#059669"], // blue-600, green-600
									borderColor: chartBorderColor,
									borderWidth: 2,
									hoverBorderWidth: 3,
									hoverOffset: 8,
								},
							],
						};
						const chartConfig = {
							type: "doughnut",
							data: chartData,
							options: {
								responsive: true,
								maintainAspectRatio: false,
								cutout: "70%",
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
											label: function (context) {
												let label = context.label || "";
												if (label) {
													label += ": ";
												}
												if (context.parsed !== null) {
													label += CPManager.utils.formatBytes(context.parsed);
													const totalForPercentage =
														CPManager.state.dashboard.originalTotalBytes;
													if (totalForPercentage > 0) {
														const percentage = (
															(context.parsed / totalForPercentage) *
															100
														).toFixed(1);
														label += ` (${percentage}%)`;
													} else {
														label += ` (0.0%)`;
													}
												}
												return label;
											},
										},
									},
								},
							},
						};
						const ctx = CPManager.elements.dataUsageCanvas.getContext("2d");
						CPManager.state.dashboard.chartInstance = new Chart(ctx, chartConfig);
					}
				} else {
					console.log("Dashboard chart data unchanged, not re-rendering chart.");
				}
			} catch (error) {
				console.error("Error loading dashboard data:", error);
				if (CPManager.elements.dashboardStatsContainer)
					CPManager.elements.dashboardStatsContainer.innerHTML = `<p class="text-red-500 col-span-full text-center">Error loading dashboard data. Check console.</p>`;
				if (CPManager.elements.donutTotalData)
					CPManager.elements.donutTotalData.textContent = CPManager.config.placeholderValue;
				// Clear cache on significant error
				CPManager.state.dashboard.apiDataCache = { sessions: null, voucherStats: null };
			}
		},

		/**
		 * Stores the original fetched data for the chart to allow legend interactivity
		 * to revert to the total or segment-specific views without re-fetching.
		 * @param {number} uploadBytes - Total upload bytes.
		 * @param {number} downloadBytes - Total download bytes.
		 * @param {number} totalBytes - Sum of upload and download bytes.
		 */
		storeOriginalChartData: function (uploadBytes, downloadBytes, totalBytes) {
			CPManager.state.dashboard.originalUploadBytes = uploadBytes;
			CPManager.state.dashboard.originalDownloadBytes = downloadBytes;
			CPManager.state.dashboard.originalTotalBytes = totalBytes;
		},

		/**
		 * Initializes event listeners for dashboard elements, specifically legend interactivity.
		 */
		initializeDashboardEventListeners: function () {
			// console.log('Dashboard: Initializing event listeners for dashboard module.'); // Removed for cleanup
			if (!CPManager.elements.legendItems || !CPManager.elements.donutTotalData) {
				console.warn("Dashboard legend items or donut total display element not found.");
				return;
			}

			CPManager.elements.legendItems.forEach((item) => {
				item.addEventListener("mouseenter", () => {
					let segmentValue, segmentColor;
					const currentTotalForPercentage = CPManager.state.dashboard.originalTotalBytes;
					const isDarkMode = document.body.classList.contains("dark-mode");
					const segmentPercentageColor = isDarkMode ? "text-slate-400" : "text-gray-500";

					if (item.textContent.includes("Client Upload")) {
						segmentValue = CPManager.state.dashboard.originalUploadBytes;
						segmentColor = "#3B82F6"; // Tailwind blue-500
					} else if (item.textContent.includes("Client Download")) {
						segmentValue = CPManager.state.dashboard.originalDownloadBytes;
						segmentColor = "#10B981"; // Tailwind green-500
					}

					if (segmentValue !== undefined && CPManager.elements.donutTotalData) {
						let segmentPercentage = 0;
						if (currentTotalForPercentage > 0) {
							segmentPercentage = (segmentValue / currentTotalForPercentage) * 100;
						}
						CPManager.elements.donutTotalData.innerHTML = `
					<span style="color: ${segmentColor}; font-weight: bold; display: block; font-size: 1.2em;">${CPManager.utils.formatBytes(
							segmentValue
						)}</span>
					<span style="font-size: 0.8em;" class="${segmentPercentageColor}">(${segmentPercentage.toFixed(
							1
						)}%)</span>
				`;
					}
				});

				item.addEventListener("mouseleave", () => {
					if (CPManager.elements.donutTotalData) {
						const isDarkMode = document.body.classList.contains("dark-mode");
						const totalPercentageColor = isDarkMode ? "text-slate-400" : "text-gray-500";
						CPManager.elements.donutTotalData.innerHTML = `
					<span style="font-weight: bold; display: block; font-size: 1.2em;">${CPManager.utils.formatBytes(
						CPManager.state.dashboard.originalTotalBytes
					)}</span>
					<span style="font-size: 0.8em;" class="${totalPercentageColor}">(100.0%)</span>
				`;
					}
				});
			});
		},
	};
})(CPManager);
