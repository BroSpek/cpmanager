// js/vouchers.js

let currentVouchers = []; // Stores vouchers for the currently selected group (for rendering)
let lastGeneratedVouchers = []; // Stores the last batch of generated vouchers for CSV download

// Caching variables
let cachedVoucherProviders = [];
let cachedVoucherGroups = {}; // Key: providerId, Value: array of group names
let cachedVouchersData = {}; // Key: `${providerId}_${groupName}`, Value: array of voucher objects

/**
 * Loads voucher providers from the API and populates the provider selection dropdown.
 * @param {boolean} [forceRefresh=false] - If true, forces a re-fetch even if data exists.
 */
async function loadVoucherProviders(forceRefresh = false) {
	// Added forceRefresh
	if (!voucherProviderSelect) return;

	if (!forceRefresh && cachedVoucherProviders.length > 0) {
		console.log("Using cached voucher providers.");
		populateVoucherProviderSelect(cachedVoucherProviders); // Repopulate select from cache
		// Trigger selection handler if a provider was auto-selected or restored
		if (voucherProviderSelect.value) {
			handleProviderSelection(voucherProviderSelect.value);
		}
		return;
	}

	voucherProviderSelect.innerHTML = '<option value="">Loading providers...</option>';
	if (voucherGroupSelect) voucherGroupSelect.innerHTML = '<option value="">Select a provider first...</option>';
	if (voucherCardContainer) clearContainer(voucherCardContainer);
	disableVoucherActionButtons(true, true, true);

	try {
		const providers = await callApi("/voucher/list_providers");
		if (providers && Array.isArray(providers)) {
			cachedVoucherProviders = providers; // Cache the fetched providers
			populateVoucherProviderSelect(providers);
		} else {
			cachedVoucherProviders = []; // Reset cache on error/unexpected format
			voucherProviderSelect.innerHTML = '<option value="">Error loading (or no providers).</option>';
			if (providers && !Array.isArray(providers)) {
				console.error("Error loading voucher providers: Unexpected format", providers);
				showToast("Could not load voucher providers: unexpected format.", "error");
			} else if (!providers) {
				// Covers null or undefined response
				showToast(
					"Failed to fetch voucher providers. Endpoint might not exist or no providers configured.",
					"warning"
				);
			}
		}
	} catch (error) {
		cachedVoucherProviders = []; // Reset cache on exception
		voucherProviderSelect.innerHTML = '<option value="">Error loading providers.</option>';
		console.error("Exception in loadVoucherProviders:", error);
		// Error toast is handled by callApi
	}
}

/**
 * Populates the voucher provider select dropdown from a list of providers.
 * @param {Array<string>} providers - Array of provider names.
 */
function populateVoucherProviderSelect(providers) {
	if (!voucherProviderSelect) return;

	if (providers.length === 0) {
		voucherProviderSelect.innerHTML = '<option value="">No voucher providers found.</option>';
		showToast("No voucher providers configured on OPNsense.", "warning");
		disableVoucherActionButtons(true, true, true);
		return;
	}

	voucherProviderSelect.innerHTML = '<option value="">-- Select Provider --</option>';
	const savedProvider = localStorage.getItem("selectedVoucherProvider");
	let providerToSelect = null;

	providers.forEach((provider) => {
		const option = document.createElement("option");
		option.value = provider;
		option.textContent = provider;
		voucherProviderSelect.appendChild(option);
		if (provider === savedProvider) {
			providerToSelect = savedProvider;
		}
	});

	if (providers.length === 1 && !providerToSelect) {
		// Auto-select if only one provider AND no saved preference
		voucherProviderSelect.value = providers[0];
		localStorage.setItem("selectedVoucherProvider", providers[0]);
		handleProviderSelection(providers[0]);
	} else if (providerToSelect) {
		// Restore last selected provider
		voucherProviderSelect.value = providerToSelect;
		handleProviderSelection(providerToSelect);
	} else {
		disableVoucherActionButtons(true, true, true); // No provider selected yet
	}
}

/**
 * Handles the selection of a voucher provider.
 * Loads voucher groups for the selected provider.
 * @param {string} providerId - The ID of the selected provider.
 * @param {boolean} [forceRefreshGroups=false] - If true, forces a re-fetch of groups.
 */
function handleProviderSelection(providerId, forceRefreshGroups = false) {
	// Added forceRefreshGroups
	if (providerId) {
		localStorage.setItem("selectedVoucherProvider", providerId);
		loadVoucherGroups(providerId, forceRefreshGroups);
		// REMOVE: disableVoucherActionButtons(false, true, true); // This line was causing the premature disabling
	} else {
		localStorage.removeItem("selectedVoucherProvider");
		if (voucherGroupSelect) voucherGroupSelect.innerHTML = '<option value="">Select a provider first...</option>';
		if (voucherCardContainer) clearContainer(voucherCardContainer);
		disableVoucherActionButtons(true, true, true);
	}
}

/**
 * Loads voucher groups for a given provider and populates the group selection dropdown.
 * @param {string} providerId - The ID of the provider.
 * @param {boolean} [forceRefresh=false] - If true, forces a re-fetch even if data exists.
 */
async function loadVoucherGroups(providerId, forceRefresh = false) {
	// Added forceRefresh
	if (!providerId || !voucherGroupSelect) {
		if (voucherGroupSelect) voucherGroupSelect.innerHTML = '<option value="">Select a provider first...</option>';
		if (voucherCardContainer) clearContainer(voucherCardContainer);
		disableVoucherActionButtons(true, true, true);
		return;
	}

	const cacheKey = providerId;
	if (!forceRefresh && cachedVoucherGroups[cacheKey] && cachedVoucherGroups[cacheKey].length > 0) {
		console.log(`Using cached voucher groups for provider ${providerId}.`);
		populateVoucherGroupSelect(providerId, cachedVoucherGroups[cacheKey]);
		// Trigger selection if a group was auto-selected or restored
		if (voucherGroupSelect.value) {
			await loadVouchersForGroup(providerId, voucherGroupSelect.value); // await here
		}
		return;
	}

	voucherGroupSelect.innerHTML = '<option value="">Loading groups...</option>';
	if (voucherCardContainer && (!cachedVouchersData[`${providerId}_${voucherGroupSelect.value}`] || forceRefresh)) {
		// only show skeleton if vouchers also need loading
		showSkeletonLoaders(voucherCardContainer, 1);
	}
	disableVoucherActionButtons(false, true, true); // Create enabled, group actions disabled

	try {
		const groups = await callApi(`/voucher/list_voucher_groups/${providerId}`);
		if (groups && Array.isArray(groups)) {
			cachedVoucherGroups[cacheKey] = groups; // Cache the fetched groups
			populateVoucherGroupSelect(providerId, groups);
		} else {
			cachedVoucherGroups[cacheKey] = []; // Reset cache for this provider on error/unexpected format
			console.error(
				`Error loading voucher groups for provider ${providerId}: API response is not an array or is undefined.`,
				groups
			);
			voucherGroupSelect.innerHTML = '<option value="">Error: Unexpected data for groups.</option>';
			if (voucherCardContainer)
				showNoDataMessage(voucherCardContainer, "Error loading voucher groups.", "fas fa-exclamation-triangle");
			disableVoucherActionButtons(false, true, true);
		}
	} catch (error) {
		cachedVoucherGroups[cacheKey] = []; // Reset cache on exception
		voucherGroupSelect.innerHTML = '<option value="">Error loading groups.</option>';
		if (voucherCardContainer)
			showNoDataMessage(voucherCardContainer, "Error loading voucher groups.", "fas fa-exclamation-triangle");
		disableVoucherActionButtons(false, true, true);
		console.error(`Exception in loadVoucherGroups for provider ${providerId}:`, error);
	}
}

/**
 * Populates the voucher group select dropdown.
 * @param {string} providerId - The ID of the provider (for localStorage key).
 * @param {Array<string>} groups - Array of group names.
 */
function populateVoucherGroupSelect(providerId, groups) {
	if (!voucherGroupSelect) return;

	const currentVal = localStorage.getItem(`voucherGroupFilter_${providerId}`) || "";
	voucherGroupSelect.innerHTML = '<option value="">-- Select a Group --</option>'; // Reset options

	if (groups.length > 0) {
		groups.forEach((group) => {
			const option = document.createElement("option");
			option.value = group;
			option.textContent = group;
			voucherGroupSelect.appendChild(option);
		});

		// Attempt to set the value from localStorage if it's a valid option
		if (currentVal && groups.includes(currentVal)) {
			voucherGroupSelect.value = currentVal;
		} else if (currentVal && !groups.includes(currentVal)) {
			// If localStorage has a value not in current group options,
			// it's effectively an invalid/stale selection.
			// Ensure the select element reflects no valid group is selected.
			voucherGroupSelect.value = ""; // Default to "Select a Group"
		}
	} else {
		// No groups for this provider, ensure select is empty.
		voucherGroupSelect.value = "";
	}

	// After populating and attempting to set the value,
	// base button state on the FINAL state of voucherGroupSelect.value
	if (voucherGroupSelect.value) {
		// A group is selected
		disableVoucherActionButtons(false, false, false); // Create enabled, group actions enabled
		loadVouchersForGroup(providerId, voucherGroupSelect.value); // Load data for the selected group
	} else {
		// No group is selected
		if (voucherCardContainer) {
			if (groups.length === 0 && providerId) {
				showNoDataMessage(
					voucherCardContainer,
					`No voucher groups found for provider: <strong>${providerId}</strong>. You can create vouchers to start a new group.`,
					"fas fa-folder-open"
				);
			} else {
				showNoDataMessage(voucherCardContainer, "Select a group to see vouchers.", "fas fa-ticket-alt");
			}
		}
		disableVoucherActionButtons(false, true, true); // Create enabled, group actions disabled
	}
}

/**
 * Loads vouchers for a specific group and provider.
 * @param {string} providerId - The ID of the provider.
 * @param {string} groupName - The name of the voucher group.
 * @param {boolean} [forceRefresh=false] - If true, forces a re-fetch even if data exists.
 */
async function loadVouchersForGroup(providerId, groupName, forceRefresh = false) {
	// Added forceRefresh
	if (!providerId || !groupName || !voucherCardContainer) {
		if (voucherCardContainer)
			showNoDataMessage(voucherCardContainer, "Provider or group not selected.", "fas fa-info-circle");
		currentVouchers = [];
		renderVouchers([], groupName); // Clear display
		return;
	}

	const cacheKey = `${providerId}_${groupName}`;
	if (!forceRefresh && cachedVouchersData[cacheKey]) {
		console.log(`Using cached vouchers for group ${groupName} (Provider: ${providerId}).`);
		currentVouchers = cachedVouchersData[cacheKey];
		renderVouchers(currentVouchers, groupName);
		if (currentVouchers.length === 0) {
			showNoDataMessage(voucherCardContainer, `No vouchers found in group "${groupName}".`, "fas fa-folder-open");
		}
		return;
	}

	showSkeletonLoaders(voucherCardContainer, 1);

	try {
		const vouchers = await callApi(`/voucher/list_vouchers/${providerId}/${groupName}`);
		if (vouchers && Array.isArray(vouchers)) {
			cachedVouchersData[cacheKey] = vouchers; // Cache the fetched vouchers
			currentVouchers = vouchers;
			renderVouchers(currentVouchers, groupName);
			if (vouchers.length === 0) {
				showNoDataMessage(
					voucherCardContainer,
					`No vouchers found in group "${groupName}".`,
					"fas fa-folder-open"
				);
			}
		} else {
			cachedVouchersData[cacheKey] = []; // Reset cache for this group on error
			currentVouchers = [];
			renderVouchers([], groupName); // Clear display
			console.error(
				`Error loading vouchers for group ${groupName} (Provider: ${providerId}): API response is not an array or is undefined.`,
				vouchers
			);
			showNoDataMessage(
				voucherCardContainer,
				"Error: Unexpected data for vouchers.",
				"fas fa-exclamation-triangle"
			);
		}
	} catch (error) {
		cachedVouchersData[cacheKey] = []; // Reset cache on exception
		currentVouchers = [];
		renderVouchers([], groupName); // Clear display
		showNoDataMessage(voucherCardContainer, "Error loading vouchers.", "fas fa-exclamation-triangle");
		console.error(`Exception in loadVouchersForGroup for ${groupName} (Provider: ${providerId}):`, error);
	}
}

/**
 * Renders voucher cards in the UI.
 * @param {Array<object>} vouchers - Array of voucher objects.
 * @param {string} groupName - The name of the group these vouchers belong to.
 */
function renderVouchers(vouchers, groupName) {
	if (!voucherCardContainer) return;
	clearContainer(voucherCardContainer);

	if (!vouchers || !Array.isArray(vouchers) || vouchers.length === 0) {
		// Message is handled by caller (loadVouchersForGroup or populateVoucherGroupSelect) if no vouchers
		return;
	}

	vouchers.forEach((voucher) => {
		const card = document.createElement("div");
		card.className = "voucher-card p-3 rounded-lg shadow border relative";
		card.setAttribute("role", "listitem");
		card.setAttribute("aria-label", `Voucher ${voucher.username}`);

		let stateTagColor = "bg-red-500"; // Default for 'expired' or unknown
		if (voucher.state === "valid") {
			stateTagColor = "bg-green-500";
		} else if (voucher.state === "unused") {
			stateTagColor = "bg-sky-500"; // Using sky blue for unused
		}

		card.innerHTML = `
            <div class="tags-container">
                <span class="info-tag ${stateTagColor} truncate" title="State: ${voucher.state}">${voucher.state}</span>
            </div>
            <div class="card-summary cursor-pointer pb-1" role="button" tabindex="0" aria-expanded="false" aria-controls="voucher-details-${
				voucher.username
			}">
                 <div class="info-row"><span class="info-label">Voucher Code</span><span class="info-value summary-main-value">${
						voucher.username
					}</span></div>
            </div>
            <div class="card-details-content text-sm space-y-1" id="voucher-details-${
				voucher.username
			}" aria-hidden="true">
                <div class="info-row"><span class="info-label">Validity</span> <span class="info-value">${formatDuration(
					voucher.validity,
					"seconds"
				)}</span></div>
                <div class="info-row"><span class="info-label">Start Time</span> <span class="info-value">${formatVoucherTimestamp(
					voucher.starttime
				)}</span></div>
                <div class="info-row"><span class="info-label">End Time</span> <span class="info-value">${formatVoucherTimestamp(
					voucher.endtime
				)}</span></div>
                <div class="info-row"><span class="info-label">Expires At</span><span class="info-value">${
					voucher.expirytime && voucher.expirytime !== 0
						? formatVoucherTimestamp(voucher.expirytime)
						: placeholderValue === "—"
						? "Never"
						: placeholderValue
				}</span></div>			
                ${
					voucher.state !== "expired"
						? `<p class="mt-3">
                    <button class="btn btn-warning w-full" data-action="revoke-voucher" data-voucher="${voucher.username}" data-group="${groupName}">
                        <i class="fas fa-times-circle mr-1"></i>Revoke Voucher
                    </button>
                 </p>`
						: ""
				}
            </div>
        `;
		voucherCardContainer.appendChild(card);

		const summaryElement = card.querySelector(".card-summary");
		const detailsContent = card.querySelector(".card-details-content");
		if (summaryElement && detailsContent) {
			summaryElement.addEventListener("click", () => {
				toggleCardDetails(card, voucherCardContainer);
				summaryElement.setAttribute("aria-expanded", detailsContent.classList.contains("expanded"));
				detailsContent.setAttribute("aria-hidden", !detailsContent.classList.contains("expanded"));
			});
			summaryElement.addEventListener("keydown", (e) => {
				// Keyboard accessibility
				if (e.key === "Enter" || e.key === " ") {
					e.preventDefault();
					toggleCardDetails(card, voucherCardContainer);
					summaryElement.setAttribute("aria-expanded", detailsContent.classList.contains("expanded"));
					detailsContent.setAttribute("aria-hidden", !detailsContent.classList.contains("expanded"));
				}
			});
		}
	});
}

/**
 * Handles the voucher generation modal visibility and form reset.
 */
function openGenerateVoucherModal() {
	if (!generateVoucherModal || !voucherProviderSelect) return;
	const selectedProvider = voucherProviderSelect.value;
	if (!selectedProvider) {
		showToast("Please select a voucher provider before generating vouchers.", "error");
		return;
	}

	// Reset form fields to defaults
	if (voucherGroupNameInput) voucherGroupNameInput.value = ""; // Clear group name
	if (voucherCountSelect) voucherCountSelect.value = "10"; // Default count
	if (voucherCountCustom) {
		voucherCountCustom.classList.add("hidden");
		voucherCountCustom.value = "1";
	}
	if (voucherLifetimeSelect) voucherLifetimeSelect.value = "240"; // Default lifetime (4 hours in minutes)
	if (voucherLifetimeCustom) {
		voucherLifetimeCustom.classList.add("hidden");
		voucherLifetimeCustom.value = "";
	}
	if (voucherUsageSelect) voucherUsageSelect.value = "0"; // Default usage (Never expires)
	if (voucherUsageCustom) {
		voucherUsageCustom.classList.add("hidden");
		voucherUsageCustom.value = "";
	}

	generateVoucherModal.classList.remove("modal-inactive");
	generateVoucherModal.classList.add("modal-active");
	if (voucherCountSelect) voucherCountSelect.focus();
}

/**
 * Handles the submission of the generate voucher form.
 */
async function handleSubmitGenerateVoucher() {
	if (!voucherProviderSelect || !submitGenerateVoucherBtn) return;

	const selectedProvider = voucherProviderSelect.value;
	if (!selectedProvider) {
		showToast("Voucher provider not selected. Cannot generate vouchers.", "error");
		return;
	}

	let count =
		voucherCountSelect.value === "custom" ? parseInt(voucherCountCustom.value) : parseInt(voucherCountSelect.value);
	if (isNaN(count) || count < 1) {
		showToast("Number of vouchers must be at least 1.", "error");
		return;
	}

	let lifetimeInSeconds;
	if (voucherLifetimeSelect.value === "custom") {
		const customMinutes = parseInt(voucherLifetimeCustom.value);
		if (isNaN(customMinutes) || customMinutes < 1) {
			showToast("Custom Validity (minutes) must be at least 1.", "error");
			return;
		}
		lifetimeInSeconds = customMinutes * 60;
	} else {
		lifetimeInSeconds = parseInt(voucherLifetimeSelect.value) * 60; // Value is already in minutes
	}

	let usageInSeconds; // OPNsense API expects 'expirytime' in seconds from generation
	if (voucherUsageSelect.value === "custom") {
		const customHours = parseInt(voucherUsageCustom.value);
		if (isNaN(customHours) || customHours < 0) {
			showToast("Custom Expires In (hours) must be a non-negative number.", "error");
			return;
		}
		usageInSeconds = customHours * 3600;
	} else {
		const selectedUsageHours = parseInt(voucherUsageSelect.value);
		if (isNaN(selectedUsageHours)) {
			showToast("Invalid Expires In selection.", "error");
			return;
		}
		usageInSeconds = selectedUsageHours * 3600;
	}

	const now = new Date();
	const defaultGroupName = `g${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, "0")}${String(
		now.getDate()
	).padStart(2, "0")}${String(now.getHours()).padStart(2, "0")}${String(now.getMinutes()).padStart(2, "0")}`;
	const groupname = voucherGroupNameInput.value.trim() || defaultGroupName;

	const payload = {
		count: String(count),
		validity: String(lifetimeInSeconds), // How long the voucher is valid once activated (in seconds)
		expirytime: String(usageInSeconds), // How long until the UNUSED voucher expires (in seconds from generation, 0 for never)
		vouchergroup: groupname,
	};

	submitGenerateVoucherBtn.disabled = true;
	submitGenerateVoucherBtn.innerHTML = '<i class="fas fa-spinner fa-spin mr-2"></i>Generating...';

	try {
		const result = await callApi(`/voucher/generate_vouchers/${selectedProvider}`, "POST", payload);
		if (result && Array.isArray(result) && result.length > 0 && result[0].username) {
			// Check if result is an array of vouchers
			lastGeneratedVouchers = result;
			showToast(
				`Vouchers generated successfully in group "${groupname}" for provider "${selectedProvider}". CSV downloading...`,
				"success"
			);
			downloadVouchersAsCSV(lastGeneratedVouchers);
			hideModal(generateVoucherModal);
			// Force refresh groups and then vouchers for the new group
			await loadVoucherGroups(selectedProvider, true);
			if (voucherGroupSelect) voucherGroupSelect.value = groupname; // Attempt to select the new group
			await loadVouchersForGroup(selectedProvider, groupname, true);
		} else if (
			result &&
			result.status === "ok_text" &&
			result.message &&
			result.message.toLowerCase().includes("created")
		) {
			showToast(
				`Vouchers generated for group "${groupname}". (API Text OK). No CSV data from this response.`,
				"success"
			);
			lastGeneratedVouchers = [];
			hideModal(generateVoucherModal);
			await loadVoucherGroups(selectedProvider, true);
			if (voucherGroupSelect) voucherGroupSelect.value = groupname;
			await loadVouchersForGroup(selectedProvider, groupname, true);
		} else {
			showToast(
				`Failed to generate vouchers: ${
					result.message ||
					(result.status === "error" ? "API reported an error." : "Unknown error or no vouchers returned.")
				}`,
				"error"
			);
			lastGeneratedVouchers = [];
		}
	} catch (error) {
		lastGeneratedVouchers = [];
	} finally {
		submitGenerateVoucherBtn.disabled = false;
		submitGenerateVoucherBtn.innerHTML = "Generate";
	}
}

/**
 * Triggers a CSV download for the provided voucher data.
 * @param {Array<object>} vouchers - Array of voucher objects to include in the CSV.
 */
function downloadVouchersAsCSV(vouchers) {
	if (!vouchers || vouchers.length === 0) {
		showToast("No voucher data to download.", "warning");
		return;
	}
	const headers = "username,password,vouchergroup,expirytime_seconds,validity_seconds";
	const csvRows = [headers];

	vouchers.forEach((voucher) => {
		const row = [
			`"${voucher.username || ""}"`,
			`"${voucher.password || ""}"`,
			`"${voucher.vouchergroup || ""}"`,
			voucher.expirytime,
			voucher.validity,
		].join(",");
		csvRows.push(row);
	});

	const csvString = csvRows.join("\n");
	const blob = new Blob([csvString], { type: "text/csv;charset=utf-8;" });
	const link = document.createElement("a");

	if (link.download !== undefined) {
		const url = URL.createObjectURL(blob);
		const groupName = vouchers[0].vouchergroup || "vouchers";
		const timestamp = new Date().toISOString().slice(0, 10).replace(/-/g, "");
		link.setAttribute("href", url);
		link.setAttribute("download", `${groupName}_${timestamp}.csv`);
		link.style.visibility = "hidden";
		document.body.appendChild(link);
		link.click();
		document.body.removeChild(link);
		URL.revokeObjectURL(url);
	} else {
		showToast("CSV download not supported by your browser.", "error");
	}
}

/**
 * Handles revoking a single voucher.
 */
async function handleRevokeVoucher(providerId, voucherCode, groupName) {
	if (!providerId) {
		showToast("Voucher provider not selected. Cannot revoke.", "error");
		return;
	}
	showConfirmationModal(
		"Revoke Voucher?",
		`Are you sure you want to revoke voucher <strong>${voucherCode}</strong> for provider "<strong>${providerId}</strong>"? This action marks it as expired and cannot be undone.`,
		async () => {
			try {
				const result = await callApi(`/voucher/expire_voucher/${providerId}`, "POST", {
					username: voucherCode,
				});
				if (result && result.status !== "error") {
					showToast(`Voucher ${voucherCode} processed for expiration.`, "success");
				} else if (result && result.status === "error") {
					showToast(
						`Voucher ${voucherCode} could not be expired. API: ${result.message || "Error"}`,
						"warning"
					);
				} else {
					showToast(
						`Voucher ${voucherCode} expiration processed with unknown API response. Status: ${
							result.status || "N/A"
						}.`,
						"info"
					);
				}
				await loadVouchersForGroup(providerId, groupName, true); // Force refresh voucher list
			} catch (error) {
				// Error toast handled by callApi
			}
		}
	);
}

/**
 * Handles dropping all expired vouchers for the selected provider and group.
 */
async function handleDropExpiredVouchers() {
	if (!voucherProviderSelect || !voucherGroupSelect) return;
	const selectedProvider = voucherProviderSelect.value;
	const selectedGroup = voucherGroupSelect.value;
	if (!selectedProvider) {
		showToast("Please select a voucher provider first.", "error");
		return;
	}
	if (!selectedGroup) {
		showToast("Please select a voucher group first.", "error");
		return;
	}

	showConfirmationModal(
		"Drop Expired Vouchers?",
		`Are you sure you want to remove all expired vouchers from group "<strong>${selectedGroup}</strong>" for provider "<strong>${selectedProvider}</strong>"?`,
		async () => {
			try {
				const result = await callApi(
					`/voucher/drop_expired_vouchers/${selectedProvider}/${selectedGroup}`,
					"POST",
					{}
				);
				if (result && result.status === "drop") {
					showToast(
						`Expired vouchers from group "${selectedGroup}" (Provider: ${selectedProvider}) cleaned up. Count: ${
							result.count || 0
						}`,
						"success"
					);
				} else {
					showToast(
						`Cleanup for group "${selectedGroup}" (Provider: ${selectedProvider}) processed. Status: ${
							result.status || "unknown"
						}. Count: ${result.count || 0}`,
						"info"
					);
				}
				await loadVouchersForGroup(selectedProvider, selectedGroup, true); // Force refresh
			} catch (error) {
				// Error toast handled by callApi
			}
		}
	);
}

/**
 * Handles dropping an entire voucher group.
 */
async function handleDropVoucherGroup() {
	if (!voucherProviderSelect || !voucherGroupSelect) return;
	const selectedProvider = voucherProviderSelect.value;
	const selectedGroup = voucherGroupSelect.value;
	if (!selectedProvider) {
		showToast("Please select a voucher provider first.", "warning");
		return;
	}
	if (!selectedGroup) {
		showToast("Please select a voucher group to delete.", "warning");
		return;
	}

	showConfirmationModal(
		"Drop Voucher Group?",
		`Are you sure you want to delete the entire voucher group "<strong>${selectedGroup}</strong>" for provider "<strong>${selectedProvider}</strong>"? This will delete all vouchers within it and cannot be undone.`,
		async () => {
			try {
				const result = await callApi(
					`/voucher/drop_voucher_group/${selectedProvider}/${selectedGroup}`,
					"POST",
					{}
				);
				if (result && result.status !== "error") {
					showToast(
						`Voucher group "${selectedGroup}" (Provider: ${selectedProvider}) deleted successfully.`,
						"success"
					);
					// Clear relevant caches
					if (cachedVoucherGroups[selectedProvider]) {
						cachedVoucherGroups[selectedProvider] = cachedVoucherGroups[selectedProvider].filter(
							(g) => g !== selectedGroup
						);
					}
					delete cachedVouchersData[`${selectedProvider}_${selectedGroup}`];

					await loadVoucherGroups(selectedProvider, true); // Force refresh group list
					if (voucherCardContainer)
						showNoDataMessage(voucherCardContainer, "Select a group to see vouchers.", "fas fa-ticket-alt");
					currentVouchers = []; // Clear current vouchers
					disableVoucherActionButtons(false, true, true); // Update button states
				} else {
					showToast(
						`Failed to delete voucher group "${selectedGroup}". API: ${
							result ? result.message : "Unknown error."
						}`,
						"error"
					);
				}
			} catch (error) {
				// Error toast handled by callApi
			}
		}
	);
}

/**
 * Initializes event listeners for the vouchers tab.
 */
function initializeVoucherEventListeners() {
	if (voucherProviderSelect) {
		voucherProviderSelect.addEventListener("change", (e) => handleProviderSelection(e.target.value));
	}
	if (voucherGroupSelect) {
		voucherGroupSelect.addEventListener("change", async (e) => {
			// Made async
			const selectedProvider = voucherProviderSelect ? voucherProviderSelect.value : null;
			const selectedGroup = e.target.value;
			if (!selectedProvider) {
				showToast("Please select a voucher provider first.", "warning");
				voucherGroupSelect.value = ""; // Reset if provider not selected
				return;
			}
			localStorage.setItem(`voucherGroupFilter_${selectedProvider}`, selectedGroup);
			if (selectedGroup) {
				await loadVouchersForGroup(selectedProvider, selectedGroup); // Uses cache by default
				disableVoucherActionButtons(false, false, false); // All actions enabled
			} else {
				if (voucherCardContainer)
					showNoDataMessage(voucherCardContainer, "Select a group to see vouchers.", "fas fa-ticket-alt");
				currentVouchers = []; // Clear data if no group selected
				renderVouchers([], ""); // Clear display
				disableVoucherActionButtons(false, true, true); // Group actions disabled
			}
		});
	}

	if (createVouchersBtn) {
		createVouchersBtn.addEventListener("click", openGenerateVoucherModal);
	}

	// Voucher Generation Modal Listeners
	if (voucherCountSelect && voucherCountCustom) {
		voucherCountSelect.addEventListener("change", (e) => {
			voucherCountCustom.classList.toggle("hidden", e.target.value !== "custom");
			if (e.target.value !== "custom") voucherCountCustom.value = e.target.value;
			else voucherCountCustom.value = "1";
		});
	}
	if (voucherLifetimeSelect && voucherLifetimeCustom) {
		voucherLifetimeSelect.addEventListener("change", (e) => {
			voucherLifetimeCustom.classList.toggle("hidden", e.target.value !== "custom");
			if (e.target.value !== "custom") voucherLifetimeCustom.value = "";
			else voucherLifetimeCustom.value = "1";
		});
	}
	if (voucherUsageSelect && voucherUsageCustom) {
		voucherUsageSelect.addEventListener("change", (e) => {
			voucherUsageCustom.classList.toggle("hidden", e.target.value !== "custom");
			if (e.target.value !== "custom") voucherUsageCustom.value = "";
			else voucherUsageCustom.value = "0";
		});
	}
	if (submitGenerateVoucherBtn) {
		submitGenerateVoucherBtn.addEventListener("click", handleSubmitGenerateVoucher);
	}
	if (cancelGenerateVoucherBtn) {
		cancelGenerateVoucherBtn.addEventListener("click", () => hideModal(generateVoucherModal));
	}

	// Event delegation for revoke voucher buttons
	if (voucherCardContainer) {
		voucherCardContainer.addEventListener("click", (e) => {
			const revokeButton = e.target.closest('[data-action="revoke-voucher"]');
			if (revokeButton) {
				e.stopPropagation(); // Prevent card expansion
				const selectedProvider = voucherProviderSelect ? voucherProviderSelect.value : null;
				const voucherCode = revokeButton.dataset.voucher;
				const groupName = revokeButton.dataset.group;
				handleRevokeVoucher(selectedProvider, voucherCode, groupName);
			}
		});
	}

	if (dropExpiredVouchersBtn) {
		dropExpiredVouchersBtn.addEventListener("click", handleDropExpiredVouchers);
	}
	if (dropVoucherGroupBtn) {
		dropVoucherGroupBtn.addEventListener("click", handleDropVoucherGroup);
	}
}
