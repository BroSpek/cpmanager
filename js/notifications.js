// js/notifications.js

// --- State Variables ---
let previousSessionIds = new Set();
let isFirstPoll = true;
let sessionPollIntervalId = null;
const POLLING_INTERVAL = 30000; // 30 seconds - adjust as needed

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
		// Ensure API credentials are set before starting polling
		if (currentApiKey && currentApiSecret) {
			// currentApiKey, currentApiSecret from config.js/main.js
			startSessionPolling();
		} else {
			showToast("API credentials not set. Cannot start polling for notifications.", "warning");
		}
	} else {
		showToast("Sign-in notifications permission denied or dismissed.", "warning");
		stopSessionPolling(); // Stop polling if permission is not granted
	}
	// Update UI toggle if you have one
	updateNotificationToggleState(permission === "granted");
}

/**
 * Fetches current sessions, identifies new ones, and triggers notifications.
 */
async function checkForNewSessionsAndNotify() {
	if (Notification.permission !== "granted") {
		console.log("Notification permission not granted. Skipping session check.");
		stopSessionPolling(); // Ensure polling is stopped if permission revoked mid-way
		return;
	}

	try {
		// callApi is from api.js
		const data = await callApi("/session/search");

		if (data && Array.isArray(data.rows)) {
			const currentSessionIds = new Set(data.rows.map((session) => session.sessionId));

			if (isFirstPoll) {
				previousSessionIds = currentSessionIds;
				isFirstPoll = false;
				console.log("Initial session list captured for notification baseline.");
				return; // Don't notify on the very first successful poll
			}

			const newSessions = data.rows.filter((session) => !previousSessionIds.has(session.sessionId));

			if (newSessions.length > 0) {
				console.log(`New sessions detected: ${newSessions.length}`);
				newSessions.forEach((session) => {
					// getZoneDescription is from utils.js, using allConfiguredZones from zones.js
					const zoneDesc = getZoneDescription(session.zoneid) || `Zone ${session.zoneid}`;
					const title = "New Captive Portal Sign-in";
					const body = `User ${session.userName || session.ipAddress} connected to ${zoneDesc}.`;
					const icon = "icons/icon-192x192.png"; // Ensure this path is correct

					if (navigator.serviceWorker.controller) {
						navigator.serviceWorker.controller.postMessage({
							type: "SHOW_NOTIFICATION",
							payload: { title, body, icon },
						});
					} else {
						console.warn(
							"Service worker not controlling. Fallback to direct notification (if possible and desired)."
						);
						// Optionally, show a direct notification if SW is not available
						// new Notification(title, { body, icon });
					}
				});
			}
			previousSessionIds = new Set(currentSessionIds); // Update baseline with a new Set
		}
	} catch (error) {
		console.error("Error polling for new sessions:", error.message);
		// Consider stopping polling on certain errors or notifying user of polling failure
		// showToast('Failed to poll for new sessions. Notifications may be interrupted.', 'error');
	}
}

/**
 * Starts the periodic polling for new sessions.
 */
function startSessionPolling() {
	if (sessionPollIntervalId) {
		console.log("Session polling is already active.");
		return;
	}
	if (Notification.permission !== "granted") {
		console.log("Cannot start polling: Notification permission not granted.");
		requestNotificationPermission(); // Prompt if not explicitly denied, or guide user.
		return;
	}

	console.log("Starting session polling for new sign-in notifications...");
	isFirstPoll = true; // Reset for a fresh baseline on start
	previousSessionIds.clear();

	// Fetch immediately once then set interval
	checkForNewSessionsAndNotify().finally(() => {
		// Ensure interval starts after the first check, regardless of its outcome (unless permission changes)
		if (Notification.permission === "granted") {
			sessionPollIntervalId = setInterval(checkForNewSessionsAndNotify, POLLING_INTERVAL);
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
	// UI toggle state should be updated by caller or requestNotificationPermission
}

/**
 * Updates the UI toggle for notifications based on permission.
 * Changes the icon and aria-label.
 * @param {boolean} isEnabled - Whether notifications are currently enabled.
 */
function updateNotificationToggleState(isEnabled) {
	const toggleButton = document.getElementById("notifications-toggle-btn");
	if (toggleButton) {
		if (isEnabled) {
			toggleButton.innerHTML = '<i class="fas fa-bell"></i>'; // Bell icon for enabled
			toggleButton.setAttribute("aria-label", "Disable sign-in notifications");
		} else {
			toggleButton.innerHTML = '<i class="fas fa-bell-slash"></i>'; // Bell-slash icon for disabled
			toggleButton.setAttribute("aria-label", "Enable sign-in notifications");
		}
		// Store preference in localStorage
		try {
			localStorage.setItem("signInNotificationsEnabled", isEnabled ? "true" : "false");
		} catch (e) {
			console.warn("Could not save notification preference to localStorage:", e.message);
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
		updateNotificationToggleState(true); // Update icon to enabled
	} else if (storedPreference === "true" && Notification.permission !== "denied") {
		// User had it enabled, but permission might be 'default' now or needs re-confirmation
		requestNotificationPermission(); // This will call updateNotificationToggleState based on new permission
	} else {
		// Default to disabled state (covers storedPreference === 'false', null, or permission denied)
		updateNotificationToggleState(false);
	}
}

// Make functions available globally if they need to be called from HTML event attributes,
// or manage event listeners centrally in main.js
// window.requestNotificationPermission = requestNotificationPermission;
