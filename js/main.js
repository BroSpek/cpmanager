// js/main.js

(function (CPManager) {
  CPManager.app = {
    /**
     * Function to apply the current theme (light/dark/system)
     * @param {string} theme - The theme to apply ('light', 'dark', or 'system').
     */
    applyTheme: function (theme) {
      let actualTheme = theme;
      if (theme === "system") {
        actualTheme = window.matchMedia("(prefers-color-scheme: dark)").matches
          ? "dark"
          : "light";
      }

      if (actualTheme === "dark") {
        document.body.classList.add("dark-mode");
      } else {
        document.body.classList.remove("dark-mode");
      }

      if (CPManager.elements.themeToggleBtn) {
        CPManager.elements.themeToggleBtn.innerHTML =
          theme === "light"
            ? '<i class="fas fa-sun"></i>'
            : theme === "dark"
              ? '<i class="fas fa-moon"></i>'
              : '<i class="fas fa-mobile-alt"></i>';
        CPManager.elements.themeToggleBtn.setAttribute(
          "aria-label",
          theme === "light"
            ? "Switch to Dark Mode"
            : theme === "dark"
              ? "Switch to System Preference"
              : "Switch to Light Mode"
        );
      }
    },

    /**
     * Function to toggle the theme between light, dark, and system.
     */
    toggleTheme: async function () {
      const currentThemeSetting =
        localStorage.getItem(CPManager.config.localStorageKeys.theme) ||
        "system";
      let newThemeSetting;

      if (currentThemeSetting === "light") {
        newThemeSetting = "dark";
      } else if (currentThemeSetting === "dark") {
        newThemeSetting = "system";
      } else {
        // system
        newThemeSetting = "light";
      }

      localStorage.setItem(
        CPManager.config.localStorageKeys.theme,
        newThemeSetting
      );
      CPManager.app.applyTheme(newThemeSetting);

      // Refresh dashboard chart due to theme change
      if (
        CPManager.dashboard &&
        typeof CPManager.dashboard.handleThemeChange === "function"
      ) {
        console.log(
          "Theme setting changed by toggle, triggering dashboard theme handler."
        );
        await CPManager.dashboard.handleThemeChange();
      }
    },

    /**
     * Function to load the saved theme from localStorage.
     */
    loadTheme: function () {
      const savedTheme =
        localStorage.getItem(CPManager.config.localStorageKeys.theme) ||
        "system";
      CPManager.app.applyTheme(savedTheme);

      if (savedTheme === "system") {
        const darkModeMediaQuery = window.matchMedia(
          "(prefers-color-scheme: dark)"
        );
        darkModeMediaQuery.addEventListener("change", async () => {
          if (
            localStorage.getItem(CPManager.config.localStorageKeys.theme) ===
            "system"
          ) {
            CPManager.app.applyTheme("system");
            if (
              CPManager.dashboard &&
              typeof CPManager.dashboard.handleThemeChange === "function"
            ) {
              console.log(
                "System theme preference changed, triggering dashboard theme handler."
              );
              await CPManager.dashboard.handleThemeChange();
            }
          }
        });
      }
    },

    setCredentialEntryUIMode: function (isEntryMode) {
      const navElement = document.querySelector("nav");
      const mainTabsContainerElement =
        CPManager.elements.mainTabs?.closest(".mb-4.border-b");
      const tabContentElement = CPManager.elements.tabPanes.dashboard?.closest(
        ".p-4.rounded-lg.shadow"
      );
      const footerElement = document.querySelector("footer");
      const configInputSection = CPManager.elements.configInputSection;
      const mainContentScrollAreaElement = document.getElementById(
        "main-content-scroll-area"
      );

      if (isEntryMode) {
        if (navElement) navElement.style.display = "none";
        if (mainTabsContainerElement)
          mainTabsContainerElement.style.display = "none";
        if (tabContentElement) tabContentElement.style.display = "none";
        if (footerElement) footerElement.style.display = "none";

        if (configInputSection) configInputSection.classList.remove("hidden");
        if (mainContentScrollAreaElement) {
          mainContentScrollAreaElement.style.display = "flex";
          mainContentScrollAreaElement.style.flexDirection = "column";
          mainContentScrollAreaElement.style.alignItems = "center";
          mainContentScrollAreaElement.style.justifyContent = "center";
          mainContentScrollAreaElement.style.minHeight = "calc(100vh)";
          mainContentScrollAreaElement.style.padding = "1rem";
          mainContentScrollAreaElement.style.backgroundColor =
            "var(--bg-color)";
        }
        if (configInputSection) {
          configInputSection.style.maxWidth = "500px";
          configInputSection.style.width = "100%";
          configInputSection.style.marginTop = "0";
          configInputSection.style.marginBottom = "auto";
          configInputSection.style.backgroundColor =
            "var(--config-input-section-bg)";
          configInputSection.style.color = "var(--config-input-section-text)";
        }
      } else {
        if (navElement) navElement.style.display = "";
        if (mainTabsContainerElement)
          mainTabsContainerElement.style.display = "";
        if (tabContentElement) tabContentElement.style.display = "";
        if (footerElement) footerElement.style.display = "";

        if (configInputSection) {
          configInputSection.classList.add("hidden");
          configInputSection.style.maxWidth = "";
          configInputSection.style.width = "";
          configInputSection.style.marginTop = "";
          configInputSection.style.marginBottom = "";
        }
        if (mainContentScrollAreaElement) {
          mainContentScrollAreaElement.style.display = "";
          mainContentScrollAreaElement.style.flexDirection = "";
          mainContentScrollAreaElement.style.alignItems = "";
          mainContentScrollAreaElement.style.justifyContent = "";
          mainContentScrollAreaElement.style.minHeight = "";
          mainContentScrollAreaElement.style.padding = "";
          mainContentScrollAreaElement.style.backgroundColor = "";
        }
      }
    },

    loadAppConfiguration: async function () {
      try {
        const response = await fetch("./app-config.json");
        if (!response.ok) {
          console.warn(
            `Failed to fetch app-config.json: ${response.status} ${response.statusText}. Will rely on user input for API Base URL.`
          );
          CPManager.config.baseUrl = "";
          return;
        }
        const appConfigData = await response.json();
        if (appConfigData.apiBaseUrl) {
          CPManager.config.baseUrl = appConfigData.apiBaseUrl;
        } else {
          console.warn(
            "apiBaseUrl not found in app-config.json. Will rely on user input for API Base URL."
          );
          CPManager.config.baseUrl = "";
        }

        if (
          appConfigData.inMemoryCacheTTLMinutes !== undefined &&
          typeof appConfigData.inMemoryCacheTTLMinutes === "number"
        ) {
          CPManager.config.inMemoryCacheTTLMinutes =
            appConfigData.inMemoryCacheTTLMinutes;
        }
        if (
          appConfigData.itemsPerPage !== undefined &&
          typeof appConfigData.itemsPerPage === "number" &&
          appConfigData.itemsPerPage > 0
        ) {
          CPManager.config.itemsPerPage = appConfigData.itemsPerPage;
        }
        console.log(
          "App config loaded. API Base URL:",
          CPManager.config.baseUrl,
          "Cache TTL:",
          CPManager.config.inMemoryCacheTTLMinutes,
          "Items/Page:",
          CPManager.config.itemsPerPage
        );
      } catch (error) {
        console.error("Error loading app configuration:", error); // Log the error object
        CPManager.config.baseUrl = "";
        if (CPManager.elements.apiStatusFooterText) {
          CPManager.elements.apiStatusFooterText.textContent =
            "App Config Load Failed!";
          CPManager.elements.apiStatusFooterText.className =
            "font-semibold text-red-500 dark:text-red-400";
        }
        CPManager.ui.showToast(
          `Warning: App configuration file failed to load. Error: ${error.message}`,
          "warning",
          10000
        );
      }
    },

    registerServiceWorker: function () {
      if ("serviceWorker" in navigator) {
        navigator.serviceWorker
          .register("./sw.js")
          .then((reg) => console.log("Service worker registered:", reg.scope))
          .catch((err) =>
            console.error("Service worker registration failed:", err)
          );
        let refreshing;
        navigator.serviceWorker.addEventListener("controllerchange", () => {
          if (refreshing) return;
          window.location.reload();
          refreshing = true;
        });
      }
    },

    loadApiCredentials: function () {
      CPManager.state.currentApiKey =
        localStorage.getItem(CPManager.config.localStorageKeys.apiKey) || "";
      CPManager.state.currentApiSecret =
        localStorage.getItem(CPManager.config.localStorageKeys.apiSecret) || "";
      CPManager.config.baseUrl =
        localStorage.getItem(CPManager.config.localStorageKeys.apiBaseUrl) ||
        CPManager.config.baseUrl ||
        "";

      if (CPManager.elements.configApiKeyInput)
        CPManager.elements.configApiKeyInput.value =
          CPManager.state.currentApiKey;
      if (CPManager.elements.configApiSecretInput)
        CPManager.elements.configApiSecretInput.value =
          CPManager.state.currentApiSecret;
      if (CPManager.elements.configApiBaseUrlInput)
        CPManager.elements.configApiBaseUrlInput.value =
          CPManager.config.baseUrl;
    },

    saveApiCredentials: async function () {
      if (
        !CPManager.elements.configApiKeyInput ||
        !CPManager.elements.configApiSecretInput ||
        !CPManager.elements.configApiBaseUrlInput
      )
        return;

      CPManager.state.currentApiKey =
        CPManager.elements.configApiKeyInput.value.trim();
      CPManager.state.currentApiSecret =
        CPManager.elements.configApiSecretInput.value.trim();
      CPManager.config.baseUrl =
        CPManager.elements.configApiBaseUrlInput.value.trim();

      if (!CPManager.config.baseUrl) {
        CPManager.ui.showToast(
          "OPNsense API Base URL cannot be empty.",
          "error"
        );
        return;
      }
      try {
        new URL(CPManager.config.baseUrl);
      } catch (error) {
        console.error("Invalid OPNsense API Base URL format:", error); // Log the error object
        CPManager.ui.showToast(
          "Invalid OPNsense API Base URL format.",
          "error"
        );
        return;
      }

      if (CPManager.state.currentApiKey && CPManager.state.currentApiSecret) {
        try {
          localStorage.setItem(
            CPManager.config.localStorageKeys.apiKey,
            CPManager.state.currentApiKey
          );
          localStorage.setItem(
            CPManager.config.localStorageKeys.apiSecret,
            CPManager.state.currentApiSecret
          );
          localStorage.setItem(
            CPManager.config.localStorageKeys.apiBaseUrl,
            CPManager.config.baseUrl
          );
          CPManager.ui.showToast(
            "API credentials and Base URL saved.",
            "success"
          );

          await CPManager.app.initializeAppLogic();
          let currentActiveTabId =
            localStorage.getItem(CPManager.config.localStorageKeys.activeTab) ||
            "dashboard";
          if (!CPManager.elements.tabPanes[currentActiveTabId])
            currentActiveTabId = "dashboard";

          console.log(
            `saveApiCredentials: Forcing refresh for tab: ${currentActiveTabId}`
          );
          CPManager.tabs.setActiveTab(currentActiveTabId, true);
        } catch (e) {
          CPManager.ui.showToast("Failed to save to local storage.", "error");
          console.error("Error saving to localStorage:", e);
        }
      } else {
        CPManager.ui.showToast("API Key and Secret cannot be empty.", "error");
      }
    },

    clearApiCredentials: function () {
      try {
        localStorage.removeItem(CPManager.config.localStorageKeys.apiKey);
        localStorage.removeItem(CPManager.config.localStorageKeys.apiSecret);
        localStorage.removeItem(CPManager.config.localStorageKeys.apiBaseUrl);
      } catch (e) {
        console.error("Error clearing localStorage:", e);
      }
      CPManager.state.currentApiKey = "";
      CPManager.state.currentApiSecret = "";
      CPManager.config.baseUrl = ""; // Also clear the runtime config
      if (CPManager.elements.configApiKeyInput)
        CPManager.elements.configApiKeyInput.value = "";
      if (CPManager.elements.configApiSecretInput)
        CPManager.elements.configApiSecretInput.value = "";
      if (CPManager.elements.configApiBaseUrlInput)
        CPManager.elements.configApiBaseUrlInput.value = "";

      CPManager.ui.showToast("API credentials cleared.", "info");
      CPManager.app.setCredentialEntryUIMode(true);

      document.querySelectorAll("button").forEach((el) => {
        if (
          el !== CPManager.elements.saveApiCredsBtn &&
          el !== CPManager.elements.clearApiCredsBtn &&
          !el.id.startsWith("confirm-") &&
          !el.id.startsWith("cancel-") &&
          el !== CPManager.elements.themeToggleBtn
        ) {
          el.disabled = true;
        }
      });
      document
        .querySelectorAll(
          "input:not(#config-api-key):not(#config-api-secret):not(#config-api-base-url), select"
        )
        .forEach((el) => (el.disabled = true));

      if (CPManager.elements.mainTabs)
        CPManager.elements.mainTabs
          .querySelectorAll(".tab-btn")
          .forEach((btn) => (btn.style.pointerEvents = "none"));
      if (CPManager.elements.apiStatusFooterText) {
        CPManager.elements.apiStatusFooterText.textContent =
          "Credentials Cleared";
        CPManager.elements.apiStatusFooterText.className =
          "font-semibold text-yellow-500 dark:text-yellow-400";
      }
      // Clear all data related UI elements
      if (CPManager.elements.sessionCardContainer)
        CPManager.ui.clearContainer(
          CPManager.elements.sessionCardContainer,
          "session-pagination"
        );
      if (CPManager.elements.voucherCardContainer)
        CPManager.ui.clearContainer(
          CPManager.elements.voucherCardContainer,
          "voucher-pagination"
        );
      if (CPManager.elements.zoneListContainer)
        CPManager.ui.clearContainer(
          CPManager.elements.zoneListContainer,
          "zone-pagination"
        );
      if (CPManager.elements.dashboardStatsContainer)
        CPManager.ui.clearContainer(CPManager.elements.dashboardStatsContainer);

      if (CPManager.state.dashboard.chartInstance) {
        CPManager.state.dashboard.chartInstance.destroy();
        CPManager.state.dashboard.chartInstance = null;
      }
      if (CPManager.elements.donutTotalData)
        CPManager.elements.donutTotalData.textContent =
          CPManager.config.placeholderValue;

      // Reset states
      CPManager.state.sessions.all = [];
      CPManager.state.sessions.currentPage = 1;
      CPManager.state.vouchers.cachedProviders = [];
      CPManager.state.vouchers.cachedGroups = {};
      CPManager.state.vouchers.cachedData = {};
      CPManager.state.vouchers.currentPage = 1;
      CPManager.state.zones.allConfigured = [];
      CPManager.state.zones.currentPage = 1;
      CPManager.state.dashboard.apiDataCache = {
        sessions: null,
        voucherStats: null,
      };
      CPManager.dashboard.storeOriginalChartData(0, 0, 0);
    },

    checkApiStatusAndConfig: async function () {
      if (!CPManager.config.baseUrl) {
        if (CPManager.elements.apiStatusFooterText) {
          CPManager.elements.apiStatusFooterText.textContent =
            "API Base URL Missing!";
          CPManager.elements.apiStatusFooterText.className =
            "font-semibold text-red-500 dark:text-red-400";
        }
        CPManager.ui.showToast(
          "OPNsense API Base URL is missing.",
          "error",
          10000
        );
        CPManager.app.setCredentialEntryUIMode(true);
        document
          .querySelectorAll(
            'button:not(#save-api-creds-btn):not(#clear-api-creds-btn):not([id^="confirm-"]):not([id^="cancel-"]):not(#theme-toggle-btn)'
          )
          .forEach((el) => (el.disabled = true));
        document
          .querySelectorAll(
            "input:not(#config-api-key):not(#config-api-secret):not(#config-api-base-url), select"
          )
          .forEach((el) => (el.disabled = true));
        if (CPManager.elements.mainTabs)
          CPManager.elements.mainTabs
            .querySelectorAll(".tab-btn")
            .forEach((btn) => (btn.style.pointerEvents = "none"));
        return false;
      }

      if (!CPManager.state.currentApiKey || !CPManager.state.currentApiSecret) {
        if (CPManager.elements.apiStatusFooterText) {
          CPManager.elements.apiStatusFooterText.textContent =
            "Credentials Missing!";
          CPManager.elements.apiStatusFooterText.className =
            "font-semibold text-yellow-500 dark:text-yellow-400";
        }
        CPManager.app.setCredentialEntryUIMode(true);
        document
          .querySelectorAll(
            'button:not(#save-api-creds-btn):not(#clear-api-creds-btn):not([id^="confirm-"]):not([id^="cancel-"]):not(#theme-toggle-btn)'
          )
          .forEach((el) => (el.disabled = true));
        document
          .querySelectorAll(
            "input:not(#config-api-key):not(#config-api-secret):not(#config-api-base-url), select"
          )
          .forEach((el) => (el.disabled = true));
        if (CPManager.elements.mainTabs)
          CPManager.elements.mainTabs
            .querySelectorAll(".tab-btn")
            .forEach((btn) => (btn.style.pointerEvents = "none"));
        return false;
      }

      CPManager.app.setCredentialEntryUIMode(false);

      try {
        await CPManager.zones.fetchAllZoneData(); // This has its own caching and error handling for API calls
        const initialCheckData = CPManager.state.zones.allConfigured;

        if (Array.isArray(initialCheckData)) {
          // Check if data is array (even if empty)
          if (CPManager.elements.apiStatusFooterText) {
            CPManager.elements.apiStatusFooterText.textContent = "Connected";
            CPManager.elements.apiStatusFooterText.className =
              "font-semibold text-green-600 dark:text-green-400";
          }
          return true;
        } else {
          if (CPManager.elements.apiStatusFooterText) {
            CPManager.elements.apiStatusFooterText.textContent =
              "Connection Problematic";
            CPManager.elements.apiStatusFooterText.className =
              "font-semibold text-yellow-500 dark:text-yellow-400";
          }
          console.warn(
            "Initial API check (fetchAllZoneData) returned unexpected data format:",
            initialCheckData
          );
          CPManager.ui.showToast(
            "API connection check returned unexpected data.",
            "warning"
          );
          return false;
        }
      } catch (error) {
        console.error("Initial API check (fetchAllZoneData) failed:", error); // Log the error object
        if (CPManager.elements.apiStatusFooterText) {
          CPManager.elements.apiStatusFooterText.textContent =
            "Connection Failed";
          CPManager.elements.apiStatusFooterText.className =
            "font-semibold text-red-500 dark:text-red-400";
        }
        if (
          error.message.includes("401") ||
          error.message.includes("Unauthorized")
        ) {
          CPManager.app.setCredentialEntryUIMode(true);
          CPManager.ui.showToast(
            "API authentication failed. Check API Key/Secret.",
            "error",
            10000
          );
        } else if (error.message.includes("Failed to fetch")) {
          CPManager.ui.showToast(
            "Cannot reach OPNsense API. Check Base URL & CORS.",
            "error",
            10000
          );
          CPManager.app.setCredentialEntryUIMode(true);
        }
        return false;
      }
    },

    handleApplyCpConfiguration: async function () {
      if (!CPManager.elements.applyCpConfigBtn) return;
      const originalButtonText = CPManager.elements.applyCpConfigBtn.innerHTML;
      CPManager.elements.applyCpConfigBtn.disabled = true;
      CPManager.elements.applyCpConfigBtn.innerHTML =
        '<i class="fas fa-spinner fa-spin mr-2"></i>Applying...';
      CPManager.ui.showToast(
        "Applying Captive Portal configuration changes...",
        "info"
      );

      try {
        const reconfigResult = await CPManager.api.callApi(
          "/service/reconfigure",
          "POST",
          {}
        );
        if (
          reconfigResult &&
          (reconfigResult.status === "ok" ||
            (reconfigResult.message &&
              reconfigResult.message.toLowerCase().includes("ok")))
        ) {
          CPManager.ui.showToast(
            "Captive portal service reconfigured successfully.",
            "success"
          );
        } else {
          const errorDetail = reconfigResult
            ? reconfigResult.status ||
              reconfigResult.message ||
              JSON.stringify(reconfigResult)
            : "Unknown response";
          CPManager.ui.showToast(
            `Service reconfigure status: ${errorDetail}`,
            "warning"
          );
          // Log the unexpected successful response or error
          console.warn(
            "Service reconfigure did not return 'ok' status:",
            reconfigResult
          );
        }
      } catch (error) {
        console.error("Error during manual reconfigure call:", error); // Log the error object
        CPManager.ui.showToast(
          `Error applying Captive Portal configuration: ${error.message}`,
          "error"
        );
      } finally {
        CPManager.elements.applyCpConfigBtn.disabled = false;
        CPManager.elements.applyCpConfigBtn.innerHTML = originalButtonText;
      }
    },

    initializeAllEventListeners: function () {
      if (
        !CPManager ||
        typeof CPManager.elements !== "object" ||
        CPManager.elements === null
      ) {
        console.error(
          "CPManager.elements not initialized. Cannot attach listeners."
        );
        return;
      }

      if (CPManager.elements.themeToggleBtn)
        CPManager.elements.themeToggleBtn.addEventListener(
          "click",
          CPManager.app.toggleTheme
        );
      if (CPManager.elements.saveApiCredsBtn)
        CPManager.elements.saveApiCredsBtn.addEventListener(
          "click",
          CPManager.app.saveApiCredentials
        );
      if (CPManager.elements.clearApiCredsBtn)
        CPManager.elements.clearApiCredsBtn.addEventListener(
          "click",
          CPManager.app.clearApiCredentials
        );
      if (CPManager.elements.applyCpConfigBtn)
        CPManager.elements.applyCpConfigBtn.addEventListener(
          "click",
          CPManager.app.handleApplyCpConfiguration
        );
      if (CPManager.elements.mainTabs) CPManager.tabs.initializeTabs();
      else
        console.warn("Main tabs container not found for event listener init.");

      if (
        CPManager.elements.confirmationModal &&
        CPManager.elements.confirmCancelBtn
      ) {
        CPManager.elements.confirmCancelBtn.addEventListener("click", () => {
          CPManager.ui.hideModal(CPManager.elements.confirmationModal);
          CPManager.state.confirmCallback = null;
        });
      }
      if (
        CPManager.elements.confirmationModal &&
        CPManager.elements.confirmProceedBtn
      ) {
        CPManager.elements.confirmProceedBtn.addEventListener("click", () => {
          if (CPManager.state.confirmCallback)
            CPManager.state.confirmCallback();
          CPManager.ui.hideModal(CPManager.elements.confirmationModal);
          CPManager.state.confirmCallback = null;
        });
      }

      const cancelButtons = document.querySelectorAll('.modal [id^="cancel-"]');
      cancelButtons.forEach((btn) => {
        if (btn && btn.dataset.specificHandlerAttached !== "true") {
          btn.addEventListener("click", () => {
            const modal = btn.closest(".modal");
            if (modal) {
              CPManager.ui.hideModal(modal);
              if (
                modal.id === "editZoneModal" &&
                CPManager.state.zones.originalFullDataForEdit
              ) {
                CPManager.state.zones.originalFullDataForEdit = null;
              }
            }
          });
          btn.dataset.specificHandlerAttached = "true";
        }
      });

      const notificationsToggleBtn = document.getElementById(
        "notifications-toggle-btn"
      );
      if (notificationsToggleBtn) {
        let longPressTimer;
        let longPressFired = false;
        const LONG_PRESS_DURATION = 750;
        const handleShortClick = () => {
          if (CPManager.state.notifications.sessionPollIntervalId) {
            CPManager.notifications.stopSessionPolling();
            CPManager.notifications.updateNotificationToggleState(false);
            CPManager.ui.showToast("Sign-in notifications disabled.", "info");
          } else {
            CPManager.notifications.requestNotificationPermission();
          }
        };
        const startPress = (event) => {
          event.preventDefault();
          longPressFired = false;
          longPressTimer = setTimeout(() => {
            longPressFired = true;
            if (
              notificationsToggleBtn.getAttribute("aria-label") ===
              "Disable sign-in notifications"
            ) {
              CPManager.app.handleSendTestNotification();
            } else {
              CPManager.ui.showToast(
                "Enable notifications first to send a test.",
                "warning"
              );
            }
          }, LONG_PRESS_DURATION);
        };
        const endPress = (event) => {
          event.preventDefault();
          clearTimeout(longPressTimer);
          if (!longPressFired) handleShortClick();
          longPressFired = false;
        };
        const cancelPress = () => {
          clearTimeout(longPressTimer);
          longPressFired = false;
        };
        notificationsToggleBtn.addEventListener("mousedown", startPress);
        notificationsToggleBtn.addEventListener("mouseup", endPress);
        notificationsToggleBtn.addEventListener("mouseleave", cancelPress);
        notificationsToggleBtn.addEventListener("touchstart", startPress, {
          passive: false,
        });
        notificationsToggleBtn.addEventListener("touchend", endPress);
        notificationsToggleBtn.addEventListener("touchcancel", cancelPress);
      }

      if (
        CPManager.sessions &&
        CPManager.sessions.initializeSessionEventListeners
      )
        CPManager.sessions.initializeSessionEventListeners();
      if (
        CPManager.vouchers &&
        CPManager.vouchers.initializeVoucherEventListeners
      )
        CPManager.vouchers.initializeVoucherEventListeners();
      if (CPManager.zones && CPManager.zones.initializeZoneEventListeners)
        CPManager.zones.initializeZoneEventListeners();
      if (
        CPManager.dashboard &&
        CPManager.dashboard.initializeDashboardEventListeners
      )
        CPManager.dashboard.initializeDashboardEventListeners();
    },

    initializeAppLogic: async function () {
      const connected = await CPManager.app.checkApiStatusAndConfig();
      if (connected) {
        document.querySelectorAll("button, input, select").forEach((el) => {
          const isConfigEl =
            el.id.startsWith("config-api-") ||
            el === CPManager.elements.saveApiCredsBtn;
          if (
            !isConfigEl ||
            el === CPManager.elements.clearApiCredsBtn ||
            el === CPManager.elements.themeToggleBtn
          ) {
            el.disabled = false;
          } else if (el === CPManager.elements.saveApiCredsBtn) {
            el.disabled = true; // Keep save disabled if configured and in main app view
          }
        });
        if (CPManager.elements.mainTabs)
          CPManager.elements.mainTabs
            .querySelectorAll(".tab-btn")
            .forEach((btn) => (btn.style.pointerEvents = "auto"));
        if (CPManager.elements.clearApiCredsBtn)
          CPManager.elements.clearApiCredsBtn.disabled = false;
        if (CPManager.elements.themeToggleBtn)
          CPManager.elements.themeToggleBtn.disabled = false;

        await CPManager.sessions.fetchManagerSessionStatus();
        CPManager.ui.disableVoucherActionButtons(false, true, true);

        let initialTab =
          localStorage.getItem(CPManager.config.localStorageKeys.activeTab) ||
          "dashboard";
        const hashTab = window.location.hash.substring(1);
        if (hashTab && CPManager.elements.tabPanes[hashTab]) {
          initialTab = hashTab;
          if (window.history.replaceState)
            window.history.replaceState(
              null,
              null,
              window.location.pathname + window.location.search
            );
        }
        if (!CPManager.elements.tabPanes[initialTab]) initialTab = "dashboard"; // Fallback

        CPManager.tabs.setActiveTab(initialTab, false);
        if (CPManager.ui && CPManager.ui.initializeResizeHandler)
          CPManager.ui.initializeResizeHandler();
        CPManager.notifications.initializeNotifications();
      } else {
        // Ensure all non-config buttons/inputs are disabled if not connected
        document
          .querySelectorAll(
            'button:not(#save-api-creds-btn):not(#clear-api-creds-btn):not([id^="confirm-"]):not([id^="cancel-"]):not(#theme-toggle-btn)'
          )
          .forEach((el) => (el.disabled = true));
        document
          .querySelectorAll(
            "input:not(#config-api-key):not(#config-api-secret):not(#config-api-base-url), select"
          )
          .forEach((el) => (el.disabled = true));
        if (CPManager.elements.mainTabs)
          CPManager.elements.mainTabs
            .querySelectorAll(".tab-btn")
            .forEach((btn) => (btn.style.pointerEvents = "none"));

        // Enable only necessary config buttons
        if (CPManager.elements.saveApiCredsBtn)
          CPManager.elements.saveApiCredsBtn.disabled = false;
        if (CPManager.elements.clearApiCredsBtn)
          CPManager.elements.clearApiCredsBtn.disabled = false;
        if (CPManager.elements.themeToggleBtn)
          CPManager.elements.themeToggleBtn.disabled = false;
        if (CPManager.elements.applyCpConfigBtn)
          CPManager.elements.applyCpConfigBtn.disabled = true;

        const dashboardPane = CPManager.elements.tabPanes.dashboard;
        if (
          dashboardPane &&
          !CPManager.config.baseUrl &&
          document.querySelector("#config-input-section.hidden")
        ) {
          // Check if config section is hidden implying app thought it was configured
          Object.values(CPManager.elements.tabPanes).forEach((pane) => {
            if (pane) {
              pane.classList.add("hidden");
              pane.classList.remove("active");
            }
          });
          dashboardPane.classList.remove("hidden");
          dashboardPane.classList.add("active");
          dashboardPane.innerHTML = `<div class="text-center p-8 text-red-500 dark:text-red-400"><i class="fas fa-exclamation-triangle fa-3x mb-3"></i><p>App config failed to load. Cannot connect.</p></div>`;
        }
      }
    },

    handleSendTestNotification: async function () {
      if (!("Notification" in window)) {
        CPManager.ui.showToast(
          "Browser does not support notifications.",
          "error"
        );
        return;
      }
      if (!navigator.serviceWorker.controller) {
        CPManager.ui.showToast("Service worker not active.", "warning");
        return;
      }
      let permission = Notification.permission;
      if (permission === "default") {
        await CPManager.notifications.requestNotificationPermission();
        permission = Notification.permission;
      }
      if (permission === "granted") {
        navigator.serviceWorker.controller.postMessage({
          type: "SHOW_NOTIFICATION",
          payload: {
            title: "Test Notification",
            body: "Notifications are working!",
            icon: "icons/icon-192x192.png",
            id: `test-${Date.now()}`,
          },
        });
        CPManager.ui.showToast("Test notification sent!", "success");
      } else if (permission === "denied") {
        CPManager.ui.showToast(
          "Notification permission denied. Please enable in browser settings.",
          "error",
          7000
        );
      }
    },

    initializeApp: async function () {
      CPManager.app.loadTheme();
      try {
        await CPManager.app.loadAppConfiguration(); // Must complete before loading credentials that might depend on it
        CPManager.app.loadApiCredentials(); // Load credentials after base URL might be set from config
        CPManager.app.initializeAllEventListeners(); // Setup listeners
        CPManager.app.registerServiceWorker(); // Register SW
        await CPManager.app.initializeAppLogic(); // Check connection and load initial data
      } catch (error) {
        console.error("Failed to initialize the application:", error); // Log the error object
        if (CPManager.elements.applyCpConfigBtn)
          CPManager.elements.applyCpConfigBtn.disabled = true;
        const dashboardPane = CPManager.elements.tabPanes.dashboard;
        if (dashboardPane) {
          Object.values(CPManager.elements.tabPanes).forEach((pane) => {
            if (pane) {
              pane.classList.add("hidden");
              pane.classList.remove("active");
            }
          });
          dashboardPane.classList.remove("hidden");
          dashboardPane.classList.add("active");
          dashboardPane.innerHTML = `<div class="text-center p-8 text-red-500 dark:text-red-400"><i class="fas fa-exclamation-triangle fa-3x mb-3"></i><p>Critical Error: App init failed. ${error.message}</p></div>`;
        }
        CPManager.app.setCredentialEntryUIMode(true); // Fallback to credential entry
      }
    },
  };

  document.addEventListener("DOMContentLoaded", CPManager.app.initializeApp);
})(window.CPManager);
