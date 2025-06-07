// js/ui.js

(function (CPManager) {
  // --- DOM Element Selections ---
  CPManager.elements = {
    // Theme Toggle Button
    themeToggleBtn: document.getElementById("theme-toggle-btn"),

    // Configuration Section Elements
    configInputSection: document.getElementById("config-input-section"),
    configApiBaseUrlInput: document.getElementById("config-api-base-url"),
    configApiKeyInput: document.getElementById("config-api-key"),
    configApiSecretInput: document.getElementById("config-api-secret"),
    saveApiCredsBtn: document.getElementById("save-api-creds-btn"),
    clearApiCredsBtn: document.getElementById("clear-api-creds-btn"),

    // Main Navigation and Tab Elements
    mainTabs: document.getElementById("mainTabs"),
    tabPanes: {
      dashboard: document.getElementById("dashboard-content"),
      sessions: document.getElementById("sessions-content"),
      vouchers: document.getElementById("vouchers-content"),
      info: document.getElementById("info-content"),
    },

    // Sessions Tab Elements
    sessionCardContainer: document.getElementById("session-card-container"),
    sessionPaginationContainer: document.getElementById("session-pagination"),
    sessionSearchInput: document.getElementById("session-search-input"),
    sessionZoneFilterSelect: document.getElementById(
      "session-zone-filter-select"
    ),
    findMySessionBtn: document.getElementById("find-my-session-btn"),
    disconnectSelectedSessionsBtn: document.getElementById(
      "disconnect-selected-sessions-btn"
    ),
    sessionSelectAllContainer: document.getElementById(
      "session-select-all-container"
    ),
    sessionSelectAllCheckbox: document.getElementById(
      "session-select-all-checkbox"
    ),
    sessionSelectedCountText: document.getElementById(
      "session-selected-count-text"
    ),

    // Vouchers Tab Elements
    voucherProviderSelect: document.getElementById("voucher-provider-select"),
    voucherGroupSelect: document.getElementById("voucher-group-select"),
    voucherCardContainer: document.getElementById("voucher-card-container"),
    voucherPaginationContainer: document.getElementById("voucher-pagination"),
    createVouchersBtn: document.getElementById("create-vouchers-btn"),
    dropVoucherGroupBtn: document.getElementById("drop-voucher-group-btn"),
    dropExpiredVouchersBtn: document.getElementById(
      "drop-expired-vouchers-btn"
    ),
    providerZoneLinkageCard: document.getElementById(
      "provider-zone-linkage-card"
    ),
    providerZoneLinkageDetails: document.getElementById(
      "provider-zone-linkage-details"
    ),
    voucherSearchInput: document.getElementById("voucher-search-input"),
    voucherStateFilterSelect: document.getElementById(
      "voucher-state-filter-select"
    ),
    voidSelectedVouchersBtn: document.getElementById(
      "void-selected-vouchers-btn"
    ),
    voucherSelectAllContainer: document.getElementById(
      "voucher-select-all-container"
    ),
    voucherSelectAllCheckbox: document.getElementById(
      "voucher-select-all-checkbox"
    ),
    voucherSelectedCountText: document.getElementById(
      "voucher-selected-count-text"
    ),

    // Voucher Generation Modal Elements
    generateVoucherModal: document.getElementById("generateVoucherModal"),
    voucherCountSelect: document.getElementById("voucher-count-select"),
    voucherCountCustom: document.getElementById("voucher-count-custom"),
    voucherLifetimeSelect: document.getElementById("voucher-lifetime-select"),
    voucherLifetimeCustom: document.getElementById("voucher-lifetime-custom"),
    voucherUsageSelect: document.getElementById("voucher-usage-select"),
    voucherUsageCustom: document.getElementById("voucher-usage-custom"),
    voucherGroupNameInput: document.getElementById("voucher-groupname"),
    cancelGenerateVoucherBtn: document.getElementById(
      "cancel-generate-voucher-btn"
    ),
    submitGenerateVoucherBtn: document.getElementById(
      "submit-generate-voucher-btn"
    ),

    // Zone Info Tab Elements
    zoneListContainer: document.getElementById("zone-list-container"),
    zonePaginationContainer: document.getElementById("zone-pagination"),

    // Edit Zone Modal Elements
    editZoneModal: document.getElementById("editZoneModal"),
    editZoneModalTitleName: document.getElementById("editZoneModalTitleName"),
    editZoneUuidInput: document.getElementById("editZoneUuidInput"),
    zoneEditDescriptionInput: document.getElementById("zone-edit-description"),
    zoneEditEnabledCheckbox: document.getElementById("zone-edit-enabled"),
    zoneEditEnabledText: document.getElementById("zone-edit-enabled-text"),
    zoneEditAllowedAddressesTextarea: document.getElementById(
      "zone-edit-allowedAddresses"
    ),
    zoneEditAllowedMACAddressesTextarea: document.getElementById(
      "zone-edit-allowedMACAddresses"
    ),
    zoneEditHardTimeoutInput: document.getElementById("zone-edit-hardtimeout"),
    zoneEditIdleTimeoutInput: document.getElementById("zone-edit-idletimeout"),
    zoneEditConcurrentLoginsCheckbox: document.getElementById(
      "zone-edit-concurrentlogins"
    ),
    zoneEditConcurrentLoginsText: document.getElementById(
      "zone-edit-concurrentlogins-text"
    ),
    zoneEditTemplateSelect: document.getElementById("zone-edit-template"),
    cancelEditZoneBtn: document.getElementById("cancel-edit-zone-btn"),
    submitEditZoneBtn: document.getElementById("submit-edit-zone-btn"),
    applyCpConfigBtn: document.getElementById("apply-cp-config-btn"),

    // Confirmation Modal Elements
    confirmationModal: document.getElementById("confirmationModal"),
    confirmationTitle: document.getElementById("confirmationTitle"),
    confirmationMessage: document.getElementById("confirmationMessage"),
    confirmCancelBtn: document.getElementById("confirm-cancel-btn"),
    confirmProceedBtn: document.getElementById("confirm-proceed-btn"),

    // Toast Notification Elements
    toastNotification: document.getElementById("toast-notification"),
    toastMessage: document.getElementById("toast-message"),

    // Footer Elements
    apiStatusFooterText: document
      .getElementById("api-status-footer")
      ?.querySelector("span"),

    // Dashboard Elements
    dashboardStatsContainer: document.getElementById(
      "dashboard-stats-container"
    ),
    dataUsageCanvas: document.getElementById("dataUsageCanvas"),
    donutTotalData: document.getElementById("donut-total-data"),
    uploadLegendValue: document.getElementById("upload-legend-value"),
    downloadLegendValue: document.getElementById("download-legend-value"),
    uploadPercentageSpan: document.getElementById("upload-percentage"),
    downloadPercentageSpan: document.getElementById("download-percentage"),
    legendItems: document.querySelectorAll(".legend-item"),
  };

  // --- UI State & Helpers for Pagination Resize ---
  if (!CPManager.ui) CPManager.ui = {}; // Ensure CPManager.ui namespace exists
  CPManager.ui.paginationStates = {}; // Stores { containerId: { args... } } for each pagination instance
  CPManager.ui.resizeListenerAttached = false; // Flag to ensure resize listener is attached only once

  // --- UI Feedback Functions ---
  CPManager.ui = {
    ...CPManager.ui, // Preserve existing ui methods if any were defined before this block
    /**
     * Displays a toast notification message.
     * @param {string} message - The message to display.
     * @param {string} [type='info'] - Type of toast ('info', 'success', 'error', 'warning').
     * @param {number} [duration=5000] - Duration in milliseconds to show the toast.
     */
    showToast: function (message, type = "info", duration = 5000) {
      const toastNotification = CPManager.elements.toastNotification;
      const toastMessage = CPManager.elements.toastMessage;

      if (!toastNotification || !toastMessage) {
        console.warn("Toast elements not found in the DOM.");
        alert(`Toast (${type}): ${message}`); // Fallback to alert
        return;
      }
      toastMessage.textContent = message;
      toastNotification.className =
        "fixed bottom-5 right-5 text-white py-3 px-5 rounded-lg shadow-lg opacity-0 transition-opacity duration-300 max-w-xs z-50";

      switch (type) {
        case "success":
          toastNotification.classList.add("bg-green-600");
          break;
        case "error":
          toastNotification.classList.add("bg-red-600");
          break;
        case "warning":
          toastNotification.classList.add("bg-yellow-500", "text-black");
          break;
        case "info":
        default:
          toastNotification.classList.add("bg-gray-800");
          break;
      }
      toastNotification.classList.add("opacity-100");
      if (toastNotification.timer) clearTimeout(toastNotification.timer);
      toastNotification.timer = setTimeout(() => {
        toastNotification.classList.remove("opacity-100");
        toastNotification.classList.add("opacity-0");
      }, duration);
    },

    /**
     * Shows a confirmation modal.
     */
    showConfirmationModal: function (title, message, callback) {
      const { confirmationModal, confirmationTitle, confirmationMessage } =
        CPManager.elements;
      if (!confirmationModal || !confirmationTitle || !confirmationMessage) {
        console.error("Confirmation modal elements not found.");
        if (
          confirm(
            title +
              "\n" +
              message
                .replace(/<br\/>/g, "\n")
                .replace(/<strong>|<\/strong>/g, "")
          )
        ) {
          if (callback) callback();
        }
        return;
      }
      confirmationTitle.textContent = title;
      confirmationMessage.innerHTML = message;
      CPManager.state.confirmCallback = callback;
      confirmationModal.classList.remove("hidden");
      confirmationModal.classList.add("flex");
    },

    /**
     * Hides the currently active modal.
     */
    hideModal: function (modalElement) {
      if (modalElement) {
        modalElement.classList.add("hidden");
        modalElement.classList.remove("flex");
      }
    },

    /**
     * Toggles card details visibility.
     */
    toggleCardDetails: function (clickedCard) {
      if (!clickedCard) return;
      const detailsContent = clickedCard.querySelector(".card-details-content");
      if (!detailsContent) return;

      const isCurrentlyExpanded = detailsContent.classList.contains("expanded");

      // Find all cards in the same tab pane and close them
      const activePane = clickedCard.closest(".tab-pane");
      if (activePane) {
        const allCards = activePane.querySelectorAll(
          ".session-card, .voucher-card, .zone-info-card, #provider-zone-linkage-card"
        );
        allCards.forEach((card) => {
          if (card !== clickedCard) {
            const otherDetails = card.querySelector(".card-details-content");
            if (otherDetails && otherDetails.classList.contains("expanded")) {
              otherDetails.classList.remove("expanded");
              otherDetails.setAttribute("aria-hidden", "true");
              const otherSummary = card.querySelector(
                ".voucher-summary, .session-summary, .zone-summary"
              );
              if (otherSummary) {
                otherSummary.setAttribute("aria-expanded", "false");
                const icon = otherSummary.querySelector(
                  "i.fas.fa-chevron-down"
                );
                if (icon) {
                  icon.style.transform = ""; // Reset rotation
                }
              }
            }
          }
        });
      }

      // Now, toggle the clicked card's state. If it was already expanded, it will now be closed.
      detailsContent.classList.toggle("expanded", !isCurrentlyExpanded);
      const isNowExpanded = !isCurrentlyExpanded;
      detailsContent.setAttribute("aria-hidden", String(!isNowExpanded));

      const summary = clickedCard.querySelector(
        ".voucher-summary, .session-summary, .zone-summary"
      );
      if (summary) {
        summary.setAttribute("aria-expanded", String(isNowExpanded));
        const icon = summary.querySelector("i.fas.fa-chevron-down");
        if (icon) {
          icon.style.transform = isNowExpanded ? "rotate(180deg)" : "";
        }
      }
    },

    /**
     * Disables/enables voucher action buttons.
     */
    disableVoucherActionButtons: function (generate, cleanup, deleteGroup) {
      const { createVouchersBtn, dropExpiredVouchersBtn, dropVoucherGroupBtn } =
        CPManager.elements;
      if (createVouchersBtn) createVouchersBtn.disabled = generate;
      if (dropExpiredVouchersBtn) dropExpiredVouchersBtn.disabled = cleanup;
      if (dropVoucherGroupBtn) dropVoucherGroupBtn.disabled = deleteGroup;
    },

    /**
     * Shows skeleton loaders.
     */
    showSkeletonLoaders: function (
      container,
      count = 2,
      skeletonHtml = '<div class="skeleton-card"></div>',
      paginationContainerId = null
    ) {
      if (container) {
        let skeletons = "";
        for (let i = 0; i < count; i++) skeletons += skeletonHtml;
        container.innerHTML = skeletons;
      }
      if (paginationContainerId) {
        const paginationEl = document.getElementById(paginationContainerId);
        if (paginationEl) paginationEl.innerHTML = "";
      }
    },

    /**
     * Clears a container.
     */
    clearContainer: function (container, paginationContainerId = null) {
      if (container) container.innerHTML = "";
      if (paginationContainerId) {
        const paginationEl = document.getElementById(paginationContainerId);
        if (paginationEl) paginationEl.innerHTML = "";
      }
    },

    /**
     * Shows a "no data" message.
     */
    showNoDataMessage: function (
      container,
      message = "No data available.",
      iconClass = "fas fa-info-circle",
      paginationContainerId = null
    ) {
      if (container) {
        container.innerHTML = `<div class="text-center p-4 text-gray-500 dark:text-slate-400"><i class="${iconClass} fa-3x mb-2"></i><p>${message}</p></div>`;
      }
      if (paginationContainerId) {
        const paginationEl = document.getElementById(paginationContainerId);
        if (paginationEl) paginationEl.innerHTML = "";
      }
    },

    /**
     * Renders pagination controls.
     */
    renderPaginationControls: function (
      container,
      currentPage,
      totalItems,
      itemsPerPage,
      onPageChangeCallback
    ) {
      if (container && container.id) {
        CPManager.ui.paginationStates[container.id] = {
          container,
          currentPage,
          totalItems,
          itemsPerPage,
          onPageChangeCallback,
        };
      }

      if (!container) return;
      container.innerHTML = "";

      if (totalItems <= itemsPerPage) return;

      const totalPages = Math.ceil(totalItems / itemsPerPage);
      const nav = document.createElement("nav");
      nav.className =
        "flex items-center justify-between px-4 py-3 sm:px-6 mt-6";
      nav.setAttribute("aria-label", "Pagination");
      nav.style.backgroundColor = "var(--bg-secondary-color)";
      nav.classList.add("rounded-md");

      const summaryDiv = document.createElement("div");
      summaryDiv.className = "sm:block";
      const startItem = (currentPage - 1) * itemsPerPage + 1;
      const endItem = Math.min(currentPage * itemsPerPage, totalItems);
      summaryDiv.innerHTML = `<p class="text-sm" style="color: var(--text-secondary-color)">Showing <span class="font-medium" style="color: var(--text-color);">${startItem}</span> to <span class="font-medium" style="color: var(--text-color);">${endItem}</span> of <span class="font-medium" style="color: var(--text-color);">${totalItems}</span> results</p>`;
      nav.appendChild(summaryDiv);

      const buttonsOuterDiv = document.createElement("div");
      buttonsOuterDiv.className = "flex-1 flex justify-between sm:justify-end";
      const buttonsInnerDiv = document.createElement("div");
      buttonsInnerDiv.className =
        "relative z-0 inline-flex rounded-lg shadow-sm -space-x-px";
      buttonsInnerDiv.setAttribute("aria-label", "Pagination");

      const createButton = (
        content,
        pageNum,
        isIcon = false,
        isEnabled = true,
        isCurrent = false
      ) => {
        const button = document.createElement("button");
        button.innerHTML = content;
        button.setAttribute(
          "aria-label",
          isIcon
            ? pageNum < currentPage
              ? "Previous page"
              : "Next page"
            : `Go to page ${pageNum}`
        );
        let baseClasses =
          "relative inline-flex items-center justify-center text-sm font-medium focus:z-20 transition-all duration-150 ease-in-out border";
        let sizeClasses = isIcon ? " p-2.5" : " px-4 py-2";
        let colorClasses = "";

        button.style.borderColor = "var(--border-secondary-color)";

        if (isCurrent) {
          colorClasses = " z-10";
          button.style.backgroundColor = "var(--tab-active-border-color)";
          button.style.color = "var(--nav-text-color)";
          button.style.borderColor = "var(--tab-active-border-color)";
          button.setAttribute("aria-current", "page");
        } else if (isEnabled) {
          button.style.backgroundColor = "var(--form-input-bg)";
          button.style.color = "var(--text-secondary-color)";
        } else {
          colorClasses = " cursor-not-allowed";
          button.style.backgroundColor = "var(--bg-color)";
          button.style.color = "var(--border-secondary-color)";
          button.style.opacity = "0.5";
        }

        button.className = baseClasses + sizeClasses + colorClasses;

        if (isEnabled && !isCurrent) {
          button.addEventListener("click", () => onPageChangeCallback(pageNum));
        }
        button.disabled = !isEnabled;
        return button;
      };

      const prevButton = createButton(
        '<i class="fas fa-chevron-left"></i>',
        currentPage - 1,
        true,
        currentPage > 1
      );
      prevButton.classList.add("rounded-l-lg");
      buttonsInnerDiv.appendChild(prevButton);

      let pageRangeDisplayed = 2;
      if (typeof window !== "undefined" && window.innerWidth < 480) {
        pageRangeDisplayed = 0;
      } else if (typeof window !== "undefined" && window.innerWidth < 640) {
        pageRangeDisplayed = 1;
      }

      let displayedPages = [];
      if (totalPages <= 2 * pageRangeDisplayed + 5) {
        for (let i = 1; i <= totalPages; i++) displayedPages.push(i);
      } else {
        displayedPages.push(1);
        if (currentPage > pageRangeDisplayed + 2) displayedPages.push("...");
        let startPage = Math.max(2, currentPage - pageRangeDisplayed);
        let endPage = Math.min(
          totalPages - 1,
          currentPage + pageRangeDisplayed
        );
        if (currentPage <= pageRangeDisplayed + 1)
          endPage = Math.min(totalPages - 1, 1 + 2 * pageRangeDisplayed);
        if (currentPage >= totalPages - pageRangeDisplayed)
          startPage = Math.max(2, totalPages - 2 * pageRangeDisplayed);
        for (let i = startPage; i <= endPage; i++) {
          if (i > 0 && i <= totalPages) displayedPages.push(i);
        }
        if (currentPage < totalPages - pageRangeDisplayed - 1)
          displayedPages.push("...");
        if (totalPages > 1) displayedPages.push(totalPages);
      }
      displayedPages = [...new Set(displayedPages)];
      for (let i = displayedPages.length - 2; i >= 1; i--) {
        if (
          displayedPages[i] === "..." &&
          displayedPages[i - 1] + 1 === displayedPages[i + 1]
        ) {
          displayedPages.splice(i, 1);
        }
      }

      displayedPages.forEach((pageNum) => {
        if (pageNum === "...") {
          const ellipsisSpan = document.createElement("span");
          ellipsisSpan.innerHTML = "&hellip;";
          ellipsisSpan.className =
            "relative inline-flex items-center px-4 py-2 border text-sm font-medium";
          ellipsisSpan.style.borderColor = "var(--border-secondary-color)";
          ellipsisSpan.style.backgroundColor = "var(--form-input-bg)";
          ellipsisSpan.style.color = "var(--text-secondary-color)";
          buttonsInnerDiv.appendChild(ellipsisSpan);
        } else {
          buttonsInnerDiv.appendChild(
            createButton(
              String(pageNum),
              pageNum,
              false,
              true,
              pageNum === currentPage
            )
          );
        }
      });

      const nextButton = createButton(
        '<i class="fas fa-chevron-right"></i>',
        currentPage + 1,
        true,
        currentPage < totalPages
      );
      nextButton.classList.add("rounded-r-lg");
      buttonsInnerDiv.appendChild(nextButton);

      buttonsOuterDiv.appendChild(buttonsInnerDiv);
      nav.appendChild(buttonsOuterDiv);
      container.appendChild(nav);

      if (currentPage > 1 && typeof container.scrollIntoView === "function") {
        setTimeout(() => {
          if (
            document.body.contains(container) &&
            container.offsetParent !== null
          ) {
            container.scrollIntoView({ behavior: "auto", block: "nearest" });
          }
        }, 100);
      }
    },

    /**
     * Initializes the debounced resize handler for pagination.
     */
    initializeResizeHandler: function () {
      if (
        typeof window !== "undefined" &&
        !CPManager.ui.resizeListenerAttached
      ) {
        let resizeTimeout;
        const handleDebouncedResize = () => {
          let activeTabPaneId = null;
          if (CPManager.elements && CPManager.elements.tabPanes) {
            for (const tabKey in CPManager.elements.tabPanes) {
              const pane = CPManager.elements.tabPanes[tabKey];
              if (
                pane &&
                pane.classList.contains("active") &&
                !pane.classList.contains("hidden")
              ) {
                activeTabPaneId = pane.id;
                break;
              }
            }
          }

          if (activeTabPaneId) {
            let paginationContainerId;
            if (activeTabPaneId.includes("sessions"))
              paginationContainerId = "session-pagination";
            else if (activeTabPaneId.includes("vouchers"))
              paginationContainerId = "voucher-pagination";
            else if (activeTabPaneId.includes("info"))
              paginationContainerId = "zone-pagination";

            if (
              paginationContainerId &&
              CPManager.ui.paginationStates[paginationContainerId]
            ) {
              const args = CPManager.ui.paginationStates[paginationContainerId];
              CPManager.ui.renderPaginationControls(
                args.container,
                args.currentPage,
                args.totalItems,
                args.itemsPerPage,
                args.onPageChangeCallback
              );
            }
          }
        };

        window.addEventListener("resize", () => {
          clearTimeout(resizeTimeout);
          resizeTimeout = setTimeout(handleDebouncedResize, 250);
        });
        CPManager.ui.resizeListenerAttached = true;
      }
    },
  };
})(CPManager);
