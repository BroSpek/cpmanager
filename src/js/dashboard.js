// js/dashboard.js
import Chart from "chart.js/auto";

(function (CPManager) {
  CPManager.dashboard = {
    /**
     * Fetches the full details for every configured captive portal zone.
     * This is a special requirement for the dashboard to calculate active providers.
     * @returns {Promise<Array>} A promise that resolves to an array of detailed zone objects.
     */
    fetchAllZoneDetails: async function () {
      try {
        // CORRECTED: Use POST and the correct relative endpoint path.
        const searchData = await CPManager.api.callApi(
          "/settings/search_zones",
          "POST",
          {},
        );
        if (!searchData || !Array.isArray(searchData.rows)) {
          console.error("Could not fetch zone list.");
          return []; // No zones found or error
        }

        // CORRECTED: Use the correct relative endpoint path for get_zone.
        const detailPromises = searchData.rows.map((zoneSummary) =>
          CPManager.api.callApi(`/settings/get_zone/${zoneSummary.uuid}`),
        );

        // Wait for all detail requests to complete
        const detailedResponses = await Promise.all(detailPromises);

        // Filter out any failed requests and extract the 'zone' object from each response
        const detailedZones = detailedResponses
          .filter((res) => res && res.zone)
          .map((res) => res.zone);

        return detailedZones;
      } catch (error) {
        console.error("Error fetching all zone details:", error);
        CPManager.ui.showToast(
          "Failed to load zone details for dashboard.",
          "danger",
        );
        return []; // Return empty array on failure
      }
    },

    /**
     * Loads and displays data for the dashboard.
     * Includes statistics like active sessions, configured zones, voucher counts,
     * and a data usage donut chart.
     * @param {boolean} [forceRefresh=false] - If true, forces a re-fetch even if data exists.
     */
    loadDashboardData: async function (forceRefresh = false) {
      const dashboardRightColumn = document.getElementById(
        "dashboard-right-column",
      );
      const dashboardBottomRow = document.getElementById(
        "dashboard-bottom-row",
      );

      if (
        !dashboardRightColumn ||
        !dashboardBottomRow ||
        !CPManager.elements.dataUsageCanvas
      ) {
        console.error(
          "One or more dashboard elements are missing from the DOM.",
        );
        if (dashboardRightColumn)
          dashboardRightColumn.innerHTML = `<p class="text-danger col-span-full text-center">Error: Dashboard UI elements missing.</p>`;
        return;
      }

      let sessionDataRows = null;
      let voucherStats = null;
      let allDetailedZones = [];

      const now = Date.now();
      const cacheTTL = CPManager.config.inMemoryCacheTTLMinutes * 60 * 1000;

      const isSessionCacheValid =
        CPManager.state.dashboard.apiDataCache.sessions &&
        now - CPManager.state.dashboard.apiDataCache.sessionsLastFetched <
          cacheTTL;
      const isVoucherStatsCacheValid =
        CPManager.state.dashboard.apiDataCache.voucherStats &&
        now - CPManager.state.dashboard.apiDataCache.voucherStatsLastFetched <
          cacheTTL;
      const isZoneDetailsCacheValid =
        CPManager.state.dashboard.apiDataCache.zoneDetails &&
        now - CPManager.state.dashboard.apiDataCache.zoneDetailsLastFetched <
          cacheTTL;

      if (
        !forceRefresh &&
        isSessionCacheValid &&
        isVoucherStatsCacheValid &&
        isZoneDetailsCacheValid
      ) {
        console.log("Using cached dashboard API data.");
        sessionDataRows = CPManager.state.dashboard.apiDataCache.sessions;
        voucherStats = CPManager.state.dashboard.apiDataCache.voucherStats;
        allDetailedZones = CPManager.state.dashboard.apiDataCache.zoneDetails;
      } else {
        console.log("Fetching fresh dashboard data or cache expired/forced.");
        dashboardRightColumn.innerHTML = `<div class="skeleton-card"></div><div class="skeleton-card"></div><div class="skeleton-card"></div>`;
        dashboardBottomRow.innerHTML = `<div class="skeleton-card"></div><div class="skeleton-card"></div>`;

        if (CPManager.elements.donutTotalData) {
          CPManager.elements.donutTotalData.textContent =
            CPManager.config.placeholderValue;
        }
        if (CPManager.elements.uploadLegendValue) {
          CPManager.elements.uploadLegendValue.textContent =
            CPManager.config.placeholderValue;
        }
        if (CPManager.elements.downloadLegendValue) {
          CPManager.elements.downloadLegendValue.textContent =
            CPManager.config.placeholderValue;
        }

        if (CPManager.state.dashboard.chartInstance) {
          CPManager.state.dashboard.chartInstance.destroy();
          CPManager.state.dashboard.chartInstance = null;
        }
      }

      try {
        if (!sessionDataRows || forceRefresh || !isSessionCacheValid) {
          const sessionData = await CPManager.api.callApi("/session/search");
          sessionDataRows =
            sessionData && Array.isArray(sessionData.rows)
              ? sessionData.rows
              : [];
          CPManager.state.dashboard.apiDataCache.sessions = sessionDataRows;
          CPManager.state.dashboard.apiDataCache.sessionsLastFetched = now;
        }

        if (
          !allDetailedZones.length ||
          forceRefresh ||
          !isZoneDetailsCacheValid
        ) {
          allDetailedZones = await this.fetchAllZoneDetails();
          CPManager.state.dashboard.apiDataCache.zoneDetails = allDetailedZones;
          CPManager.state.dashboard.apiDataCache.zoneDetailsLastFetched = now;
        }
        // Also update the main zones state for other parts of the app that might need it
        CPManager.state.zones.allConfigured = allDetailedZones;

        if (!voucherStats || forceRefresh || !isVoucherStatsCacheValid) {
          let totalVouchers = 0,
            activeVouchers = 0,
            expiredVouchers = 0,
            unusedVouchers = 0,
            totalProviders = 0;
          let allVoucherProviderNames = [];

          try {
            const providers = await CPManager.api.callApi(
              "/voucher/list_providers",
            );
            if (providers && Array.isArray(providers) && providers.length > 0) {
              totalProviders = providers.length;
              allVoucherProviderNames = providers;
              for (const provider of providers) {
                const voucherGroups = await CPManager.api.callApi(
                  `/voucher/list_voucher_groups/${provider}`,
                );
                if (voucherGroups && Array.isArray(voucherGroups)) {
                  for (const group of voucherGroups) {
                    const vouchersInGroup = await CPManager.api.callApi(
                      `/voucher/list_vouchers/${provider}/${group}`,
                    );
                    if (vouchersInGroup && Array.isArray(vouchersInGroup)) {
                      totalVouchers += vouchersInGroup.length;
                      activeVouchers += vouchersInGroup.filter(
                        (v) => v.state === "valid",
                      ).length;
                      expiredVouchers += vouchersInGroup.filter(
                        (v) => v.state === "expired",
                      ).length;
                      unusedVouchers += vouchersInGroup.filter(
                        (v) => v.state === "unused",
                      ).length;
                    }
                  }
                }
              }
            }
          } catch (voucherError) {
            console.error(
              "Error fetching voucher stats:",
              voucherError.message,
            );
            CPManager.ui.showToast(
              "Could not load voucher statistics.",
              "warning",
            );
          }
          voucherStats = {
            totalVouchers,
            activeVouchers,
            expiredVouchers,
            unusedVouchers,
            totalProviders,
            allVoucherProviderNames,
          };
          CPManager.state.dashboard.apiDataCache.voucherStats = voucherStats;
          CPManager.state.dashboard.apiDataCache.voucherStatsLastFetched = now;
        }

        const activeSessionCount = sessionDataRows.length;
        const totalZonesCount = allDetailedZones.length;
        const {
          totalVouchers,
          activeVouchers,
          expiredVouchers,
          unusedVouchers,
          totalProviders,
        } = voucherStats;

        const activeZonesCount = allDetailedZones.filter(
          (zone) => zone.enabled == "1",
        ).length;

        const activeProviders = new Set();
        if (allDetailedZones && Array.isArray(allDetailedZones)) {
          allDetailedZones.forEach((zone) => {
            const authservers = zone.authservers;
            if (authservers && typeof authservers === "object") {
              for (const providerName in authservers) {
                if (
                  authservers[providerName] &&
                  authservers[providerName].selected === 1
                ) {
                  activeProviders.add(providerName);
                }
              }
            }
          });
        }
        const activeProvidersCount = activeProviders.size;

        let totalClientUploadBytes = 0,
          totalClientDownloadBytes = 0;
        sessionDataRows.forEach((s) => {
          totalClientUploadBytes += s.bytes_in || 0;
          totalClientDownloadBytes += s.bytes_out || 0;
        });

        const rightColumnHtml = `
          <div class="db-card" id="dashboard-active-sessions-card" title="Go to Sessions tab" role="button" tabindex="0">
            <div class="db-card-number">${activeSessionCount}</div>
            <div class="db-card-label">Active Sessions</div>
          </div>
          <div class="db-card" id="dashboard-zones-card" title="Go to Zones tab" role="button" tabindex="0">
            <div class="db-card-cols-2">
              <div><div class="db-card-number">${totalZonesCount}</div><div class="db-card-label">Configured Zones</div></div>
              <div><div class="db-card-number text-success">${activeZonesCount}</div><div class="db-card-label">Active Zones</div></div>
            </div>
          </div>
          <div class="db-card" id="dashboard-providers-card" title="Go to Vouchers tab" role="button" tabindex="0">
            <div class="db-card-cols-2">
              <div><div class="db-card-number">${totalProviders}</div><div class="db-card-label">Total Providers</div></div>
              <div><div class="db-card-number text-success">${activeProvidersCount}</div><div class="db-card-label">Active Providers</div></div>
            </div>
          </div>`;
        dashboardRightColumn.innerHTML = rightColumnHtml;

        const bottomRowHtml = `
          <div class="db-card" id="dashboard-vouchers-card" title="Go to Vouchers tab" role="button" tabindex="0">
            <div class="db-card-cols-2">
              <div><div class="db-card-number">${totalVouchers}</div><div class="db-card-label">Total Vouchers</div></div>
              <div><div class="db-card-number text-success">${activeVouchers}</div><div class="db-card-label">Active Vouchers</div></div>
            </div>
          </div>
          <div class="db-card" id="dashboard-unused-expired-vouchers-card" title="Go to Vouchers tab" role="button" tabindex="0">
            <div class="db-card-cols-2">
              <div><div class="db-card-number text-primary">${unusedVouchers}</div><div class="db-card-label">Unused Vouchers</div></div>
              <div><div class="db-card-number text-danger">${expiredVouchers}</div><div class="db-card-label">Expired Vouchers</div></div>
            </div>
          </div>`;
        dashboardBottomRow.innerHTML = bottomRowHtml;

        [
          "dashboard-active-sessions-card",
          "dashboard-zones-card",
          "dashboard-providers-card",
          "dashboard-vouchers-card",
          "dashboard-unused-expired-vouchers-card",
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

        document
          .getElementById("dashboard-active-sessions-card")
          ?.addEventListener("click", () =>
            CPManager.tabs.setActiveTab("sessions"),
          );
        document
          .getElementById("dashboard-zones-card")
          ?.addEventListener("click", () =>
            CPManager.tabs.setActiveTab("info"),
          );
        document
          .getElementById("dashboard-providers-card")
          ?.addEventListener("click", () =>
            CPManager.tabs.setActiveTab("vouchers"),
          );
        document
          .getElementById("dashboard-vouchers-card")
          ?.addEventListener("click", () =>
            CPManager.tabs.setActiveTab("vouchers"),
          );
        document
          .getElementById("dashboard-unused-expired-vouchers-card")
          ?.addEventListener("click", () =>
            CPManager.tabs.setActiveTab("vouchers"),
          );

        const currentTotalData =
          totalClientUploadBytes + totalClientDownloadBytes;
        if (
          forceRefresh ||
          !CPManager.state.dashboard.chartInstance ||
          currentTotalData !== CPManager.state.dashboard.originalTotalBytes
        ) {
          this.storeOriginalChartData(
            totalClientUploadBytes,
            totalClientDownloadBytes,
            currentTotalData,
          );
          this.updateChart(currentTotalData);
        }
      } catch (error) {
        console.error("Error loading dashboard data:", error);
        dashboardRightColumn.innerHTML = `<p class="text-danger col-span-full text-center">Error loading dashboard data. Check console.</p>`;
      }
    },

    updateChart: function (currentTotalData) {
      if (!CPManager.elements.dataUsageCanvas) return;
      const { originalUploadBytes, originalDownloadBytes } =
        CPManager.state.dashboard;

      if (CPManager.elements.donutTotalData) {
        CPManager.elements.donutTotalData.innerHTML = `
                <span class="font-bold block text-lg">${CPManager.utils.formatBytes(
                  currentTotalData,
                )}</span>
                <span class="text-xs text-muted-foreground">(100.0%)</span>`;
      }
      if (CPManager.elements.uploadLegendValue) {
        CPManager.elements.uploadLegendValue.textContent =
          CPManager.utils.formatBytes(originalUploadBytes);
      }
      if (CPManager.elements.uploadPercentageSpan) {
        CPManager.elements.uploadPercentageSpan.textContent = `(${(currentTotalData >
        0
          ? (originalUploadBytes / currentTotalData) * 100
          : 0
        ).toFixed(1)}%)`;
      }
      if (CPManager.elements.downloadLegendValue) {
        CPManager.elements.downloadLegendValue.textContent =
          CPManager.utils.formatBytes(originalDownloadBytes);
      }
      if (CPManager.elements.downloadPercentageSpan) {
        CPManager.elements.downloadPercentageSpan.textContent = `(${(currentTotalData >
        0
          ? (originalDownloadBytes / currentTotalData) * 100
          : 0
        ).toFixed(1)}%)`;
      }

      const chartDataValues = [originalUploadBytes, originalDownloadBytes];
      const rootStyles = getComputedStyle(document.documentElement);
      const getChartCompatibleColor = (variableName, alpha = 1.0) => {
        const rawValue = rootStyles.getPropertyValue(variableName).trim();
        const commaValue = rawValue.replace(/ /g, ", ");
        return alpha < 1.0
          ? `hsla(${commaValue}, ${alpha})`
          : `hsl(${commaValue})`;
      };

      const chartColors = {
        primary: getChartCompatibleColor("--primary", 0.7),
        success: getChartCompatibleColor("--success", 0.7),
        primaryHover: getChartCompatibleColor("--primary"),
        successHover: getChartCompatibleColor("--success"),
        tooltipBg: getChartCompatibleColor("--secondary"),
        tooltipText: getChartCompatibleColor("--secondary-foreground"),
        border: getChartCompatibleColor("--card"),
      };

      if (CPManager.state.dashboard.chartInstance) {
        CPManager.state.dashboard.chartInstance.data.datasets[0].data =
          chartDataValues;
        CPManager.state.dashboard.chartInstance.update();
      } else {
        const ctx = CPManager.elements.dataUsageCanvas.getContext("2d");
        CPManager.state.dashboard.chartInstance = new Chart(ctx, {
          type: "doughnut",
          data: {
            labels: ["Client Upload", "Client Download"],
            datasets: [
              {
                data: chartDataValues,
                backgroundColor: [chartColors.primary, chartColors.success],
                hoverBackgroundColor: [
                  chartColors.primaryHover,
                  chartColors.successHover,
                ],
                borderColor: chartColors.border,
                borderWidth: 2,
                hoverBorderWidth: 3,
                hoverOffset: 8,
              },
            ],
          },
          options: {
            responsive: true,
            maintainAspectRatio: false,
            cutout: "70%",
            animation: {
              animateScale: true,
              animateRotate: true,
              duration: 1000,
            },
            layout: { padding: 10 },
            plugins: {
              legend: { display: false },
              tooltip: {
                enabled: true,
                backgroundColor: chartColors.tooltipBg,
                titleColor: chartColors.tooltipText,
                bodyColor: chartColors.tooltipText,
                displayColors: false,
                callbacks: {
                  label: (context) => {
                    let label = context.label || "";
                    if (label) label += ": ";
                    if (context.parsed !== null) {
                      label += CPManager.utils.formatBytes(context.parsed);
                      const total =
                        CPManager.state.dashboard.originalTotalBytes;
                      const percentage =
                        total > 0
                          ? ((context.parsed / total) * 100).toFixed(1)
                          : 0;
                      label += ` (${percentage}%)`;
                    }
                    return label;
                  },
                },
              },
            },
          },
        });
      }
    },

    storeOriginalChartData: function (uploadBytes, downloadBytes, totalBytes) {
      CPManager.state.dashboard.originalUploadBytes = uploadBytes;
      CPManager.state.dashboard.originalDownloadBytes = downloadBytes;
      CPManager.state.dashboard.originalTotalBytes = totalBytes;
    },

    handleThemeChange: async function () {
      console.log("Dashboard: Handling theme change for chart update.");
      if (CPManager.state.dashboard.chartInstance) {
        CPManager.state.dashboard.chartInstance.destroy();
        CPManager.state.dashboard.chartInstance = null;
      }
      await this.loadDashboardData(true);
    },

    initializeDashboardEventListeners: function () {
      const legendItems = document.querySelectorAll(".legend-item");
      const donutTotalData = document.getElementById("donut-total-data");

      if (!legendItems.length || !donutTotalData) {
        console.warn(
          "Dashboard legend items or donut total display element not found.",
        );
        return;
      }

      legendItems.forEach((item) => {
        item.addEventListener("mouseenter", () => {
          const isUpload = item.textContent.includes("Client Upload");
          const segmentValue = isUpload
            ? CPManager.state.dashboard.originalUploadBytes
            : CPManager.state.dashboard.originalDownloadBytes;
          const segmentColorClass = isUpload
            ? "text-blue-500"
            : "text-green-500";
          const total = CPManager.state.dashboard.originalTotalBytes;
          const percentage =
            total > 0 ? ((segmentValue / total) * 100).toFixed(1) : 0;

          donutTotalData.innerHTML = `
            <span class="font-bold block text-lg ${segmentColorClass}">${CPManager.utils.formatBytes(
              segmentValue,
            )}</span>
            <span class="text-xs text-muted-foreground">(${percentage}%)</span>`;
        });

        item.addEventListener("mouseleave", () => {
          const totalBytes = CPManager.state.dashboard.originalTotalBytes;
          donutTotalData.innerHTML = `
            <span class="font-bold block text-lg">${CPManager.utils.formatBytes(
              totalBytes,
            )}</span>
            <span class="text-xs text-muted-foreground">(100.0%)</span>`;
        });
      });
    },
  };
})(CPManager);
