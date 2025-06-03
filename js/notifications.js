// js/notifications.js

// --- State Variables ---
let previousSessionIds = new Set();
let isFirstPoll = true;
let sessionPollIntervalId = null;
const POLLING_INTERVAL = 30000; // 30 seconds
const POLLING_INTERVAL_HIDDEN_TAB = 300000; // 5 minutes when tab is hidden
let consecutivePollErrors = 0;
const MAX_POLL_ERRORS_BEFORE_DISABLE = 5; // Disable notifications after this many consecutive errors

// --- Core Functions ---

/**
 * Requests permission from the user to show notifications.
 * Starts polling if permission is granted.
 */
async function requestNotificationPermission() {
	if (!("Notification" in window)) {
		showToast("This browser does not support desktop notification", "error");
		return;
	}

	const permission = await Notification.requestPermission();
	if (permission === "granted") {
		showToast("Sign-in notifications enabled!", "success");
		if (currentApiKey && currentApiSecret) {
			startSessionPolling();
			consecutivePollErrors = 0; // Reset error count on permission grant
			updateNotificationToggleState(true, false); // Update UI, not in error state
		} else {
			showToast("API credentials not set. Cannot start polling for notifications.", "warning");
			updateNotificationToggleState(false, false); // Update UI, not in error state
		}
	} else {
		showToast("Sign-in notifications permission denied or dismissed.", "warning");
		stopSessionPolling();
		updateNotificationToggleState(false, false); // Update UI, not in error state
	}
}

/**
 * Fetches current sessions, identifies new ones, and triggers notifications.
 */
async function checkForNewSessionsAndNotify() {
	if (Notification.permission !== "granted") {
		console.log("Notification permission not granted. Skipping session check.");
		stopSessionPolling();
		updateNotificationToggleState(false, false); // Ensure UI reflects disabled state
		return;
	}

	try {
		const data = await callApi("/session/search"); // callApi is from api.js

		if (data && Array.isArray(data.rows)) {
			consecutivePollErrors = 0; // Reset error count on successful API call
			if (document.getElementById("notifications-toggle-btn")?.dataset.errorState === "true") {
				updateNotificationToggleState(true, false); // Clear error state from icon if it was set
			}

			const currentSessionIds = new Set(data.rows.map((session) => session.sessionId));

			if (isFirstPoll) {
				previousSessionIds = currentSessionIds;
				isFirstPoll = false;
				console.log("Initial session list captured for notification baseline.");
				return;
			}

			const newSessions = data.rows.filter((session) => !previousSessionIds.has(session.sessionId));

			if (newSessions.length > 0) {
				console.log(`New sessions detected: ${newSessions.length}`);
				newSessions.forEach((session) => {
					// getZoneDescription is from utils.js, using allConfiguredZones from zones.js
					const zoneDesc = getZoneDescription(session.zoneid) || `Zone ${session.zoneid}`;
					const title = "New Captive Portal Sign-in";
					const body = `User ${session.userName || session.ipAddress} connected to ${zoneDesc}.`;
					const icon = "icons/icon-192x192.png";

					if (navigator.serviceWorker.controller) {
						navigator.serviceWorker.controller.postMessage({
							type: "SHOW_NOTIFICATION",
							payload: { title, body, icon, id: session.sessionId }, // Add a unique identifier, e.g., session.sessionId
						});
					} else {
						console.warn("Service worker not controlling. Fallback to direct notification (if possible).");
						// new Notification(title, { body, icon }); // Direct notification as fallback (optional)
					}
				});
			}
			previousSessionIds = new Set(currentSessionIds);
		} else {
			// Handle cases where data.rows is not an array but API call might have been "ok" (e.g., empty response)
			console.warn(
				"checkForNewSessionsAndNotify: API response for sessions was not an array or data was unexpected.",
				data
			);
			// Don't increment error count here unless callApi itself threw an error (handled below)
		}
	} catch (error) {
		console.error("Error polling for new sessions:", error.message);
		consecutivePollErrors++;
		if (consecutivePollErrors >= MAX_POLL_ERRORS_BEFORE_DISABLE) {
			showToast(
				`Disabling notifications due to ${MAX_POLL_ERRORS_BEFORE_DISABLE} consecutive API errors. Please check connection/config.`,
				"error",
				8000
			);
			stopSessionPolling();
			updateNotificationToggleState(false, true); // Update UI to error state
		} else {
			// Optionally, show a less severe toast for intermittent errors
			// showToast('Failed to poll for new sessions. Retrying...', 'warning');
		}
	}
}

/**
 * Starts the periodic polling for new sessions. Adjusts interval based on tab visibility.
 */
function startSessionPolling() {
	if (sessionPollIntervalId) {
		console.log("Session polling is already active.");
		return;
	}
	if (Notification.permission !== "granted") {
		console.log("Cannot start polling: Notification permission not granted.");
		// requestNotificationPermission(); // This could be called, or rely on user to re-enable
		return;
	}

	console.log("Starting session polling for new sign-in notifications...");
	isFirstPoll = true;
	previousSessionIds.clear();
	consecutivePollErrors = 0; // Reset error count when starting

	const currentInterval = document.hidden ? POLLING_INTERVAL_HIDDEN_TAB : POLLING_INTERVAL;

	checkForNewSessionsAndNotify().finally(() => {
		if (Notification.permission === "granted" && !sessionPollIntervalId) {
			// Check again in case permission changed
			sessionPollIntervalId = setInterval(checkForNewSessionsAndNotify, currentInterval);
			console.log(`Polling interval set to ${currentInterval / 1000} seconds.`);
		}
	});
}

/**
 * Stops the periodic polling for new sessions.
 */
function stopSessionPolling() {
	if (sessionPollIntervalId) {
		clearInterval(sessionPollIntervalId);
		sessionPollIntervalId = null;
		console.log("Session polling stopped.");
	}
	// The caller should manage UI updates (like toggle button state)
}

/**
 * Updates the UI toggle for notifications based on permission and error state.
 * @param {boolean} isEnabled - Whether notifications are currently functionally enabled.
 * @param {boolean} [isErrorState=false] - Whether to show an error icon.
 */
function updateNotificationToggleState(isEnabled, isErrorState = false) {
	const toggleButton = document.getElementById("notifications-toggle-btn");
	if (toggleButton) {
		if (isErrorState) {
			toggleButton.innerHTML = '<i class="fas fa-exclamation-triangle text-red-500"></i>'; // Error icon
			toggleButton.setAttribute("aria-label", "Notifications disabled due to errors. Click to re-try.");
			toggleButton.dataset.errorState = "true";
		} else if (isEnabled) {
			toggleButton.innerHTML = '<i class="fas fa-bell"></i>';
			toggleButton.setAttribute("aria-label", "Disable sign-in notifications");
			toggleButton.dataset.errorState = "false";
		} else {
			toggleButton.innerHTML = '<i class="fas fa-bell-slash"></i>';
			toggleButton.setAttribute("aria-label", "Enable sign-in notifications");
			toggleButton.dataset.errorState = "false";
		}
		// Store functional preference (ignoring error state for storage)
		try {
			localStorage.setItem("signInNotificationsEnabled", isEnabled && !isErrorState ? "true" : "false");
		} catch (e) {
			console.warn("Could not save notification preference to localStorage:", e.message);
		}
	}
}

/**
 * Handles changes in page visibility to adjust polling interval.
 */
function handleVisibilityChange() {
	if (!sessionPollIntervalId && localStorage.getItem("signInNotificationsEnabled") !== "true") {
		// If polling is already stopped or notifications are not meant to be enabled, do nothing.
		return;
	}

	// Clear existing interval before setting a new one
	if (sessionPollIntervalId) {
		clearInterval(sessionPollIntervalId);
		sessionPollIntervalId = null; // Important to allow re-creation
	}

	if (document.hidden) {
		console.log("Tab hidden. Switching to background polling interval.");
		if (Notification.permission === "granted") {
			// Only poll if permission still granted
			sessionPollIntervalId = setInterval(checkForNewSessionsAndNotify, POLLING_INTERVAL_HIDDEN_TAB);
			console.log(`Polling interval set to ${POLLING_INTERVAL_HIDDEN_TAB / 1000} seconds (background).`);
		}
	} else {
		console.log("Tab visible. Switching to foreground polling interval.");
		// If returning to visibility and notifications were enabled, restart with normal interval
		if (localStorage.getItem("signInNotificationsEnabled") === "true" && Notification.permission === "granted") {
			// Reset isFirstPoll to get a fresh baseline if desired, or maintain continuity
			// isFirstPoll = true; // Uncomment if you want a fresh baseline on tab focus
			// previousSessionIds.clear(); // Uncomment if you want a fresh baseline on tab focus
			startSessionPolling(); // This will use the default POLLING_INTERVAL
		}
	}
}

/**
 * Initializes the notification feature: checks stored preference and permission.
 */
function initializeNotifications() {
	const storedPreference = localStorage.getItem("signInNotificationsEnabled");
	const permissionGranted = Notification.permission === "granted";

	if (storedPreference === "true" && permissionGranted) {
		startSessionPolling();
		updateNotificationToggleState(true, false);
	} else if (storedPreference === "true" && Notification.permission === "default") {
		// User had it enabled, but permission might be 'default' now (e.g. after browser reset)
		requestNotificationPermission(); // This will call updateNotificationToggleState
	} else {
		// Default to disabled state (covers storedPreference 'false', null, or permission 'denied')
		updateNotificationToggleState(false, false);
	}

	// Add visibility change listener
	document.addEventListener("visibilitychange", handleVisibilityChange);
}
