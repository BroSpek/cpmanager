// js/tabs.js

(function (CPManager) {
  CPManager.tabs = {
    /**
     * Sets the active tab and corresponding content pane.
     * Handles visual styling of tab buttons and visibility of tab content.
     * Also triggers data loading functions for the newly active tab.
     * @param {string} tabId - The ID of the tab to activate (e.g., 'dashboard', 'sessions').
     * @param {boolean} [forceRefreshData=false] - If true, forces data re-fetch for the tab.
     */
    setActiveTab: function (tabId, forceRefreshData = false) {
      if (!CPManager.elements.mainTabs || !CPManager.elements.tabPanes[tabId]) {
        console.error(`Tab or tab pane not found for ID: ${tabId}`);
        return;
      }

      // Update tab button styles
      CPManager.elements.mainTabs
        .querySelectorAll(".tab-btn")
        .forEach((btn) => {
          if (btn.dataset.tab === tabId) {
            btn.classList.add("active", "text-blue-600", "border-blue-600");
            btn.classList.remove(
              "border-transparent",
              "hover:text-gray-700",
              "hover:border-gray-400"
            );
            btn.setAttribute("aria-selected", "true"); // Accessibility
          } else {
            btn.classList.remove("active", "text-blue-600", "border-blue-600");
            btn.classList.add(
              "border-transparent",
              "hover:text-gray-700",
              "hover:border-gray-400"
            );
            btn.setAttribute("aria-selected", "false"); // Accessibility
          }
        });

      // Show/hide tab content panes
      Object.keys(CPManager.elements.tabPanes).forEach((paneKey) => {
        if (CPManager.elements.tabPanes[paneKey]) {
          if (paneKey === tabId) {
            CPManager.elements.tabPanes[paneKey].classList.remove("hidden");
            CPManager.elements.tabPanes[paneKey].classList.add("active");
            CPManager.elements.tabPanes[paneKey].removeAttribute("hidden"); // Accessibility
          } else {
            CPManager.elements.tabPanes[paneKey].classList.add("hidden");
            CPManager.elements.tabPanes[paneKey].classList.remove("active");
            CPManager.elements.tabPanes[paneKey].setAttribute("hidden", ""); // Accessibility
          }
        }
      });

      // Trigger data loading for the active tab, passing forceRefreshData
      switch (tabId) {
        case "dashboard":
          CPManager.dashboard.loadDashboardData(forceRefreshData);
          break;
        case "sessions":
          CPManager.sessions.loadSessions(forceRefreshData);
          break;
        case "vouchers":
          CPManager.vouchers.loadVoucherProviders(forceRefreshData);
          break;
        case "info": // Assuming 'info' is the Zones tab
          CPManager.zones.loadZoneInfo(forceRefreshData);
          break;
        default:
          console.warn(`No specific load function for tab: ${tabId}`);
      }

      // Save the active tab to localStorage for persistence
      try {
        localStorage.setItem(
          CPManager.config.localStorageKeys.activeTab,
          tabId
        );
      } catch (e) {
        console.warn("Could not save active tab to localStorage:", e.message);
      }
    },

    /**
     * Initializes tab functionality by adding an event listener to the main tabs container.
     */
    initializeTabs: function () {
      if (CPManager.elements.mainTabs) {
        CPManager.elements.mainTabs.addEventListener("click", (e) => {
          const tabButton = e.target.closest(".tab-btn");
          if (tabButton && tabButton.dataset.tab) {
            e.preventDefault(); // Prevent default anchor behavior
            CPManager.tabs.setActiveTab(tabButton.dataset.tab, false);
          }
        });
      } else {
        console.error("Main tabs container (mainTabs) not found.");
      }
    },
  };
})(CPManager);
