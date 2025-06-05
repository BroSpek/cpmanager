// js/vouchers.js

(function (CPManager) {
	CPManager.vouchers = {
		/**
		 * Fetches and displays voucher provider to zone linkage in an expandable card.
		 */
		displayProviderZoneLinkage: async function () {
			const detailsContainer = CPManager.elements.providerZoneLinkageDetails;
			if (!detailsContainer) {
				console.warn("Provider zone linkage details container not found.");
				return;
			}

			detailsContainer.innerHTML =
				'<p class="text-gray-500 dark:text-gray-400"><i class="fas fa-spinner fa-spin mr-2"></i>Loading linkage information...</p>';

			try {
				if (CPManager.state.zones.allConfigured.length === 0) {
					await CPManager.zones.fetchAllZoneData();
				}
				if (CPManager.state.vouchers.cachedProviders.length === 0) {
					const providers = await CPManager.api.callApi("/voucher/list_providers");
					if (providers && Array.isArray(providers)) {
						CPManager.state.vouchers.cachedProviders = providers;
					} else {
						CPManager.state.vouchers.cachedProviders = [];
					}
				}

				const configuredVoucherProviders = CPManager.state.vouchers.cachedProviders;
				const providerToZonesMap = {};

				if (CPManager.state.zones.allConfigured.length > 0 && configuredVoucherProviders.length > 0) {
					for (const zoneSummary of CPManager.state.zones.allConfigured) {
						if (!zoneSummary.uuid) continue;
						try {
							const zoneDetailsResponse = await CPManager.api.callApi(
								`/settings/get_zone/${zoneSummary.uuid}`
							);
							if (zoneDetailsResponse?.zone?.authservers) {
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
								`Could not fetch details for zone ${zoneSummary.uuid} for linkage card: ${detailError.message}`
							);
						}
					}
				}

				const providersActuallyUsedByZones = Object.keys(providerToZonesMap).filter(
					(providerName) => providerToZonesMap[providerName].size > 0
				);

				if (providersActuallyUsedByZones.length === 0) {
					detailsContainer.innerHTML =
						'<p class="text-gray-500 dark:text-gray-400">No voucher providers are currently linked to any active zones.</p>';
				} else {
					let listHtml = '<ul class="space-y-3">';
					providersActuallyUsedByZones.forEach((providerName) => {
						const zonesSet = providerToZonesMap[providerName];
						const zonesList = Array.from(zonesSet)
							.map(
								(zn) =>
									`<li><i class="fas fa-layer-group text-xs mr-1 text-gray-400 dark:text-gray-500"></i>${zn}</li>`
							)
							.join("");
						listHtml += `<li class="border-b border-gray-200 dark:border-gray-700 border-dashed pb-2 last:border-b-0 last:pb-0">
										<span class="font-semibold text-gray-700 dark:text-gray-300">${providerName}</span> is linked to:
										<ul class="list-none pl-4 mt-1 text-xs space-y-1">${zonesList}</ul>
									</li>`;
					});
					listHtml += "</ul>";
					detailsContainer.innerHTML = listHtml;
				}
			} catch (error) {
				console.error("Error displaying provider-zone linkage:", error);
				detailsContainer.innerHTML =
					'<p class="text-red-500">Could not load linkage information. Check console.</p>';
			}
		},

		initializeProviderZoneLinkageCard: function () {
			const card = CPManager.elements.providerZoneLinkageCard;
			if (!card) {
				return;
			}
			if (card.dataset.listenerAttached === "true") {
				return;
			}

			const summaryElement = card.querySelector(".card-summary");
			const detailsContent = CPManager.elements.providerZoneLinkageDetails;
			const icon = summaryElement ? summaryElement.querySelector("i.fas") : null;

			if (summaryElement && detailsContent) {
				summaryElement.addEventListener("click", () => {
					const isExpanded = detailsContent.classList.toggle("expanded");
					detailsContent.setAttribute("aria-hidden", String(!isExpanded));
					summaryElement.setAttribute("aria-expanded", String(isExpanded));
					if (icon) {
						icon.classList.toggle("fa-chevron-down", !isExpanded);
						icon.classList.toggle("fa-chevron-up", isExpanded);
					}
					if (isExpanded && detailsContent.innerHTML.includes("Loading linkage information...")) {
						CPManager.vouchers.displayProviderZoneLinkage();
					}
				});
				summaryElement.addEventListener("keydown", (e) => {
					if (e.key === "Enter" || e.key === " ") {
						e.preventDefault();
						summaryElement.click();
					}
				});
				card.dataset.listenerAttached = "true";
			}
		},
		loadVoucherProviders: async function (forceRefresh = false) {
			if (!CPManager.elements.voucherProviderSelect) return;
			CPManager.state.vouchers.currentPage = 1; // Reset page

			CPManager.vouchers.initializeProviderZoneLinkageCard();

			const detailsContainer = CPManager.elements.providerZoneLinkageDetails;
			if (detailsContainer && detailsContainer.classList.contains("expanded") && forceRefresh) {
				await CPManager.vouchers.displayProviderZoneLinkage();
			}

			if (
				!forceRefresh &&
				CPManager.state.vouchers.cachedProviders.length > 0 &&
				Date.now() - CPManager.state.vouchers.lastFetchedProviders <
					CPManager.config.inMemoryCacheTTLMinutes * 60 * 1000
			) {
				console.log("Using cached voucher providers.");
				CPManager.vouchers.populateVoucherProviderSelect(CPManager.state.vouchers.cachedProviders);
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
				CPManager.ui.clearContainer(CPManager.elements.voucherCardContainer, "voucher-pagination");
			CPManager.ui.disableVoucherActionButtons(true, true, true);

			try {
				const providers = await CPManager.api.callApi("/voucher/list_providers");
				if (providers && Array.isArray(providers)) {
					CPManager.state.vouchers.cachedProviders = providers;
					CPManager.state.vouchers.lastFetchedProviders = Date.now();
					CPManager.vouchers.populateVoucherProviderSelect(providers);
					if (detailsContainer && detailsContainer.classList.contains("expanded")) {
						await CPManager.vouchers.displayProviderZoneLinkage();
					}
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
			}
		},

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

		handleProviderSelection: function (providerId, forceRefreshGroups = false) {
			CPManager.state.vouchers.currentPage = 1; // Reset page
			if (providerId) {
				localStorage.setItem("selectedVoucherProvider", providerId);
				CPManager.vouchers.loadVoucherGroups(providerId, forceRefreshGroups);
			} else {
				localStorage.removeItem("selectedVoucherProvider");
				if (CPManager.elements.voucherGroupSelect)
					CPManager.elements.voucherGroupSelect.innerHTML =
						'<option value="">Select a provider first...</option>';
				if (CPManager.elements.voucherCardContainer)
					CPManager.ui.clearContainer(CPManager.elements.voucherCardContainer, "voucher-pagination");
				CPManager.ui.disableVoucherActionButtons(true, true, true);
			}
		},

		loadVoucherGroups: async function (providerId, forceRefresh = false) {
			CPManager.state.vouchers.currentPage = 1; // Reset page
			if (!providerId || !CPManager.elements.voucherGroupSelect) {
				if (CPManager.elements.voucherGroupSelect)
					CPManager.elements.voucherGroupSelect.innerHTML =
						'<option value="">Select a provider first...</option>';
				if (CPManager.elements.voucherCardContainer)
					CPManager.ui.clearContainer(CPManager.elements.voucherCardContainer, "voucher-pagination");
				CPManager.ui.disableVoucherActionButtons(true, true, true);
				return;
			}

			const cacheKey = providerId;
			if (
				!forceRefresh &&
				CPManager.state.vouchers.cachedGroups[cacheKey] &&
				CPManager.state.vouchers.cachedGroupsTimestamps[cacheKey] &&
				Date.now() - CPManager.state.vouchers.cachedGroupsTimestamps[cacheKey] <
					CPManager.config.inMemoryCacheTTLMinutes * 60 * 1000
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
				CPManager.ui.showSkeletonLoaders(
					CPManager.elements.voucherCardContainer,
					1,
					'<div class="skeleton-card"></div>',
					"voucher-pagination"
				);
			}
			CPManager.ui.disableVoucherActionButtons(false, true, true);

			try {
				const groups = await CPManager.api.callApi(`/voucher/list_voucher_groups/${providerId}`);
				if (groups && Array.isArray(groups)) {
					CPManager.state.vouchers.cachedGroups[cacheKey] = groups;
					CPManager.state.vouchers.cachedGroupsTimestamps[cacheKey] = Date.now();
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
							"fas fa-exclamation-triangle",
							"voucher-pagination"
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
						"fas fa-exclamation-triangle",
						"voucher-pagination"
					);
				CPManager.ui.disableVoucherActionButtons(false, true, true);
				console.error(`Exception in loadVoucherGroups for provider ${providerId}:`, error);
			}
		},

		populateVoucherGroupSelect: function (providerId, groups) {
			if (!CPManager.elements.voucherGroupSelect) return;
			CPManager.state.vouchers.currentPage = 1; // Reset page

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
							"fas fa-folder-open",
							"voucher-pagination"
						);
					} else {
						CPManager.ui.showNoDataMessage(
							CPManager.elements.voucherCardContainer,
							"Select a group to see vouchers.",
							"fas fa-ticket-alt",
							"voucher-pagination"
						);
					}
				}
				CPManager.ui.disableVoucherActionButtons(false, true, true);
			}
		},

		loadVouchersForGroup: async function (providerId, groupName, forceRefresh = false) {
			CPManager.state.vouchers.currentPage = 1; // Reset page
			if (!providerId || !groupName || !CPManager.elements.voucherCardContainer) {
				if (CPManager.elements.voucherCardContainer)
					CPManager.ui.showNoDataMessage(
						CPManager.elements.voucherCardContainer,
						"Provider or group not selected.",
						"fas fa-info-circle",
						"voucher-pagination"
					);
				CPManager.state.vouchers.current = [];
				CPManager.vouchers.renderVouchers([], groupName);
				return;
			}

			const cacheKey = `${providerId}_${groupName}`;
			if (
				!forceRefresh &&
				CPManager.state.vouchers.cachedData[cacheKey] &&
				Date.now() - CPManager.state.vouchers.cachedData[cacheKey].lastFetched <
					CPManager.config.inMemoryCacheTTLMinutes * 60 * 1000
			) {
				console.log(`Using cached vouchers for group ${groupName} (Provider: ${providerId}).`);
				CPManager.state.vouchers.current = CPManager.state.vouchers.cachedData[cacheKey].data;
				CPManager.vouchers.renderVouchers(CPManager.state.vouchers.current, groupName);
				if (CPManager.state.vouchers.current.length === 0) {
					CPManager.ui.showNoDataMessage(
						CPManager.elements.voucherCardContainer,
						`No vouchers found in group "${groupName}".`,
						"fas fa-folder-open",
						"voucher-pagination"
					);
				}
				return;
			}

			CPManager.ui.showSkeletonLoaders(
				CPManager.elements.voucherCardContainer,
				CPManager.config.itemsPerPage,
				'<div class="skeleton-card"></div>',
				"voucher-pagination"
			);

			try {
				const vouchers = await CPManager.api.callApi(`/voucher/list_vouchers/${providerId}/${groupName}`);
				if (vouchers && Array.isArray(vouchers)) {
					CPManager.state.vouchers.cachedData[cacheKey] = {
						data: vouchers,
						lastFetched: Date.now(),
					};
					CPManager.state.vouchers.current = vouchers;
					CPManager.vouchers.renderVouchers(CPManager.state.vouchers.current, groupName);
					if (vouchers.length === 0) {
						CPManager.ui.showNoDataMessage(
							CPManager.elements.voucherCardContainer,
							`No vouchers found in group "${groupName}".`,
							"fas fa-folder-open",
							"voucher-pagination"
						);
					}
				} else {
					CPManager.state.vouchers.cachedData[cacheKey] = { data: [], lastFetched: 0 };
					CPManager.state.vouchers.current = [];
					CPManager.vouchers.renderVouchers([], groupName);
					console.error(
						`Error loading vouchers for group ${groupName} (Provider: ${providerId}): API response is not an array or is undefined.`,
						vouchers
					);
					CPManager.ui.showNoDataMessage(
						CPManager.elements.voucherCardContainer,
						"Error: Unexpected data for vouchers.",
						"fas fa-exclamation-triangle",
						"voucher-pagination"
					);
				}
			} catch (error) {
				CPManager.state.vouchers.cachedData[cacheKey] = { data: [], lastFetched: 0 };
				CPManager.state.vouchers.current = [];
				CPManager.vouchers.renderVouchers([], groupName);
				CPManager.ui.showNoDataMessage(
					CPManager.elements.voucherCardContainer,
					"Error loading vouchers.",
					"fas fa-exclamation-triangle",
					"voucher-pagination"
				);
				console.error(`Exception in loadVouchersForGroup for ${groupName} (Provider: ${providerId}):`, error);
			}
		},

		renderVouchers: function (vouchers, groupName) {
			if (!CPManager.elements.voucherCardContainer) return;
			CPManager.ui.clearContainer(CPManager.elements.voucherCardContainer, "voucher-pagination");

			if (!vouchers || !Array.isArray(vouchers) || vouchers.length === 0) {
				return;
			}

			const page = CPManager.state.vouchers.currentPage;
			const itemsPerPage = CPManager.config.itemsPerPage;
			const startIndex = (page - 1) * itemsPerPage;
			const endIndex = startIndex + itemsPerPage;
			const paginatedVouchers = vouchers.slice(startIndex, endIndex);

			paginatedVouchers.forEach((voucher) => {
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
			<div class="card-details-content text-sm space-y-1" id="voucher-details-${voucher.username}" aria-hidden="true">
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
			CPManager.ui.renderPaginationControls(
				CPManager.elements.voucherPaginationContainer,
				CPManager.state.vouchers.currentPage,
				vouchers.length, // Total vouchers in the current group (full list before pagination)
				CPManager.config.itemsPerPage,
				(newPage) => {
					CPManager.state.vouchers.currentPage = newPage;
					CPManager.vouchers.renderVouchers(vouchers, groupName); // Re-render with the full list for the group
				}
			);
		},

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
					CPManager.state.vouchers.currentPage = 1; // Reset page
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
					CPManager.state.vouchers.currentPage = 1; // Reset page
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
						CPManager.state.vouchers.currentPage = 1; // Reset page
						await CPManager.vouchers.loadVouchersForGroup(providerId, groupName, true);
					} catch (error) {}
				}
			);
		},

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
						CPManager.state.vouchers.currentPage = 1; // Reset page
						await CPManager.vouchers.loadVouchersForGroup(selectedProvider, selectedGroup, true);
					} catch (error) {}
				}
			);
		},

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
							delete CPManager.state.vouchers.cachedGroupsTimestamps[selectedProvider];

							CPManager.state.vouchers.currentPage = 1; // Reset page
							await CPManager.vouchers.loadVoucherGroups(selectedProvider, true);
							if (CPManager.elements.voucherCardContainer)
								CPManager.ui.showNoDataMessage(
									CPManager.elements.voucherCardContainer,
									"Select a group to see vouchers.",
									"fas fa-ticket-alt",
									"voucher-pagination"
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
					} catch (error) {}
				}
			);
		},

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
					CPManager.state.vouchers.currentPage = 1; // Reset page
					if (selectedGroup) {
						await CPManager.vouchers.loadVouchersForGroup(selectedProvider, selectedGroup);
						CPManager.ui.disableVoucherActionButtons(false, false, false);
					} else {
						if (CPManager.elements.voucherCardContainer)
							CPManager.ui.showNoDataMessage(
								CPManager.elements.voucherCardContainer,
								"Select a group to see vouchers.",
								"fas fa-ticket-alt",
								"voucher-pagination"
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
