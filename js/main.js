// js/main.js

// (Existing code: loadAppConfiguration, registerServiceWorker, credential functions, checkApiStatusAndConfig, etc.)
// ...
let confirmCallback = null;
const zoneColors = {};
const authViaColors = {};

async function loadAppConfiguration() {
    try {
        const response = await fetch('./app-config.json');
        if (!response.ok) {
            throw new Error(`Failed to fetch app-config.json: ${response.status} ${response.statusText}`);
        }
        const appConfigData = await response.json();
        if (appConfigData.apiBaseUrl) {
            OPNsenseConfig.baseUrl = appConfigData.apiBaseUrl;
            console.log("Application configuration loaded. API Base URL set to:", OPNsenseConfig.baseUrl);
        } else {
            throw new Error("apiBaseUrl not found in app-config.json");
        }
    } catch (error) {
        console.error("Error loading application configuration:", error.message);
        if (apiStatusFooterText) {
            apiStatusFooterText.textContent = 'App Config Load Failed!';
            apiStatusFooterText.className = 'font-semibold text-red-500';
        }
        showToast(`Critical: Failed to load app configuration. API calls will likely fail. Error: ${error.message}`, 'error', 10000);
        throw error;
    }
}

function registerServiceWorker() {
    if ('serviceWorker' in navigator) {
        navigator.serviceWorker.register('./sw.js')
            .then((reg) => {
                console.log('Service worker registered successfully:', reg.scope);
            })
            .catch((err) => {
                console.error('Service worker registration failed:', err);
            });
        let refreshing;
        navigator.serviceWorker.addEventListener('controllerchange', () => {
            if (refreshing) return;
            console.log('Service Worker: Controller changed. Page will reload.');
            window.location.reload();
            refreshing = true;
        });
    }
}

function loadApiCredentials() {
    currentApiKey = localStorage.getItem('opnsenseApiKey') || '';
    currentApiSecret = localStorage.getItem('opnsenseApiSecret') || '';
    if (configApiKeyInput) configApiKeyInput.value = currentApiKey;
    if (configApiSecretInput) configApiSecretInput.value = currentApiSecret;
}

async function saveApiCredentials() {
    if (!configApiKeyInput || !configApiSecretInput) return;
    currentApiKey = configApiKeyInput.value.trim();
    currentApiSecret = configApiSecretInput.value.trim();
    if (currentApiKey && currentApiSecret) {
        try {
            localStorage.setItem('opnsenseApiKey', currentApiKey);
            localStorage.setItem('opnsenseApiSecret', currentApiSecret);
            showToast('API credentials saved to browser local storage.', 'success');
            if (configInputSection) configInputSection.classList.add('hidden');
            await initializeAppLogic();
        } catch (e) {
            showToast('Failed to save credentials to local storage. Storage might be full or disabled.', 'error');
            console.error("Error saving to localStorage:", e);
        }
    } else {
        showToast('API Key and Secret cannot be empty.', 'error');
    }
}

function clearApiCredentials() {
    try {
        localStorage.removeItem('opnsenseApiKey');
        localStorage.removeItem('opnsenseApiSecret');
    } catch (e) {
        console.error("Error clearing localStorage:", e);
    }
    currentApiKey = '';
    currentApiSecret = '';
    if (configApiKeyInput) configApiKeyInput.value = '';
    if (configApiSecretInput) configApiSecretInput.value = '';
    showToast('API credentials cleared from local storage.', 'info');
    if (configInputSection) configInputSection.classList.remove('hidden');
    document.querySelectorAll('button:not(#save-api-creds-btn):not(#clear-api-creds-btn):not([id^="confirm-"]):not([id^="cancel-"])')
        .forEach(el => el.disabled = true);
    document.querySelectorAll('input:not(#config-api-key):not(#config-api-secret), select')
        .forEach(el => el.disabled = true);
    if (mainTabs) {
        mainTabs.querySelectorAll('.tab-btn').forEach(btn => btn.style.pointerEvents = 'none');
    }
    if (apiStatusFooterText) {
        apiStatusFooterText.textContent = 'Credentials Cleared';
        apiStatusFooterText.className = 'font-semibold text-yellow-500';
    }
    if (sessionCardContainer) clearContainer(sessionCardContainer);
    if (voucherCardContainer) clearContainer(voucherCardContainer);
    if (zoneListContainer) clearContainer(zoneListContainer);
    if (dashboardStatsContainer) clearContainer(dashboardStatsContainer);
    if (dataUsageChart) { // Clear dashboard chart if it exists
        dataUsageChart.destroy();
        dataUsageChart = null;
        // Also reset dashboard cache
        if (typeof dashboardApiDataCache !== 'undefined') {
            dashboardApiDataCache = { sessions: null, voucherStats: null };
        }
    }
    if (donutTotalData) donutTotalData.textContent = placeholderValue;

    // Reset other caches as well upon clearing credentials
    if (typeof allSessions !== 'undefined') allSessions = [];
    if (typeof cachedVoucherProviders !== 'undefined') cachedVoucherProviders = [];
    if (typeof cachedVoucherGroups !== 'undefined') cachedVoucherGroups = {};
    if (typeof cachedVouchersData !== 'undefined') cachedVouchersData = {};
    if (typeof allConfiguredZones !== 'undefined') allConfiguredZones = []; // zones.js cache
}

async function checkApiStatusAndConfig() {
    if (!OPNsenseConfig.baseUrl) {
        if (apiStatusFooterText) apiStatusFooterText.textContent = 'API Base URL Missing from Config!';
        showToast('Critical: API Base URL not loaded from app-config.json. Cannot connect to API.', 'error', 10000);
        return false;
    }
    if (!currentApiKey || !currentApiSecret) {
        if (apiStatusFooterText) apiStatusFooterText.textContent = 'Credentials Missing!';
        if (configInputSection) configInputSection.classList.remove('hidden');
        document.querySelectorAll('button:not(#save-api-creds-btn):not(#clear-api-creds-btn):not([id^="confirm-"]):not([id^="cancel-"])')
            .forEach(el => el.disabled = true);
        document.querySelectorAll('input:not(#config-api-key):not(#config-api-secret), select')
            .forEach(el => el.disabled = true);
        if(mainTabs) mainTabs.querySelectorAll('.tab-btn').forEach(btn => btn.style.pointerEvents = 'none');
        return false;
    }
    if (configInputSection) configInputSection.classList.add('hidden');
    try {
        // fetchAllZoneData itself has caching, called here to confirm API connectivity and get zone list early
        await fetchAllZoneData(); // Defaults to forceRefresh = false, uses cache if available
        const initialCheckData = allConfiguredZones; // Use the (potentially cached) result

        if (Array.isArray(initialCheckData)) { // Check if we got a valid array (even if empty)
            if (apiStatusFooterText) {
                apiStatusFooterText.textContent = 'Connected';
                apiStatusFooterText.className = 'font-semibold text-green-600';
            }
            return true;
        } else {
            if (apiStatusFooterText) {
                apiStatusFooterText.textContent = 'Connection Problematic';
                apiStatusFooterText.className = 'font-semibold text-yellow-500';
            }
            console.warn("Initial API check (via fetchAllZoneData) returned unexpected data format:", initialCheckData);
            showToast('API connection check returned unexpected data. App might not function correctly.', 'warning');
            return false;
        }
    } catch (error) {
        if (apiStatusFooterText) {
            apiStatusFooterText.textContent = 'Connection Failed';
            apiStatusFooterText.className = 'font-semibold text-red-500';
        }
        console.error("Initial API check (via fetchAllZoneData) failed:", error.message);
        if (error.message.includes("401") || error.message.includes("Unauthorized")) {
            if (configInputSection) configInputSection.classList.remove('hidden');
        }
        return false;
    }
}

/**
 * Handles the click of the global "Apply Captive Portal Configuration" button.
 * Calls the service/reconfigure endpoint.
 */
async function handleApplyCpConfiguration() {
    if (!applyCpConfigBtn) return;

    const originalButtonText = applyCpConfigBtn.innerHTML;
    applyCpConfigBtn.disabled = true;
    applyCpConfigBtn.innerHTML = '<i class="fas fa-spinner fa-spin mr-2"></i>Applying...';
    showToast('Applying Captive Portal configuration changes...', 'info');

    try {
        const reconfigResult = await callApi('/service/reconfigure', 'POST', {}); // Assuming callApi is globally available
        if (reconfigResult && (reconfigResult.status === 'ok' || (reconfigResult.message && reconfigResult.message.toLowerCase().includes('ok')))) {
            showToast('Captive Portal service reconfigured successfully.', 'success');
            // Optionally, you might want to reload data in the current tab or dashboard with forceRefresh = true
            const activeTabId = localStorage.getItem('activeHelpdeskTab');
            if (activeTabId && typeof setActiveTab === 'function') {
                 // Re-call setActiveTab for the current tab with forceRefreshData = true
                 // This will trigger the respective load function with forceRefreshData = true
                 // setActiveTab(activeTabId, true); // Commented out as it might be too aggressive, specific refresh buttons are better
                 // Or, more targeted:
                 // if (activeTabId === 'dashboard' && typeof loadDashboardData === 'function') loadDashboardData(true);
                 // else if (activeTabId === 'info' && typeof loadZoneInfo === 'function') loadZoneInfo(true);
                 // ... etc.
            }
        } else {
            const errorDetail = reconfigResult ? (reconfigResult.status || reconfigResult.message || JSON.stringify(reconfigResult)) : 'Unknown response';
            showToast(`Service reconfigure attempt finished. Status: ${errorDetail}`, 'warning');
            console.warn('Reconfigure result not explicitly "ok":', reconfigResult);
        }
    } catch (error) {
        console.error("Error during manual reconfigure call:", error.message);
    } finally {
        applyCpConfigBtn.disabled = false;
        applyCpConfigBtn.innerHTML = originalButtonText;
    }
}

function initializeAllEventListeners() {
    if (saveApiCredsBtn) saveApiCredsBtn.addEventListener('click', saveApiCredentials);
    if (clearApiCredsBtn) clearApiCredsBtn.addEventListener('click', clearApiCredentials);

    if (applyCpConfigBtn) {
        applyCpConfigBtn.addEventListener('click', handleApplyCpConfiguration);
    }

    initializeTabs(); // From tabs.js
    if (confirmationModal && confirmCancelBtn) {
        confirmCancelBtn.addEventListener('click', () => {
            hideModal(confirmationModal);
            confirmCallback = null;
        });
    }
    if (confirmationModal && confirmProceedBtn) {
        confirmProceedBtn.addEventListener('click', () => {
            if (confirmCallback) confirmCallback();
            hideModal(confirmationModal);
            confirmCallback = null;
        });
    }
    document.querySelectorAll('.modal [id^="cancel-"]').forEach(btn => {
        if (!btn.dataset.specificHandlerAttached) {
            btn.addEventListener('click', () => {
                const modal = btn.closest('.modal');
                if (modal) {
                    hideModal(modal);
                    if (modal.id === 'editZoneModal' && typeof originalFullZoneDataForEdit !== 'undefined') {
                        originalFullZoneDataForEdit = null;
                    }
                }
            });
        }
    });
    initializeSessionEventListeners();
    initializeVoucherEventListeners();
    initializeZoneEventListeners();
    initializeDashboardEventListeners();
}

async function initializeAppLogic() {
    const connected = await checkApiStatusAndConfig();

    if (connected) {
        document.querySelectorAll('button:not([id^="confirm-"]):not([id^="cancel-"]), input, select').forEach(el => {
            if (el.id !== 'config-api-key' && el.id !== 'config-api-secret' && el.id !== 'save-api-creds-btn' && el.id !== 'clear-api-creds-btn') {
                el.disabled = false;
            }
        });
        if (mainTabs) {
            mainTabs.querySelectorAll('.tab-btn').forEach(btn => btn.style.pointerEvents = 'auto');
        }

        if (typeof fetchManagerSessionStatus === 'function') await fetchManagerSessionStatus(); // sessions.js
        if (typeof disableVoucherActionButtons === 'function') disableVoucherActionButtons(true, true, true); // vouchers.js

        let initialTab = 'dashboard';
        try {
            const savedTab = localStorage.getItem('activeHelpdeskTab');
            if (savedTab && tabPanes[savedTab]) { // tabPanes should be globally available from ui.js or similar
                initialTab = savedTab;
            }
        } catch (e) { console.warn("localStorage access error for active tab:", e.message); }

        if (typeof setActiveTab === 'function') {
            setActiveTab(initialTab, false); // Call setActiveTab with forceRefreshData = false
        } else {
            console.error("setActiveTab function is not defined. Tabs will not initialize correctly.");
        }
    } else {
        document.querySelectorAll('button:not(#save-api-creds-btn):not(#clear-api-creds-btn):not([id^="confirm-"]):not([id^="cancel-"])')
            .forEach(el => el.disabled = true);
        document.querySelectorAll('input:not(#config-api-key):not(#config-api-secret), select')
            .forEach(el => el.disabled = true);
        if (mainTabs) {
            mainTabs.querySelectorAll('.tab-btn').forEach(btn => btn.style.pointerEvents = 'none');
        }
        if (!currentApiKey || !currentApiSecret) {
            if (configInputSection && OPNsenseConfig.baseUrl) configInputSection.classList.remove('hidden');
        }
        if (applyCpConfigBtn) applyCpConfigBtn.disabled = true;

        // Display appropriate message if not connected
        const dashboardPane = tabPanes ? tabPanes.dashboard : null;
        if (dashboardPane && OPNsenseConfig.baseUrl) {
            Object.values(tabPanes).forEach(pane => { if(pane) {pane.classList.add('hidden'); pane.classList.remove('active');}});
            dashboardPane.classList.remove('hidden');
            dashboardPane.classList.add('active');
            dashboardPane.innerHTML = `<div class="text-center p-8 text-red-500"><i class="fas fa-exclamation-triangle fa-3x mb-3"></i><p>Application not connected. Please check API credentials and OPNsense server.</p></div>`;
        } else if (dashboardPane && !OPNsenseConfig.baseUrl) {
            Object.values(tabPanes).forEach(pane => {if(pane) {pane.classList.add('hidden'); pane.classList.remove('active');}});
            dashboardPane.classList.remove('hidden');
            dashboardPane.classList.add('active');
            dashboardPane.innerHTML = `<div class="text-center p-8 text-red-500"><i class="fas fa-exclamation-triangle fa-3x mb-3"></i><p>Application configuration (app-config.json) failed to load. Cannot connect.</p></div>`;
        }
    }
}

async function initializeApp() {
    try {
        await loadAppConfiguration();
        loadApiCredentials();
        initializeAllEventListeners(); // This now includes initializeTabs()
        registerServiceWorker();
        await initializeAppLogic();
    } catch (error) {
        console.error("Failed to initialize the application due to configuration load error:", error.message);
        if (applyCpConfigBtn) applyCpConfigBtn.disabled = true;
        // Display a critical error message in the UI if app config fails
        const dashboardPane = typeof tabPanes !== 'undefined' && tabPanes ? tabPanes.dashboard : document.getElementById('tab-dashboard'); // Fallback ID if tabPanes not ready
        if (dashboardPane) {
             if (typeof tabPanes !== 'undefined' && tabPanes) {
                Object.values(tabPanes).forEach(pane => { if(pane) {pane.classList.add('hidden'); pane.classList.remove('active');}});
                dashboardPane.classList.remove('hidden');
                dashboardPane.classList.add('active');
             }
            dashboardPane.innerHTML = `<div class="text-center p-8 text-red-500"><i class="fas fa-exclamation-triangle fa-3x mb-3"></i><p>Critical Error: Application configuration (app-config.json) failed to load. Cannot connect or function.</p><p class="text-sm mt-2">Details: ${error.message}</p></div>`;
        }
    }
}

document.addEventListener('DOMContentLoaded', initializeApp);