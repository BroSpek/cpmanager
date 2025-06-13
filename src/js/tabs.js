// js/tabs.js

(function (CPManager) {
  CPManager.tabs = {
    /**
     * Sets the active tab and corresponding content pane.
     * Handles visual styling, visibility, and dynamically loads the required JS module.
     * @param {string} tabId - The ID of the tab to activate (e.g., 'dashboard', 'sessions').
     * @param {boolean} [forceRefreshData=false] - If true, forces data re-fetch for the tab.
     */
    // --- CHANGE 1: Make the function async to use 'await' ---
    setActiveTab: async function (tabId, forceRefreshData = false) {
      if (!CPManager.elements.mainTabs || !CPManager.elements.tabPanes[tabId]) {
        console.error(`Tab or tab pane not found for ID: ${tabId}`);
        return;
      }

      // Update tab button styles
      CPManager.elements.mainTabs
        .querySelectorAll(".tab-btn")
        .forEach((btn) => {
          if (btn.dataset.tab === tabId) {
            btn.classList.add("active", "text-primary", "border-primary");
            btn.classList.remove(
              "border-transparent",
              "text-muted-foreground",
              "hover:text-foreground",
              "hover:border-muted",
            );
            btn.setAttribute("aria-selected", "true"); // Accessibility
          } else {
            btn.classList.remove("active", "text-primary", "border-primary");
            btn.classList.add(
              "border-transparent",
              "text-muted-foreground",
              "hover:text-foreground",
              "hover:border-muted",
            );
            btn.setAttribute("aria-selected", "false"); // Accessibility
          }
        });

      // Update visibility of tab content panes
      Object.entries(CPManager.elements.tabPanes).forEach(([key, pane]) => {
        if (pane) {
          if (key === tabId) {
            pane.classList.remove("hidden");
            pane.classList.add("active");
          } else {
            pane.classList.add("hidden");
            pane.classList.remove("active");
          }
        }
      });

      // --- CHANGE 2: Dynamically load the module for the active tab ---
      try {
        switch (tabId) {
          case "dashboard":
            // Dynamically import the dashboard module
            await import("./dashboard.js");
            // Now that it's loaded, call its function
            if (CPManager.dashboard && CPManager.dashboard.loadDashboardData) {
              CPManager.dashboard.loadDashboardData(forceRefreshData);
            }
            break;
          case "sessions":
            await import("./sessions.js");
            if (CPManager.sessions && CPManager.sessions.loadSessions) {
              CPManager.sessions.loadSessions(forceRefreshData);
            }
            break;
          case "vouchers":
            await import("./vouchers.js");
            if (CPManager.vouchers && CPManager.vouchers.loadVoucherProviders) {
              CPManager.vouchers.loadVoucherProviders(forceRefreshData);
            }
            break;
          case "info": // This is the Zones tab
            await import("./zones.js");
            if (CPManager.zones && CPManager.zones.loadZoneInfo) {
              CPManager.zones.loadZoneInfo(forceRefreshData);
            }
            break;
          default:
            console.warn(`No specific load function for tab: ${tabId}`);
        }
      } catch (error) {
        console.error(
          `Failed to dynamically load module for tab: ${tabId}`,
          error,
        );
      }

      // Save the active tab to localStorage for persistence
      try {
        localStorage.setItem(
          CPManager.config.localStorageKeys.activeTab,
          tabId,
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
        console.error("Main tabs container not found for initialization.");
      }
    },
  };
})(window.CPManager);
