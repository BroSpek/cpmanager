// js/sessions.js

let allSessions = []; // Stores all fetched sessions to allow client-side filtering
let managerSessionDetails = null; // Stores details of the current device's session if identified

/**
 * Fetches the status of the current device's session to identify the manager.
 * This helps in highlighting the manager's own session in the list.
 * Uses a direct fetch as it's a status check not requiring full API wrapper.
 */
async function fetchManagerSessionStatus() {
    const zoneIdForStatusCall = '0'; // Typically, status can be checked against any zone, '0' is common.
    try {
        // Note: This fetch does not use the `callApi` wrapper because it's a special status endpoint
        // and might not need the same auth or error handling if it's a public status check.
        // If it requires authentication, it should be adapted or callApi should be made more flexible.
        const response = await fetch(`${OPNsenseConfig.baseUrl}/api/captiveportal/access/status/${zoneIdForStatusCall}`);
        const responseText = await response.text();

        if (!response.ok) {
            console.warn(`Manager session status check failed: ${response.status} ${response.statusText}`);
            managerSessionDetails = null;
            return;
        }

        const data = JSON.parse(responseText);
        if (data && data.sessionId && data.clientState === "AUTHORIZED") {
            managerSessionDetails = {
                sessionId: data.sessionId,
                zoneid: String(data.zoneid), // Ensure zoneid is a string for consistent comparison
                ipAddress: data.ipAddress,
            };
            console.log("Current device's session identified:", managerSessionDetails.ipAddress, "ID:", managerSessionDetails.sessionId.substring(0, 8) + "...");
            // If sessions tab is already active, re-apply filters to highlight
            if (tabPanes.sessions && tabPanes.sessions.classList.contains('active')) {
                applySessionFilters();
            }
        } else {
            managerSessionDetails = null;
            console.log("Current device is not connected via an authorized captive portal session, or status endpoint returned unexpected data.");
        }
    } catch (error) {
        console.error(`Exception during fetchManagerSessionStatus:`, error.message);
        managerSessionDetails = null;
    }
}


/**
 * Loads all active sessions from the OPNsense API.
 * Populates the zone filter dropdown and then renders the sessions.
 * @param {boolean} [forceRefresh=false] - If true, forces a re-fetch even if data exists.
 */
async function loadSessions(forceRefresh = false) { // Added forceRefresh
    if (!sessionCardContainer) return;

    // Ensure zone data is available for descriptions and filtering (critical for populateSessionZoneFilter)
    if (allConfiguredZones.length === 0) {
        await fetchAllZoneData(); // Assumes fetchAllZoneData is globally available
    }
    populateSessionZoneFilter(); // Populate filters regardless of session data cache

    if (!forceRefresh && allSessions.length > 0) {
        console.log("Using cached sessions. Applying filters.");
        applySessionFilters(); // Re-render from existing data
        return;
    }

    showSkeletonLoaders(sessionCardContainer, 3); // Show 3 skeleton cards while loading

    try {
        const data = await callApi('/session/search'); // API call
        if (data && Array.isArray(data.rows)) {
            allSessions = data.rows;
            applySessionFilters(); // Filter and render
        } else {
            console.error("Error loading sessions: API response `data.rows` is not an array or data is undefined.", data);
            showNoDataMessage(sessionCardContainer, "Error: Unexpected data format for sessions.", "fas fa-exclamation-triangle");
            allSessions = []; // Reset sessions
        }
    } catch (error) {
        console.error("Error loading sessions:", error);
        showNoDataMessage(sessionCardContainer, "Could not load sessions. Please check API connection and OPNsense logs.", "fas fa-exclamation-triangle");
        allSessions = []; // Reset sessions
    }
}

/**
 * Populates the session zone filter dropdown with available zones.
 */
function populateSessionZoneFilter() {
    if (!sessionZoneFilterSelect) return;

    const currentVal = localStorage.getItem('sessionZoneFilter') || "";
    // Only repopulate if significantly changed or empty, to preserve selection if possible
    // For now, we repopulate it each time loadSessions is called if allConfiguredZones has data
    sessionZoneFilterSelect.innerHTML = '<option value="">All Zones</option>'; // Default option

    if (allConfiguredZones.length > 0) {
        allConfiguredZones.forEach(zone => {
            const option = document.createElement('option');
            option.value = zone.zoneid;
            option.textContent = zone.description || `Zone ${zone.zoneid}`;
            sessionZoneFilterSelect.appendChild(option);
        });
        sessionZoneFilterSelect.value = currentVal; // Restore last selected value
    }
}

/**
 * Applies search and zone filters to the `allSessions` array and re-renders the session list.
 */
function applySessionFilters() {
    if (!sessionCardContainer) return;

    const searchTerm = sessionSearchInput ? sessionSearchInput.value.toLowerCase() : "";
    const selectedZoneId = sessionZoneFilterSelect ? sessionZoneFilterSelect.value : "";

    if (sessionZoneFilterSelect) { // Save filter preference
        localStorage.setItem('sessionZoneFilter', selectedZoneId);
    }

    let filteredSessions = allSessions;

    if (selectedZoneId) {
        filteredSessions = filteredSessions.filter(s => String(s.zoneid) === selectedZoneId);
    }

    if (searchTerm) {
        filteredSessions = filteredSessions.filter(s =>
            (s.ipAddress && s.ipAddress.toLowerCase().includes(searchTerm)) ||
            (s.macAddress && s.macAddress.toLowerCase().includes(searchTerm)) ||
            (s.userName && s.userName.toLowerCase().includes(searchTerm)) ||
            (s.sessionId && s.sessionId.toLowerCase().includes(searchTerm))
        );
    }
    renderSessions(filteredSessions);
}

/**
 * Renders the filtered list of sessions as cards in the UI.
 * @param {Array<object>} sessions - Array of session objects to render.
 */
function renderSessions(sessions) {
    if (!sessionCardContainer) return;
    clearContainer(sessionCardContainer);

    if (!sessions || !Array.isArray(sessions) || sessions.length === 0) {
        showNoDataMessage(sessionCardContainer, "No sessions match filters or no active sessions found.", "fas fa-users-slash");
        return;
    }

    sessions.forEach((session) => {
        const zoneDesc = getZoneDescription(session.zoneid); // Util function
        const zoneTagColor = getZoneColor(session.zoneid);   // Util function
        const readableAuthVia = formatAuthVia(session.authenticated_via); // Util function
        const authViaTagColor = getAuthViaColor(readableAuthVia); // Util function

        let isManagerCurrentDeviceSession = false;
        if (managerSessionDetails &&
            session.sessionId === managerSessionDetails.sessionId &&
            String(session.zoneid) === managerSessionDetails.zoneid) {
            isManagerCurrentDeviceSession = true;
        }

        const card = document.createElement('div');
        card.className = `session-card bg-gray-50 p-3 rounded-lg shadow border border-gray-200 relative ${isManagerCurrentDeviceSession ? 'ring-2 ring-offset-1 ring-blue-500 shadow-lg' : ''}`;
        // Add ARIA roles and labels for accessibility
        card.setAttribute('role', 'listitem');
        card.setAttribute('aria-label', `Session for IP ${session.ipAddress || 'Unknown IP'}`);


        let managerIconHtml = '';
        if (isManagerCurrentDeviceSession) {
            managerIconHtml = `<span class="info-tag bg-blue-600 text-white flex items-center" title="This is your current device's session (IP: ${managerSessionDetails.ipAddress || 'N/A'})"><i class="fas fa-user-shield mr-1"></i>You</span>`;
        }

        card.innerHTML = `
            <div class="tags-container">
                ${managerIconHtml}
                <span class="info-tag ${authViaTagColor} truncate" title="Authenticated Via: ${readableAuthVia}">${readableAuthVia}</span>
                <span class="info-tag ${zoneTagColor} truncate" title="Zone: ${zoneDesc}">${zoneDesc}</span>
            </div>
            <div class="session-summary card-summary cursor-pointer pb-1" role="button" tabindex="0" aria-expanded="false" aria-controls="session-details-${session.sessionId}">
                <div class="space-y-1">
                    <div class="info-row"><span class="info-label">IP Address</span> <span class="info-value summary-main-value">${session.ipAddress || placeholderValue}</span></div>
                    <div class="info-row"><span class="info-label">User</span> <span class="info-value summary-main-value">${session.userName || placeholderValue}</span></div>
                    <div class="info-row"><span class="info-label">MAC</span> <span class="info-value summary-main-value">${session.macAddress || placeholderValue}</span></div>
                </div>
            </div>
            <div class="card-details-content text-sm space-y-1" id="session-details-${session.sessionId}" aria-hidden="true">
                <div class="info-row"><span class="info-label">Zone ID</span> <span class="info-value">${session.zoneid}</span></div>
                <div class="info-row"><span class="info-label">Session ID</span> <span class="info-value">${session.sessionId || placeholderValue}</span></div>
                <div class="info-row"><span class="info-label">Start Time</span> <span class="info-value">${session.startTime ? new Date(session.startTime * 1000).toLocaleString() : placeholderValue}</span></div>
                <div class="info-row"><span class="info-label">Last Accessed</span> <span class="info-value">${session.last_accessed ? new Date(session.last_accessed * 1000).toLocaleString() : placeholderValue}</span></div>
                <div class="info-row"><span class="info-label">Packets Uploaded</span> <span class="info-value">${session.packets_in !== undefined ? session.packets_in.toLocaleString() : placeholderValue}</span></div>
                <div class="info-row"><span class="info-label">Packets Downloaded</span> <span class="info-value">${session.packets_out !== undefined ? session.packets_out.toLocaleString() : placeholderValue}</span></div>
                <div class="info-row"><span class="info-label">Data Uploaded</span> <span class="info-value">${session.bytes_in !== undefined ? formatBytes(session.bytes_in) : placeholderValue}</span></div>
                <div class="info-row"><span class="info-label">Data Downloaded</span> <span class="info-value">${session.bytes_out !== undefined ? formatBytes(session.bytes_out) : placeholderValue}</span></div>
                <div class="info-row"><span class="info-label">Acc. Timeout</span> <span class="info-value">${session.acc_session_timeout ? formatDuration(session.acc_session_timeout, 'seconds') : placeholderValue}</span></div>
                <p class="mt-3">
                    <button class="btn btn-warning w-full" data-action="disconnect-session" data-sessionid="${session.sessionId}" data-zoneid="${session.zoneid}" data-ip="${session.ipAddress || 'Unknown IP'}">
                        <i class="fas fa-power-off mr-1"></i>Disconnect Session
                    </button>
                </p>
            </div>
        `;
        sessionCardContainer.appendChild(card);

        const disconnectButton = card.querySelector('[data-action="disconnect-session"]');
        if (disconnectButton && isManagerCurrentDeviceSession) {
            disconnectButton.innerHTML = '<i class="fas fa-power-off mr-1"></i>Disconnect My Session';
            disconnectButton.classList.remove('btn-warning');
            disconnectButton.classList.add('btn-danger');
        }

        // Add event listener for expanding/collapsing card details
        const summaryElement = card.querySelector('.session-summary');
        const detailsContent = card.querySelector('.card-details-content'); // Added detailsContent
        if (summaryElement && detailsContent) { // Added detailsContent check
            summaryElement.addEventListener('click', () => {
                toggleCardDetails(card, sessionCardContainer);
                summaryElement.setAttribute('aria-expanded', detailsContent.classList.contains('expanded'));
                detailsContent.setAttribute('aria-hidden', !detailsContent.classList.contains('expanded'));

            });
            summaryElement.addEventListener('keydown', (e) => { // Keyboard accessibility
                if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault();
                    toggleCardDetails(card, sessionCardContainer);
                     summaryElement.setAttribute('aria-expanded', detailsContent.classList.contains('expanded'));
                    detailsContent.setAttribute('aria-hidden', !detailsContent.classList.contains('expanded'));
                }
            });
        }
    });
}


/**
 * Handles the disconnection of a single session.
 * @param {string} sessionId - The ID of the session to disconnect.
 * @param {string} zoneId - The zone ID of the session.
 * @param {string} ipAddress - The IP address of the client for confirmation message.
 * @param {boolean} isMySession - Flag indicating if it's the manager's own session.
 */
async function handleDisconnectSession(sessionId, zoneId, ipAddress, isMySession) {
    let title = isMySession ? 'Disconnect YOUR Session?' : 'Disconnect Client?';
    let message = isMySession ?
        `<strong>DANGER:</strong> You are attempting to disconnect your current management session.<br/>IP: <strong>${ipAddress}</strong><br/>ID: <strong>${sessionId.substring(0,8)}...</strong><br/><br/>This could lock you out. Are you absolutely sure?` :
        `Are you sure you want to disconnect client?<br/>IP: <strong>${ipAddress}</strong><br/>ID: <strong>${sessionId.substring(0,8)}...</strong>`;

    showConfirmationModal(title, message, async () => {
        try {
            const finalPayload = { sessionId: sessionId }; // OPNsense API might expect just sessionId or more specific structure
            const result = await callApi(`/session/disconnect/${zoneId}`, 'POST', finalPayload);

            if (result && (result.terminateCause || result.status === 'ok' || result.status === 'ok_text' || (result.message && result.message.toLowerCase().includes("ok")))) {
                showToast(`Client ${ipAddress} (ID: ${sessionId.substring(0,8)}...) disconnected successfully.`, 'success');
                if (isMySession) {
                    managerSessionDetails = null; // Clear manager session details if they disconnected themselves
                }
                await loadSessions(true); // Force refresh the session list
            } else {
                showToast(`Failed to disconnect client ${ipAddress}: ${result.message || 'Unknown API response.'}`, 'error');
            }
        } catch (errorCatch) {
            // Error already handled by callApi and shown in a toast.
            console.error("Error during disconnect session attempt:", errorCatch.message);
        }
    });
}

/**
 * Handles disconnecting all currently filtered sessions (excluding the manager's own session).
 */
async function handleDisconnectAllSessions() {
    const selectedZoneId = sessionZoneFilterSelect ? sessionZoneFilterSelect.value : "";
    const selectedZoneName = selectedZoneId ? (sessionZoneFilterSelect.options[sessionZoneFilterSelect.selectedIndex].text || `Zone ${selectedZoneId}`) : "All Zones";

    let sessionsToDisconnect = allSessions; // Start with all sessions currently loaded
    if (selectedZoneId) { // Filter by selected zone if any
        sessionsToDisconnect = sessionsToDisconnect.filter(s => String(s.zoneid) === selectedZoneId);
    }
    const searchTerm = sessionSearchInput ? sessionSearchInput.value.toLowerCase() : "";
    if (searchTerm) { // Further filter by search term if any
         sessionsToDisconnect = sessionsToDisconnect.filter(s =>
            (s.ipAddress && s.ipAddress.toLowerCase().includes(searchTerm)) ||
            (s.macAddress && s.macAddress.toLowerCase().includes(searchTerm)) ||
            (s.userName && s.userName.toLowerCase().includes(searchTerm)) ||
            (s.sessionId && s.sessionId.toLowerCase().includes(searchTerm))
        );
    }


    // Exclude the manager's own session
    if (managerSessionDetails && managerSessionDetails.sessionId) {
        sessionsToDisconnect = sessionsToDisconnect.filter(s =>
            !(s.sessionId === managerSessionDetails.sessionId && String(s.zoneid) === managerSessionDetails.zoneid)
        );
    }

    if (sessionsToDisconnect.length === 0) {
        showToast(`No other active sessions found to disconnect in ${selectedZoneName} (matching current filters).`, 'info');
        return;
    }

    const confirmationMsg = `You are about to disconnect <strong>${sessionsToDisconnect.length}</strong> session(s) in <strong>${selectedZoneName}</strong> (excluding your own, matching current filters).<br><br>Are you sure you want to proceed?`;

    showConfirmationModal('Confirm Disconnect All Filtered', confirmationMsg, async () => {
        showToast(`Disconnecting ${sessionsToDisconnect.length} sessions in ${selectedZoneName}... Please wait.`, 'info', 10000);

        let successCount = 0;
        let failureCount = 0;
        const disconnectPromises = [];

        for (const session of sessionsToDisconnect) {
            const payload = { sessionId: session.sessionId };
            disconnectPromises.push(
                callApi(`/session/disconnect/${session.zoneid}`, 'POST', payload)
                    .then(result => {
                        if (result && (result.terminateCause || result.status === 'ok' || result.status === 'ok_text' || (result.message && result.message.toLowerCase().includes("ok")))) {
                            successCount++;
                        } else {
                            failureCount++;
                            console.warn(`Failed to disconnect session ${session.sessionId} (IP: ${session.ipAddress}): ${result.message || 'Unknown API response.'}`);
                        }
                    })
                    .catch(error => {
                        failureCount++;
                        console.error(`Error disconnecting session ${session.sessionId} (IP: ${session.ipAddress}):`, error.message);
                    })
            );
        }

        await Promise.all(disconnectPromises);

        let summaryMessage = '';
        if (successCount > 0 && failureCount === 0) {
            summaryMessage = `Successfully disconnected all ${successCount} targeted sessions in ${selectedZoneName}.`;
            showToast(summaryMessage, 'success');
        } else if (successCount > 0 && failureCount > 0) {
            summaryMessage = `Disconnected ${successCount} sessions. Failed to disconnect ${failureCount} sessions in ${selectedZoneName}. Check console for details.`;
            showToast(summaryMessage, 'warning', 7000);
        } else if (successCount === 0 && failureCount > 0) {
            summaryMessage = `Failed to disconnect any of the ${failureCount} targeted sessions in ${selectedZoneName}. Check console for details.`;
            showToast(summaryMessage, 'error', 7000);
        } else { // successCount === 0 && failureCount === 0 (should not happen if sessionsToDisconnect.length > 0)
            summaryMessage = `No sessions were processed or an unexpected issue occurred in ${selectedZoneName}.`;
            showToast(summaryMessage, 'info');
        }
        await loadSessions(true); // Force refresh the session list
    });
}


/**
 * Initializes event listeners for the sessions tab.
 */
function initializeSessionEventListeners() {
    if (sessionSearchInput) {
        sessionSearchInput.addEventListener('input', applySessionFilters);
    }
    if (sessionZoneFilterSelect) {
        sessionZoneFilterSelect.addEventListener('change', applySessionFilters);
    }

    // Event delegation for disconnect buttons within session cards
    if (sessionCardContainer) {
        sessionCardContainer.addEventListener('click', (e) => {
            const disconnectButton = e.target.closest('[data-action="disconnect-session"]');
            if (disconnectButton) {
                e.stopPropagation(); // Prevent card expansion
                const sessionId = disconnectButton.dataset.sessionid;
                const zoneid = disconnectButton.dataset.zoneid;
                const ip = disconnectButton.dataset.ip;
                const isMy = managerSessionDetails && managerSessionDetails.sessionId === sessionId && managerSessionDetails.zoneid === zoneid;
                handleDisconnectSession(sessionId, zoneid, ip, isMy);
            }
        });
    }

    if (disconnectAllSessionsBtn) {
        disconnectAllSessionsBtn.addEventListener('click', handleDisconnectAllSessions);
    }

    if (findMySessionBtn) {
        findMySessionBtn.addEventListener('click', async () => { // Made async
            if (managerSessionDetails && managerSessionDetails.sessionId) {
                showToast(`Found your session (IP: ${managerSessionDetails.ipAddress}). Highlighting and filtering...`, 'info');
                if(sessionZoneFilterSelect) sessionZoneFilterSelect.value = ""; // Reset zone filter
                if(sessionSearchInput) sessionSearchInput.value = managerSessionDetails.sessionId; // Search by your session ID

                if (tabPanes.sessions && tabPanes.sessions.classList.contains('active')) {
                    // If already on sessions tab, ensure data is loaded (potentially from cache) and then apply filters
                    await loadSessions(); // Ensure sessions are loaded (uses cache by default)
                    applySessionFilters();
                } else {
                    setActiveTab('sessions'); // This will trigger loadSessions (which uses cache by default)
                }
                // Scroll to the card after a short delay to allow rendering
                setTimeout(() => {
                    const highlightedCard = sessionCardContainer ? sessionCardContainer.querySelector('.ring-blue-500') : null;
                    if (highlightedCard) {
                        highlightedCard.scrollIntoView({ behavior: 'smooth', block: 'center' });
                    }
                }, 300);
            } else {
                showToast("Your current session details not found. Attempting to fetch...", "warning");
                 // Attempt to fetch manager session status again if not found
                await fetchManagerSessionStatus(); // Made await
                if (!managerSessionDetails) {
                     showToast("Still couldn't find your session. Please ensure you are logged into the captive portal.", "warning");
                } else {
                    // If found now, re-trigger the find logic
                    findMySessionBtn.click();
                }
            }
        });
    }
}