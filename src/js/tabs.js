// js/tabs.js
import { dom } from "@fortawesome/fontawesome-svg-core";

(function (CPManager) {
  CPManager.tabs = {
    /**
     * Keeps track of which tab modules have been loaded and initialized.
     */
    loaded: {
      dashboard: false,
      sessions: false,
      vouchers: false,
      info: false,
    },

    /**
     * Sets the active tab and corresponding content pane.
     * Handles visual styling of tab buttons and visibility of tab content.
     * Also triggers data loading functions for the newly active tab.
     * @param {string} tabId - The ID of the tab to activate (e.g., 'dashboard', 'sessions').
     * @param {boolean} [forceRefreshData=false] - If true, forces data re-fetch for the tab.
     */
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

      // --- Lazy Loading Logic ---
      const tabAlreadyLoaded = CPManager.tabs.loaded[tabId];

      if (!tabAlreadyLoaded) {
        switch (tabId) {
          case "dashboard":
            await import("./dashboard.js");
            CPManager.dashboard.initializeDashboardEventListeners();
            CPManager.tabs.loaded[tabId] = true;
            break;
          case "sessions":
            await import("./sessions.js");
            CPManager.sessions.initializeSessionEventListeners();
            CPManager.tabs.loaded[tabId] = true;
            break;
          case "vouchers":
            await import("./vouchers.js");
            CPManager.vouchers.initializeVoucherEventListeners();
            CPManager.tabs.loaded[tabId] = true;
            break;
          case "info": // Zones tab
            await import("./zones.js");
            CPManager.zones.initializeZoneEventListeners();
            CPManager.tabs.loaded[tabId] = true;
            break;
        }
      }

      // --- Data Loading and Icon Rendering ---
      switch (tabId) {
        case "dashboard":
          await CPManager.dashboard.loadDashboardData(forceRefreshData);
          break;
        case "sessions":
          await CPManager.sessions.loadSessions(forceRefreshData);
          break;
        case "vouchers":
          await CPManager.vouchers.loadVoucherProviders(forceRefreshData);
          break;
        case "info": // Assuming 'info' is the Zones tab
          await CPManager.zones.loadZoneInfo(forceRefreshData);
          break;
        default:
          console.warn(`No specific load function for tab: ${tabId}`);
      }

      // After the content for the tab has been rendered, re-run dom.watch()
      // to transform any new <i> tags into <svg> icons.
      dom.watch();

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
        console.error("Main tabs container (mainTabs) not found.");
      }
    },
  };
})(CPManager);
