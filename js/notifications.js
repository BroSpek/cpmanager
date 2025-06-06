// js/notifications.js

(function (CPManager) {
  CPManager.notifications = {
    requestNotificationPermission: async function () {
      if (!("Notification" in window)) {
        CPManager.ui.showToast(
          "Browser does not support desktop notification",
          "error"
        );
        return;
      }

      const permission = await Notification.requestPermission();
      if (permission === "granted") {
        CPManager.ui.showToast("Sign-in notifications enabled!", "success");
        if (CPManager.state.currentApiKey && CPManager.state.currentApiSecret) {
          CPManager.notifications.startSessionPolling();
          CPManager.state.notifications.consecutivePollErrors = 0;
          CPManager.notifications.updateNotificationToggleState(true, false);
        } else {
          CPManager.ui.showToast(
            "API credentials not set. Cannot start polling.",
            "warning"
          );
          CPManager.notifications.updateNotificationToggleState(false, false);
        }
      } else {
        CPManager.ui.showToast(
          "Sign-in notifications permission denied.",
          "warning"
        );
        CPManager.notifications.stopSessionPolling();
        CPManager.notifications.updateNotificationToggleState(false, false);
      }
    },

    checkForNewSessionsAndNotify: async function () {
      if (Notification.permission !== "granted") {
        CPManager.notifications.stopSessionPolling();
        CPManager.notifications.updateNotificationToggleState(false, false);
        return;
      }

      try {
        const data = await CPManager.api.callApi("/session/search");
        if (data && Array.isArray(data.rows)) {
          CPManager.state.notifications.consecutivePollErrors = 0;
          if (
            document.getElementById("notifications-toggle-btn")?.dataset
              .errorState === "true"
          ) {
            CPManager.notifications.updateNotificationToggleState(true, false);
          }

          const currentSessionIds = new Set(
            data.rows.map((session) => session.sessionId)
          );
          if (CPManager.state.notifications.isFirstPoll) {
            CPManager.state.notifications.previousSessionIds =
              currentSessionIds;
            CPManager.state.notifications.isFirstPoll = false;
            return;
          }

          const newSessions = data.rows.filter(
            (session) =>
              !CPManager.state.notifications.previousSessionIds.has(
                session.sessionId
              )
          );
          if (newSessions.length > 0) {
            newSessions.forEach((session) => {
              const zoneDesc =
                CPManager.utils.getZoneDescription(session.zoneid) ||
                `Zone ${session.zoneid}`;
              const title = "New Captive Portal Sign-in";
              const body = `User ${session.userName || session.ipAddress} connected to ${zoneDesc}.`;
              const icon = "icons/icon-192x192.png";
              if (navigator.serviceWorker.controller) {
                navigator.serviceWorker.controller.postMessage({
                  type: "SHOW_NOTIFICATION",
                  payload: { title, body, icon, id: session.sessionId },
                });
              }
            });
          }
          CPManager.state.notifications.previousSessionIds = new Set(
            currentSessionIds
          );
        }
      } catch (error) {
        console.error("Error polling for new sessions:", error.message);
        CPManager.state.notifications.consecutivePollErrors++;
        if (
          CPManager.state.notifications.consecutivePollErrors >=
          CPManager.state.notifications.MAX_POLL_ERRORS_BEFORE_DISABLE
        ) {
          CPManager.ui.showToast(
            `Disabling notifications due to ${CPManager.state.notifications.MAX_POLL_ERRORS_BEFORE_DISABLE} API errors.`,
            "error",
            8000
          );
          CPManager.notifications.stopSessionPolling();
          CPManager.notifications.updateNotificationToggleState(false, true);
        }
      }
    },

    startSessionPolling: function () {
      if (CPManager.state.notifications.sessionPollIntervalId) return;
      if (Notification.permission !== "granted") return;

      CPManager.state.notifications.isFirstPoll = true;
      CPManager.state.notifications.previousSessionIds.clear();
      CPManager.state.notifications.consecutivePollErrors = 0;

      const currentInterval = document.hidden
        ? CPManager.state.notifications.POLLING_INTERVAL_HIDDEN_TAB
        : CPManager.state.notifications.POLLING_INTERVAL;
      CPManager.notifications.checkForNewSessionsAndNotify().finally(() => {
        if (
          Notification.permission === "granted" &&
          !CPManager.state.notifications.sessionPollIntervalId
        ) {
          CPManager.state.notifications.sessionPollIntervalId = setInterval(
            CPManager.notifications.checkForNewSessionsAndNotify,
            currentInterval
          );
        }
      });
    },

    stopSessionPolling: function () {
      if (CPManager.state.notifications.sessionPollIntervalId) {
        clearInterval(CPManager.state.notifications.sessionPollIntervalId);
        CPManager.state.notifications.sessionPollIntervalId = null;
      }
    },

    updateNotificationToggleState: function (isEnabled, isErrorState = false) {
      const toggleButton = document.getElementById("notifications-toggle-btn");
      if (toggleButton) {
        if (isErrorState) {
          toggleButton.innerHTML =
            '<i class="fas fa-exclamation-triangle text-red-500"></i>';
          toggleButton.setAttribute(
            "aria-label",
            "Notifications disabled (errors). Click to re-try."
          );
          toggleButton.dataset.errorState = "true";
        } else if (isEnabled) {
          toggleButton.innerHTML = '<i class="fas fa-bell"></i>';
          toggleButton.setAttribute(
            "aria-label",
            "Disable sign-in notifications"
          );
          toggleButton.dataset.errorState = "false";
        } else {
          toggleButton.innerHTML = '<i class="fas fa-bell-slash"></i>';
          toggleButton.setAttribute(
            "aria-label",
            "Enable sign-in notifications"
          );
          toggleButton.dataset.errorState = "false";
        }
        try {
          localStorage.setItem(
            CPManager.config.localStorageKeys.signInNotificationsEnabled,
            isEnabled && !isErrorState ? "true" : "false"
          );
        } catch (e) {
          console.warn(
            "Could not save notification preference to localStorage:",
            e.message
          );
        }
      }
    },

    handleVisibilityChange: function () {
      if (
        !CPManager.state.notifications.sessionPollIntervalId &&
        localStorage.getItem(
          CPManager.config.localStorageKeys.signInNotificationsEnabled
        ) !== "true"
      ) {
        return;
      }
      if (CPManager.state.notifications.sessionPollIntervalId) {
        clearInterval(CPManager.state.notifications.sessionPollIntervalId);
        CPManager.state.notifications.sessionPollIntervalId = null;
      }
      if (document.hidden) {
        if (Notification.permission === "granted") {
          CPManager.state.notifications.sessionPollIntervalId = setInterval(
            CPManager.notifications.checkForNewSessionsAndNotify,
            CPManager.state.notifications.POLLING_INTERVAL_HIDDEN_TAB
          );
        }
      } else {
        if (
          localStorage.getItem(
            CPManager.config.localStorageKeys.signInNotificationsEnabled
          ) === "true" &&
          Notification.permission === "granted"
        ) {
          CPManager.notifications.startSessionPolling();
        }
      }
    },

    initializeNotifications: function () {
      const storedPreference = localStorage.getItem(
        CPManager.config.localStorageKeys.signInNotificationsEnabled
      );
      const permissionGranted = Notification.permission === "granted";

      if (storedPreference === "true" && permissionGranted) {
        CPManager.notifications.startSessionPolling();
        CPManager.notifications.updateNotificationToggleState(true, false);
      } else if (
        storedPreference === "true" &&
        Notification.permission === "default"
      ) {
        CPManager.notifications.requestNotificationPermission();
      } else {
        CPManager.notifications.updateNotificationToggleState(false, false);
      }
      document.addEventListener(
        "visibilitychange",
        CPManager.notifications.handleVisibilityChange
      );
    },
  };
})(CPManager);
