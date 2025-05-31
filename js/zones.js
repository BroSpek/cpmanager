// js/zones.js

let allConfiguredZones = []; // Stores all configured zones (summary data)
let originalFullZoneDataForEdit = null; // Stores the full data of the zone being edited

/**
 * Fetches summary data for all configured captive portal zones.
 * Stores the data in `allConfiguredZones`.
 * @param {boolean} [forceRefresh=false] - If true, forces a re-fetch even if data exists.
 */
async function fetchAllZoneData(forceRefresh = false) {
    if (!forceRefresh && allConfiguredZones.length > 0 && allConfiguredZones[0].description !== undefined) {
        // Data already exists and seems populated (has description), skip re-fetch unless forced
        console.log("Using cached allConfiguredZones data.");
        return;
    }
    try {
        console.log(forceRefresh ? "Forcing refresh of allConfiguredZones." : "Fetching allConfiguredZones.");
        const data = await callApi('/settings/search_zones'); // Endpoint for zone summaries
        if (data && Array.isArray(data.rows)) {
            allConfiguredZones = data.rows;
        } else {
            allConfiguredZones = []; // Reset if data is not as expected
            console.warn("No zones found or unexpected data format from /settings/search_zones.", data);
        }
        if (allConfiguredZones.length === 0 && !(data && Array.isArray(data.rows))) { // Check if it was an API issue vs actually no zones
             // Avoid toast if API returned empty array, which is valid
        } else if (allConfiguredZones.length === 0) {
            console.warn("No captive portal zones found during fetchAllZoneData.");
        }
    } catch (error) {
        console.error("Failed to fetch all zone data for descriptions:", error.message);
        // showToast("Could not load zone summary data.", "warning"); // Toast might be redundant if callApi handles it
        allConfiguredZones = []; // Reset on error
    }
}

/**
 * Loads and displays summary information for all configured zones.
 * @param {boolean} [forceRefreshDetails=false] - If true, forces a re-fetch of all zone data before loading.
 */
async function loadZoneInfo(forceRefreshDetails = false) { // Added forceRefreshDetails
    if (!zoneListContainer) return;

    // Show skeleton loaders only if forcing a full refresh or if no zones are currently displayed
    const needsSkeleton = forceRefreshDetails || zoneListContainer.querySelectorAll('.zone-info-card').length === 0;
    if (needsSkeleton) {
        showSkeletonLoaders(zoneListContainer, 2);
    }

    try {
        // Fetch zone summary data. fetchAllZoneData has its own internal cache check.
        // Pass forceRefreshDetails to it if we need to bypass its cache.
        await fetchAllZoneData(forceRefreshDetails);

        clearContainer(zoneListContainer); // Clear previous cards before rendering

        if (!Array.isArray(allConfiguredZones) || allConfiguredZones.length === 0) {
            showNoDataMessage(zoneListContainer, "No captive portal zones configured on OPNsense.", "fas fa-folder-open");
            return;
        }

        allConfiguredZones.forEach(zoneSummary => {
            const zoneCard = document.createElement('div');
            zoneCard.className = 'zone-info-card p-3 rounded-lg shadow border relative';
            zoneCard.setAttribute('role', 'listitem');
            zoneCard.setAttribute('aria-label', `Zone: ${zoneSummary.description || `Zone ID ${zoneSummary.zoneid}`}`);

            const statusText = zoneSummary.enabled === '1' ? 'Enabled' : 'Disabled';
            const statusColor = zoneSummary.enabled === '1' ? 'bg-green-500' : 'bg-red-500';

            zoneCard.innerHTML = `
                <div class="tags-container">
                     <span class="info-tag ${statusColor} truncate" title="Status: ${statusText}">${statusText}</span>
                </div>
                <div class="card-summary cursor-pointer pb-1" role="button" tabindex="0" aria-expanded="false" aria-controls="zone-details-${zoneSummary.uuid}">
                     <div class="info-row"><span class="info-label">Name</span><span class="info-value summary-main-value">${zoneSummary.description || `Unnamed Zone (ID: ${zoneSummary.zoneid})`}</span></div>
                     <div class="info-row"><span class="info-label">Zone ID</span><span class="info-value summary-main-value">${zoneSummary.zoneid}</span></div>
					 <div class="info-row"><span class="info-label">Short UUID</span><span class="info-value summary-main-value">${zoneSummary.uuid.substring(0,8)}...</span></div>
                </div>
                <div class="card-details-content text-sm space-y-1" id="zone-details-${zoneSummary.uuid}" aria-hidden="true">Loading details...</div>`;
            zoneCard.dataset.uuid = zoneSummary.uuid;
            zoneCard.dataset.initialZoneid = zoneSummary.zoneid;
            zoneListContainer.appendChild(zoneCard);

            const summaryElement = zoneCard.querySelector('.card-summary');
            const detailsContent = zoneCard.querySelector('.card-details-content');
            if (summaryElement && detailsContent) {
                summaryElement.addEventListener('click', () => {
                    handleZoneCardClick(zoneCard, detailsContent, summaryElement);
                });
                summaryElement.addEventListener('keydown', (e) => {
                    if (e.key === 'Enter' || e.key === ' ') {
                        e.preventDefault();
                        handleZoneCardClick(zoneCard, detailsContent, summaryElement);
                    }
                });
            }
        });
    } catch (error) {
        console.error("Error in loadZoneInfo:", error);
        showNoDataMessage(zoneListContainer, "Error loading zone information.", "fas fa-exclamation-triangle");
    }
}

/**
 * Handles the click/interaction on a zone card to expand/collapse and load details.
 * @param {HTMLElement} card - The zone card element.
 * @param {HTMLElement} detailsContainer - The container for detailed zone info.
 * @param {HTMLElement} summaryElement - The summary element that was clicked.
 */
async function handleZoneCardClick(card, detailsContainer, summaryElement) {
    const isCurrentlyExpanded = detailsContainer.classList.contains('expanded');
    toggleCardDetails(card, zoneListContainer);
    const isNowExpanded = detailsContainer.classList.contains('expanded');

    summaryElement.setAttribute('aria-expanded', String(isNowExpanded));
    detailsContainer.setAttribute('aria-hidden', String(!isNowExpanded));


    // Load details only if newly expanded and not already loaded (or if it previously failed)
    if (isNowExpanded && (detailsContainer.innerHTML.includes('Loading details...') || detailsContainer.innerHTML.includes('Error loading details'))) {
        const uuid = card.dataset.uuid;
        // const initialZoneId = card.dataset.initialZoneid;

        try {
            // Details for a specific zone are less likely to be stale during a session unless edited.
            // Consider if a forced refresh for individual zone GET is needed. For now, always fetches.
            const zoneDetailsResponse = await callApi(`/settings/get_zone/${uuid}`);
            let detailsHtml = '';

            const createInfoRowDiv = (label, value) => {
                const displayValue = (value === null || value === undefined || String(value).trim() === '') ? placeholderValue : String(value);
                return `<div class="info-row"><span class="info-label">${label}</span> <span class="info-value">${displayValue}</span></div>`;
            };

            // Display UUID clearly from summary data if available, then full from details
            detailsHtml += createInfoRowDiv('UUID', uuid);


            if (zoneDetailsResponse && zoneDetailsResponse.zone) {
                const zoneData = zoneDetailsResponse.zone;
                for (const [key, value] of Object.entries(zoneData)) {
                    if (key === 'uuid' || key === 'description' || key === 'enabled' || key === 'zoneid') continue; // Already in summary/tag or handled above

                    const readableKey = zoneFieldMappings[key] || key.charAt(0).toUpperCase() + key.slice(1).replace(/([A-Z])/g, ' $1');
                    let displayValue;

                    if (key === 'idletimeout' || key === 'hardtimeout') {
                        displayValue = value ? formatDuration(parseInt(value), 'minutes') : placeholderValue;
                    } else if (['disableRules', 'alwaysSendAccountingReqs', 'concurrentlogins', 'extendedPreAuthData'].includes(key)) {
                        displayValue = String(value) === '1' ? 'Yes' : (String(value) === '0' ? 'No' : String(value));
                    } else if (typeof value === 'object' && value !== null && Object.values(value).some(v_obj => typeof v_obj === 'object' && v_obj !== null && 'selected' in v_obj)) {
                        displayValue = formatOpnsenseSelectable(value);
                    } else if (Array.isArray(value)) {
                        displayValue = value.length > 0 ? value.join(', ') : placeholderValue;
                    }
                    else {
                        displayValue = String(value);
                    }

                    if (typeof displayValue === 'string' && displayValue.length > 150) { // Check type before using .length
                        displayValue = displayValue.substring(0, 150) + '...';
                    }
                    detailsHtml += createInfoRowDiv(readableKey, displayValue || placeholderValue);
                }
            } else {
                detailsHtml += '<div>No further detailed properties found or unexpected response format.</div>';
            }

            detailsHtml += `
                <p class="mt-3">
                    <button class="btn btn-secondary btn-sm w-full" data-action="edit-zone" data-uuid="${uuid}">
                        <i class="fas fa-edit mr-1"></i> Edit Zone Settings
                    </button>
                </p>
            `;
            detailsContainer.innerHTML = detailsHtml;
        } catch (error) {
            console.error(`Error loading details for zone ${uuid}:`, error);
            detailsContainer.innerHTML = '<p class="text-red-500">Error loading details. Check console.</p>';
        }
    }
}


/**
 * Fetches zone data and opens the edit zone modal.
 * @param {string} uuid - The UUID of the zone to edit.
 */
async function fetchAndOpenEditZoneModal(uuid) {
    if (!editZoneModal) {
        console.error("Edit Zone Modal element not found.");
        return;
    }
    try {
        const response = await callApi(`/settings/get_zone/${uuid}`); // This fetches fresh data for editing
        if (response && response.zone) {
            originalFullZoneDataForEdit = response; // Store for potential reference, though not used for building payload anymore
            populateEditZoneModal(response.zone, uuid);
            editZoneModal.classList.remove('modal-inactive');
            editZoneModal.classList.add('modal-active');
            if(zoneEditDescriptionInput) zoneEditDescriptionInput.focus();
        } else {
            showToast(`Could not load details for zone ${uuid}. API response issue.`, 'error');
            originalFullZoneDataForEdit = null;
        }
    } catch (error) {
        // showToast(`Error fetching zone details for editing: ${error.message}`, 'error'); // callApi usually handles toast
        originalFullZoneDataForEdit = null;
    }
}

/**
 * Populates the edit zone modal with data for the given zone.
 * @param {object} zoneData - The detailed data for the zone.
 * @param {string} uuid - The UUID of the zone.
 */
function populateEditZoneModal(zoneData, uuid) {
    if (!editZoneUuidInput || !editZoneModalTitleName || !zoneEditDescriptionInput || !zoneEditEnabledCheckbox || !zoneEditEnabledText || !zoneEditAllowedAddressesTextarea || !zoneEditAllowedMACAddressesTextarea) {
        console.error("One or more edit zone modal form elements are missing.");
        showToast("Cannot populate edit zone dialog: form elements missing.", "error");
        return;
    }

    /**
     * Helper function to format field values for textareas.
     * Converts OPNsense-style selectable objects to a comma-separated string of their 'value' properties.
     * If the input is already a string, it's returned as is.
     * Other object types will result in an empty string to avoid "[objectObject]".
     * @param {*} fieldValue - The value from zoneData.
     * @returns {string} A string suitable for textarea population.
     */
    const formatForTextarea = (fieldValue) => {
        if (typeof fieldValue === 'object' && fieldValue !== null && !Array.isArray(fieldValue)) {
            // Check if it's likely an OPNsense-style selectable object
            // (i.e., its own properties are objects containing 'value' and 'selected')
            const isOpnSelectableObject = Object.values(fieldValue).some(
                item => typeof item === 'object' && item !== null && item.hasOwnProperty('selected') && item.hasOwnProperty('value')
            );

            if (isOpnSelectableObject) {
                const selectedValues = [];
                for (const key in fieldValue) {
                    // Check if the item is an object and has 'selected' and 'value' properties
                    if (typeof fieldValue[key] === 'object' && fieldValue[key] !== null &&
                        fieldValue[key].hasOwnProperty('selected') && fieldValue[key].hasOwnProperty('value')) {
                        
                        // Consider an item selected if its 'selected' property is 1, '1', or true
                        if (fieldValue[key].selected === 1 || fieldValue[key].selected === '1' || fieldValue[key].selected === true) {
                            selectedValues.push(fieldValue[key].value);
                        }
                    }
                }
                return selectedValues.join(','); // Comma-separated, no space (as per API expectation for lists)
            } else {
                // If it's an object but not the expected OPNsense selectable format,
                // log it and return empty to prevent "[objectObject]".
                console.warn("Encountered an unexpected object type for textarea,_was_not_OPNsense_selectable:", fieldValue);
                return '';
            }
        }
        if (typeof fieldValue === 'string') {
            // If it's already a string, use it directly.
            // The API expects comma-separated, so if the string from GET is different,
            // this might need further transformation based on actual GET response format.
            // For now, assuming if it's a string, it's either correct or the user will fix it.
            return fieldValue;
        }
        // For null, undefined, arrays, or other unexpected types, return an empty string.
        return '';
    };

    editZoneUuidInput.value = uuid;
    editZoneModalTitleName.textContent = zoneData.description || `Zone ${zoneData.zoneid || uuid.substring(0, 8)}`;
    zoneEditDescriptionInput.value = zoneData.description || '';

    const isEnabled = zoneData.enabled === '1';
    zoneEditEnabledCheckbox.checked = isEnabled;
    zoneEditEnabledText.textContent = isEnabled ? 'Enabled' : 'Disabled';

    zoneEditAllowedAddressesTextarea.value = formatForTextarea(zoneData.allowedAddresses);
    zoneEditAllowedMACAddressesTextarea.value = formatForTextarea(zoneData.allowedMACAddresses);
}

/**
 * Saves the edited zone settings via an API call.
 * Sends only the 4 editable fields.
 */
async function saveZoneSettings() {
    if (!editZoneUuidInput || !submitEditZoneBtn) {
        showToast('Zone UUID is missing or save button not found. Cannot save.', 'error');
        return;
    }
    const uuid = editZoneUuidInput.value;

    // These are the only settings being actively managed by your current edit modal
    const zoneSettingsActuallyEdited = {
        description: zoneEditDescriptionInput.value.trim(),
        enabled: zoneEditEnabledCheckbox.checked ? '1' : '0',
        allowedAddresses: zoneEditAllowedAddressesTextarea.value.replace(/\s+/g, ''),
        allowedMACAddresses: zoneEditAllowedMACAddressesTextarea.value.replace(/\s+/g, '').toLowerCase()
    };

    // Construct the payload with ONLY the settings edited in this modal.
    const finalApiPayload = {
        zone: zoneSettingsActuallyEdited
    };

    submitEditZoneBtn.disabled = true;
    submitEditZoneBtn.innerHTML = '<i class="fas fa-spinner fa-spin mr-2"></i>Saving...';

    try {
        const result = await callApi(`/settings/set_zone/${uuid}`, 'POST', finalApiPayload);

        if (result && result.result === 'saved') {
            showToast(`Zone settings updated for "${zoneSettingsActuallyEdited.description || uuid.substring(0, 8)}".`, 'success');
            hideModal(editZoneModal);
            originalFullZoneDataForEdit = null; // Clear original data cache

            await loadZoneInfo(true); // Force refresh of zone summaries and re-render the zone list

            showToast('Applying changes by reconfiguring service...', 'info', 7000);
            const reconfigResult = await callApi('/service/reconfigure', 'POST', {});
            if (reconfigResult && (reconfigResult.status === 'ok' || (reconfigResult.message && reconfigResult.message.toLowerCase().includes('ok')))) {
                showToast('Captive portal service reconfigured successfully.', 'success');
            } else {
                showToast(`Service reconfigure status: ${reconfigResult ? (reconfigResult.status || reconfigResult.message || JSON.stringify(reconfigResult)) : 'Unknown'}. Manual check may be needed.`, 'warning', 10000);
            }

        } else {
            let errorMessage = `Failed to save zone settings: ${result?.message || result?.result || 'Unknown API error'}`;
            if (result && result.validations) {
                for (const key in result.validations) {
                    errorMessage += `\n- ${key}: ${result.validations[key]}`;
                }
            }
            showToast(errorMessage, 'error', 10000);
        }
    } catch (error) {
        console.error("Error during saveZoneSettings:", error.message);
        // Assuming callApi handles toast for network/request errors
    } finally {
        submitEditZoneBtn.disabled = false;
        submitEditZoneBtn.innerHTML = 'Save Changes';
    }
}


/**
 * Initializes event listeners for the zone information tab.
 */
function initializeZoneEventListeners() {
    if (zoneListContainer) {
        zoneListContainer.addEventListener('click', async (e) => {
            const editButton = e.target.closest('[data-action="edit-zone"]');
            if (editButton) {
                e.stopPropagation();
                const uuid = editButton.dataset.uuid;
                if (uuid) {
                    fetchAndOpenEditZoneModal(uuid);
                } else {
                    console.error("Edit button clicked but no UUID found on dataset.");
                }
            }
        });
    }

    if (submitEditZoneBtn) {
        submitEditZoneBtn.addEventListener('click', saveZoneSettings);
    }
    if (cancelEditZoneBtn) {
        cancelEditZoneBtn.addEventListener('click', () => {
            hideModal(editZoneModal);
            originalFullZoneDataForEdit = null; // Clear original data cache
        });
    }
    if (zoneEditEnabledCheckbox && zoneEditEnabledText) {
        zoneEditEnabledCheckbox.addEventListener('change', function() {
            zoneEditEnabledText.textContent = this.checked ? 'Enabled' : 'Disabled';
        });
    }
}
