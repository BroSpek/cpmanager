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
				actualTheme = window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
			}

			if (actualTheme === "dark") {
				document.body.classList.add("dark-mode");
			} else {
				document.body.classList.remove("dark-mode");
			}

			// Update theme toggle button icon based on the selected theme preference
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
		toggleTheme: function () {
			const currentThemeSetting = localStorage.getItem("theme") || "system"; // Default to system
			let newThemeSetting;

			if (currentThemeSetting === "light") {
				newThemeSetting = "dark";
			} else if (currentThemeSetting === "dark") {
				newThemeSetting = "system";
			} else {
				// system
				newThemeSetting = "light";
			}

			localStorage.setItem("theme", newThemeSetting);
			CPManager.app.applyTheme(newThemeSetting);

			// Re-initialize chart if it exists, as its colors might depend on the effectively applied theme
			if (
				CPManager.state.dashboard.chartInstance &&
				typeof CPManager.dashboard.loadDashboardData === "function"
			) {
				console.log("Theme setting changed, re-loading dashboard data for chart update.");
				if (CPManager.state.dashboard.chartInstance) {
					CPManager.state.dashboard.chartInstance.destroy();
					CPManager.state.dashboard.chartInstance = null;
				}
				if (typeof CPManager.dashboard.storeOriginalChartData === "function") {
					CPManager.dashboard.storeOriginalChartData(0, 0, 0); // Resetting with zeros
				}
				CPManager.state.dashboard.apiDataCache.sessions = null; // Force re-fetch
				CPManager.state.dashboard.apiDataCache.voucherStats = null; // Force re-fetch

				CPManager.dashboard.loadDashboardData(true); // Force refresh dashboard data
			}
		},

		/**
		 * Function to load the saved theme from localStorage.
		 */
		loadTheme: function () {
			const savedTheme = localStorage.getItem("theme") || "system"; // Default to system
			CPManager.app.applyTheme(savedTheme);

			// Listener for system theme changes if "system" is selected
			if (savedTheme === "system") {
				const darkModeMediaQuery = window.matchMedia("(prefers-color-scheme: dark)");
				darkModeMediaQuery.addEventListener("change", () => {
					if (localStorage.getItem("theme") === "system") {
						CPManager.app.applyTheme("system");
						// Optionally, refresh chart if visual aspects change significantly
						if (
							CPManager.state.dashboard.chartInstance &&
							typeof CPManager.dashboard.loadDashboardData === "function"
						) {
							console.log("System theme changed, re-loading dashboard data for chart update.");
							if (CPManager.state.dashboard.chartInstance) {
								CPManager.state.dashboard.chartInstance.destroy();
								CPManager.state.dashboard.chartInstance = null;
							}
							if (typeof CPManager.dashboard.storeOriginalChartData === "function") {
								CPManager.dashboard.storeOriginalChartData(0, 0, 0);
							}
							CPManager.state.dashboard.apiDataCache.sessions = null;
							CPManager.state.dashboard.apiDataCache.voucherStats = null;

							CPManager.dashboard.loadDashboardData(true);
						}
					}
				});
			}
		},

		/**
		 * Function to control the UI mode for credential entry.
		 * @param {boolean} isEntryMode - True to show credential entry UI, false to show normal app UI.
		 */
		setCredentialEntryUIMode: function (isEntryMode) {
			const navElement = document.querySelector("nav");
			const mainTabsContainerElement = CPManager.elements.mainTabs?.closest(".mb-4.border-b");
			const tabContentElement = CPManager.elements.tabPanes.dashboard?.closest(".p-4.rounded-lg.shadow"); // Get parent of any tab pane
			const footerElement = document.querySelector("footer");
			const configInputSection = CPManager.elements.configInputSection;
			const mainContentScrollAreaElement = document.getElementById("main-content-scroll-area");

			if (isEntryMode) {
				if (navElement) navElement.style.display = "none";
				if (mainTabsContainerElement) mainTabsContainerElement.style.display = "none";
				if (tabContentElement) tabContentElement.style.display = "none";
				if (footerElement) footerElement.style.display = "none";

				if (configInputSection) {
					configInputSection.classList.remove("hidden");
				}
				if (mainContentScrollAreaElement) {
					mainContentScrollAreaElement.style.display = "flex";
					mainContentScrollAreaElement.style.flexDirection = "column";
					mainContentScrollAreaElement.style.alignItems = "center";
					mainContentScrollAreaElement.style.justifyContent = "center";
					mainContentScrollAreaElement.style.minHeight = "calc(100vh)"; // Full viewport height
					mainContentScrollAreaElement.style.padding = "1rem";
					mainContentScrollAreaElement.style.backgroundColor = "var(--bg-color)";
				}
				if (configInputSection) {
					configInputSection.style.maxWidth = "500px";
					configInputSection.style.width = "100%";
					configInputSection.style.marginTop = "0"; // Reset margin due to flex centering
					configInputSection.style.marginBottom = "auto"; // Helps with centering
					// Ensure the config section itself has a light background if body theme is dark
					configInputSection.style.backgroundColor = "var(--config-input-section-bg)";
					configInputSection.style.color = "var(--config-input-section-text)";
				}
			} else {
				if (navElement) navElement.style.display = ""; // Revert to stylesheet's display
				if (mainTabsContainerElement) mainTabsContainerElement.style.display = "";
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
					mainContentScrollAreaElement.style.backgroundColor = ""; // Revert to themed background
				}
			}
		},

		/**
		 * Loads application configuration from `app-config.json`.
		 */
		loadAppConfiguration: async function () {
			try {
				const response = await fetch("./app-config.json");
				if (!response.ok) {
					console.warn(
						`Failed to fetch app-config.json: ${response.status} ${response.statusText}. Will rely on user input for API Base URL.`
					);
					CPManager.config.baseUrl = ""; // Explicitly set to empty string if file not found/parseable
					return;
				}
				const appConfigData = await response.json();
				if (appConfigData.apiBaseUrl) {
					CPManager.config.baseUrl = appConfigData.apiBaseUrl;
					console.log("Application configuration loaded. API Base URL set to:", CPManager.config.baseUrl);
				} else {
					console.warn("apiBaseUrl not found in app-config.json. Will rely on user input for API Base URL.");
					CPManager.config.baseUrl = ""; // Set to empty if key is missing in the JSON
				}
			} catch (error) {
				console.error(
					"Error loading application configuration (JSON parse error or network issue):",
					error.message
				);
				CPManager.config.baseUrl = "";
				if (CPManager.elements.apiStatusFooterText) {
					CPManager.elements.apiStatusFooterText.textContent = "App Config Load Failed!";
					CPManager.elements.apiStatusFooterText.className = "font-semibold text-red-500 dark:text-red-400";
				}
				CPManager.ui.showToast(
					`Warning: App configuration file failed to load. Please enter API Base URL manually. Error: ${error.message}`,
					"warning",
					10000
				);
			}
		},

		/**
		 * Registers the service worker for PWA features and notifications.
		 */
		registerServiceWorker: function () {
			if ("serviceWorker" in navigator) {
				navigator.serviceWorker
					.register("./sw.js")
					.then((reg) => {
						console.log("Service worker registered successfully:", reg.scope);
					})
					.catch((err) => {
						console.error("Service worker registration failed:", err);
					});
				let refreshing;
				navigator.serviceWorker.addEventListener("controllerchange", () => {
					if (refreshing) return;
					console.log("Service Worker: Controller changed. Page will reload.");
					window.location.reload();
					refreshing = true;
				});
			}
		},

		/**
		 * Loads API credentials (key, secret, base URL) from local storage.
		 */
		loadApiCredentials: function () {
			CPManager.state.currentApiKey = localStorage.getItem("opnsenseApiKey") || "";
			CPManager.state.currentApiSecret = localStorage.getItem("opnsenseApiSecret") || "";
			// Load API Base URL from local storage, if available
			CPManager.config.baseUrl = localStorage.getItem("opnsenseApiBaseUrl") || CPManager.config.baseUrl || ""; // Prioritize stored, then existing, then empty

			if (CPManager.elements.configApiKeyInput)
				CPManager.elements.configApiKeyInput.value = CPManager.state.currentApiKey;
			if (CPManager.elements.configApiSecretInput)
				CPManager.elements.configApiSecretInput.value = CPManager.state.currentApiSecret;
			if (CPManager.elements.configApiBaseUrlInput)
				CPManager.elements.configApiBaseUrlInput.value = CPManager.config.baseUrl;
		},

		/**
		 * Saves API credentials and base URL to local storage.
		 */
		saveApiCredentials: async function () {
			if (
				!CPManager.elements.configApiKeyInput ||
				!CPManager.elements.configApiSecretInput ||
				!CPManager.elements.configApiBaseUrlInput
			)
				return;

			CPManager.state.currentApiKey = CPManager.elements.configApiKeyInput.value.trim();
			CPManager.state.currentApiSecret = CPManager.elements.configApiSecretInput.value.trim();
			CPManager.config.baseUrl = CPManager.elements.configApiBaseUrlInput.value.trim();

			if (!CPManager.config.baseUrl) {
				CPManager.ui.showToast("OPNsense API Base URL cannot be empty.", "error");
				return;
			}
			try {
				new URL(CPManager.config.baseUrl);
			} catch (e) {
				CPManager.ui.showToast(
					"Invalid OPNsense API Base URL format. Please enter a valid URL (e.g., https://192.168.1.1).",
					"error"
				);
				return;
			}

			if (CPManager.state.currentApiKey && CPManager.state.currentApiSecret) {
				try {
					localStorage.setItem("opnsenseApiKey", CPManager.state.currentApiKey);
					localStorage.setItem("opnsenseApiSecret", CPManager.state.currentApiSecret);
					localStorage.setItem("opnsenseApiBaseUrl", CPManager.config.baseUrl);
					CPManager.ui.showToast("API credentials and Base URL saved to browser local storage.", "success");

					await CPManager.app.initializeAppLogic(); // This re-evaluates connection and UI state

					let currentActiveTabId = "dashboard";
					try {
						const savedTab = localStorage.getItem("activeHelpdeskTab");
						if (savedTab && CPManager.elements.tabPanes[savedTab]) {
							currentActiveTabId = savedTab;
						}
					} catch (e) {
						console.warn(
							"localStorage access error for active tab during credential save refresh:",
							e.message
						);
					}

					console.log(
						`saveApiCredentials: Forcing refresh for tab: ${currentActiveTabId} after saving credentials.`
					);
					CPManager.tabs.setActiveTab(currentActiveTabId, true);
				} catch (e) {
					CPManager.ui.showToast(
						"Failed to save credentials to local storage. Storage might be full or disabled.",
						"error"
					);
					console.error("Error saving to localStorage:", e);
				}
			} else {
				CPManager.ui.showToast("API Key and Secret cannot be empty.", "error");
			}
		},

		/**
		 * Clears API credentials from local storage and resets UI.
		 */
		clearApiCredentials: function () {
			try {
				localStorage.removeItem("opnsenseApiKey");
				localStorage.removeItem("opnsenseApiSecret");
				localStorage.removeItem("opnsenseApiBaseUrl");
			} catch (e) {
				console.error("Error clearing localStorage:", e);
			}
			CPManager.state.currentApiKey = "";
			CPManager.state.currentApiSecret = "";
			CPManager.config.baseUrl = "";
			if (CPManager.elements.configApiKeyInput) CPManager.elements.configApiKeyInput.value = "";
			if (CPManager.elements.configApiSecretInput) CPManager.elements.configApiSecretInput.value = "";
			if (CPManager.elements.configApiBaseUrlInput) CPManager.elements.configApiBaseUrlInput.value = "";

			CPManager.ui.showToast("API credentials cleared from local storage.", "info");
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

			if (CPManager.elements.mainTabs) {
				CPManager.elements.mainTabs
					.querySelectorAll(".tab-btn")
					.forEach((btn) => (btn.style.pointerEvents = "none"));
			}
			if (CPManager.elements.apiStatusFooterText) {
				CPManager.elements.apiStatusFooterText.textContent = "Credentials Cleared";
				CPManager.elements.apiStatusFooterText.className = "font-semibold text-yellow-500 dark:text-yellow-400";
			}

			if (CPManager.elements.sessionCardContainer)
				CPManager.ui.clearContainer(CPManager.elements.sessionCardContainer);
			if (CPManager.elements.voucherCardContainer)
				CPManager.ui.clearContainer(CPManager.elements.voucherCardContainer);
			if (CPManager.elements.zoneListContainer) CPManager.ui.clearContainer(CPManager.elements.zoneListContainer);
			if (CPManager.elements.dashboardStatsContainer)
				CPManager.ui.clearContainer(CPManager.elements.dashboardStatsContainer);

			if (CPManager.state.dashboard.chartInstance) {
				CPManager.state.dashboard.chartInstance.destroy();
				CPManager.state.dashboard.chartInstance = null;
				CPManager.state.dashboard.apiDataCache = { sessions: null, voucherStats: null };
				CPManager.dashboard.storeOriginalChartData(0, 0, 0);
			}
			if (CPManager.elements.donutTotalData)
				CPManager.elements.donutTotalData.textContent = CPManager.config.placeholderValue;

			CPManager.state.sessions.all = [];
			CPManager.state.vouchers.cachedProviders = [];
			CPManager.state.vouchers.cachedGroups = {};
			CPManager.state.vouchers.cachedData = {};
			CPManager.state.zones.allConfigured = [];
		},

		/**
		 * Checks API status and configuration, updates UI accordingly.
		 * @returns {Promise<boolean>} True if connected and configured, false otherwise.
		 */
		checkApiStatusAndConfig: async function () {
			if (!CPManager.config.baseUrl) {
				if (CPManager.elements.apiStatusFooterText) {
					CPManager.elements.apiStatusFooterText.textContent = "API Base URL Missing!";
					CPManager.elements.apiStatusFooterText.className = "font-semibold text-red-500 dark:text-red-400";
				}
				CPManager.ui.showToast(
					"Critical: OPNsense API Base URL is missing. Please configure it.",
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
					CPManager.elements.apiStatusFooterText.textContent = "Credentials Missing!";
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
				await CPManager.zones.fetchAllZoneData();
				const initialCheckData = CPManager.state.zones.allConfigured;

				if (Array.isArray(initialCheckData)) {
					if (CPManager.elements.apiStatusFooterText) {
						CPManager.elements.apiStatusFooterText.textContent = "Connected";
						CPManager.elements.apiStatusFooterText.className =
							"font-semibold text-green-600 dark:text-green-400";
					}
					return true;
				} else {
					if (CPManager.elements.apiStatusFooterText) {
						CPManager.elements.apiStatusFooterText.textContent = "Connection Problematic";
						CPManager.elements.apiStatusFooterText.className =
							"font-semibold text-yellow-500 dark:text-yellow-400";
					}
					console.warn(
						"Initial API check (fetchAllZoneData) returned unexpected data format:",
						initialCheckData
					);
					CPManager.ui.showToast(
						"API connection check returned unexpected data. App might not function correctly.",
						"warning"
					);
					return false;
				}
			} catch (error) {
				if (CPManager.elements.apiStatusFooterText) {
					CPManager.elements.apiStatusFooterText.textContent = "Connection Failed";
					CPManager.elements.apiStatusFooterText.className = "font-semibold text-red-500 dark:text-red-400";
				}
				console.error("Initial API check (fetchAllZoneData) failed:", error.message);
				if (error.message.includes("401") || error.message.includes("Unauthorized")) {
					CPManager.app.setCredentialEntryUIMode(true);
					CPManager.ui.showToast(
						"API authentication failed. Please check your API Key and Secret.",
						"error",
						10000
					);
				} else if (error.message.includes("Failed to fetch")) {
					CPManager.ui.showToast(
						"Cannot reach OPNsense API. Please check your Base URL, network, and CORS settings.",
						"error",
						10000
					);
					CPManager.app.setCredentialEntryUIMode(true);
				}
				return false;
			}
		},

		/**
		 * Handles the click of the global "Apply Captive Portal Configuration" button.
		 * Calls the service/reconfigure endpoint.
		 */
		handleApplyCpConfiguration: async function () {
			if (!CPManager.elements.applyCpConfigBtn) return;

			const originalButtonText = CPManager.elements.applyCpConfigBtn.innerHTML;
			CPManager.elements.applyCpConfigBtn.disabled = true;
			CPManager.elements.applyCpConfigBtn.innerHTML = '<i class="fas fa-spinner fa-spin mr-2"></i>Applying...';
			CPManager.ui.showToast("Applying Captive Portal configuration changes...", "info");

			try {
				const reconfigResult = await CPManager.api.callApi("/service/reconfigure", "POST", {});
				if (
					reconfigResult &&
					(reconfigResult.status === "ok" ||
						(reconfigResult.message && reconfigResult.message.toLowerCase().includes("ok")))
				) {
					CPManager.ui.showToast("Captive Portal service reconfigured successfully.", "success");
				} else {
					const errorDetail = reconfigResult
						? reconfigResult.status || reconfigResult.message || JSON.stringify(reconfigResult)
						: "Unknown response";
					CPManager.ui.showToast(`Service reconfigure attempt finished. Status: ${errorDetail}`, "warning");
					console.warn('Reconfigure result not explicitly "ok":', reconfigResult);
				}
			} catch (error) {
				console.error("Error during manual reconfigure call:", error.message);
			} finally {
				CPManager.elements.applyCpConfigBtn.disabled = false;
				CPManager.elements.applyCpConfigBtn.innerHTML = originalButtonText;
			}
		},

		/**
		 * Initializes all static event listeners for the application.
		 */
		initializeAllEventListeners: function () {
			// Verify CPManager.elements is an object before accessing its properties
			if (!CPManager || typeof CPManager.elements !== "object" || CPManager.elements === null) {
				console.error("CPManager.elements is not properly initialized. Cannot attach event listeners.");
				return; // Prevent further errors
			}

			if (CPManager.elements.themeToggleBtn) {
				CPManager.elements.themeToggleBtn.addEventListener("click", CPManager.app.toggleTheme);
			}

			if (CPManager.elements.saveApiCredsBtn)
				CPManager.elements.saveApiCredsBtn.addEventListener("click", CPManager.app.saveApiCredentials);

			if (CPManager.elements.clearApiCredsBtn)
				CPManager.elements.clearApiCredsBtn.addEventListener("click", CPManager.app.clearApiCredentials);

			if (CPManager.elements.applyCpConfigBtn)
				CPManager.elements.applyCpConfigBtn.addEventListener("click", CPManager.app.handleApplyCpConfiguration);

			// Call initializeTabs only if mainTabs element is available
			if (CPManager.elements.mainTabs) {
				CPManager.tabs.initializeTabs();
			} else {
				console.warn("Main tabs container (mainTabs) not found. Tabs functionality may be limited.");
			}

			// Confirmation Modal Buttons
			if (CPManager.elements.confirmationModal && CPManager.elements.confirmCancelBtn) {
				CPManager.elements.confirmCancelBtn.addEventListener("click", () => {
					CPManager.ui.hideModal(CPManager.elements.confirmationModal);
					CPManager.state.confirmCallback = null;
				});
			}
			if (CPManager.elements.confirmationModal && CPManager.elements.confirmProceedBtn) {
				CPManager.elements.confirmProceedBtn.addEventListener("click", () => {
					if (CPManager.state.confirmCallback) CPManager.state.confirmCallback();
					CPManager.ui.hideModal(CPManager.elements.confirmationModal);
					CPManager.state.confirmCallback = null;
				});
			}

			// Generic cancel button handler for modals
			const cancelButtons = document.querySelectorAll('.modal [id^="cancel-"]');
			if (cancelButtons) {
				cancelButtons.forEach((btn) => {
					if (btn && btn.dataset.specificHandlerAttached !== "true") {
						btn.addEventListener("click", () => {
							const modal = btn.closest(".modal");
							if (modal) {
								CPManager.ui.hideModal(modal);
								if (modal.id === "editZoneModal" && CPManager.state.zones.originalFullDataForEdit) {
									CPManager.state.zones.originalFullDataForEdit = null;
								}
							}
						});
						btn.dataset.specificHandlerAttached = "true";
					}
				});
			}

			// Listener for the notifications toggle button with long-press
			const notificationsToggleBtn = document.getElementById("notifications-toggle-btn");
			if (notificationsToggleBtn) {
				let longPressTimer;
				let longPressFired = false;
				const LONG_PRESS_DURATION = 750; // milliseconds

				const handleShortClick = () => {
					// Original click action
					if (CPManager.state.notifications.sessionPollIntervalId) {
						CPManager.notifications.stopSessionPolling();
						CPManager.notifications.updateNotificationToggleState(false); // Corrected: removed second argument
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
						// Check if notifications are conceptually enabled before sending a test
						// The aria-label "Disable sign-in notifications" means the icon is currently 'bell' (enabled)
						if (notificationsToggleBtn.getAttribute("aria-label") === "Disable sign-in notifications") {
							CPManager.app.handleSendTestNotification();
						} else {
							CPManager.ui.showToast("Please enable notifications first to send a test.", "warning");
						}
					}, LONG_PRESS_DURATION);
				};

				const endPress = (event) => {
					event.preventDefault();
					clearTimeout(longPressTimer);
					if (!longPressFired) {
						handleShortClick();
					}
					longPressFired = false;
				};
				
				const cancelPress = () => {
					clearTimeout(longPressTimer);
					longPressFired = false;
				}

				// Mouse events
				notificationsToggleBtn.addEventListener("mousedown", startPress);
				notificationsToggleBtn.addEventListener("mouseup", endPress);
				notificationsToggleBtn.addEventListener("mouseleave", cancelPress); 

				// Touch events
				notificationsToggleBtn.addEventListener("touchstart", startPress, { passive: false }); 
				notificationsToggleBtn.addEventListener("touchend", endPress);
				notificationsToggleBtn.addEventListener("touchcancel", cancelPress); 
			}


			// Call module-specific event initializers, assuming they also handle their own element checks
			if (CPManager.sessions && typeof CPManager.sessions.initializeSessionEventListeners === "function") {
				CPManager.sessions.initializeSessionEventListeners();
			} else {
				console.warn("Sessions module or its initializer not found.");
			}

			if (CPManager.vouchers && typeof CPManager.vouchers.initializeVoucherEventListeners === "function") {
				CPManager.vouchers.initializeVoucherEventListeners();
			} else {
				console.warn("Vouchers module or its initializer not found.");
			}

			if (CPManager.zones && typeof CPManager.zones.initializeZoneEventListeners === "function") {
				CPManager.zones.initializeZoneEventListeners();
			} else {
				console.warn("Zones module or its initializer not found.");
			}

			if (CPManager.dashboard && typeof CPManager.dashboard.initializeDashboardEventListeners === "function") {
				CPManager.dashboard.initializeDashboardEventListeners();
			} else {
				console.warn("Dashboard module or its initializer not found.");
			}
		},

		/**
		 * Core application logic after initial setup. Checks API, loads data, sets active tab.
		 */
		initializeAppLogic: async function () {
			const connected = await CPManager.app.checkApiStatusAndConfig();

			if (connected) {
				document.querySelectorAll("button, input, select").forEach((el) => {
					const isConfigBaseUrl = el.id === "config-api-base-url";
					const isConfigKey = el.id === "config-api-key";
					const isConfigSecret = el.id === "config-api-secret";
					const isSaveCredsBtn = el === CPManager.elements.saveApiCredsBtn;

					if (
						!(isConfigKey || isConfigSecret || isConfigBaseUrl || isSaveCredsBtn) ||
						el === CPManager.elements.clearApiCredsBtn ||
						el === CPManager.elements.themeToggleBtn
					) {
						el.disabled = false;
					} else if (isSaveCredsBtn) {
						el.disabled = true; // Keep save button disabled if already configured and showing main app
					}
				});
				if (CPManager.elements.mainTabs) {
					CPManager.elements.mainTabs
						.querySelectorAll(".tab-btn")
						.forEach((btn) => (btn.style.pointerEvents = "auto"));
				}
				if (CPManager.elements.clearApiCredsBtn) CPManager.elements.clearApiCredsBtn.disabled = false;
				if (CPManager.elements.themeToggleBtn) CPManager.elements.themeToggleBtn.disabled = false;

				await CPManager.sessions.fetchManagerSessionStatus();
				CPManager.ui.disableVoucherActionButtons(false, true, true);

				let initialTab = "dashboard";

				const hashTab = window.location.hash.substring(1);
				if (hashTab && CPManager.elements.tabPanes[hashTab]) {
					initialTab = hashTab;
					if (window.history.replaceState) {
						window.history.replaceState(null, null, window.location.pathname + window.location.search);
					}
				} else {
					try {
						const savedTab = localStorage.getItem("activeHelpdeskTab");
						if (savedTab && CPManager.elements.tabPanes[savedTab]) {
							initialTab = savedTab;
						}
					} catch (e) {
						console.warn("localStorage access error for active tab:", e.message);
					}
				}

				CPManager.tabs.setActiveTab(initialTab, false);

				CPManager.notifications.initializeNotifications();
			} else {
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

				if (CPManager.elements.mainTabs) {
					CPManager.elements.mainTabs
						.querySelectorAll(".tab-btn")
						.forEach((btn) => (btn.style.pointerEvents = "none"));
				}
				if (CPManager.elements.saveApiCredsBtn) CPManager.elements.saveApiCredsBtn.disabled = false;
				if (CPManager.elements.clearApiCredsBtn) CPManager.elements.clearApiCredsBtn.disabled = false;
				if (CPManager.elements.themeToggleBtn) CPManager.elements.themeToggleBtn.disabled = false;

				if (CPManager.elements.applyCpConfigBtn) CPManager.elements.applyCpConfigBtn.disabled = true;

				const dashboardPane = CPManager.elements.tabPanes.dashboard;
				if (dashboardPane && !CPManager.config.baseUrl) {
					if (CPManager.elements.tabPanes)
						Object.values(CPManager.elements.tabPanes).forEach((pane) => {
							if (pane) {
								pane.classList.add("hidden");
								pane.classList.remove("active");
							}
						});
					dashboardPane.classList.remove("hidden");
					dashboardPane.classList.add("active");
					dashboardPane.innerHTML = `<div class="text-center p-8 text-red-500 dark:text-red-400"><i class="fas fa-exclamation-triangle fa-3x mb-3"></i><p>Application configuration (app-config.json) failed to load. Cannot connect.</p></div>`;
				}
			}
		},

		/**
		 * Handles sending a test notification.
		 */
		handleSendTestNotification: async function () {
			console.log("Attempting to send test notification..."); // Debug log
			if (!("Notification" in window)) {
				CPManager.ui.showToast("This browser does not support desktop notifications.", "error");
				return;
			}

			if (!navigator.serviceWorker.controller) {
				CPManager.ui.showToast("Service worker is not active. Cannot send notification.", "warning");
				return;
			}

			let permission = Notification.permission;

			if (permission === "default") {
				// We should await the permission request result before proceeding
				await CPManager.notifications.requestNotificationPermission();
				permission = Notification.permission; // Update permission status
			}

			if (permission === "granted") {
				const testPayload = {
					title: "Test Notification",
					body: "If you see this, notifications are working!",
					icon: "icons/icon-192x192.png",
					id: `test-${new Date().getTime()}`, // Unique ID for the test notification
				};

				navigator.serviceWorker.controller.postMessage({
					type: "SHOW_NOTIFICATION",
					payload: testPayload,
				});
				CPManager.ui.showToast("Test notification sent!", "success");
			} else if (permission === "denied") {
				CPManager.ui.showToast(
					"Notification permission has been denied. Please enable it in your browser settings.",
					"error",
					7000
				);
			}
		},

		/**
		 * Initializes the entire application.
		 */
		initializeApp: async function () {
			CPManager.app.loadTheme();
			try {
				await CPManager.app.loadAppConfiguration();
				CPManager.app.loadApiCredentials();
				CPManager.app.initializeAllEventListeners();
				CPManager.app.registerServiceWorker();
				await CPManager.app.initializeAppLogic();
			} catch (error) {
				console.error("Failed to initialize the application due to configuration load error:", error.message);
				if (CPManager.elements.applyCpConfigBtn) CPManager.elements.applyCpConfigBtn.disabled = true;
				const dashboardPane = CPManager.elements.tabPanes.dashboard;
				if (dashboardPane) {
					if (CPManager.elements.tabPanes) {
						Object.values(CPManager.elements.tabPanes).forEach((pane) => {
							if (pane) {
								pane.classList.add("hidden");
								pane.classList.remove("active");
							}
						});
						dashboardPane.classList.remove("hidden");
						dashboardPane.classList.add("active");
					}
					dashboardPane.innerHTML = `<div class="text-center p-8 text-red-500 dark:text-red-400"><i class="fas fa-exclamation-triangle fa-3x mb-3"></i><p>Critical Error: Application configuration (app-config.json) failed to load. Cannot connect or function.</p><p class="text-sm mt-2">Details: ${error.message}</p></div>`;
				}
				CPManager.app.setCredentialEntryUIMode(true);
			}
		},
	};

	// Initialize the app when the DOM is fully loaded
	document.addEventListener("DOMContentLoaded", CPManager.app.initializeApp);
})(window.CPManager);
