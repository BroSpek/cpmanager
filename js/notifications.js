// js/notifications.js

(function (CPManager) {
	CPManager.notifications = {
		/**
		 * Requests permission from the user to show notifications.
		 * Starts polling if permission is granted.
		 */
		requestNotificationPermission: async function () {
			if (!("Notification" in window)) {
				CPManager.ui.showToast("This browser does not support desktop notification", "error");
				return;
			}

			const permission = await Notification.requestPermission();
			if (permission === "granted") {
				CPManager.ui.showToast("Sign-in notifications enabled!", "success");
				if (CPManager.state.currentApiKey && CPManager.state.currentApiSecret) {
					CPManager.notifications.startSessionPolling();
					CPManager.state.notifications.consecutivePollErrors = 0; // Reset error count on permission grant
					CPManager.notifications.updateNotificationToggleState(true, false); // Update UI, not in error state
				} else {
					CPManager.ui.showToast(
						"API credentials not set. Cannot start polling for notifications.",
						"warning"
					);
					CPManager.notifications.updateNotificationToggleState(false, false); // Update UI, not in error state
				}
			} else {
				CPManager.ui.showToast("Sign-in notifications permission denied or dismissed.", "warning");
				CPManager.notifications.stopSessionPolling();
				CPManager.notifications.updateNotificationToggleState(false, false); // Update UI, not in error state
			}
		},

		/**
		 * Fetches current sessions, identifies new ones, and triggers notifications.
		 */
		checkForNewSessionsAndNotify: async function () {
			if (Notification.permission !== "granted") {
				console.log("Notification permission not granted. Skipping session check.");
				CPManager.notifications.stopSessionPolling();
				CPManager.notifications.updateNotificationToggleState(false, false); // Ensure UI reflects disabled state
				return;
			}

			try {
				const data = await CPManager.api.callApi("/session/search"); // callApi is from api.js

				if (data && Array.isArray(data.rows)) {
					CPManager.state.notifications.consecutivePollErrors = 0; // Reset error count on successful API call
					if (document.getElementById("notifications-toggle-btn")?.dataset.errorState === "true") {
						CPManager.notifications.updateNotificationToggleState(true, false); // Clear error state from icon if it was set
					}

					const currentSessionIds = new Set(data.rows.map((session) => session.sessionId));

					if (CPManager.state.notifications.isFirstPoll) {
						CPManager.state.notifications.previousSessionIds = currentSessionIds;
						CPManager.state.notifications.isFirstPoll = false;
						console.log("Initial session list captured for notification baseline.");
						return;
					}

					const newSessions = data.rows.filter(
						(session) => !CPManager.state.notifications.previousSessionIds.has(session.sessionId)
					);

					if (newSessions.length > 0) {
						console.log(`New sessions detected: ${newSessions.length}`);
						newSessions.forEach((session) => {
							// getZoneDescription is from utils.js, using allConfiguredZones from zones.js
							const zoneDesc =
								CPManager.utils.getZoneDescription(session.zoneid) || `Zone ${session.zoneid}`;
							const title = "New Captive Portal Sign-in";
							const body = `User ${session.userName || session.ipAddress} connected to ${zoneDesc}.`;
							const icon = "icons/icon-192x192.png";

							if (navigator.serviceWorker.controller) {
								navigator.serviceWorker.controller.postMessage({
									type: "SHOW_NOTIFICATION",
									payload: { title, body, icon, id: session.sessionId }, // Add a unique identifier, e.g., session.sessionId
								});
							} else {
								console.warn(
									"Service worker not controlling. Fallback to direct notification (if possible)."
								);
								// new Notification(title, { body, icon }); // Direct notification as fallback (optional)
							}
						});
					}
					CPManager.state.notifications.previousSessionIds = new Set(currentSessionIds);
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
				CPManager.state.notifications.consecutivePollErrors++;
				if (
					CPManager.state.notifications.consecutivePollErrors >=
					CPManager.state.notifications.MAX_POLL_ERRORS_BEFORE_DISABLE
				) {
					CPManager.ui.showToast(
						`Disabling notifications due to ${CPManager.state.notifications.MAX_POLL_ERRORS_BEFORE_DISABLE} consecutive API errors. Please check connection/config.`,
						"error",
						8000
					);
					CPManager.notifications.stopSessionPolling();
					CPManager.notifications.updateNotificationToggleState(false, true); // Update UI to error state
				} else {
					// Optionally, show a less severe toast for intermittent errors
					// CPManager.ui.showToast('Failed to poll for new sessions. Retrying...', 'warning');
				}
			}
		},

		/**
		 * Starts the periodic polling for new sessions. Adjusts interval based on tab visibility.
		 */
		startSessionPolling: function () {
			if (CPManager.state.notifications.sessionPollIntervalId) {
				console.log("Session polling is already active.");
				return;
			}
			if (Notification.permission !== "granted") {
				console.log("Cannot start polling: Notification permission not granted.");
				return;
			}

			console.log("Starting session polling for new sign-in notifications...");
			CPManager.state.notifications.isFirstPoll = true;
			CPManager.state.notifications.previousSessionIds.clear();
			CPManager.state.notifications.consecutivePollErrors = 0; // Reset error count when starting

			const currentInterval = document.hidden
				? CPManager.state.notifications.POLLING_INTERVAL_HIDDEN_TAB
				: CPManager.state.notifications.POLLING_INTERVAL;

			CPManager.notifications.checkForNewSessionsAndNotify().finally(() => {
				if (Notification.permission === "granted" && !CPManager.state.notifications.sessionPollIntervalId) {
					// Check again in case permission changed
					CPManager.state.notifications.sessionPollIntervalId = setInterval(
						CPManager.notifications.checkForNewSessionsAndNotify,
						currentInterval
					);
					console.log(`Polling interval set to ${currentInterval / 1000} seconds.`);
				}
			});
		},

		/**
		 * Stops the periodic polling for new sessions.
		 */
		stopSessionPolling: function () {
			if (CPManager.state.notifications.sessionPollIntervalId) {
				clearInterval(CPManager.state.notifications.sessionPollIntervalId);
				CPManager.state.notifications.sessionPollIntervalId = null;
				console.log("Session polling stopped.");
			}
		},

		/**
		 * Updates the UI toggle for notifications based on permission and error state.
		 * @param {boolean} isEnabled - Whether notifications are currently functionally enabled.
		 * @param {boolean} [isErrorState=false] - Whether to show an error icon.
		 */
		updateNotificationToggleState: function (isEnabled, isErrorState = false) {
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
		},

		/**
		 * Handles changes in page visibility to adjust polling interval.
		 */
		handleVisibilityChange: function () {
			if (
				!CPManager.state.notifications.sessionPollIntervalId &&
				localStorage.getItem("signInNotificationsEnabled") !== "true"
			) {
				// If polling is already stopped or notifications are not meant to be enabled, do nothing.
				return;
			}

			// Clear existing interval before setting a new one
			if (CPManager.state.notifications.sessionPollIntervalId) {
				clearInterval(CPManager.state.notifications.sessionPollIntervalId);
				CPManager.state.notifications.sessionPollIntervalId = null; // Important to allow re-creation
			}

			if (document.hidden) {
				console.log("Tab hidden. Switching to background polling interval.");
				if (Notification.permission === "granted") {
					// Only poll if permission still granted
					CPManager.state.notifications.sessionPollIntervalId = setInterval(
						CPManager.notifications.checkForNewSessionsAndNotify,
						CPManager.state.notifications.POLLING_INTERVAL_HIDDEN_TAB
					);
					console.log(
						`Polling interval set to ${
							CPManager.state.notifications.POLLING_INTERVAL_HIDDEN_TAB / 1000
						} seconds (background).`
					);
				}
			} else {
				console.log("Tab visible. Switching to foreground polling interval.");
				// If returning to visibility and notifications were enabled, restart with normal interval
				if (
					localStorage.getItem("signInNotificationsEnabled") === "true" &&
					Notification.permission === "granted"
				) {
					// Reset isFirstPoll to get a fresh baseline if desired, or maintain continuity
					// CPManager.state.notifications.isFirstPoll = true; // Uncomment if you want a fresh baseline on tab focus
					// CPManager.state.notifications.previousSessionIds.clear(); // Uncomment if you want a fresh baseline on tab focus
					CPManager.notifications.startSessionPolling(); // This will use the default POLLING_INTERVAL
				}
			}
		},

		/**
		 * Initializes the notification feature: checks stored preference and permission.
		 */
		initializeNotifications: function () {
			const storedPreference = localStorage.getItem("signInNotificationsEnabled");
			const permissionGranted = Notification.permission === "granted";

			if (storedPreference === "true" && permissionGranted) {
				CPManager.notifications.startSessionPolling();
				CPManager.notifications.updateNotificationToggleState(true, false);
			} else if (storedPreference === "true" && Notification.permission === "default") {
				// User had it enabled, but permission might be 'default' now (e.g. after browser reset)
				CPManager.notifications.requestNotificationPermission(); // This will call updateNotificationToggleState
			} else {
				// Default to disabled state (covers storedPreference 'false', null, or permission 'denied')
				CPManager.notifications.updateNotificationToggleState(false, false);
			}

			// Add visibility change listener
			document.addEventListener("visibilitychange", CPManager.notifications.handleVisibilityChange);
		},
	};
})(CPManager);
