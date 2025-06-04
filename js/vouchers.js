// js/vouchers.js

(function (CPManager) {
	CPManager.vouchers = {
		/**
		 * Loads voucher providers from the API and populates the provider selection dropdown.
		 * @param {boolean} [forceRefresh=false] - If true, forces a re-fetch even if data exists.
		 */
		loadVoucherProviders: async function (forceRefresh = false) {
			if (!CPManager.elements.voucherProviderSelect) return;

			if (!forceRefresh && CPManager.state.vouchers.cachedProviders.length > 0) {
				console.log("Using cached voucher providers.");
				CPManager.vouchers.populateVoucherProviderSelect(CPManager.state.vouchers.cachedProviders); // Repopulate select from cache
				// Trigger selection handler if a provider was auto-selected or restored
				if (CPManager.elements.voucherProviderSelect.value) {
					CPManager.vouchers.handleProviderSelection(CPManager.elements.voucherProviderSelect.value);
				}
				return;
			}

			CPManager.elements.voucherProviderSelect.innerHTML = '<option value="">Loading providers...</option>';
			if (CPManager.elements.voucherGroupSelect)
				CPManager.elements.voucherGroupSelect.innerHTML =
					'<option value="">Select a provider first...</option>';
			if (CPManager.elements.voucherCardContainer)
				CPManager.ui.clearContainer(CPManager.elements.voucherCardContainer);
			CPManager.ui.disableVoucherActionButtons(true, true, true);

			try {
				const providers = await CPManager.api.callApi("/voucher/list_providers");
				if (providers && Array.isArray(providers)) {
					CPManager.state.vouchers.cachedProviders = providers; // Cache the fetched providers
					CPManager.vouchers.populateVoucherProviderSelect(providers);
				} else {
					CPManager.state.vouchers.cachedProviders = []; // Reset cache on error/unexpected format
					console.error(
						"Error loading voucher providers: Unexpected format",
						providers,
						"API response:",
						providers
					);
					CPManager.ui.showToast("Could not load voucher providers: unexpected format.", "error");
				}
			} catch (error) {
				CPManager.state.vouchers.cachedProviders = []; // Reset cache on exception
				CPManager.elements.voucherProviderSelect.innerHTML =
					'<option value="">Error loading providers.</option>';
				console.error("Exception in loadVoucherProviders:", error);
				// Error toast is handled by callApi
			}
		},

		/**
		 * Populates the voucher provider select dropdown from a list of providers.
		 * @param {Array<string>} providers - Array of provider names.
		 */
		populateVoucherProviderSelect: function (providers) {
			if (!CPManager.elements.voucherProviderSelect) return;

			if (providers.length === 0) {
				CPManager.elements.voucherProviderSelect.innerHTML =
					'<option value="">No voucher providers found.</option>';
				CPManager.ui.showToast("No voucher providers configured on OPNsense.", "warning");
				CPManager.ui.disableVoucherActionButtons(true, true, true);
				return;
			}

			CPManager.elements.voucherProviderSelect.innerHTML = '<option value="">-- Select Provider --</option>';
			const savedProvider = localStorage.getItem("selectedVoucherProvider");
			let providerToSelect = null;

			providers.forEach((provider) => {
				const option = document.createElement("option");
				option.value = provider;
				option.textContent = provider;
				CPManager.elements.voucherProviderSelect.appendChild(option);
				if (provider === savedProvider) {
					providerToSelect = savedProvider;
				}
			});

			if (providers.length === 1 && !providerToSelect) {
				// Auto-select if only one provider AND no saved preference
				CPManager.elements.voucherProviderSelect.value = providers[0];
				localStorage.setItem("selectedVoucherProvider", providers[0]);
				CPManager.vouchers.handleProviderSelection(providers[0]);
			} else if (providerToSelect) {
				// Restore last selected provider
				CPManager.elements.voucherProviderSelect.value = providerToSelect;
				CPManager.vouchers.handleProviderSelection(providerToSelect);
			} else {
				CPManager.ui.disableVoucherActionButtons(true, true, true); // No provider selected yet
			}
		},

		/**
		 * Handles the selection of a voucher provider.
		 * Loads voucher groups for the selected provider.
		 * @param {string} providerId - The ID of the selected provider.
		 * @param {boolean} [forceRefreshGroups=false] - If true, forces a re-fetch of groups.
		 */
		handleProviderSelection: function (providerId, forceRefreshGroups = false) {
			if (providerId) {
				localStorage.setItem("selectedVoucherProvider", providerId);
				CPManager.vouchers.loadVoucherGroups(providerId, forceRefreshGroups);
			} else {
				localStorage.removeItem("selectedVoucherProvider");
				if (CPManager.elements.voucherGroupSelect)
					CPManager.elements.voucherGroupSelect.innerHTML =
						'<option value="">Select a provider first...</option>';
				if (CPManager.elements.voucherCardContainer)
					CPManager.ui.clearContainer(CPManager.elements.voucherCardContainer);
				CPManager.ui.disableVoucherActionButtons(true, true, true);
			}
		},

		/**
		 * Loads voucher groups for a given provider and populates the group selection dropdown.
		 * @param {string} providerId - The ID of the provider.
		 * @param {boolean} [forceRefresh=false] - If true, forces a re-fetch even if data exists.
		 */
		loadVoucherGroups: async function (providerId, forceRefresh = false) {
			if (!providerId || !CPManager.elements.voucherGroupSelect) {
				if (CPManager.elements.voucherGroupSelect)
					CPManager.elements.voucherGroupSelect.innerHTML =
						'<option value="">Select a provider first...</option>';
				if (CPManager.elements.voucherCardContainer)
					CPManager.ui.clearContainer(CPManager.elements.voucherCardContainer);
				CPManager.ui.disableVoucherActionButtons(true, true, true);
				return;
			}

			const cacheKey = providerId;
			if (
				!forceRefresh &&
				CPManager.state.vouchers.cachedGroups[cacheKey] &&
				CPManager.state.vouchers.cachedGroups[cacheKey].length > 0
			) {
				console.log(`Using cached voucher groups for provider ${providerId}.`);
				CPManager.vouchers.populateVoucherGroupSelect(
					providerId,
					CPManager.state.vouchers.cachedGroups[cacheKey]
				);
				// Trigger selection if a group was auto-selected or restored
				if (CPManager.elements.voucherGroupSelect.value) {
					await CPManager.vouchers.loadVouchersForGroup(
						providerId,
						CPManager.elements.voucherGroupSelect.value
					); // await here
				}
				return;
			}

			CPManager.elements.voucherGroupSelect.innerHTML = '<option value="">Loading groups...</option>';
			if (
				CPManager.elements.voucherCardContainer &&
				(!CPManager.state.vouchers.cachedData[`${providerId}_${CPManager.elements.voucherGroupSelect.value}`] ||
					forceRefresh)
			) {
				// only show skeleton if vouchers also need loading
				CPManager.ui.showSkeletonLoaders(CPManager.elements.voucherCardContainer, 1);
			}
			CPManager.ui.disableVoucherActionButtons(false, true, true); // Create enabled, group actions disabled

			try {
				const groups = await CPManager.api.callApi(`/voucher/list_voucher_groups/${providerId}`);
				if (groups && Array.isArray(groups)) {
					CPManager.state.vouchers.cachedGroups[cacheKey] = groups; // Cache the fetched groups
					CPManager.vouchers.populateVoucherGroupSelect(providerId, groups);
				} else {
					CPManager.state.vouchers.cachedGroups[cacheKey] = []; // Reset cache for this provider on error/unexpected format
					console.error(
						`Error loading voucher groups for provider ${providerId}: API response is not an array or is undefined.`,
						groups
					);
					CPManager.elements.voucherGroupSelect.innerHTML =
						'<option value="">Error: Unexpected data for groups.</option>';
					if (CPManager.elements.voucherCardContainer)
						CPManager.ui.showNoDataMessage(
							CPManager.elements.voucherCardContainer,
							"Error loading voucher groups.",
							"fas fa-exclamation-triangle"
						);
					CPManager.ui.disableVoucherActionButtons(false, true, true);
				}
			} catch (error) {
				CPManager.state.vouchers.cachedGroups[cacheKey] = []; // Reset cache on exception
				CPManager.elements.voucherGroupSelect.innerHTML = '<option value="">Error loading groups.</option>';
				if (CPManager.elements.voucherCardContainer)
					CPManager.ui.showNoDataMessage(
						CPManager.elements.voucherCardContainer,
						"Error loading voucher groups.",
						"fas fa-exclamation-triangle"
					);
				CPManager.ui.disableVoucherActionButtons(false, true, true);
				console.error(`Exception in loadVoucherGroups for provider ${providerId}:`, error);
			}
		},

		/**
		 * Populates the voucher group select dropdown.
		 * @param {string} providerId - The ID of the provider (for localStorage key).
		 * @param {Array<string>} groups - Array of group names.
		 */
		populateVoucherGroupSelect: function (providerId, groups) {
			if (!CPManager.elements.voucherGroupSelect) return;

			const currentVal = localStorage.getItem(`voucherGroupFilter_${providerId}`) || "";
			CPManager.elements.voucherGroupSelect.innerHTML = '<option value="">-- Select a Group --</option>'; // Reset options

			if (groups.length > 0) {
				groups.forEach((group) => {
					const option = document.createElement("option");
					option.value = group;
					option.textContent = group;
					CPManager.elements.voucherGroupSelect.appendChild(option);
				});

				// Attempt to set the value from localStorage if it's a valid option
				if (currentVal && groups.includes(currentVal)) {
					CPManager.elements.voucherGroupSelect.value = currentVal;
				} else if (currentVal && !groups.includes(currentVal)) {
					// If localStorage has a value not in current group options,
					// it's effectively an invalid/stale selection.
					// Ensure the select element reflects no valid group is selected.
					CPManager.elements.voucherGroupSelect.value = ""; // Default to "Select a Group"
				}
			} else {
				// No groups for this provider, ensure select is empty.
				CPManager.elements.voucherGroupSelect.value = "";
			}

			// After populating and attempting to set the value,
			// base button state on the FINAL state of voucherGroupSelect.value
			if (CPManager.elements.voucherGroupSelect.value) {
				// A group is selected
				CPManager.ui.disableVoucherActionButtons(false, false, false); // All actions enabled
				CPManager.vouchers.loadVouchersForGroup(providerId, CPManager.elements.voucherGroupSelect.value); // Load data for the selected group
			} else {
				// No group is selected
				if (CPManager.elements.voucherCardContainer) {
					if (groups.length === 0 && providerId) {
						CPManager.ui.showNoDataMessage(
							CPManager.elements.voucherCardContainer,
							`No voucher groups found for provider: <strong>${providerId}</strong>. You can create vouchers to start a new group.`,
							"fas fa-folder-open"
						);
					} else {
						CPManager.ui.showNoDataMessage(
							CPManager.elements.voucherCardContainer,
							"Select a group to see vouchers.",
							"fas fa-ticket-alt"
						);
					}
				}
				CPManager.ui.disableVoucherActionButtons(false, true, true); // Group actions disabled
			}
		},

		/**
		 * Loads vouchers for a specific group and provider.
		 * @param {string} providerId - The ID of the provider.
		 * @param {string} groupName - The name of the voucher group.
		 * @param {boolean} [forceRefresh=false] - If true, forces a re-fetch even if data exists.
		 */
		loadVouchersForGroup: async function (providerId, groupName, forceRefresh = false) {
			if (!providerId || !groupName || !CPManager.elements.voucherCardContainer) {
				if (CPManager.elements.voucherCardContainer)
					CPManager.ui.showNoDataMessage(
						CPManager.elements.voucherCardContainer,
						"Provider or group not selected.",
						"fas fa-info-circle"
					);
				CPManager.state.vouchers.current = [];
				CPManager.vouchers.renderVouchers([], groupName); // Clear display
				return;
			}

			const cacheKey = `${providerId}_${groupName}`;
			if (!forceRefresh && CPManager.state.vouchers.cachedData[cacheKey]) {
				console.log(`Using cached vouchers for group ${groupName} (Provider: ${providerId}).`);
				CPManager.state.vouchers.current = CPManager.state.vouchers.cachedData[cacheKey];
				CPManager.vouchers.renderVouchers(CPManager.state.vouchers.current, groupName);
				if (CPManager.state.vouchers.current.length === 0) {
					CPManager.ui.showNoDataMessage(
						CPManager.elements.voucherCardContainer,
						`No vouchers found in group "${groupName}".`,
						"fas fa-folder-open"
					);
				}
				return;
			}

			CPManager.ui.showSkeletonLoaders(CPManager.elements.voucherCardContainer, 1);

			try {
				const vouchers = await CPManager.api.callApi(`/voucher/list_vouchers/${providerId}/${groupName}`);
				if (vouchers && Array.isArray(vouchers)) {
					CPManager.state.vouchers.cachedData[cacheKey] = vouchers; // Cache the fetched vouchers
					CPManager.state.vouchers.current = vouchers;
					CPManager.vouchers.renderVouchers(CPManager.state.vouchers.current, groupName);
					if (vouchers.length === 0) {
						CPManager.ui.showNoDataMessage(
							CPManager.elements.voucherCardContainer,
							`No vouchers found in group "${groupName}".`,
							"fas fa-folder-open"
						);
					}
				} else {
					CPManager.state.vouchers.cachedData[cacheKey] = []; // Reset cache for this group on error
					CPManager.state.vouchers.current = [];
					CPManager.vouchers.renderVouchers([], groupName); // Clear display
					console.error(
						`Error loading vouchers for group ${groupName} (Provider: ${providerId}): API response is not an array or is undefined.`,
						vouchers
					);
					CPManager.ui.showNoDataMessage(
						CPManager.elements.voucherCardContainer,
						"Error: Unexpected data for vouchers.",
						"fas fa-exclamation-triangle"
					);
				}
			} catch (error) {
				CPManager.state.vouchers.cachedData[cacheKey] = []; // Reset cache on exception
				CPManager.state.vouchers.current = [];
				CPManager.vouchers.renderVouchers([], groupName); // Clear display
				CPManager.ui.showNoDataMessage(
					CPManager.elements.voucherCardContainer,
					"Error loading vouchers.",
					"fas fa-exclamation-triangle"
				);
				console.error(`Exception in loadVouchersForGroup for ${groupName} (Provider: ${providerId}):`, error);
			}
		},

		/**
		 * Renders voucher cards in the UI.
		 * @param {Array<object>} vouchers - Array of voucher objects.
		 * @param {string} groupName - The name of the group these vouchers belong to.
		 */
		renderVouchers: function (vouchers, groupName) {
			if (!CPManager.elements.voucherCardContainer) return;
			CPManager.ui.clearContainer(CPManager.elements.voucherCardContainer);

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
                <div class="info-row"><span class="info-label">Validity</span> <span class="info-value">${CPManager.utils.formatDuration(
					voucher.validity,
					"seconds"
				)}</span></div>
                <div class="info-row"><span class="info-label">Start Time</span> <span class="info-value">${CPManager.utils.formatVoucherTimestamp(
					voucher.starttime
				)}</span></div>
                <div class="info-row"><span class="info-label">End Time</span> <span class="info-value">${CPManager.utils.formatVoucherTimestamp(
					voucher.endtime
				)}</span></div>
                <div class="info-row"><span class="info-label">Expires At</span><span class="info-value">${
					voucher.expirytime && voucher.expirytime !== 0
						? CPManager.utils.formatVoucherTimestamp(voucher.expirytime)
						: CPManager.config.placeholderValue === "—"
						? "Never"
						: CPManager.config.placeholderValue
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
				CPManager.elements.voucherCardContainer.appendChild(card);

				const summaryElement = card.querySelector(".card-summary");
				const detailsContent = card.querySelector(".card-details-content");
				if (summaryElement && detailsContent) {
					summaryElement.addEventListener("click", () => {
						CPManager.ui.toggleCardDetails(card, CPManager.elements.voucherCardContainer);
						summaryElement.setAttribute("aria-expanded", detailsContent.classList.contains("expanded"));
						detailsContent.setAttribute("aria-hidden", !detailsContent.classList.contains("expanded"));
					});
					summaryElement.addEventListener("keydown", (e) => {
						// Keyboard accessibility
						if (e.key === "Enter" || e.key === " ") {
							e.preventDefault();
							CPManager.ui.toggleCardDetails(card, CPManager.elements.voucherCardContainer);
							summaryElement.setAttribute("aria-expanded", detailsContent.classList.contains("expanded"));
							detailsContent.setAttribute("aria-hidden", !detailsContent.classList.contains("expanded"));
						}
					});
				}
			});
		},

		/**
		 * Handles the voucher generation modal visibility and form reset.
		 */
		openGenerateVoucherModal: function () {
			if (!CPManager.elements.generateVoucherModal || !CPManager.elements.voucherProviderSelect) return;
			const selectedProvider = CPManager.elements.voucherProviderSelect.value;
			if (!selectedProvider) {
				CPManager.ui.showToast("Please select a voucher provider before generating vouchers.", "error");
				return;
			}

			// Reset form fields to defaults
			if (CPManager.elements.voucherGroupNameInput) CPManager.elements.voucherGroupNameInput.value = ""; // Clear group name
			if (CPManager.elements.voucherCountSelect) CPManager.elements.voucherCountSelect.value = "10"; // Default count
			if (CPManager.elements.voucherCountCustom) {
				CPManager.elements.voucherCountCustom.classList.add("hidden");
				CPManager.elements.voucherCountCustom.value = "1";
			}
			if (CPManager.elements.voucherLifetimeSelect) CPManager.elements.voucherLifetimeSelect.value = "240"; // Default lifetime (4 hours in minutes)
			if (CPManager.elements.voucherLifetimeCustom) {
				CPManager.elements.voucherLifetimeCustom.classList.add("hidden");
				CPManager.elements.voucherLifetimeCustom.value = "";
			}
			if (CPManager.elements.voucherUsageSelect) CPManager.elements.voucherUsageSelect.value = "0"; // Default usage (Never expires)
			if (CPManager.elements.voucherUsageCustom) {
				CPManager.elements.voucherUsageCustom.classList.add("hidden");
				CPManager.elements.voucherUsageCustom.value = "";
			}
			// Set default output format to 'card'
			const cardOutputRadio = document.querySelector('input[name="voucher-output-format"][value="card"]');
			if (cardOutputRadio) {
				cardOutputRadio.checked = true;
			}

			CPManager.elements.generateVoucherModal.classList.remove("modal-inactive");
			CPManager.elements.generateVoucherModal.classList.add("modal-active");
			if (CPManager.elements.voucherCountSelect) CPManager.elements.voucherCountSelect.focus();
		},

		/**
		 * Handles the submission of the generate voucher form.
		 * Now generates a PDF instead of CSV.
		 */
		handleSubmitGenerateVoucher: async function () {
			if (!CPManager.elements.voucherProviderSelect || !CPManager.elements.submitGenerateVoucherBtn) return;

			const selectedProvider = CPManager.elements.voucherProviderSelect.value;
			if (!selectedProvider) {
				CPManager.ui.showToast("Voucher provider not selected. Cannot generate vouchers.", "error");
				return;
			}

			let count =
				CPManager.elements.voucherCountSelect.value === "custom"
					? parseInt(CPManager.elements.voucherCountCustom.value)
					: parseInt(CPManager.elements.voucherCountSelect.value);
			if (isNaN(count) || count < 1) {
				CPManager.ui.showToast("Number of vouchers must be at least 1.", "error");
				return;
			}

			let lifetimeInSeconds;
			if (CPManager.elements.voucherLifetimeSelect.value === "custom") {
				const customMinutes = parseInt(CPManager.elements.voucherLifetimeCustom.value);
				if (isNaN(customMinutes) || customMinutes < 1) {
					CPManager.ui.showToast("Custom Validity (minutes) must be at least 1.", "error");
					return;
				}
				lifetimeInSeconds = customMinutes * 60;
			} else {
				lifetimeInSeconds = parseInt(CPManager.elements.voucherLifetimeSelect.value) * 60; // Value is already in minutes
			}

			let usageInSeconds; // OPNsense API expects 'expirytime' in seconds from generation
			if (CPManager.elements.voucherUsageSelect.value === "custom") {
				const customHours = parseInt(CPManager.elements.voucherUsageCustom.value);
				if (isNaN(customHours) || customHours < 0) {
					CPManager.ui.showToast("Custom Expires In (hours) must be a non-negative number.", "error");
					return;
				}
				usageInSeconds = customHours * 3600;
			} else {
				const selectedUsageHours = parseInt(CPManager.elements.voucherUsageSelect.value);
				if (isNaN(selectedUsageHours)) {
					CPManager.ui.showToast("Invalid Expires In selection.", "error");
					return;
				}
				usageInSeconds = selectedUsageHours * 3600;
			}

			const now = new Date();
			const defaultGroupName = `g${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, "0")}${String(
				now.getDate()
			).padStart(2, "0")}${String(now.getHours()).padStart(2, "0")}${String(now.getMinutes()).padStart(2, "0")}`;
			const groupname = CPManager.elements.voucherGroupNameInput.value.trim() || defaultGroupName;

			const payload = {
				count: String(count),
				validity: String(lifetimeInSeconds), // How long the voucher is valid once activated (in seconds)
				expirytime: String(usageInSeconds), // How long until the UNUSED voucher expires (in seconds from generation, 0 for never)
				vouchergroup: groupname,
			};

			CPManager.elements.submitGenerateVoucherBtn.disabled = true;
			CPManager.elements.submitGenerateVoucherBtn.innerHTML =
				'<i class="fas fa-spinner fa-spin mr-2"></i>Generating...';

			try {
				const result = await CPManager.api.callApi(
					`/voucher/generate_vouchers/${selectedProvider}`,
					"POST",
					payload
				);
				if (result && Array.isArray(result) && result.length > 0 && result[0].username) {
					CPManager.state.vouchers.lastGenerated = result;

					const outputFormat = document.querySelector('input[name="voucher-output-format"]:checked').value;
					const { jsPDF } = window.jspdf;
					const doc = new jsPDF({
						orientation: "portrait",
						unit: "mm",
						format: "a4",
					});

					if (outputFormat === "card") {
						CPManager.ui.showToast(`Vouchers generated. Generating Card Style PDF...`, "success");
						CPManager.vouchers.generateVouchersAsCardPDF(
							CPManager.state.vouchers.lastGenerated,
							groupname,
							doc
						); // Adds content to 'doc'
					} else if (outputFormat === "table") {
						CPManager.ui.showToast(`Vouchers generated. Generating Table Style PDF...`, "success");
						CPManager.vouchers.generateVouchersAsTablePDF(
							CPManager.state.vouchers.lastGenerated,
							groupname,
							doc
						); // Adds content to 'doc'
					} else if (outputFormat === "both") {
						CPManager.ui.showToast(
							`Vouchers generated. Generating Card and Table Style PDFs...`,
							"success"
						);
						CPManager.vouchers.generateVouchersAsCardPDF(
							CPManager.state.vouchers.lastGenerated,
							groupname,
							doc
						); // Adds card content to 'doc'
						doc.addPage(); // Add a new page for the table
						CPManager.vouchers.generateVouchersAsTablePDF(
							CPManager.state.vouchers.lastGenerated,
							groupname,
							doc
						); // Adds table content to 'doc'
					}

					// Save the single document after all content has been added
					const timestamp = new Date().toISOString().slice(0, 10).replace(/-/g, "");
					const filename = `${groupname}_${timestamp}_vouchers.pdf`;
					doc.save(filename);
					CPManager.ui.showToast("Vouchers PDF generated successfully!", "success");

					CPManager.ui.hideModal(CPManager.elements.generateVoucherModal);
					await CPManager.vouchers.loadVoucherGroups(selectedProvider, true);
					if (CPManager.elements.voucherGroupSelect) CPManager.elements.voucherGroupSelect.value = groupname;
					await CPManager.vouchers.loadVouchersForGroup(selectedProvider, groupname, true);
				} else if (
					result &&
					result.status === "ok_text" &&
					result.message &&
					result.message.toLowerCase().includes("created")
				) {
					CPManager.ui.showToast(
						`Vouchers generated for group "${groupname}". (API Text OK). No detailed voucher data for PDF.`,
						"success"
					);
					CPManager.state.vouchers.lastGenerated = []; // No specific voucher data to PDF
					CPManager.ui.hideModal(CPManager.elements.generateVoucherModal);
					await CPManager.vouchers.loadVoucherGroups(selectedProvider, true);
					if (CPManager.elements.voucherGroupSelect) CPManager.elements.voucherGroupSelect.value = groupname;
					await CPManager.vouchers.loadVouchersForGroup(selectedProvider, groupname, true);
				} else {
					CPManager.ui.showToast(
						`Failed to generate vouchers: ${
							result.message ||
							(result.status === "error"
								? "API reported an error."
								: "Unknown error or no vouchers returned.")
						}`,
						"error"
					);
					CPManager.state.vouchers.lastGenerated = [];
				}
			} catch (error) {
				CPManager.state.vouchers.lastGenerated = [];
				console.error("Error during voucher generation or PDF creation:", error);
				CPManager.ui.showToast("An error occurred during voucher generation or PDF creation.", "error");
			} finally {
				CPManager.elements.submitGenerateVoucherBtn.disabled = false;
				CPManager.elements.submitGenerateVoucherBtn.innerHTML = "Generate";
			}
		},

		/**
		 * Generates a PDF from the provided voucher data using jsPDF.
		 * This function creates a "card" style layout for vouchers.
		 * @param {Array<object>} vouchers - Array of voucher objects to include in the PDF.
		 * @param {string} groupName - The name of the group these vouchers belong to.
		 * @param {object} doc - The jsPDF document instance to add content to.
		 */
		generateVouchersAsCardPDF: function (vouchers, groupName, doc) {
			const pageHeight = doc.internal.pageSize.height; // 297 mm for A4 portrait
			const pageWidth = doc.internal.pageSize.width; // 210 mm for A4 portrait
			const margin = 10; // mm, margin on all sides of the page

			// Define layout for 3 columns x 6 rows
			const vouchersPerRow = 3;
			const vouchersPerColumn = 6; // Desired 6 rows
			const horizontalGap = 4; // mm, gap between vouchers horizontally
			const verticalGap = 4; // mm, gap between vouchers vertically

			// Calculate usable area for vouchers within margins
			const printableWidth = pageWidth - 2 * margin; // 190 mm
			// Deduct space for title at the top of each page for card style
			const titleHeight = 15; // Estimated height for title + padding
			const printableHeightPerVoucherArea = pageHeight - 2 * margin - titleHeight;

			// Recalculate voucher dimensions based on new gaps and title space
			const voucherWidth = (printableWidth - (vouchersPerRow - 1) * horizontalGap) / vouchersPerRow; // (190 - 2*4) / 3 = 182 / 3 = 60.66 mm
			const voucherHeight =
				(printableHeightPerVoucherArea - (vouchersPerColumn - 1) * verticalGap) / vouchersPerColumn; // (277 - 15 - 5*4) / 6 = (262 - 20) / 6 = 242 / 6 = 40.33 mm

			let currentY = margin; // Starting Y position for content on a new page

			// Add title to the first page (or new page if docInstance exists)
			// This check is now always true because we pass the doc from handleSubmitGenerateVoucher
			doc.setFontSize(20);
			doc.setFont("helvetica", "bold");
			doc.text(`Vouchers for Group: ${groupName} (Card Style)`, pageWidth / 2, currentY + 5, { align: "center" });
			currentY += titleHeight; // Move down after title

			vouchers.forEach((voucher, index) => {
				const vouchersPerPage = vouchersPerRow * vouchersPerColumn;
				const voucherIndexOnPage = index % vouchersPerPage;

				// Add new page if current voucher is the first on a new page (after the initial page setup)
				if (index > 0 && voucherIndexOnPage === 0) {
					doc.addPage();
					currentY = margin; // Reset Y for new page
					doc.setFontSize(20);
					doc.setFont("helvetica", "bold");
					doc.text(`Vouchers for Group: ${groupName} (Card Style - Cont.)`, pageWidth / 2, currentY + 5, {
						align: "center",
					});
					currentY += titleHeight;
				}

				const colIndex = voucherIndexOnPage % vouchersPerRow;
				const rowIndex = Math.floor(voucherIndexOnPage / vouchersPerRow);

				const voucherAbsX = margin + colIndex * (voucherWidth + horizontalGap);
				const voucherAbsY = currentY + rowIndex * (voucherHeight + verticalGap);

				// Draw voucher card border (slightly rounded corners)
				doc.setDrawColor(200); // Light gray border
				doc.roundedRect(voucherAbsX, voucherAbsY, voucherWidth, voucherHeight, 2, 2, "S"); // 'S' for stroke

				// Voucher Code Label
				doc.setFontSize(8); // Smaller font for label
				doc.setFont("helvetica", "bold");
				doc.setTextColor(55, 65, 81); // Tailwind gray-700 equivalent
				doc.text("Voucher Code", voucherAbsX + voucherWidth / 2, voucherAbsY + 6, { align: "center" });

				// Actual Voucher Code
				doc.setFontSize(16); // Adjusted font size for the code
				doc.setTextColor(29, 78, 216); // Tailwind blue-700 equivalent
				doc.text(
					voucher.username || CPManager.config.placeholderValue,
					voucherAbsX + voucherWidth / 2,
					voucherAbsY + 16,
					{
						align: "center",
					}
				);

				// Password (if exists)
				let detailLineY = voucherAbsY + 22; // Starting Y offset for details
				if (voucher.password) {
					doc.setFontSize(7); // Smaller font for password
					doc.setTextColor(75, 85, 99); // Tailwind gray-600 equivalent
					doc.text(`Password: ${voucher.password}`, voucherAbsX + voucherWidth / 2, detailLineY, {
						align: "center",
					});
					detailLineY += 4; // Increment Y for next line
				}

				// Details (Validity, Expires, Group)
				doc.setFontSize(6); // Even smaller font for details
				doc.setTextColor(107, 114, 128); // Tailwind gray-500 equivalent
				doc.text(
					`Validity: ${CPManager.utils.formatDuration(voucher.validity, "seconds")}`,
					voucherAbsX + voucherWidth / 2,
					detailLineY + 3,
					{ align: "center" }
				);
				doc.text(
					`Expires: ${
						voucher.expirytime && voucher.expirytime !== 0
							? CPManager.utils.formatVoucherTimestamp(voucher.expirytime)
							: "Never"
					}`,
					voucherAbsX + voucherWidth / 2,
					detailLineY + 6,
					{ align: "center" }
				);
				doc.text(
					`Group: ${voucher.vouchergroup || CPManager.config.placeholderValue}`,
					voucherAbsX + voucherWidth / 2,
					detailLineY + 9,
					{ align: "center" }
				);
			});
		},

		/**
		 * Generates a PDF with voucher data presented in a table format.
		 * @param {Array<object>} vouchers - Array of voucher objects.
		 * @param {string} groupName - The name of the group.
		 * @param {object} doc - The jsPDF document instance to add content to.
		 */
		generateVouchersAsTablePDF: function (vouchers, groupName, doc) {
			const startY = 20; // Starting Y position for the table content

			doc.setFontSize(18);
			doc.setFont("helvetica", "bold");
			doc.text(`Voucher Table for Group: ${groupName}`, doc.internal.pageSize.width / 2, startY, {
				align: "center",
			});

			const tableHeaders = [["Voucher Code", "Password", "Validity", "Expires", "Group"]];

			const tableData = vouchers.map((v) => [
				v.username || CPManager.config.placeholderValue,
				v.password || CPManager.config.placeholderValue,
				CPManager.utils.formatDuration(v.validity, "seconds"),
				v.expirytime && v.expirytime !== 0 ? CPManager.utils.formatVoucherTimestamp(v.expirytime) : "Never",
				v.vouchergroup || CPManager.config.placeholderValue,
			]);

			doc.autoTable({
				startY: startY + 10,
				head: tableHeaders,
				body: tableData,
				theme: "striped", // 'striped', 'grid', 'plain'
				headStyles: { fillColor: [41, 128, 185], textColor: [255, 255, 255] }, // Blue header
				styles: {
					fontSize: 8,
					cellPadding: 2,
					valign: "middle",
					halign: "center",
				},
				columnStyles: {
					0: { cellWidth: 30 }, // Voucher Code
					1: { cellWidth: 25 }, // Password
					2: { cellWidth: 25 }, // Validity
					3: { cellWidth: 40 }, // Expires
					4: { cellWidth: "auto" }, // Group
				},
				didDrawPage: function (data) {
					// Footer for page numbers
					let str = "Page " + doc.internal.getNumberOfPages();
					doc.setFontSize(8);
					doc.text(
						str,
						doc.internal.pageSize.width - data.settings.margin.right,
						doc.internal.pageSize.height - 5
					);
				},
			});
		},

		/**
		 * Handles revoking a single voucher.
		 */
		handleRevokeVoucher: async function (providerId, voucherCode, groupName) {
			if (!providerId) {
				CPManager.ui.showToast("Voucher provider not selected. Cannot revoke.", "error");
				return;
			}
			CPManager.ui.showConfirmationModal(
				"Revoke Voucher?",
				`Are you sure you want to revoke voucher <strong>${voucherCode}</strong> for provider "<strong>${providerId}</strong>"? This action marks it as expired and cannot be undone.`,
				async () => {
					try {
						const result = await CPManager.api.callApi(`/voucher/expire_voucher/${providerId}`, "POST", {
							username: voucherCode,
						});
						if (result && result.status !== "error") {
							CPManager.ui.showToast(`Voucher ${voucherCode} processed for expiration.`, "success");
						} else if (result && result.status === "error") {
							CPManager.ui.showToast(
								`Voucher ${voucherCode} could not be expired. API: ${result.message || "Error"}`,
								"warning"
							);
						} else {
							CPManager.ui.showToast(
								`Voucher ${voucherCode} expiration processed with unknown API response. Status: ${
									result.status || "N/A"
								}.`,
								"info"
							);
						}
						await CPManager.vouchers.loadVouchersForGroup(providerId, groupName, true); // Force refresh voucher list
					} catch (error) {
						// Error toast handled by callApi
					}
				}
			);
		},

		/**
		 * Handles dropping all expired vouchers for the selected provider and group.
		 */
		handleDropExpiredVouchers: async function () {
			if (!CPManager.elements.voucherProviderSelect || !CPManager.elements.voucherGroupSelect) return;
			const selectedProvider = CPManager.elements.voucherProviderSelect.value;
			const selectedGroup = CPManager.elements.voucherGroupSelect.value;
			if (!selectedProvider) {
				CPManager.ui.showToast("Please select a voucher provider first.", "error");
				return;
			}
			if (!selectedGroup) {
				CPManager.ui.showToast("Please select a voucher group first.", "error");
				return;
			}

			CPManager.ui.showConfirmationModal(
				"Drop Expired Vouchers?",
				`Are you sure you want to remove all expired vouchers from group "<strong>${selectedGroup}</strong>" for provider "<strong>${selectedProvider}</strong>"?`,
				async () => {
					try {
						const result = await CPManager.api.callApi(
							`/voucher/drop_expired_vouchers/${selectedProvider}/${selectedGroup}`,
							"POST",
							{}
						);
						if (result && result.status === "drop") {
							CPManager.ui.showToast(
								`Expired vouchers from group "${selectedGroup}" (Provider: ${selectedProvider}) cleaned up. Count: ${
									result.count || 0
								}`,
								"success"
							);
						} else {
							CPManager.ui.showToast(
								`Cleanup for group "${selectedGroup}" (Provider: ${selectedProvider}) processed. Status: ${
									result.status || "unknown"
								}. Count: ${result.count || 0}`,
								"info"
							);
						}
						await CPManager.vouchers.loadVouchersForGroup(selectedProvider, selectedGroup, true); // Force refresh
					} catch (error) {
						// Error toast handled by callApi
					}
				}
			);
		},

		/**
		 * Handles dropping an entire voucher group.
		 */
		handleDropVoucherGroup: async function () {
			if (!CPManager.elements.voucherProviderSelect || !CPManager.elements.voucherGroupSelect) return;
			const selectedProvider = CPManager.elements.voucherProviderSelect.value;
			const selectedGroup = CPManager.elements.voucherGroupSelect.value;
			if (!selectedProvider) {
				CPManager.ui.showToast("Please select a voucher provider first.", "warning");
				return;
			}
			if (!selectedGroup) {
				CPManager.ui.showToast("Please select a voucher group to delete.", "warning");
				return;
			}

			CPManager.ui.showConfirmationModal(
				"Drop Voucher Group?",
				`Are you sure you want to delete the entire voucher group "<strong>${selectedGroup}</strong>" for provider "<strong>${selectedProvider}</strong>"? This will delete all vouchers within it and cannot be undone.`,
				async () => {
					try {
						const result = await CPManager.api.callApi(
							`/voucher/drop_voucher_group/${selectedProvider}/${selectedGroup}`,
							"POST",
							{}
						);
						if (result && result.status !== "error") {
							CPManager.ui.showToast(
								`Voucher group "${selectedGroup}" (Provider: ${selectedProvider}) deleted successfully.`,
								"success"
							);
							// Clear relevant caches
							if (CPManager.state.vouchers.cachedGroups[selectedProvider]) {
								CPManager.state.vouchers.cachedGroups[selectedProvider] =
									CPManager.state.vouchers.cachedGroups[selectedProvider].filter(
										(g) => g !== selectedGroup
									);
							}
							delete CPManager.state.vouchers.cachedData[`${selectedProvider}_${selectedGroup}`];

							await CPManager.vouchers.loadVoucherGroups(selectedProvider, true); // Force refresh group list
							if (CPManager.elements.voucherCardContainer)
								CPManager.ui.showNoDataMessage(
									CPManager.elements.voucherCardContainer,
									"Select a group to see vouchers.",
									"fas fa-ticket-alt"
								);
							CPManager.state.vouchers.current = []; // Clear current vouchers
							CPManager.ui.disableVoucherActionButtons(false, true, true); // Update button states
						} else {
							CPManager.ui.showToast(
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
		},

		/**
		 * Initializes event listeners for the vouchers tab.
		 */
		initializeVoucherEventListeners: function () {
			// console.log('Vouchers: Initializing event listeners for vouchers module.'); // Removed for cleanup
			if (CPManager.elements.voucherProviderSelect) {
				CPManager.elements.voucherProviderSelect.addEventListener("change", (e) =>
					CPManager.vouchers.handleProviderSelection(e.target.value)
				);
			}
			if (CPManager.elements.voucherGroupSelect) {
				CPManager.elements.voucherGroupSelect.addEventListener("change", async (e) => {
					const selectedProvider = CPManager.elements.voucherProviderSelect
						? CPManager.elements.voucherProviderSelect.value
						: null;
					const selectedGroup = e.target.value;
					if (!selectedProvider) {
						CPManager.ui.showToast("Please select a voucher provider first.", "warning");
						CPManager.elements.voucherGroupSelect.value = ""; // Reset if provider not selected
						return;
					}
					localStorage.setItem(`voucherGroupFilter_${selectedProvider}`, selectedGroup);
					if (selectedGroup) {
						await CPManager.vouchers.loadVouchersForGroup(selectedProvider, selectedGroup); // Uses cache by default
						CPManager.ui.disableVoucherActionButtons(false, false, false); // All actions enabled
					} else {
						if (CPManager.elements.voucherCardContainer)
							CPManager.ui.showNoDataMessage(
								CPManager.elements.voucherCardContainer,
								"Select a group to see vouchers.",
								"fas fa-ticket-alt"
							);
						CPManager.state.vouchers.current = []; // Clear data if no group selected
						CPManager.vouchers.renderVouchers([], ""); // Clear display
						CPManager.ui.disableVoucherActionButtons(false, true, true); // Group actions disabled
					}
				});
			}

			if (CPManager.elements.createVouchersBtn) {
				CPManager.elements.createVouchersBtn.addEventListener(
					"click",
					CPManager.vouchers.openGenerateVoucherModal
				);
			}

			// Voucher Generation Modal Listeners
			if (CPManager.elements.voucherCountSelect && CPManager.elements.voucherCountCustom) {
				CPManager.elements.voucherCountSelect.addEventListener("change", (e) => {
					CPManager.elements.voucherCountCustom.classList.toggle("hidden", e.target.value !== "custom");
					if (e.target.value !== "custom") CPManager.elements.voucherCountCustom.value = e.target.value;
					else CPManager.elements.voucherCountCustom.value = "1";
				});
			}
			if (CPManager.elements.voucherLifetimeSelect && CPManager.elements.voucherLifetimeCustom) {
				CPManager.elements.voucherLifetimeSelect.addEventListener("change", (e) => {
					CPManager.elements.voucherLifetimeCustom.classList.toggle("hidden", e.target.value !== "custom");
					if (e.target.value !== "custom") CPManager.elements.voucherLifetimeCustom.value = "";
					else CPManager.elements.voucherLifetimeCustom.value = "1";
				});
			}
			if (CPManager.elements.voucherUsageSelect && CPManager.elements.voucherUsageCustom) {
				CPManager.elements.voucherUsageSelect.addEventListener("change", (e) => {
					CPManager.elements.voucherUsageCustom.classList.toggle("hidden", e.target.value !== "custom");
					if (e.target.value !== "custom") CPManager.elements.voucherUsageCustom.value = "";
					else CPManager.elements.voucherUsageCustom.value = "0";
				});
			}
			if (CPManager.elements.submitGenerateVoucherBtn) {
				CPManager.elements.submitGenerateVoucherBtn.addEventListener(
					"click",
					CPManager.vouchers.handleSubmitGenerateVoucher
				);
			}
			if (CPManager.elements.cancelGenerateVoucherBtn) {
				CPManager.elements.cancelGenerateVoucherBtn.addEventListener("click", () =>
					// Corrected ID here
					CPManager.ui.hideModal(CPManager.elements.generateVoucherModal)
				);
			}

			// Event delegation for revoke voucher buttons
			if (CPManager.elements.voucherCardContainer) {
				CPManager.elements.voucherCardContainer.addEventListener("click", (e) => {
					const revokeButton = e.target.closest('[data-action="revoke-voucher"]');
					if (revokeButton) {
						e.stopPropagation(); // Prevent card expansion
						const selectedProvider = CPManager.elements.voucherProviderSelect
							? CPManager.elements.voucherProviderSelect.value
							: null;
						const voucherCode = revokeButton.dataset.voucher;
						const groupName = revokeButton.dataset.group;
						CPManager.vouchers.handleRevokeVoucher(selectedProvider, voucherCode, groupName);
					}
				});
			}

			if (CPManager.elements.dropExpiredVouchersBtn) {
				CPManager.elements.dropExpiredVouchersBtn.addEventListener(
					"click",
					CPManager.vouchers.handleDropExpiredVouchers
				);
			}
			if (CPManager.elements.dropVoucherGroupBtn) {
				CPManager.elements.dropVoucherGroupBtn.addEventListener(
					"click",
					CPManager.vouchers.handleDropVoucherGroup
				);
			}
		},
	};
})(CPManager);
