// js/main.js

let confirmCallback = null;
const zoneColors = {}; // Used in utils.js, initialized here or in config.js
const authViaColors = {}; // Used in utils.js, initialized here or in config.js

// Function to apply the current theme (light/dark/system)
function applyTheme(theme) {
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
	if (themeToggleBtn) {
		if (theme === "light") {
			themeToggleBtn.innerHTML = '<i class="fas fa-sun"></i>'; // Sun icon for light theme
			themeToggleBtn.setAttribute("aria-label", "Switch to Dark Mode");
		} else if (theme === "dark") {
			themeToggleBtn.innerHTML = '<i class="fas fa-moon"></i>'; // Moon icon for dark theme
			themeToggleBtn.setAttribute("aria-label", "Switch to System Preference");
		} else {
			// system
			themeToggleBtn.innerHTML = '<i class="fas fa-mobile-alt"></i>'; // Mobile icon for system preference
			themeToggleBtn.setAttribute("aria-label", "Switch to Light Mode");
		}
	}

	// Update meta theme-color (optional, based on actual applied theme)
	// const metaThemeColor = document.querySelector('meta[name="theme-color"]');
	// if (metaThemeColor) {
	//     if (actualTheme === 'dark') {
	//         metaThemeColor.setAttribute('content', '#0F172A'); // Example dark bg
	//     } else {
	//         metaThemeColor.setAttribute('content', '#FFFFFF'); // Example light bg or nav color
	//     }
	// }
}

// Function to toggle the theme between light, dark, and system
function toggleTheme() {
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
	applyTheme(newThemeSetting);

	// Re-initialize chart if it exists, as its colors might depend on the effectively applied theme
	if (typeof dataUsageChart !== "undefined" && dataUsageChart && typeof loadDashboardData === "function") {
		console.log("Theme setting changed, re-loading dashboard data for chart update.");
		if (dataUsageChart) {
			dataUsageChart.destroy();
			dataUsageChart = null;
		}
		if (typeof storeOriginalChartData === "function") {
			storeOriginalChartData(0, 0, 0); // Resetting with zeros
		}
		if (typeof dashboardApiDataCache !== "undefined") {
			dashboardApiDataCache.sessions = null; // Force re-fetch
			dashboardApiDataCache.voucherStats = null; // Force re-fetch
		}
		loadDashboardData(true); // Force refresh dashboard data
	}
}

// Function to load the saved theme from localStorage
function loadTheme() {
	const savedTheme = localStorage.getItem("theme") || "system"; // Default to system
	applyTheme(savedTheme);

	// Listener for system theme changes if "system" is selected
	if (savedTheme === "system") {
		const darkModeMediaQuery = window.matchMedia("(prefers-color-scheme: dark)");
		darkModeMediaQuery.addEventListener("change", () => {
			if (localStorage.getItem("theme") === "system") {
				applyTheme("system");
				// Optionally, refresh chart if visual aspects change significantly
				if (
					typeof dataUsageChart !== "undefined" &&
					dataUsageChart &&
					typeof loadDashboardData === "function"
				) {
					console.log("System theme changed, re-loading dashboard data for chart update.");
					if (dataUsageChart) {
						dataUsageChart.destroy();
						dataUsageChart = null;
					}
					if (typeof storeOriginalChartData === "function") {
						storeOriginalChartData(0, 0, 0);
					}
					if (typeof dashboardApiDataCache !== "undefined") {
						dashboardApiDataCache.sessions = null;
						dashboardApiDataCache.voucherStats = null;
					}
					loadDashboardData(true);
				}
			}
		});
	}
}

// Function to control the UI mode for credential entry
function setCredentialEntryUIMode(isEntryMode) {
	// Assuming these elements are globally accessible constants from ui.js or queried here
	const navElement = document.querySelector("nav");
	const mainTabsContainerElement = document.getElementById("mainTabs")?.closest(".mb-4.border-b"); // Use var from CSS
	const tabContentElement = document.getElementById("tabContent");
	const footerElement = document.querySelector("footer");
	// configInputSection is a const from ui.js
	// mainContentScrollArea is an ID from index.html
	const mainContentScrollAreaElement = document.getElementById("main-content-scroll-area");

	if (isEntryMode) {
		if (navElement) navElement.style.display = "none";
		if (mainTabsContainerElement) mainTabsContainerElement.style.display = "none";
		if (tabContentElement) tabContentElement.style.display = "none";
		if (footerElement) footerElement.style.display = "none";

		if (configInputSection) {
			// Assumes configInputSection is available globally from ui.js
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
}

async function loadAppConfiguration() {
	try {
		const response = await fetch("./app-config.json");
		if (!response.ok) {
			// If app-config.json isn't found or is empty, we can still proceed,
			// but the baseUrl will need to be provided by the user.
			console.warn(
				`Failed to fetch app-config.json: ${response.status} ${response.statusText}. Will rely on user input for API Base URL.`
			);
			OPNsenseConfig.baseUrl = ""; // Explicitly set to empty string if file not found/parseable
			return; // Do not throw, allow app to proceed to credential prompt
		}
		const appConfigData = await response.json();
		if (appConfigData.apiBaseUrl) {
			OPNsenseConfig.baseUrl = appConfigData.apiBaseUrl;
			console.log("Application configuration loaded. API Base URL set to:", OPNsenseConfig.baseUrl);
		} else {
			console.warn("apiBaseUrl not found in app-config.json. Will rely on user input for API Base URL.");
			OPNsenseConfig.baseUrl = ""; // Set to empty if key is missing in the JSON
		}
	} catch (error) {
		console.error("Error loading application configuration (JSON parse error or network issue):", error.message);
		// This is a more critical error if the file exists but is malformed.
		// Still, setting to empty string and allowing user input is a fallback.
		OPNsenseConfig.baseUrl = "";
		if (typeof apiStatusFooterText !== "undefined" && apiStatusFooterText) {
			apiStatusFooterText.textContent = "App Config Load Failed!";
			apiStatusFooterText.className = "font-semibold text-red-500 dark:text-red-400";
		}
		showToast(
			`Warning: App configuration file failed to load. Please enter API Base URL manually. Error: ${error.message}`,
			"warning",
			10000
		);
	}
}

function registerServiceWorker() {
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
}

function loadApiCredentials() {
	currentApiKey = localStorage.getItem("opnsenseApiKey") || "";
	currentApiSecret = localStorage.getItem("opnsenseApiSecret") || "";
	// Load API Base URL from local storage, if available
	OPNsenseConfig.baseUrl = localStorage.getItem("opnsenseApiBaseUrl") || OPNsenseConfig.baseUrl || ""; // Prioritize stored, then existing, then empty

	// Assumes configApiKeyInput, configApiSecretInput, configApiBaseUrlInput are global consts from ui.js
	if (typeof configApiKeyInput !== "undefined" && configApiKeyInput) configApiKeyInput.value = currentApiKey;
	if (typeof configApiSecretInput !== "undefined" && configApiSecretInput)
		configApiSecretInput.value = currentApiSecret;
	if (typeof configApiBaseUrlInput !== "undefined" && configApiBaseUrlInput)
		configApiBaseUrlInput.value = OPNsenseConfig.baseUrl;
}

async function saveApiCredentials() {
	// Assumes configApiKeyInput, configApiSecretInput, configApiBaseUrlInput are global consts from ui.js
	if (!configApiKeyInput || !configApiSecretInput || !configApiBaseUrlInput) return; // Added configApiBaseUrlInput

	currentApiKey = configApiKeyInput.value.trim();
	currentApiSecret = configApiSecretInput.value.trim();
	OPNsenseConfig.baseUrl = configApiBaseUrlInput.value.trim(); // Get from input

	if (!OPNsenseConfig.baseUrl) {
		// Validate Base URL
		showToast("OPNsense API Base URL cannot be empty.", "error");
		return;
	}
	// Basic URL validation
	try {
		new URL(OPNsenseConfig.baseUrl);
	} catch (e) {
		showToast(
			"Invalid OPNsense API Base URL format. Please enter a valid URL (e.g., https://192.168.1.1).",
			"error"
		);
		return;
	}

	if (currentApiKey && currentApiSecret) {
		try {
			localStorage.setItem("opnsenseApiKey", currentApiKey);
			localStorage.setItem("opnsenseApiSecret", currentApiSecret);
			localStorage.setItem("opnsenseApiBaseUrl", OPNsenseConfig.baseUrl); // Save Base URL
			showToast("API credentials and Base URL saved to browser local storage.", "success");
			// setCredentialEntryUIMode(false) will be called by checkApiStatusAndConfig via initializeAppLogic

			await initializeAppLogic(); // This re-evaluates connection and UI state

			// Force refresh the active tab's data
			let currentActiveTabId = "dashboard"; // Default to dashboard
			const activeTabSetting =
				localStorage.getItem("theme") === "system"
					? "system"
					: localStorage.getItem("activeHelpdeskTab") || "dashboard";

			try {
				const savedTab = localStorage.getItem("activeHelpdeskTab");
				// Assumes tabPanes is global from ui.js
				if (savedTab && typeof tabPanes !== "undefined" && tabPanes[savedTab]) {
					currentActiveTabId = savedTab;
				}
			} catch (e) {
				console.warn("localStorage access error for active tab during credential save refresh:", e.message);
			}

			if (typeof setActiveTab === "function") {
				console.log(
					`saveApiCredentials: Forcing refresh for tab: ${currentActiveTabId} after saving credentials.`
				);
				setActiveTab(currentActiveTabId, true);
			}
		} catch (e) {
			showToast("Failed to save credentials to local storage. Storage might be full or disabled.", "error");
			console.error("Error saving to localStorage:", e);
		}
	} else {
		showToast("API Key and Secret cannot be empty.", "error");
	}
}

function clearApiCredentials() {
	// Assumes configApiKeyInput, configApiSecretInput, configApiBaseUrlInput are global consts from ui.js
	try {
		localStorage.removeItem("opnsenseApiKey");
		localStorage.removeItem("opnsenseApiSecret");
		localStorage.removeItem("opnsenseApiBaseUrl"); // Clear Base URL
	} catch (e) {
		console.error("Error clearing localStorage:", e);
	}
	currentApiKey = "";
	currentApiSecret = "";
	OPNsenseConfig.baseUrl = ""; // Clear the in-memory config as well
	if (configApiKeyInput) configApiKeyInput.value = "";
	if (configApiSecretInput) configApiSecretInput.value = "";
	if (configApiBaseUrlInput) configApiBaseUrlInput.value = ""; // Clear Base URL input

	showToast("API credentials cleared from local storage.", "info");
	setCredentialEntryUIMode(true); // Activate special UI mode

	// Disable buttons and inputs
	// Assumes saveApiCredsBtn, clearApiCredsBtn are global consts from ui.js
	document.querySelectorAll("button").forEach((el) => {
		if (
			el !== saveApiCredsBtn &&
			el !== clearApiCredsBtn &&
			!el.id.startsWith("confirm-") &&
			!el.id.startsWith("cancel-") &&
			el !== themeToggleBtn
		) {
			el.disabled = true;
		}
	});
	document
		.querySelectorAll("input:not(#config-api-key):not(#config-api-secret):not(#config-api-base-url), select") // Added config-api-base-url
		.forEach((el) => (el.disabled = true));

	// Assumes mainTabs, apiStatusFooterText are global consts from ui.js
	if (mainTabs) {
		mainTabs.querySelectorAll(".tab-btn").forEach((btn) => (btn.style.pointerEvents = "none"));
	}
	if (apiStatusFooterText) {
		apiStatusFooterText.textContent = "Credentials Cleared";
		apiStatusFooterText.className = "font-semibold text-yellow-500 dark:text-yellow-400";
	}

	// Clear UI content
	// Assumes sessionCardContainer, voucherCardContainer, zoneListContainer, dashboardStatsContainer, donutTotalData are global from ui.js
	if (sessionCardContainer && typeof clearContainer === "function") clearContainer(sessionCardContainer);
	if (voucherCardContainer && typeof clearContainer === "function") clearContainer(voucherCardContainer);
	if (zoneListContainer && typeof clearContainer === "function") clearContainer(zoneListContainer);
	if (dashboardStatsContainer && typeof clearContainer === "function") clearContainer(dashboardStatsContainer);

	// Assumes dataUsageChart is a global variable for the chart instance
	if (typeof dataUsageChart !== "undefined" && dataUsageChart) {
		dataUsageChart.destroy();
		dataUsageChart = null;
		if (typeof dashboardApiDataCache !== "undefined") {
			// dashboardApiDataCache from dashboard.js
			dashboardApiDataCache = { sessions: null, voucherStats: null };
		}
		if (typeof storeOriginalChartData === "function") {
			// Reset original chart data
			storeOriginalChartData(0, 0, 0);
		}
	}
	if (donutTotalData && typeof placeholderValue !== "undefined") donutTotalData.textContent = placeholderValue; // placeholderValue from config.js

	// Reset data caches
	if (typeof allSessions !== "undefined") allSessions = []; // from sessions.js
	if (typeof cachedVoucherProviders !== "undefined") cachedVoucherProviders = []; // from vouchers.js
	if (typeof cachedVoucherGroups !== "undefined") cachedVoucherGroups = {}; // from vouchers.js
	if (typeof cachedVouchersData !== "undefined") cachedVouchersData = {}; // from vouchers.js
	if (typeof allConfiguredZones !== "undefined") allConfiguredZones = []; // from zones.js
}

async function checkApiStatusAndConfig() {
	// Assumes apiStatusFooterText, configInputSection, mainTabs are global consts from ui.js
	if (!OPNsenseConfig.baseUrl) {
		if (apiStatusFooterText) {
			apiStatusFooterText.textContent = "API Base URL Missing!";
			apiStatusFooterText.className = "font-semibold text-red-500 dark:text-red-400";
		}
		showToast("Critical: OPNsense API Base URL is missing. Please configure it.", "error", 10000);
		setCredentialEntryUIMode(true); // Show credential UI
		// Also disable everything except credential inputs and theme toggle
		document
			.querySelectorAll(
				'button:not(#save-api-creds-btn):not(#clear-api-creds-btn):not([id^="confirm-"]):not([id^="cancel-"]):not(#theme-toggle-btn)'
			)
			.forEach((el) => (el.disabled = true));
		document
			.querySelectorAll("input:not(#config-api-key):not(#config-api-secret):not(#config-api-base-url), select")
			.forEach((el) => (el.disabled = true));
		if (mainTabs) mainTabs.querySelectorAll(".tab-btn").forEach((btn) => (btn.style.pointerEvents = "none"));
		return false;
	}

	if (!currentApiKey || !currentApiSecret) {
		if (apiStatusFooterText) {
			apiStatusFooterText.textContent = "Credentials Missing!";
			apiStatusFooterText.className = "font-semibold text-yellow-500 dark:text-yellow-400";
		}
		setCredentialEntryUIMode(true); // Activate special UI mode

		// Disable buttons
		document
			.querySelectorAll(
				'button:not(#save-api-creds-btn):not(#clear-api-creds-btn):not([id^="confirm-"]):not([id^="cancel-"]):not(#theme-toggle-btn)'
			)
			.forEach((el) => (el.disabled = true));
		document
			.querySelectorAll("input:not(#config-api-key):not(#config-api-secret):not(#config-api-base-url), select")
			.forEach((el) => (el.disabled = true));
		if (mainTabs) mainTabs.querySelectorAll(".tab-btn").forEach((btn) => (btn.style.pointerEvents = "none"));
		return false;
	}

	setCredentialEntryUIMode(false); // Credentials seem present, switch to normal UI before API test

	try {
		await fetchAllZoneData(); // Test API connection and get zone list (uses cache by default)
		// allConfiguredZones is from zones.js
		const initialCheckData = typeof allConfiguredZones !== "undefined" ? allConfiguredZones : null;

		if (Array.isArray(initialCheckData)) {
			if (apiStatusFooterText) {
				apiStatusFooterText.textContent = "Connected";
				apiStatusFooterText.className = "font-semibold text-green-600 dark:text-green-400";
			}
			return true;
		} else {
			// Unexpected response format from API check
			if (apiStatusFooterText) {
				apiStatusFooterText.textContent = "Connection Problematic";
				apiStatusFooterText.className = "font-semibold text-yellow-500 dark:text-yellow-400";
			}
			console.warn("Initial API check (fetchAllZoneData) returned unexpected data format:", initialCheckData);
			showToast("API connection check returned unexpected data. App might not function correctly.", "warning");
			// Don't revert to credential mode here unless it's an auth error (handled below)
			return false;
		}
	} catch (error) {
		// API call failed
		if (apiStatusFooterText) {
			apiStatusFooterText.textContent = "Connection Failed";
			apiStatusFooterText.className = "font-semibold text-red-500 dark:text-red-400";
		}
		console.error("Initial API check (fetchAllZoneData) failed:", error.message);
		if (error.message.includes("401") || error.message.includes("Unauthorized")) {
			setCredentialEntryUIMode(true); // Auth error, so show credential input
			showToast("API authentication failed. Please check your API Key and Secret.", "error", 10000); // Specific error message
		} else if (error.message.includes("Failed to fetch")) {
			// This typically means network error, CORS, or incorrect URL
			showToast(
				"Cannot reach OPNsense API. Please check your Base URL, network, and CORS settings.",
				"error",
				10000
			);
			setCredentialEntryUIMode(true); // Assume it's a URL issue or a network one that needs user attention to URL.
		}
		return false;
	}
}
/**
 * Handles the click of the global "Apply Captive Portal Configuration" button.
 * Calls the service/reconfigure endpoint.
 */
async function handleApplyCpConfiguration() {
	// Assumes applyCpConfigBtn is global from ui.js
	if (!applyCpConfigBtn) return;

	const originalButtonText = applyCpConfigBtn.innerHTML;
	applyCpConfigBtn.disabled = true;
	applyCpConfigBtn.innerHTML = '<i class="fas fa-spinner fa-spin mr-2"></i>Applying...';
	showToast("Applying Captive Portal configuration changes...", "info");

	try {
		const reconfigResult = await callApi("/service/reconfigure", "POST", {});
		if (
			reconfigResult &&
			(reconfigResult.status === "ok" ||
				(reconfigResult.message && reconfigResult.message.toLowerCase().includes("ok")))
		) {
			showToast("Captive Portal service reconfigured successfully.", "success");
		} else {
			const errorDetail = reconfigResult
				? reconfigResult.status || reconfigResult.message || JSON.stringify(reconfigResult)
				: "Unknown response";
			showToast(`Service reconfigure attempt finished. Status: ${errorDetail}`, "warning");
			console.warn('Reconfigure result not explicitly "ok":', reconfigResult);
		}
	} catch (error) {
		// Error toast is handled by callApi
		console.error("Error during manual reconfigure call:", error.message);
	} finally {
		applyCpConfigBtn.disabled = false;
		applyCpConfigBtn.innerHTML = originalButtonText;
	}
}

function initializeAllEventListeners() {
	// Theme toggle button
	if (themeToggleBtn) {
		// themeToggleBtn from ui.js
		themeToggleBtn.addEventListener("click", toggleTheme); // toggleTheme from main.js
	}

	// API Credentials Buttons
	if (saveApiCredsBtn) saveApiCredsBtn.addEventListener("click", saveApiCredentials);
	if (clearApiCredsBtn) clearApiCredsBtn.addEventListener("click", clearApiCredentials);

	// Apply CP Config Button
	if (applyCpConfigBtn) applyCpConfigBtn.addEventListener("click", handleApplyCpConfiguration);

	initializeTabs(); // From tabs.js

	// Confirmation Modal Buttons
	if (confirmationModal && confirmCancelBtn) {
		confirmCancelBtn.addEventListener("click", () => {
			hideModal(confirmationModal); // hideModal from ui.js
			confirmCallback = null; // confirmCallback from main.js
		});
	}
	if (confirmationModal && confirmProceedBtn) {
		confirmProceedBtn.addEventListener("click", () => {
			if (confirmCallback) confirmCallback();
			hideModal(confirmationModal); // hideModal from ui.js
			confirmCallback = null; // confirmCallback from main.js
		});
	}

	// Generic cancel button handler for modals
	document.querySelectorAll('.modal [id^="cancel-"]').forEach((btn) => {
		if (btn.dataset.specificHandlerAttached !== "true") {
			btn.addEventListener("click", () => {
				const modal = btn.closest(".modal");
				if (modal) {
					hideModal(modal);
					if (modal.id === "editZoneModal" && typeof originalFullZoneDataForEdit !== "undefined") {
						// originalFullZoneDataForEdit from zones.js
						originalFullZoneDataForEdit = null;
					}
				}
			});
			btn.dataset.specificHandlerAttached = "true";
		}
	});

	// Listener for the notifications toggle button
	const notificationsToggleBtn = document.getElementById("notifications-toggle-btn"); // Make sure this ID matches your HTML
	if (notificationsToggleBtn) {
		notificationsToggleBtn.addEventListener("click", () => {
			if (typeof sessionPollIntervalId !== "undefined" && sessionPollIntervalId) {
				// sessionPollIntervalId from notifications.js
				if (typeof stopSessionPolling === "function") stopSessionPolling(); // stopSessionPolling from notifications.js
				if (typeof updateNotificationToggleState === "function") updateNotificationToggleState(false); // updateNotificationToggleState from notifications.js
				if (typeof showToast === "function") showToast("Sign-in notifications disabled.", "info"); // showToast from ui.js
			} else {
				if (typeof requestNotificationPermission === "function") requestNotificationPermission(); // requestNotificationPermission from notifications.js
			}
		});
	}

	// START: New listener for the Test Notification button
	const testNotificationBtn = document.getElementById("test-notification-btn");
	if (testNotificationBtn) {
		testNotificationBtn.addEventListener("click", handleSendTestNotification);
	}
	// END: New listener

	initializeSessionEventListeners(); // From sessions.js
	initializeVoucherEventListeners(); // From vouchers.js
	initializeZoneEventListeners(); // From zones.js
	initializeDashboardEventListeners(); // From dashboard.js
}

async function initializeAppLogic() {
	const connected = await checkApiStatusAndConfig();
	// Assumes saveApiCredsBtn, clearApiCredsBtn, mainTabs, applyCpConfigBtn are global from ui.js
	// Assumes tabPanes is global from ui.js

	if (connected) {
		// Enable all relevant buttons, inputs, selects
		document.querySelectorAll("button, input, select").forEach((el) => {
			// Check if the element is NOT part of the config input section (unless it's clearApiCredsBtn)
			const isConfigBaseUrl = el.id === "config-api-base-url"; // NEW
			const isConfigKey = el.id === "config-api-key";
			const isConfigSecret = el.id === "config-api-secret";
			const isSaveCredsBtn = el === saveApiCredsBtn;

			if (
				!(isConfigKey || isConfigSecret || isConfigBaseUrl || isSaveCredsBtn) || // NEW
				el === clearApiCredsBtn ||
				el === themeToggleBtn
			) {
				el.disabled = false;
			} else if (isSaveCredsBtn) {
				// saveApiCredsBtn should be disabled if not in credential entry mode
				el.disabled = true;
			}
		});
		if (mainTabs) {
			mainTabs.querySelectorAll(".tab-btn").forEach((btn) => (btn.style.pointerEvents = "auto"));
		}
		if (clearApiCredsBtn) clearApiCredsBtn.disabled = false; // Always enable if creds exist.
		if (themeToggleBtn) themeToggleBtn.disabled = false; // Always enable theme toggle

		if (typeof fetchManagerSessionStatus === "function") await fetchManagerSessionStatus();
		// disableVoucherActionButtons is from vouchers.js
		if (typeof disableVoucherActionButtons === "function") disableVoucherActionButtons(false, true, true); // sensible defaults on load

		let initialTab = "dashboard"; // Default to dashboard

		// Check URL hash first for navigation from notifications
		const hashTab = window.location.hash.substring(1); // Remove '#'
		if (hashTab && tabPanes && tabPanes[hashTab]) {
			initialTab = hashTab;
			// Clear the hash from the URL to prevent re-triggering on subsequent loads/refreshes
			// and to not persist notification navigation state if user navigates manually.
			if (window.history.replaceState) {
				window.history.replaceState(null, null, window.location.pathname + window.location.search);
			}
		} else {
			// If no valid hash, try localStorage
			try {
				const savedTab = localStorage.getItem("activeHelpdeskTab");
				if (savedTab && tabPanes && tabPanes[savedTab]) {
					initialTab = savedTab;
				}
			} catch (e) {
				console.warn("localStorage access error for active tab:", e.message);
			}
		}

		if (typeof setActiveTab === "function") {
			// setActiveTab is from tabs.js
			setActiveTab(initialTab, false); // Load initial tab, use cache if available
		} else {
			console.error("setActiveTab function is not defined. Tabs will not initialize correctly.");
		}

		// Initialize notifications feature
		if (typeof initializeNotifications === "function") {
			// initializeNotifications is from notifications.js
			initializeNotifications();
		}
	} else {
		// Not connected
		// Disable most buttons/inputs, except those in the config section and theme toggle
		document
			.querySelectorAll(
				'button:not(#save-api-creds-btn):not(#clear-api-creds-btn):not([id^="confirm-"]):not([id^="cancel-"]):not(#theme-toggle-btn)'
			)
			.forEach((el) => (el.disabled = true));
		document
			.querySelectorAll("input:not(#config-api-key):not(#config-api-secret):not(#config-api-base-url), select") // Added config-api-base-url
			.forEach((el) => (el.disabled = true));

		if (mainTabs) {
			mainTabs.querySelectorAll(".tab-btn").forEach((btn) => (btn.style.pointerEvents = "none"));
		}
		if (saveApiCredsBtn) saveApiCredsBtn.disabled = false; // Enable save if config section is shown
		if (clearApiCredsBtn) clearApiCredsBtn.disabled = false; // Always enable clear
		if (themeToggleBtn) themeToggleBtn.disabled = false; // Theme toggle should always be enabled

		if (applyCpConfigBtn) applyCpConfigBtn.disabled = true;

		// Handle dashboard display if not connected
		const dashboardPane = tabPanes ? tabPanes.dashboard : null;
		if (dashboardPane && !OPNsenseConfig.baseUrl) {
			// Critical: app-config.json failed
			if (tabPanes)
				Object.values(tabPanes).forEach((pane) => {
					if (pane) {
						pane.classList.add("hidden");
						pane.classList.remove("active");
					}
				});
			dashboardPane.classList.remove("hidden");
			dashboardPane.classList.add("active");
			dashboardPane.innerHTML = `<div class="text-center p-8 text-red-500 dark:text-red-400"><i class="fas fa-exclamation-triangle fa-3x mb-3"></i><p>Application configuration (app-config.json) failed to load. Cannot connect.</p></div>`;
		} else if (dashboardPane && OPNsenseConfig.baseUrl && (!currentApiKey || !currentApiSecret)) {
			// If in credential input mode, dashboard is hidden by setCredentialEntryUIMode, so no need to overwrite its content here.
			// The message about missing creds is implicitly handled by the dedicated UI mode.
		}
	}
}

/**
 * Handles sending a test notification.
 */
async function handleSendTestNotification() {
	if (!("Notification" in window)) {
		showToast("This browser does not support desktop notifications.", "error"); // showToast is from ui.js
		return;
	}

	if (!navigator.serviceWorker.controller) {
		showToast("Service worker is not active. Cannot send notification.", "warning");
		return;
	}

	let permission = Notification.permission;

	if (permission === "default") {
		// requestNotificationPermission is from notifications.js and handles its own toasts/UI updates
		await requestNotificationPermission();
		permission = Notification.permission; // Re-check permission after request
	}

	if (permission === "granted") {
		const testPayload = {
			title: "Test Notification",
			body: "If you see this, notifications are working!",
			icon: "icons/icon-192x192.png", // As used in sw.js
			// Use a unique ID for the tag to ensure it's a new notification and doesn't replace others unexpectedly
			id: `test-${new Date().getTime()}`,
		};

		navigator.serviceWorker.controller.postMessage({
			// Assumes service worker is active and controlling
			type: "SHOW_NOTIFICATION",
			payload: testPayload,
		});
		showToast("Test notification sent!", "success");
	} else if (permission === "denied") {
		showToast("Notification permission has been denied. Please enable it in your browser settings.", "error", 7000);
	}
	// If permission is still 'default' after the request attempt,
	// requestNotificationPermission() would have already shown a relevant toast.
}

async function initializeApp() {
	// Assumes applyCpConfigBtn, tabPanes are global from ui.js
	loadTheme(); // Load theme preference early
	try {
		await loadAppConfiguration(); // Must complete before anything else
		loadApiCredentials();
		initializeAllEventListeners(); // Setup all static event listeners
		registerServiceWorker();
		await initializeAppLogic(); // Check connection, set initial UI state and load tab
	} catch (error) {
		// This catch is mainly for loadAppConfiguration failure
		console.error("Failed to initialize the application due to configuration load error:", error.message);
		if (applyCpConfigBtn) applyCpConfigBtn.disabled = true;
		const dashboardPane =
			typeof tabPanes !== "undefined" && tabPanes
				? tabPanes.dashboard
				: document.getElementById("dashboard-content");
		if (dashboardPane) {
			if (typeof tabPanes !== "undefined" && tabPanes) {
				Object.values(tabPanes).forEach((pane) => {
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
		// Also ensure credential entry mode is active if config load failed, as API calls won't work.
		setCredentialEntryUIMode(true);
	}
}

document.addEventListener("DOMContentLoaded", initializeApp);
