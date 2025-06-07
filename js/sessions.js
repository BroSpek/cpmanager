// js/sessions.js

(function (CPManager) {
  CPManager.sessions = {
    // --- State for selection, similar to vouchers ---
    selectedSessions: new Set(),
    currentlyVisibleSessions: [],

    // --- Core Functions ---

    fetchManagerSessionStatus: async function () {
      const zoneIdForStatusCall = "0";
      try {
        const response = await fetch(
          `${CPManager.config.baseUrl}/api/captiveportal/access/status/${zoneIdForStatusCall}`
        );
        const responseText = await response.text();

        if (!response.ok) {
          console.warn(
            `Manager session status check failed: ${response.status} ${response.statusText}`
          );
          CPManager.state.sessions.managerDetails = null;
          return;
        }

        const data = JSON.parse(responseText);
        if (data && data.sessionId && data.clientState === "AUTHORIZED") {
          CPManager.state.sessions.managerDetails = {
            sessionId: data.sessionId,
            zoneid: String(data.zoneid),
            ipAddress: data.ipAddress,
          };
          console.log(
            "Current device's session identified:",
            CPManager.state.sessions.managerDetails.ipAddress,
            "ID:",
            CPManager.state.sessions.managerDetails.sessionId.substring(0, 8) +
              "..."
          );
          if (
            CPManager.elements.tabPanes.sessions &&
            CPManager.elements.tabPanes.sessions.classList.contains("active")
          ) {
            CPManager.sessions.applySessionFilters();
          }
        } else {
          CPManager.state.sessions.managerDetails = null;
          console.log(
            "Current device not connected via authorized captive portal session, or status endpoint returned unexpected data."
          );
        }
      } catch (error) {
        console.error(
          `Exception during fetchManagerSessionStatus:`,
          error.message
        );
        CPManager.state.sessions.managerDetails = null;
      }
    },

    loadSessions: async function (forceRefresh = false) {
      if (!CPManager.elements.sessionCardContainer) return;
      CPManager.state.sessions.currentPage = 1;
      this.selectedSessions.clear(); // Clear selection on load

      if (CPManager.state.zones.allConfigured.length === 0) {
        await CPManager.zones.fetchAllZoneData();
      }
      this.populateSessionZoneFilter();

      if (
        !forceRefresh &&
        CPManager.state.sessions.all.length > 0 &&
        Date.now() - CPManager.state.sessions.lastFetched <
          CPManager.config.inMemoryCacheTTLMinutes * 60 * 1000
      ) {
        console.log("Using cached sessions. Applying filters.");
        this.applySessionFilters();
        return;
      }

      CPManager.ui.showSkeletonLoaders(
        CPManager.elements.sessionCardContainer,
        CPManager.config.itemsPerPage,
        '<div class="skeleton-card"></div>',
        "session-pagination"
      );
      this.updateSelectAllUI(); // Ensure UI is correct during load

      try {
        const data = await CPManager.api.callApi("/session/search");
        if (data && Array.isArray(data.rows)) {
          CPManager.state.sessions.all = data.rows;
          CPManager.state.sessions.lastFetched = Date.now();
          this.applySessionFilters();
        } else {
          console.error(
            "Error loading sessions: API response `data.rows` is not an array or data is undefined.",
            data
          );
          CPManager.ui.showNoDataMessage(
            CPManager.elements.sessionCardContainer,
            "Error: Unexpected data format for sessions.",
            "fas fa-exclamation-triangle",
            "session-pagination"
          );
          CPManager.state.sessions.all = [];
          this.currentlyVisibleSessions = [];
          this.updateSelectAllUI();
        }
      } catch (error) {
        console.error("Error loading sessions:", error);
        CPManager.ui.showNoDataMessage(
          CPManager.elements.sessionCardContainer,
          "Could not load sessions. Check API connection and OPNsense logs.",
          "fas fa-exclamation-triangle",
          "session-pagination"
        );
        CPManager.state.sessions.all = [];
        this.currentlyVisibleSessions = [];
        this.updateSelectAllUI();
      }
    },

    populateSessionZoneFilter: function () {
      if (!CPManager.elements.sessionZoneFilterSelect) return;

      const currentVal =
        localStorage.getItem(
          CPManager.config.localStorageKeys.sessionZoneFilter
        ) || "";
      CPManager.elements.sessionZoneFilterSelect.innerHTML =
        '<option value="">All Zones</option>';

      if (CPManager.state.zones.allConfigured.length > 0) {
        CPManager.state.zones.allConfigured.forEach((zone) => {
          const option = document.createElement("option");
          option.value = zone.zoneid;
          option.textContent = zone.description || `Zone ${zone.zoneid}`;
          CPManager.elements.sessionZoneFilterSelect.appendChild(option);
        });
        CPManager.elements.sessionZoneFilterSelect.value = currentVal;
      }
    },

    applySessionFilters: function () {
      if (!CPManager.elements.sessionCardContainer) return;
      CPManager.state.sessions.currentPage = 1;
      this.selectedSessions.clear(); // Clear selection when filters change

      const searchTerm = CPManager.elements.sessionSearchInput
        ? CPManager.elements.sessionSearchInput.value.toLowerCase()
        : "";
      const selectedZoneId = CPManager.elements.sessionZoneFilterSelect
        ? CPManager.elements.sessionZoneFilterSelect.value
        : "";

      if (CPManager.elements.sessionZoneFilterSelect) {
        localStorage.setItem(
          CPManager.config.localStorageKeys.sessionZoneFilter,
          selectedZoneId
        );
      }

      let filteredSessions = CPManager.state.sessions.all;

      if (selectedZoneId) {
        filteredSessions = filteredSessions.filter(
          (s) => String(s.zoneid) === selectedZoneId
        );
      }

      if (searchTerm) {
        filteredSessions = filteredSessions.filter(
          (s) =>
            (s.ipAddress && s.ipAddress.toLowerCase().includes(searchTerm)) ||
            (s.macAddress && s.macAddress.toLowerCase().includes(searchTerm)) ||
            (s.userName && s.userName.toLowerCase().includes(searchTerm)) ||
            (s.sessionId && s.sessionId.toLowerCase().includes(searchTerm))
        );
      }

      this.currentlyVisibleSessions = filteredSessions;
      this.renderSessions(filteredSessions);
    },

    renderSessions: function (sessions) {
      if (!CPManager.elements.sessionCardContainer) return;
      const selectAllContainer = CPManager.elements.sessionSelectAllContainer;

      CPManager.ui.clearContainer(
        CPManager.elements.sessionCardContainer,
        "session-pagination"
      );

      this.updateSelectAllUI();

      if (!sessions || !Array.isArray(sessions) || sessions.length === 0) {
        if (selectAllContainer) selectAllContainer.classList.add("hidden");
        CPManager.ui.showNoDataMessage(
          CPManager.elements.sessionCardContainer,
          "No sessions match filters or no active sessions found.",
          "fas fa-users-slash",
          "session-pagination"
        );
        return;
      }

      if (selectAllContainer) selectAllContainer.classList.remove("hidden");

      const page = CPManager.state.sessions.currentPage;
      const itemsPerPage = CPManager.config.itemsPerPage;
      const startIndex = (page - 1) * itemsPerPage;
      const endIndex = startIndex + itemsPerPage;
      const paginatedSessions = sessions.slice(startIndex, endIndex);

      paginatedSessions.forEach((session) => {
        const zoneDesc = CPManager.utils.getZoneDescription(session.zoneid);
        const zoneTagColor = CPManager.utils.getZoneColor(session.zoneid);
        const readableAuthVia = CPManager.utils.formatAuthVia(
          session.authenticated_via
        );
        const authViaTagColor =
          CPManager.utils.getAuthViaColor(readableAuthVia);
        const macAddressType = CPManager.utils.getMacAddressType(
          session.macAddress
        );
        let macTypeTagHtml = "";
        if (macAddressType) {
          const macTypeTagColor =
            macAddressType === "device" ? "bg-slate-500" : "bg-purple-500";
          const macTypeReadable =
            macAddressType.charAt(0).toUpperCase() + macAddressType.slice(1);
          macTypeTagHtml = `<span class="info-tag ${macTypeTagColor} truncate" title="MAC Type: ${macTypeReadable}">${macTypeReadable}</span>`;
        }

        const isManagerCurrentDeviceSession =
          CPManager.state.sessions.managerDetails &&
          session.sessionId ===
            CPManager.state.sessions.managerDetails.sessionId &&
          String(session.zoneid) ===
            CPManager.state.sessions.managerDetails.zoneid;

        const isChecked = this.selectedSessions.has(session.sessionId);

        const card = document.createElement("div");
        card.className = `session-card p-2 rounded-lg shadow border group ${
          isManagerCurrentDeviceSession
            ? "ring-2 ring-offset-1 ring-blue-500 shadow-lg is-manager-session"
            : ""
        }`;
        card.setAttribute("role", "listitem");
        card.setAttribute(
          "aria-label",
          `Session for IP ${session.ipAddress || "Unknown IP"}`
        );

        let managerIconHtml = "";
        if (isManagerCurrentDeviceSession) {
          managerIconHtml = `<span class="info-tag bg-blue-600 text-white flex items-center" title="This is your current device's session (IP: ${
            CPManager.state.sessions.managerDetails.ipAddress || "N/A"
          })"><i class="fas fa-user-shield mr-1"></i>You</span>`;
        }
        
        const checkboxHTML = `
            <div class="flex-shrink-0">
                <input type="checkbox" class="session-select-checkbox form-checkbox h-5 w-5" data-session-id="${session.sessionId}" ${isChecked ? "checked" : ""}>
            </div>`;

        const tagsHTML = `
            <div class="flex items-center gap-1">
                ${managerIconHtml}
                ${macTypeTagHtml}
                <span class="info-tag ${authViaTagColor} truncate" title="Authenticated Via: ${readableAuthVia}">${readableAuthVia}</span>
                <span class="info-tag ${zoneTagColor} truncate" title="Zone: ${zoneDesc}">${zoneDesc}</span>
            </div>`;

        card.innerHTML = `
                    <div class="flex justify-between items-center mb-1">
                        ${checkboxHTML}
                        ${tagsHTML}
                    </div>
					<div class="session-summary card-summary cursor-pointer pb-1" role="button" tabindex="0" aria-expanded="false" aria-controls="session-details-${
            session.sessionId
          }">
						<div class="space-y-1">
							<div class="info-row"><span class="info-label">IP Address</span> <span class="info-value summary-main-value">${
                session.ipAddress || CPManager.config.placeholderValue
              }</span></div>
							<div class="info-row"><span class="info-label">User</span> <span class="info-value summary-main-value">${
                session.userName || CPManager.config.placeholderValue
              }</span></div>
							<div class="info-row"><span class="info-label">MAC</span> <span class="info-value summary-main-value">${
                session.macAddress || CPManager.config.placeholderValue
              }</span></div>
						</div>
					</div>
					<div class="card-details-content text-sm space-y-1" id="session-details-${
            session.sessionId
          }" aria-hidden="true">
						<div class="info-row"><span class="info-label">Zone ID</span> <span class="info-value">${
              session.zoneid
            }</span></div>
						<div class="info-row"><span class="info-label">Session ID</span> <span class="info-value">${
              session.sessionId || CPManager.config.placeholderValue
            }</span></div>
						<div class="info-row"><span class="info-label">Start Time</span> <span class="info-value">${
              session.startTime
                ? new Date(session.startTime * 1000).toLocaleString()
                : CPManager.config.placeholderValue
            }</span></div>
						<div class="info-row"><span class="info-label">Last Accessed</span> <span class="info-value">${
              session.last_accessed
                ? new Date(session.last_accessed * 1000).toLocaleString()
                : CPManager.config.placeholderValue
            }</span></div>
						<div class="info-row"><span class="info-label">Packets Uploaded</span> <span class="info-value">${
              session.packets_in !== undefined
                ? session.packets_in.toLocaleString()
                : CPManager.config.placeholderValue
            }</span></div>
						<div class="info-row"><span class="info-label">Packets Downloaded</span> <span class="info-value">${
              session.packets_out !== undefined
                ? session.packets_out.toLocaleString()
                : CPManager.config.placeholderValue
            }</span></div>
						<div class="info-row"><span class="info-label">Data Uploaded</span> <span class="info-value">${
              session.bytes_in !== undefined
                ? CPManager.utils.formatBytes(session.bytes_in)
                : CPManager.config.placeholderValue
            }</span></div>
						<div class="info-row"><span class="info-label">Data Downloaded</span> <span class="info-value">${
              session.bytes_out !== undefined
                ? CPManager.utils.formatBytes(session.bytes_out)
                : CPManager.config.placeholderValue
            }</span></div>
						<div class="info-row"><span class="info-label">Acc. Timeout</span> <span class="info-value">${
              session.acc_session_timeout
                ? CPManager.utils.formatDuration(
                    session.acc_session_timeout,
                    "seconds"
                  )
                : CPManager.config.placeholderValue
            }</span></div>
					</div>`;
        CPManager.elements.sessionCardContainer.appendChild(card);
      });
      CPManager.ui.renderPaginationControls(
        CPManager.elements.sessionPaginationContainer,
        CPManager.state.sessions.currentPage,
        sessions.length,
        CPManager.config.itemsPerPage,
        (newPage) => {
          CPManager.state.sessions.currentPage = newPage;
          this.renderSessions(sessions);
        }
      );
    },

    // --- Selection and Action Functions ---

    updateDisconnectSelectedButton: function () {
      const button = CPManager.elements.disconnectSelectedSessionsBtn;
      if (!button) return;
      const selectedCount = this.selectedSessions.size;
      button.innerHTML = `<i class="fas fa-times-circle mr-2"></i>Disconnect`;
      button.disabled = selectedCount === 0;
    },

    updateSelectAllUI: function () {
      const {
        sessionSelectAllCheckbox,
        sessionSelectedCountText,
        sessionSelectAllContainer,
      } = CPManager.elements;
      if (
        !sessionSelectAllCheckbox ||
        !sessionSelectedCountText ||
        !sessionSelectAllContainer
      )
        return;

      this.updateDisconnectSelectedButton();

      const selectedCount = this.selectedSessions.size;
      sessionSelectedCountText.textContent = `(${selectedCount} session${
        selectedCount === 1 ? "" : "s"
      } selected)`;

      const visibleSessions = this.currentlyVisibleSessions;
      if (visibleSessions.length === 0) {
        sessionSelectAllContainer.classList.add("hidden");
        sessionSelectAllCheckbox.checked = false;
        sessionSelectAllCheckbox.indeterminate = false;
        sessionSelectAllCheckbox.disabled = true;
        return;
      }

      sessionSelectAllContainer.classList.remove("hidden");
      sessionSelectAllCheckbox.disabled = false;
      const allVisibleSelected = visibleSessions.every((s) =>
        this.selectedSessions.has(s.sessionId)
      );

      sessionSelectAllCheckbox.checked = allVisibleSelected;
      sessionSelectAllCheckbox.indeterminate =
        selectedCount > 0 && !allVisibleSelected;
    },

    handleSelectAll: function (isChecked) {
      this.currentlyVisibleSessions.forEach((session) => {
        if (isChecked) {
          this.selectedSessions.add(session.sessionId);
        } else {
          this.selectedSessions.delete(session.sessionId);
        }
      });
      // Re-render the currently visible cards to update checkbox states
      this.renderSessions(this.currentlyVisibleSessions);
    },

    handleDisconnectSelectedSessions: async function () {
      const selectedSessionIds = Array.from(this.selectedSessions);
      if (selectedSessionIds.length === 0) {
        CPManager.ui.showToast("No sessions selected.", "info");
        return;
      }

      const sessionsToDisconnect = CPManager.state.sessions.all.filter((s) =>
        selectedSessionIds.includes(s.sessionId)
      );

      if (sessionsToDisconnect.length === 0) {
        CPManager.ui.showToast(
          "Could not find details for selected sessions. Please refresh.",
          "error"
        );
        this.selectedSessions.clear();
        this.updateSelectAllUI();
        return;
      }

      const isMySessionSelected =
        CPManager.state.sessions.managerDetails?.sessionId &&
        this.selectedSessions.has(
          CPManager.state.sessions.managerDetails.sessionId
        );

      let title = "Disconnect Selected Sessions?";
      let message = `Are you sure you want to disconnect the <strong>${sessionsToDisconnect.length}</strong> selected session(s)?`;

      if (isMySessionSelected) {
        title = "Warning: Disconnecting Own Session";
        message = `<div class="hint-box hint-box-danger"><i class="fas fa-biohazard"></i><span><strong>DANGER:</strong> Your own session is included in the selection. Disconnecting it may lock you out of this manager.</span></div><p class="mt-4">Disconnect <strong>${sessionsToDisconnect.length}</strong> session(s) anyway?</p>`;
      }

      CPManager.ui.showConfirmationModal(title, message, async () => {
        CPManager.ui.showToast(
          `Disconnecting ${sessionsToDisconnect.length} session(s)...`,
          "info",
          5000
        );

        let successCount = 0;
        let failureCount = 0;

        const disconnectPromises = sessionsToDisconnect.map((session) =>
          CPManager.api
            .callApi(`/session/disconnect/${session.zoneid}`, "POST", {
              sessionId: session.sessionId,
            })
            .then((result) => {
              if (
                result &&
                (result.terminateCause ||
                  result.status === "ok" ||
                  result.status === "ok_text")
              ) {
                successCount++;
              } else {
                failureCount++;
                console.warn(
                  `Failed to disconnect session ${session.sessionId}:`,
                  result
                );
              }
            })
            .catch((error) => {
              failureCount++;
              console.error(
                `Error disconnecting session ${session.sessionId}:`,
                error
              );
            })
        );

        await Promise.all(disconnectPromises);

        let summaryMessage = "";
        let toastType = "info";
        if (successCount > 0 && failureCount === 0) {
          summaryMessage = `Successfully disconnected all ${successCount} selected sessions.`;
          toastType = "success";
        } else if (successCount > 0 && failureCount > 0) {
          summaryMessage = `Disconnected ${successCount} sessions. Failed for ${failureCount}. Check console.`;
          toastType = "warning";
        } else if (successCount === 0 && failureCount > 0) {
          summaryMessage = `Failed to disconnect any of the ${failureCount} selected sessions. Check console.`;
          toastType = "error";
        }

        CPManager.ui.showToast(summaryMessage, toastType, 7000);

        this.selectedSessions.clear();
        await this.loadSessions(true); // Force refresh
      });
    },

    // --- Event Listener Initialization ---

    initializeSessionEventListeners: function () {
      if (CPManager.elements.sessionSearchInput)
        CPManager.elements.sessionSearchInput.addEventListener(
          "input",
          () => this.applySessionFilters()
        );
      if (CPManager.elements.sessionZoneFilterSelect)
        CPManager.elements.sessionZoneFilterSelect.addEventListener(
          "change",
          () => this.applySessionFilters()
        );

      // Listener for card container (delegated)
      if (CPManager.elements.sessionCardContainer) {
        CPManager.elements.sessionCardContainer.addEventListener(
          "click",
          (e) => {
            const checkbox = e.target.closest(".session-select-checkbox");
            if (checkbox) {
              const sessionId = checkbox.dataset.sessionId;
              if (checkbox.checked) {
                this.selectedSessions.add(sessionId);
                const isMySession =
                  CPManager.state.sessions.managerDetails &&
                  sessionId ===
                    CPManager.state.sessions.managerDetails.sessionId;
                if (isMySession) {
                  CPManager.ui.showToast(
                    "Warning: You have selected your own session.",
                    "warning",
                    4000
                  );
                }
              } else {
                this.selectedSessions.delete(sessionId);
              }
              this.updateSelectAllUI();
              return;
            }

            const summaryElement = e.target.closest(".session-summary");
            if (summaryElement) {
              const card = summaryElement.closest(".session-card");
              const detailsContent = card.querySelector(
                ".card-details-content"
              );
              CPManager.ui.toggleCardDetails(
                card,
                CPManager.elements.sessionCardContainer
              );
              summaryElement.setAttribute(
                "aria-expanded",
                detailsContent.classList.contains("expanded")
              );
              detailsContent.setAttribute(
                "aria-hidden",
                !detailsContent.classList.contains("expanded")
              );
            }
          }
        );
      }

      // Action button listeners
      if (CPManager.elements.disconnectSelectedSessionsBtn)
        CPManager.elements.disconnectSelectedSessionsBtn.addEventListener(
          "click",
          () => this.handleDisconnectSelectedSessions()
        );

      if (CPManager.elements.sessionSelectAllCheckbox) {
        CPManager.elements.sessionSelectAllCheckbox.addEventListener(
          "change",
          (e) => this.handleSelectAll(e.target.checked)
        );
      }

      if (CPManager.elements.findMySessionBtn) {
        CPManager.elements.findMySessionBtn.addEventListener(
          "click",
          async () => {
            if (
              CPManager.state.sessions.managerDetails &&
              CPManager.state.sessions.managerDetails.sessionId
            ) {
              CPManager.ui.showToast(
                `Found your session (IP: ${CPManager.state.sessions.managerDetails.ipAddress}). Highlighting...`,
                "info"
              );
              if (CPManager.elements.sessionZoneFilterSelect)
                CPManager.elements.sessionZoneFilterSelect.value = "";
              if (CPManager.elements.sessionSearchInput)
                CPManager.elements.sessionSearchInput.value =
                  CPManager.state.sessions.managerDetails.sessionId;

              this.applySessionFilters(); // Apply the search filter immediately
              CPManager.tabs.setActiveTab("sessions"); // Switch to the tab

              setTimeout(() => {
                const highlightedCard = document.querySelector(
                  ".session-card.is-manager-session"
                );
                if (highlightedCard)
                  highlightedCard.scrollIntoView({
                    behavior: "smooth",
                    block: "center",
                  });
              }, 300);
            } else {
              CPManager.ui.showToast(
                "Your session details not found. Fetching...",
                "warning"
              );
              await this.fetchManagerSessionStatus();
              if (!CPManager.state.sessions.managerDetails) {
                CPManager.ui.showToast(
                  "Still couldn't find your session. Ensure you are logged into the portal.",
                  "warning"
                );
              } else {
                CPManager.elements.findMySessionBtn.click(); // Retry
              }
            }
          }
        );
      }
    },
  };
})(CPManager);