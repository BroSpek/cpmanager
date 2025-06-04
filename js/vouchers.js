// js/vouchers.js

(function (CPManager) {
	CPManager.vouchers = {
		/**
		 * Displays a hint about voucher usage based on zone configurations.
		 * Lists providers and the zones they are linked to, with correct pluralization.
		 */
		displayVoucherUsageHint: async function () {
			if (!CPManager.elements.voucherHintBox) return;

			CPManager.elements.voucherHintBox.innerHTML =
				'<div><i class="fas fa-spinner fa-spin mr-2"></i><span>Loading zone authentication info...</span></div>';
			CPManager.elements.voucherHintBox.className = "hint-box hint-box-info"; // Default to info while loading
			CPManager.elements.voucherHintBox.classList.remove("hidden");

			try {
				// Ensure zone summaries and voucher providers are loaded
				if (CPManager.state.zones.allConfigured.length === 0) {
					await CPManager.zones.fetchAllZoneData();
				}
				if (CPManager.state.vouchers.cachedProviders.length === 0) {
					console.log("Voucher providers not cached for hint, attempting to load...");
					await CPManager.vouchers.loadVoucherProviders(false);
				}

				const configuredVoucherProviders = CPManager.state.vouchers.cachedProviders;
				const providerToZonesMap = {}; // Key: providerName, Value: Set of zoneName strings

				if (CPManager.state.zones.allConfigured.length > 0) {
					for (const zoneSummary of CPManager.state.zones.allConfigured) {
						if (!zoneSummary.uuid) continue;
						try {
							const zoneDetailsResponse = await CPManager.api.callApi(
								`/settings/get_zone/${zoneSummary.uuid}`
							);
							if (
								zoneDetailsResponse &&
								zoneDetailsResponse.zone &&
								zoneDetailsResponse.zone.authservers
							) {
								const authServersField = zoneDetailsResponse.zone.authservers;
								let selectedAuthServers = [];

								if (
									typeof authServersField === "object" &&
									authServersField !== null &&
									!Array.isArray(authServersField)
								) {
									const formatted = CPManager.utils.formatOpnsenseSelectable(authServersField);
									if (formatted) {
										selectedAuthServers = formatted
											.split(",")
											.map((s) => s.trim())
											.filter((s) => s.length > 0);
									}
								} else if (typeof authServersField === "string" && authServersField.trim() !== "") {
									selectedAuthServers = authServersField
										.split(",")
										.map((s) => s.trim())
										.filter((s) => s.length > 0);
								} else if (Array.isArray(authServersField)) {
									selectedAuthServers = authServersField
										.map((s) => String(s).trim())
										.filter((s) => s.length > 0);
								}

								const zoneName = zoneSummary.description || `Zone ${zoneSummary.zoneid}`;

								selectedAuthServers.forEach((serverName) => {
									if (configuredVoucherProviders.includes(serverName)) {
										if (!providerToZonesMap[serverName]) {
											providerToZonesMap[serverName] = new Set();
										}
										providerToZonesMap[serverName].add(zoneName);
									}
								});
							}
						} catch (detailError) {
							console.warn(
								`Could not fetch details for zone ${zoneSummary.uuid} for hint: ${detailError.message}`
							);
						}
					}
				}

				const providersActuallyUsedByZones = Object.keys(providerToZonesMap).filter(
					(providerName) => providerToZonesMap[providerName].size > 0
				);

				if (providersActuallyUsedByZones.length === 0) {
					CPManager.elements.voucherHintBox.className = "hint-box hint-box-warning";
					CPManager.elements.voucherHintBox.innerHTML = `
                        <i class="fas fa-exclamation-triangle"></i>
                        <div><strong>Warning:</strong> No captive portal zones are currently configured to use any of the available Voucher authentication servers. Vouchers generated here may not be usable until a zone is configured appropriately in OPNsense (Services > Captive Portal > Administration > Edit Zone > Authentication method) to use one of the listed Voucher Providers.</div>
                    `;
				} else {
					CPManager.elements.voucherHintBox.className = "hint-box hint-box-info";
					let listItems = providersActuallyUsedByZones
						.map((providerName) => {
							const zonesSet = providerToZonesMap[providerName];
							const zoneCount = zonesSet.size;
							const zoneNoun = zoneCount === 1 ? "zone" : "zones";
							const zonesList = Array.from(zonesSet)
								.map((zn) => `<strong>"${zn}"</strong>`)
								.join(", ");
							return `<li>Provider <strong>"${providerName}"</strong> is currently linked to ${zoneCount} ${zoneNoun}: ${zonesList}.</li>`;
						})
						.join("");
					CPManager.elements.voucherHintBox.innerHTML = `
                        <i class="fas fa-info-circle"></i>
                        <div>Voucher provider linkage:<ul>${listItems}</ul>Ensure these providers are of type "Vouchers" in OPNsense (System > Access > Servers) and linked to the desired zones.</div>
                    `;
				}
			} catch (error) {
				console.error("Error displaying voucher usage hint:", error);
				CPManager.elements.voucherHintBox.className = "hint-box hint-box-warning";
				CPManager.elements.voucherHintBox.innerHTML = `
                    <i class="fas fa-exclamation-triangle"></i>
                    <div>Could not determine zone authentication configurations. Please check API connectivity.</div>
                `;
			}
			CPManager.elements.voucherHintBox.classList.remove("hidden");
		},

		/**
		 * Loads voucher providers from the API and populates the provider selection dropdown.
		 * @param {boolean} [forceRefresh=false] - If true, forces a re-fetch even if data exists.
		 */
		loadVoucherProviders: async function (forceRefresh = false) {
			if (!CPManager.elements.voucherProviderSelect) return;

			const displayHintAfterProviders = async () => {
				if (typeof CPManager.vouchers.displayVoucherUsageHint === "function") {
					await CPManager.vouchers.displayVoucherUsageHint();
				}
			};

			if (!forceRefresh && CPManager.state.vouchers.cachedProviders.length > 0) {
				console.log("Using cached voucher providers.");
				CPManager.vouchers.populateVoucherProviderSelect(CPManager.state.vouchers.cachedProviders);
				if (CPManager.elements.voucherProviderSelect.value) {
					CPManager.vouchers.handleProviderSelection(CPManager.elements.voucherProviderSelect.value);
				}
				await displayHintAfterProviders();
				return;
			}

			CPManager.elements.voucherProviderSelect.innerHTML = '<option value="">Loading providers...</option>';
			if (CPManager.elements.voucherGroupSelect)
				CPManager.elements.voucherGroupSelect.innerHTML =
					'<option value="">Select a provider first...</option>';
			if (CPManager.elements.voucherCardContainer)
				CPManager.ui.clearContainer(CPManager.elements.voucherCardContainer);
			CPManager.ui.disableVoucherActionButtons(true, true, true);
			if (CPManager.elements.voucherHintBox) CPManager.elements.voucherHintBox.classList.add("hidden");

			try {
				const providers = await CPManager.api.callApi("/voucher/list_providers");
				if (providers && Array.isArray(providers)) {
					CPManager.state.vouchers.cachedProviders = providers;
					CPManager.vouchers.populateVoucherProviderSelect(providers);
				} else {
					CPManager.state.vouchers.cachedProviders = [];
					console.error(
						"Error loading voucher providers: Unexpected format",
						providers,
						"API response:",
						providers
					);
					CPManager.ui.showToast("Could not load voucher providers: unexpected format.", "error");
				}
			} catch (error) {
				CPManager.state.vouchers.cachedProviders = [];
				CPManager.elements.voucherProviderSelect.innerHTML =
					'<option value="">Error loading providers.</option>';
				console.error("Exception in loadVoucherProviders:", error);
			} finally {
				await displayHintAfterProviders();
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
				CPManager.elements.voucherProviderSelect.value = providers[0];
				localStorage.setItem("selectedVoucherProvider", providers[0]);
				CPManager.vouchers.handleProviderSelection(providers[0]);
			} else if (providerToSelect) {
				CPManager.elements.voucherProviderSelect.value = providerToSelect;
				CPManager.vouchers.handleProviderSelection(providerToSelect);
			} else {
				CPManager.ui.disableVoucherActionButtons(true, true, true);
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
				if (CPManager.elements.voucherGroupSelect.value) {
					await CPManager.vouchers.loadVouchersForGroup(
						providerId,
						CPManager.elements.voucherGroupSelect.value
					);
				}
				return;
			}

			CPManager.elements.voucherGroupSelect.innerHTML = '<option value="">Loading groups...</option>';
			if (
				CPManager.elements.voucherCardContainer &&
				(!CPManager.state.vouchers.cachedData[`${providerId}_${CPManager.elements.voucherGroupSelect.value}`] ||
					forceRefresh)
			) {
				CPManager.ui.showSkeletonLoaders(CPManager.elements.voucherCardContainer, 1);
			}
			CPManager.ui.disableVoucherActionButtons(false, true, true);

			try {
				const groups = await CPManager.api.callApi(`/voucher/list_voucher_groups/${providerId}`);
				if (groups && Array.isArray(groups)) {
					CPManager.state.vouchers.cachedGroups[cacheKey] = groups;
					CPManager.vouchers.populateVoucherGroupSelect(providerId, groups);
				} else {
					CPManager.state.vouchers.cachedGroups[cacheKey] = [];
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
				CPManager.state.vouchers.cachedGroups[cacheKey] = [];
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
			CPManager.elements.voucherGroupSelect.innerHTML = '<option value="">-- Select a Group --</option>';

			if (groups.length > 0) {
				groups.forEach((group) => {
					const option = document.createElement("option");
					option.value = group;
					option.textContent = group;
					CPManager.elements.voucherGroupSelect.appendChild(option);
				});

				if (currentVal && groups.includes(currentVal)) {
					CPManager.elements.voucherGroupSelect.value = currentVal;
				} else if (currentVal && !groups.includes(currentVal)) {
					CPManager.elements.voucherGroupSelect.value = "";
				}
			} else {
				CPManager.elements.voucherGroupSelect.value = "";
			}

			if (CPManager.elements.voucherGroupSelect.value) {
				CPManager.ui.disableVoucherActionButtons(false, false, false);
				CPManager.vouchers.loadVouchersForGroup(providerId, CPManager.elements.voucherGroupSelect.value);
			} else {
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
				CPManager.ui.disableVoucherActionButtons(false, true, true);
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
				CPManager.vouchers.renderVouchers([], groupName);
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
					CPManager.state.vouchers.cachedData[cacheKey] = vouchers;
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
					CPManager.state.vouchers.cachedData[cacheKey] = [];
					CPManager.state.vouchers.current = [];
					CPManager.vouchers.renderVouchers([], groupName);
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
				CPManager.state.vouchers.cachedData[cacheKey] = [];
				CPManager.state.vouchers.current = [];
				CPManager.vouchers.renderVouchers([], groupName);
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
				return;
			}

			vouchers.forEach((voucher) => {
				const card = document.createElement("div");
				card.className = "voucher-card p-3 rounded-lg shadow border relative";
				card.setAttribute("role", "listitem");
				card.setAttribute("aria-label", `Voucher ${voucher.username}`);

				let stateTagColor = "bg-red-500";
				if (voucher.state === "valid") {
					stateTagColor = "bg-green-500";
				} else if (voucher.state === "unused") {
					stateTagColor = "bg-sky-500";
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

			if (CPManager.elements.voucherGroupNameInput) CPManager.elements.voucherGroupNameInput.value = "";
			if (CPManager.elements.voucherCountSelect) CPManager.elements.voucherCountSelect.value = "10";
			if (CPManager.elements.voucherCountCustom) {
				CPManager.elements.voucherCountCustom.classList.add("hidden");
				CPManager.elements.voucherCountCustom.value = "1";
			}
			if (CPManager.elements.voucherLifetimeSelect) CPManager.elements.voucherLifetimeSelect.value = "240";
			if (CPManager.elements.voucherLifetimeCustom) {
				CPManager.elements.voucherLifetimeCustom.classList.add("hidden");
				CPManager.elements.voucherLifetimeCustom.value = "";
			}
			if (CPManager.elements.voucherUsageSelect) CPManager.elements.voucherUsageSelect.value = "0";
			if (CPManager.elements.voucherUsageCustom) {
				CPManager.elements.voucherUsageCustom.classList.add("hidden");
				CPManager.elements.voucherUsageCustom.value = "";
			}
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
				lifetimeInSeconds = parseInt(CPManager.elements.voucherLifetimeSelect.value) * 60;
			}

			let usageInSeconds;
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
				validity: String(lifetimeInSeconds),
				expirytime: String(usageInSeconds),
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
						);
					} else if (outputFormat === "table") {
						CPManager.ui.showToast(`Vouchers generated. Generating Table Style PDF...`, "success");
						CPManager.vouchers.generateVouchersAsTablePDF(
							CPManager.state.vouchers.lastGenerated,
							groupname,
							doc
						);
					} else if (outputFormat === "both") {
						CPManager.ui.showToast(
							`Vouchers generated. Generating Card and Table Style PDFs...`,
							"success"
						);
						CPManager.vouchers.generateVouchersAsCardPDF(
							CPManager.state.vouchers.lastGenerated,
							groupname,
							doc
						);
						doc.addPage();
						CPManager.vouchers.generateVouchersAsTablePDF(
							CPManager.state.vouchers.lastGenerated,
							groupname,
							doc
						);
					}

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
					CPManager.state.vouchers.lastGenerated = [];
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
			const pageHeight = doc.internal.pageSize.height;
			const pageWidth = doc.internal.pageSize.width;
			const margin = 10;

			const vouchersPerRow = 3;
			const vouchersPerColumn = 6;
			const horizontalGap = 4;
			const verticalGap = 4;

			const printableWidth = pageWidth - 2 * margin;
			const titleHeight = 15;
			const printableHeightPerVoucherArea = pageHeight - 2 * margin - titleHeight;

			const voucherWidth = (printableWidth - (vouchersPerRow - 1) * horizontalGap) / vouchersPerRow;
			const voucherHeight =
				(printableHeightPerVoucherArea - (vouchersPerColumn - 1) * verticalGap) / vouchersPerColumn;

			let currentY = margin;

			doc.setFontSize(20);
			doc.setFont("helvetica", "bold");
			doc.text(`Vouchers for Group: ${groupName} (Card Style)`, pageWidth / 2, currentY + 5, { align: "center" });
			currentY += titleHeight;

			vouchers.forEach((voucher, index) => {
				const vouchersPerPage = vouchersPerRow * vouchersPerColumn;
				const voucherIndexOnPage = index % vouchersPerPage;

				if (index > 0 && voucherIndexOnPage === 0) {
					doc.addPage();
					currentY = margin;
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

				doc.setDrawColor(200);
				doc.roundedRect(voucherAbsX, voucherAbsY, voucherWidth, voucherHeight, 2, 2, "S");

				doc.setFontSize(8);
				doc.setFont("helvetica", "bold");
				doc.setTextColor(55, 65, 81);
				doc.text("Voucher Code", voucherAbsX + voucherWidth / 2, voucherAbsY + 6, { align: "center" });

				doc.setFontSize(16);
				doc.setTextColor(29, 78, 216);
				doc.text(
					voucher.username || CPManager.config.placeholderValue,
					voucherAbsX + voucherWidth / 2,
					voucherAbsY + 16,
					{
						align: "center",
					}
				);

				let detailLineY = voucherAbsY + 22;
				if (voucher.password) {
					doc.setFontSize(7);
					doc.setTextColor(75, 85, 99);
					doc.text(`Password: ${voucher.password}`, voucherAbsX + voucherWidth / 2, detailLineY, {
						align: "center",
					});
					detailLineY += 4;
				}

				doc.setFontSize(6);
				doc.setTextColor(107, 114, 128);
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
			const startY = 20;

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
				theme: "striped",
				headStyles: { fillColor: [41, 128, 185], textColor: [255, 255, 255] },
				styles: {
					fontSize: 8,
					cellPadding: 2,
					valign: "middle",
					halign: "center",
				},
				columnStyles: {
					0: { cellWidth: 30 },
					1: { cellWidth: 25 },
					2: { cellWidth: 25 },
					3: { cellWidth: 40 },
					4: { cellWidth: "auto" },
				},
				didDrawPage: function (data) {
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
						await CPManager.vouchers.loadVouchersForGroup(providerId, groupName, true);
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
						await CPManager.vouchers.loadVouchersForGroup(selectedProvider, selectedGroup, true);
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
							if (CPManager.state.vouchers.cachedGroups[selectedProvider]) {
								CPManager.state.vouchers.cachedGroups[selectedProvider] =
									CPManager.state.vouchers.cachedGroups[selectedProvider].filter(
										(g) => g !== selectedGroup
									);
							}
							delete CPManager.state.vouchers.cachedData[`${selectedProvider}_${selectedGroup}`];

							await CPManager.vouchers.loadVoucherGroups(selectedProvider, true);
							if (CPManager.elements.voucherCardContainer)
								CPManager.ui.showNoDataMessage(
									CPManager.elements.voucherCardContainer,
									"Select a group to see vouchers.",
									"fas fa-ticket-alt"
								);
							CPManager.state.vouchers.current = [];
							CPManager.ui.disableVoucherActionButtons(false, true, true);
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
						CPManager.elements.voucherGroupSelect.value = "";
						return;
					}
					localStorage.setItem(`voucherGroupFilter_${selectedProvider}`, selectedGroup);
					if (selectedGroup) {
						await CPManager.vouchers.loadVouchersForGroup(selectedProvider, selectedGroup);
						CPManager.ui.disableVoucherActionButtons(false, false, false);
					} else {
						if (CPManager.elements.voucherCardContainer)
							CPManager.ui.showNoDataMessage(
								CPManager.elements.voucherCardContainer,
								"Select a group to see vouchers.",
								"fas fa-ticket-alt"
							);
						CPManager.state.vouchers.current = [];
						CPManager.vouchers.renderVouchers([], "");
						CPManager.ui.disableVoucherActionButtons(false, true, true);
					}
				});
			}

			if (CPManager.elements.createVouchersBtn) {
				CPManager.elements.createVouchersBtn.addEventListener(
					"click",
					CPManager.vouchers.openGenerateVoucherModal
				);
			}

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
					CPManager.ui.hideModal(CPManager.elements.generateVoucherModal)
				);
			}

			if (CPManager.elements.voucherCardContainer) {
				CPManager.elements.voucherCardContainer.addEventListener("click", (e) => {
					const revokeButton = e.target.closest('[data-action="revoke-voucher"]');
					if (revokeButton) {
						e.stopPropagation();
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
