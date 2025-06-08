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
      // Check if all necessary DOM elements are present for the dashboard
      if (
        !CPManager.elements.dashboardStatsContainer ||
        !CPManager.elements.dataUsageCanvas ||
        !CPManager.elements.donutTotalData ||
        !CPManager.elements.uploadLegendValue ||
        !CPManager.elements.downloadLegendValue ||
        !CPManager.elements.uploadPercentageSpan ||
        !CPManager.elements.downloadPercentageSpan
      ) {
        console.error(
          "One or more dashboard elements are missing from the DOM."
        );
        // Display an error message if critical elements are missing
        if (CPManager.elements.dashboardStatsContainer)
          CPManager.elements.dashboardStatsContainer.innerHTML = `<p class="text-red-500 col-span-full text-center">Error: Dashboard UI elements missing.</p>`;
        return;
      }

      let sessionDataRows = null;
      // voucherStats will now hold totalVouchers, activeVouchers, expiredVouchers, unusedVouchers (NEW), and totalProviders
      let voucherStats = null;
      let totalZonesCount = 0;

      // Define cache parameters
      const now = Date.now();
      const cacheTTL = CPManager.config.inMemoryCacheTTLMinutes * 60 * 1000;

      // Check if existing cache data is valid
      const isSessionCacheValid =
        CPManager.state.dashboard.apiDataCache.sessions &&
        now - CPManager.state.dashboard.apiDataCache.sessionsLastFetched <
          cacheTTL;
      // Check for unusedVouchers in cache, as it's a new metric
      const isVoucherStatsCacheValid =
        CPManager.state.dashboard.apiDataCache.voucherStats !== null &&
        CPManager.state.dashboard.apiDataCache.voucherStats.unusedVouchers !==
          undefined && // NEW check
        now - CPManager.state.dashboard.apiDataCache.voucherStatsLastFetched <
          cacheTTL;

      // Use cached data if available and valid, otherwise prepare for fresh fetch
      if (!forceRefresh && isSessionCacheValid && isVoucherStatsCacheValid) {
        console.log("Using cached dashboard API data.");
        sessionDataRows = CPManager.state.dashboard.apiDataCache.sessions;
        voucherStats = CPManager.state.dashboard.apiDataCache.voucherStats;
        // Ensure zones data is loaded even if cached for other parts of the app
        if (CPManager.state.zones.allConfigured.length === 0) {
          await CPManager.zones.fetchAllZoneData();
        }
        totalZonesCount = CPManager.state.zones.allConfigured.length;
      } else {
        console.log("Fetching fresh dashboard data or cache expired/forced.");
        // Show skeleton loaders while data is being fetched
        // We now need 4 skeletons: Active Sessions, Configured Zones, Total/Active Vouchers, and the new combined card.
        CPManager.elements.dashboardStatsContainer.innerHTML = `
          <div class="skeleton-card"></div>
          <div class="skeleton-card"></div>
          <div class="skeleton-card"></div>
                    <div class="skeleton-card"></div> `;
        // Reset donut chart and legends to placeholder values
        CPManager.elements.donutTotalData.textContent =
          CPManager.config.placeholderValue;
        CPManager.elements.uploadLegendValue.textContent =
          CPManager.config.placeholderValue;
        CPManager.elements.downloadLegendValue.textContent =
          CPManager.config.placeholderValue;
        CPManager.elements.uploadPercentageSpan.textContent = "";
        CPManager.elements.downloadPercentageSpan.textContent = "";

        // Destroy existing chart instance to prevent conflicts
        if (CPManager.state.dashboard.chartInstance) {
          CPManager.state.dashboard.chartInstance.destroy();
          CPManager.state.dashboard.chartInstance = null;
        }
      }

      try {
        // Fetch session data if not cached or forced refresh
        if (!sessionDataRows || forceRefresh || !isSessionCacheValid) {
          const sessionData = await CPManager.api.callApi("/session/search");
          sessionDataRows =
            sessionData && Array.isArray(sessionData.rows)
              ? sessionData.rows
              : [];
          CPManager.state.dashboard.apiDataCache.sessions = sessionDataRows;
          CPManager.state.dashboard.apiDataCache.sessionsLastFetched =
            Date.now();
        }

        // Fetch zone data if not already loaded
        if (
          CPManager.state.zones.allConfigured.length === 0 &&
          totalZonesCount === 0
        ) {
          await CPManager.zones.fetchAllZoneData();
        }
        totalZonesCount = CPManager.state.zones.allConfigured.length;

        // Fetch Voucher Stats including Total Providers and Expired Vouchers
        if (!voucherStats || forceRefresh || !isVoucherStatsCacheValid) {
          let totalVouchers = 0,
            activeVouchers = 0,
            expiredVouchers = 0, // Initialize counter for expired vouchers
            unusedVouchers = 0, // Initialize counter for unused vouchers (NEW)
            totalProviders = 0; // Initialize counter for total providers

          try {
            // Fetch all voucher providers
            const providers = await CPManager.api.callApi(
              "/voucher/list_providers"
            );
            if (providers && Array.isArray(providers) && providers.length > 0) {
              totalProviders = providers.length; // Set total providers count
              for (const provider of providers) {
                // For each provider, list all voucher groups
                const voucherGroups = await CPManager.api.callApi(
                  `/voucher/list_voucher_groups/${provider}`
                );
                if (voucherGroups && Array.isArray(voucherGroups)) {
                  for (const group of voucherGroups) {
                    // For each group, list all vouchers
                    const vouchersInGroup = await CPManager.api.callApi(
                      `/voucher/list_vouchers/${provider}/${group}`
                    );
                    if (vouchersInGroup && Array.isArray(vouchersInGroup)) {
                      totalVouchers += vouchersInGroup.length;
                      // Filter and count active vouchers
                      activeVouchers += vouchersInGroup.filter(
                        (v) => v.state === "valid"
                      ).length;
                      // Filter and count expired vouchers
                      expiredVouchers += vouchersInGroup.filter(
                        (v) => v.state === "expired"
                      ).length;
                      // Filter and count unused vouchers (NEW)
                      unusedVouchers += vouchersInGroup.filter(
                        (v) => v.state === "unused"
                      ).length;
                    }
                  }
                }
              }
            }
          } catch (voucherError) {
            console.error(
              "Error fetching voucher stats for dashboard:",
              voucherError.message
            );
            CPManager.ui.showToast(
              "Could not load all voucher statistics for dashboard.",
              "warning"
            );
          }
          // Store all calculated voucher statistics in the cache
          voucherStats = {
            totalVouchers,
            activeVouchers,
            expiredVouchers,
            unusedVouchers, // NEW
            totalProviders,
          };
          CPManager.state.dashboard.apiDataCache.voucherStats = voucherStats;
          CPManager.state.dashboard.apiDataCache.voucherStatsLastFetched =
            Date.now();
        }

        // Destructure retrieved data for display
        const activeSessionCount = sessionDataRows.length;
        const {
          totalVouchers,
          activeVouchers,
          expiredVouchers,
          unusedVouchers,
        } = voucherStats;

        let totalClientUploadBytes = 0,
          totalClientDownloadBytes = 0;
        sessionDataRows.forEach((s) => {
          totalClientUploadBytes += s.bytes_in || 0;
          totalClientDownloadBytes += s.bytes_out || 0;
        });

        // Construct the HTML for dashboard statistics cards
        let statsHtml = `
          <div class="cp-card p-6 text-center cursor-pointer transition-transform duration-200 ease-in-out hover:transform hover:-translate-y-0.5 hover:shadow-lg" id="dashboard-active-sessions-card" title="Go to Sessions tab" role="button" tabindex="0">
            <div class="text-4xl font-bold" style="color: var(--stat-value-color);">${activeSessionCount}</div>
            <div class="text-sm mt-1" style="color: var(--stat-label-color);">Active Sessions</div>
          </div>
          <div class="cp-card p-6 text-center cursor-pointer transition-transform duration-200 ease-in-out hover:transform hover:-translate-y-0.5 hover:shadow-lg" id="dashboard-configured-zones-card" title="Go to Zones tab" role="button" tabindex="0">
            <div class="text-4xl font-bold" style="color: var(--stat-value-color);">${totalZonesCount}</div>
            <div class="text-sm mt-1" style="color: var(--stat-label-color);">Configured Zones</div>
          </div>
          <div class="cp-card p-6 text-center cursor-pointer transition-transform duration-200 ease-in-out hover:transform hover:-translate-y-0.5 hover:shadow-lg" id="dashboard-vouchers-card" title="Go to Vouchers tab" role="button" tabindex="0">
            <div class="grid grid-cols-2 gap-x-2 items-center">
              <div class="mb-0">
                <div class="text-4xl font-bold" style="color: var(--stat-value-color);">${totalVouchers}</div>
                <div class="text-sm mt-1" style="color: var(--stat-label-color);">Total Vouchers</div>
              </div>
              <div>
                <div class="text-4xl font-bold" style="color: var(--stat-value-color);">${activeVouchers}</div>
                <div class="text-sm mt-1" style="color: var(--stat-label-color);">Active Vouchers</div>
              </div>
            </div>
          </div>
          <div class="cp-card p-6 text-center cursor-pointer transition-transform duration-200 ease-in-out hover:transform hover:-translate-y-0.5 hover:shadow-lg" id="dashboard-providers-expired-vouchers-card" title="Go to Vouchers tab" role="button" tabindex="0">
              <div class="grid grid-cols-2 gap-x-2 items-center">
                  <div>
                      <div class="text-4xl font-bold" style="color: var(--stat-value-color);">${unusedVouchers}</div> <div class="text-sm mt-1" style="color: var(--stat-label-color);">Unused Vouchers</div> </div>
                  <div>
                      <div class="text-4xl font-bold" style="color: var(--stat-value-color);">${expiredVouchers}</div>
                      <div class="text-sm mt-1" style="color: var(--stat-label-color);">Expired Vouchers</div>
                  </div>
              </div>
          </div>
        `;
        CPManager.elements.dashboardStatsContainer.innerHTML = statsHtml;

        // Add event listeners for direct navigation to tabs
        document
          .getElementById("dashboard-active-sessions-card")
          ?.addEventListener("click", () =>
            CPManager.tabs.setActiveTab("sessions")
          );
        document
          .getElementById("dashboard-configured-zones-card")
          ?.addEventListener("click", () =>
            CPManager.tabs.setActiveTab("info")
          );
        document
          .getElementById("dashboard-vouchers-card")
          ?.addEventListener("click", () =>
            CPManager.tabs.setActiveTab("vouchers")
          );
        // Add event listener for the new combined card
        document
          .getElementById("dashboard-providers-expired-vouchers-card")
          ?.addEventListener("click", () =>
            CPManager.tabs.setActiveTab("vouchers")
          );

        // Add keyboard navigation for dashboard cards
        [
          "dashboard-active-sessions-card",
          "dashboard-configured-zones-card",
          "dashboard-vouchers-card",
          "dashboard-providers-expired-vouchers-card", // Updated to the new combined card ID
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

        // Update donut chart data and legends
        const currentTotalData =
          totalClientUploadBytes + totalClientDownloadBytes;
        if (
          forceRefresh ||
          totalClientUploadBytes !==
            CPManager.state.dashboard.originalUploadBytes ||
          totalClientDownloadBytes !==
            CPManager.state.dashboard.originalDownloadBytes ||
          !CPManager.state.dashboard.chartInstance
        ) {
          CPManager.dashboard.storeOriginalChartData(
            totalClientUploadBytes,
            totalClientDownloadBytes,
            currentTotalData
          );

          if (CPManager.elements.donutTotalData) {
            // Display total data in the center of the donut chart
            CPManager.elements.donutTotalData.innerHTML = `
              <span style="font-weight: bold; display: block; font-size: 1.2em;">${CPManager.utils.formatBytes(
                currentTotalData
              )}</span>
              <span style="font-size: 0.8em;" class="text-gray-500 dark:text-gray-400">(100.0%)</span>`;
          }
          // Update legend values for upload and download
          if (CPManager.elements.uploadLegendValue)
            CPManager.elements.uploadLegendValue.textContent =
              CPManager.utils.formatBytes(totalClientUploadBytes);
          if (CPManager.elements.downloadLegendValue)
            CPManager.elements.downloadLegendValue.textContent =
              CPManager.utils.formatBytes(totalClientDownloadBytes);
          // Update percentage spans in legends
          if (CPManager.elements.uploadPercentageSpan)
            CPManager.elements.uploadPercentageSpan.textContent = `(${(currentTotalData >
            0
              ? (totalClientUploadBytes / currentTotalData) * 100
              : 0
            ).toFixed(1)}%)`;
          if (CPManager.elements.downloadPercentageSpan)
            CPManager.elements.downloadPercentageSpan.textContent = `(${(currentTotalData >
            0
              ? (totalClientDownloadBytes / currentTotalData) * 100
              : 0
            ).toFixed(1)}%)`;

          const chartDataValues = [
            totalClientUploadBytes,
            totalClientDownloadBytes,
          ];
          // Determine chart colors based on current theme
          const isDarkMode =
            document.documentElement.classList.contains("dark"); // Check html element for 'dark' class
          const tooltipBgColor = isDarkMode ? "#334155" : "#1F2937";
          const tooltipTextColor = isDarkMode ? "#E2E8F0" : "#FFFFFF";
          const chartBorderColor = isDarkMode ? "#1E293B" : "#FFFFFF";

          // Update existing chart data or create a new chart instance
          if (CPManager.state.dashboard.chartInstance) {
            CPManager.state.dashboard.chartInstance.data.datasets[0].data =
              chartDataValues;
            CPManager.state.dashboard.chartInstance.options.plugins.tooltip.backgroundColor =
              tooltipBgColor;
            CPManager.state.dashboard.chartInstance.options.plugins.tooltip.titleColor =
              tooltipTextColor;
            CPManager.state.dashboard.chartInstance.options.plugins.tooltip.bodyColor =
              tooltipTextColor;
            CPManager.state.dashboard.chartInstance.options.borderColor =
              chartBorderColor;
            CPManager.state.dashboard.chartInstance.update();
          } else if (CPManager.elements.dataUsageCanvas) {
            // Ensure canvas element exists
            const ctx = CPManager.elements.dataUsageCanvas.getContext("2d");
            CPManager.state.dashboard.chartInstance = new Chart(ctx, {
              type: "doughnut",
              data: {
                labels: ["Client Upload", "Client Download"],
                datasets: [
                  {
                    data: chartDataValues,
                    backgroundColor: ["#3B82F6", "#10B981"], // Blue for upload, Green for download
                    hoverBackgroundColor: ["#2563EB", "#059669"], // Darker shades for hover
                    borderColor: chartBorderColor,
                    borderWidth: 2,
                    hoverBorderWidth: 3,
                    hoverOffset: 8,
                  },
                ],
              },
              options: {
                responsive: true,
                maintainAspectRatio: false, // Allows flexible sizing
                cutout: "70%", // Donut thickness
                animation: {
                  animateScale: true,
                  animateRotate: true,
                  duration: 1000,
                },
                layout: { padding: 10 },
                plugins: {
                  legend: { display: false }, // Hide default legend as custom legend is used
                  tooltip: {
                    enabled: true,
                    backgroundColor: tooltipBgColor,
                    titleColor: tooltipTextColor,
                    bodyColor: tooltipTextColor,
                    displayColors: false, // Hide color squares in tooltip
                    callbacks: {
                      label: function (context) {
                        let label = context.label || "";
                        if (label) label += ": ";
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
            });
          }
        }
      } catch (error) {
        console.error("Error loading dashboard data:", error);
        // Display generic error message if data fetching fails
        if (CPManager.elements.dashboardStatsContainer)
          CPManager.elements.dashboardStatsContainer.innerHTML = `<p class="text-red-500 col-span-full text-center">Error loading dashboard data. Check console.</p>`;
        if (CPManager.elements.donutTotalData)
          CPManager.elements.donutTotalData.textContent =
            CPManager.config.placeholderValue;
        // Reset cache states on error
        CPManager.state.dashboard.apiDataCache.sessions = null;
        CPManager.state.dashboard.apiDataCache.sessionsLastFetched = 0;
        CPManager.state.dashboard.apiDataCache.voucherStats = null;
        CPManager.state.dashboard.apiDataCache.voucherStatsLastFetched = 0;
      }
    },

    /**
     * Stores the original bytes data for chart calculations and legend displays.
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
     * Handles theme changes by destroying and reloading the dashboard chart
     * to ensure colors and styles are updated correctly.
     */
    handleThemeChange: async function () {
      console.log("Dashboard: Handling theme change for chart update.");
      // Destroy current chart instance to apply new theme styles
      if (CPManager.state.dashboard.chartInstance) {
        CPManager.state.dashboard.chartInstance.destroy();
        CPManager.state.dashboard.chartInstance = null;
        console.log("Dashboard chart instance destroyed for theme change.");
      }

      // Reload dashboard data, forcing a refresh to re-render the chart with new theme colors
      await CPManager.dashboard.loadDashboardData(true);
    },

    /**
     * Initializes event listeners specific to the dashboard,
     * such as hover effects for chart legends.
     */
    initializeDashboardEventListeners: function () {
      // Check for required elements
      if (
        !CPManager.elements.legendItems ||
        !CPManager.elements.donutTotalData
      ) {
        console.warn(
          "Dashboard legend items or donut total display element not found."
        );
        return;
      }

      // Add mouseover and mouseleave events for legend items
      CPManager.elements.legendItems.forEach((item) => {
        item.addEventListener("mouseenter", () => {
          let segmentValue, segmentColor;
          const currentTotalForPercentage =
            CPManager.state.dashboard.originalTotalBytes;
          const isDarkMode =
            document.documentElement.classList.contains("dark"); // Check html element for 'dark' class
          const segmentPercentageColor = isDarkMode
            ? "text-slate-400"
            : "text-gray-500";

          // Determine segment value and color based on the hovered legend item
          if (item.textContent.includes("Client Upload")) {
            segmentValue = CPManager.state.dashboard.originalUploadBytes;
            segmentColor = "#3B82F6"; // Match upload color
          } else if (item.textContent.includes("Client Download")) {
            segmentValue = CPManager.state.dashboard.originalDownloadBytes;
            segmentColor = "#10B981"; // Match download color
          }

          // Update the donut total display with specific segment data on hover
          if (segmentValue !== undefined && CPManager.elements.donutTotalData) {
            let segmentPercentage = 0;
            if (currentTotalForPercentage > 0) {
              segmentPercentage =
                (segmentValue / currentTotalForPercentage) * 100;
            }
            CPManager.elements.donutTotalData.innerHTML = `
              <span style="color: ${segmentColor}; font-weight: bold; display: block; font-size: 1.2em;">${CPManager.utils.formatBytes(
                segmentValue
              )}</span>
              <span style="font-size: 0.8em;" class="${segmentPercentageColor}">(${segmentPercentage.toFixed(1)}%)</span>`;
          }
        });

        item.addEventListener("mouseleave", () => {
          // Revert the donut total display to show overall total when mouse leaves legend item
          if (CPManager.elements.donutTotalData) {
            const isDarkMode =
              document.documentElement.classList.contains("dark"); // Check html element for 'dark' class
            const totalPercentageColor = isDarkMode
              ? "text-slate-400"
              : "text-gray-500";
            CPManager.elements.donutTotalData.innerHTML = `
              <span style="font-weight: bold; display: block; font-size: 1.2em;">${CPManager.utils.formatBytes(
                CPManager.state.dashboard.originalTotalBytes
              )}</span>
              <span style="font-size: 0.8em;" class="${totalPercentageColor}">(100.0%)</span>`;
          }
        });
      });
    },
  };
})(CPManager);
