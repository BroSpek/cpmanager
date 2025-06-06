// js/vouchers.js

(function (CPManager) {
	CPManager.vouchers = {
		selectedVouchers: new Set(),
		currentlyVisibleVouchers: [],

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
					CPManager.state.vouchers.cachedProviders = Array.isArray(providers) ? providers : [];
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
										selectedAuthServers = formatted.split(",").map((s) => s.trim()).filter(Boolean);
									}
								} else if (typeof authServersField === "string" && authServersField.trim() !== "") {
									selectedAuthServers = authServersField.split(",").map((s) => s.trim()).filter(Boolean);
								} else if (Array.isArray(authServersField)) {
									selectedAuthServers = authServersField.map((s) => String(s).trim()).filter(Boolean);
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
							console.warn(`Could not fetch details for zone ${zoneSummary.uuid} for linkage card: ${detailError.message}`);
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
						const zonesList = Array.from(providerToZonesMap[providerName]).map((zn) => `<li><i class="fas fa-layer-group text-xs mr-1 text-gray-400 dark:text-gray-500"></i>${zn}</li>`).join("");
						listHtml += `<li class="border-b border-gray-200 dark:border-gray-700 border-dashed pb-2 last:border-b-0 last:pb-0"><span class="font-semibold text-gray-700 dark:text-gray-300">${providerName}</span> is linked to:<ul class="list-none pl-4 mt-1 text-xs space-y-1">${zonesList}</ul></li>`;
					});
					listHtml += "</ul>";
					detailsContainer.innerHTML = listHtml;
				}
			} catch (error) {
				console.error("Error displaying provider-zone linkage:", error);
				detailsContainer.innerHTML = '<p class="text-red-500">Could not load linkage information. Check console.</p>';
			}
		},

		initializeProviderZoneLinkageCard: function () {
			const card = CPManager.elements.providerZoneLinkageCard;
			if (!card || card.dataset.listenerAttached === "true") return;
			const summaryElement = card.querySelector(".card-summary");
			const detailsContent = CPManager.elements.providerZoneLinkageDetails;
			const icon = summaryElement ? summaryElement.querySelector("i.fas") : null;
			if (summaryElement && detailsContent) {
				summaryElement.addEventListener("click", () => {
					const isExpanded = detailsContent.classList.toggle("expanded");
					detailsContent.setAttribute("aria-hidden", String(!isExpanded));
					summaryElement.setAttribute("aria-expanded", String(isExpanded));
					if (icon) icon.classList.toggle("fa-chevron-up", isExpanded);
					if (isExpanded && detailsContent.innerHTML.includes("Loading")) this.displayProviderZoneLinkage();
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
			CPManager.state.vouchers.currentPage = 1;
			this.initializeProviderZoneLinkageCard();
			const detailsContainer = CPManager.elements.providerZoneLinkageDetails;
			if (detailsContainer && detailsContainer.classList.contains("expanded") && forceRefresh) {
				await this.displayProviderZoneLinkage();
			}
			if (!forceRefresh && CPManager.state.vouchers.cachedProviders.length > 0 && Date.now() - CPManager.state.vouchers.lastFetchedProviders < CPManager.config.inMemoryCacheTTLMinutes * 60 * 1000) {
				this.populateVoucherProviderSelect(CPManager.state.vouchers.cachedProviders);
				if (CPManager.elements.voucherProviderSelect.value) {
					this.handleProviderSelection(CPManager.elements.voucherProviderSelect.value);
				}
				return;
			}
			CPManager.elements.voucherProviderSelect.innerHTML = '<option value="">Loading providers...</option>';
			if (CPManager.elements.voucherGroupSelect) CPManager.elements.voucherGroupSelect.innerHTML = '<option value="">Select provider...</option>';
			if (CPManager.elements.voucherCardContainer) CPManager.ui.clearContainer(CPManager.elements.voucherCardContainer, "voucher-pagination");
			if (CPManager.elements.voucherSearchInput) CPManager.elements.voucherSearchInput.value = "";
			if (CPManager.elements.voucherStateFilterSelect) CPManager.elements.voucherStateFilterSelect.value = "";
			CPManager.ui.disableVoucherActionButtons(true, true, true);
			this.updateVoidSelectedButton(); 
			try {
				const providers = await CPManager.api.callApi("/voucher/list_providers");
				if (Array.isArray(providers)) {
					CPManager.state.vouchers.cachedProviders = providers;
					CPManager.state.vouchers.lastFetchedProviders = Date.now();
					this.populateVoucherProviderSelect(providers);
					if (detailsContainer && detailsContainer.classList.contains("expanded")) {
						await this.displayProviderZoneLinkage();
					}
				} else {
					CPManager.state.vouchers.cachedProviders = [];
					CPManager.ui.showToast("Could not load voucher providers: unexpected format.", "error");
				}
			} catch (error) {
				CPManager.state.vouchers.cachedProviders = [];
				CPManager.elements.voucherProviderSelect.innerHTML = '<option value="">Error loading providers.</option>';
			}
		},

		populateVoucherProviderSelect: function (providers) {
			if (!CPManager.elements.voucherProviderSelect) return;
			if (providers.length === 0) {
				CPManager.elements.voucherProviderSelect.innerHTML = '<option value="">No providers found.</option>';
				CPManager.ui.showToast("No voucher providers configured on OPNsense.", "warning");
				CPManager.ui.disableVoucherActionButtons(true, true, true);
				this.updateVoidSelectedButton();
				return;
			}
			CPManager.elements.voucherProviderSelect.innerHTML = '<option value="">-- Select Provider --</option>';
			const savedProvider = localStorage.getItem(CPManager.config.localStorageKeys.selectedVoucherProvider);
			let providerToSelect = null;
			providers.forEach((provider) => {
				const option = document.createElement("option");
				option.value = provider;
				option.textContent = provider;
				CPManager.elements.voucherProviderSelect.appendChild(option);
				if (provider === savedProvider) providerToSelect = savedProvider;
			});
			if (providers.length === 1 && !providerToSelect) {
				CPManager.elements.voucherProviderSelect.value = providers[0];
				localStorage.setItem(CPManager.config.localStorageKeys.selectedVoucherProvider, providers[0]);
				this.handleProviderSelection(providers[0]);
			} else if (providerToSelect) {
				CPManager.elements.voucherProviderSelect.value = providerToSelect;
				this.handleProviderSelection(providerToSelect);
			} else {
				CPManager.ui.disableVoucherActionButtons(true, true, true);
				this.updateVoidSelectedButton();
			}
		},
		
		handleProviderSelection: function (providerId, forceRefreshGroups = false) {
			CPManager.state.vouchers.currentPage = 1;
			this.selectedVouchers.clear();
			this.updateSelectAllUI([]);
			if (CPManager.elements.voucherSearchInput) CPManager.elements.voucherSearchInput.value = "";
			if (CPManager.elements.voucherStateFilterSelect) CPManager.elements.voucherStateFilterSelect.value = "";
			if (providerId) {
				localStorage.setItem(CPManager.config.localStorageKeys.selectedVoucherProvider, providerId);
				this.loadVoucherGroups(providerId, forceRefreshGroups);
			} else {
				localStorage.removeItem(CPManager.config.localStorageKeys.selectedVoucherProvider);
				if (CPManager.elements.voucherGroupSelect) CPManager.elements.voucherGroupSelect.innerHTML = '<option value="">Select provider...</option>';
				if (CPManager.elements.voucherCardContainer) CPManager.ui.clearContainer(CPManager.elements.voucherCardContainer, "voucher-pagination");
				CPManager.ui.disableVoucherActionButtons(true, true, true);
				this.updateVoidSelectedButton();
			}
		},

		loadVoucherGroups: async function (providerId, forceRefresh = false) {
			CPManager.state.vouchers.currentPage = 1;
			this.selectedVouchers.clear();
			this.updateSelectAllUI([]);
			if (CPManager.elements.voucherSearchInput) CPManager.elements.voucherSearchInput.value = "";
			if (CPManager.elements.voucherStateFilterSelect) CPManager.elements.voucherStateFilterSelect.value = "";
			if (!providerId || !CPManager.elements.voucherGroupSelect) {
				if (CPManager.elements.voucherGroupSelect) CPManager.elements.voucherGroupSelect.innerHTML = '<option value="">Select provider...</option>';
				if (CPManager.elements.voucherCardContainer) CPManager.ui.clearContainer(CPManager.elements.voucherCardContainer, "voucher-pagination");
				CPManager.ui.disableVoucherActionButtons(true, true, true);
				this.updateVoidSelectedButton();
				return;
			}
			const cacheKey = providerId;
			if (!forceRefresh && CPManager.state.vouchers.cachedGroups[cacheKey] && Date.now() - CPManager.state.vouchers.cachedGroupsTimestamps[cacheKey] < CPManager.config.inMemoryCacheTTLMinutes * 60 * 1000) {
				this.populateVoucherGroupSelect(providerId, CPManager.state.vouchers.cachedGroups[cacheKey]);
				return;
			}
			CPManager.elements.voucherGroupSelect.innerHTML = '<option value="">Loading groups...</option>';
			if (CPManager.elements.voucherCardContainer && (!CPManager.state.vouchers.cachedData[`${providerId}_${CPManager.elements.voucherGroupSelect.value}`] || forceRefresh)) {
				CPManager.ui.showSkeletonLoaders(CPManager.elements.voucherCardContainer, 1, '<div class="skeleton-card"></div>', "voucher-pagination");
			}
			CPManager.ui.disableVoucherActionButtons(false, true, true);
			this.updateVoidSelectedButton();
			try {
				const groups = await CPManager.api.callApi(`/voucher/list_voucher_groups/${providerId}`);
				if (Array.isArray(groups)) {
					CPManager.state.vouchers.cachedGroups[cacheKey] = groups;
					CPManager.state.vouchers.cachedGroupsTimestamps[cacheKey] = Date.now();
					this.populateVoucherGroupSelect(providerId, groups);
				} else {
					CPManager.state.vouchers.cachedGroups[cacheKey] = [];
					if (CPManager.elements.voucherGroupSelect) CPManager.elements.voucherGroupSelect.innerHTML = '<option value="">Error: No groups data.</option>';
					if (CPManager.elements.voucherCardContainer) CPManager.ui.showNoDataMessage(CPManager.elements.voucherCardContainer, "Error loading groups.", "fas fa-exclamation-triangle", "voucher-pagination");
					CPManager.ui.disableVoucherActionButtons(false, true, true);
					this.updateVoidSelectedButton();
				}
			} catch (error) {
				CPManager.state.vouchers.cachedGroups[cacheKey] = [];
				if(CPManager.elements.voucherGroupSelect) CPManager.elements.voucherGroupSelect.innerHTML = '<option value="">Error loading groups.</option>';
				if (CPManager.elements.voucherCardContainer) CPManager.ui.showNoDataMessage(CPManager.elements.voucherCardContainer, "Error loading groups.", "fas fa-exclamation-triangle", "voucher-pagination");
				CPManager.ui.disableVoucherActionButtons(false, true, true);
				this.updateVoidSelectedButton();
			}
		},

		populateVoucherGroupSelect: async function (providerId, groups) {
			if (!CPManager.elements.voucherGroupSelect) return;
			CPManager.state.vouchers.currentPage = 1;
			const groupFilterKey = `${CPManager.config.localStorageKeys.voucherGroupFilterPrefix}${providerId}`;
			const currentVal = localStorage.getItem(groupFilterKey) || "";
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
					localStorage.removeItem(groupFilterKey);
				}
			} else {
				CPManager.elements.voucherGroupSelect.value = "";
			}
			if (CPManager.elements.voucherGroupSelect.value) {
				CPManager.ui.disableVoucherActionButtons(false, false, false);
				await this.loadVouchersForGroup(providerId, CPManager.elements.voucherGroupSelect.value);
			} else {
				if (CPManager.elements.voucherCardContainer) {
					if (groups.length === 0 && providerId) {
						CPManager.ui.showNoDataMessage(CPManager.elements.voucherCardContainer, `No voucher groups for provider: <strong>${providerId}</strong>.`, "fas fa-folder-open", "voucher-pagination");
					} else {
						CPManager.ui.showNoDataMessage(CPManager.elements.voucherCardContainer, "Select a group to see its vouchers.", "fas fa-ticket-alt", "voucher-pagination");
					}
				}
				this.renderVouchers([], "");
				CPManager.ui.disableVoucherActionButtons(false, true, true);
				this.updateVoidSelectedButton();
			}
		},

		loadVouchersForGroup: async function (providerId, groupName, forceRefresh = false) {
			CPManager.state.vouchers.currentPage = 1;
			this.selectedVouchers.clear();
			
			if (!providerId || !groupName || !CPManager.elements.voucherCardContainer) {
				if (CPManager.elements.voucherCardContainer) CPManager.ui.showNoDataMessage(CPManager.elements.voucherCardContainer, "Provider or group not selected.", "fas fa-info-circle", "voucher-pagination");
				CPManager.state.vouchers.current = [];
				this.renderVouchers([], groupName);
				return;
			}
			
			const cacheKey = `${providerId}_${groupName}`;
			const isCacheValid = !forceRefresh && CPManager.state.vouchers.cachedData[cacheKey] && Date.now() - CPManager.state.vouchers.cachedData[cacheKey].lastFetched < CPManager.config.inMemoryCacheTTLMinutes * 60 * 1000;

			if (!isCacheValid) {
				CPManager.ui.showSkeletonLoaders(CPManager.elements.voucherCardContainer, CPManager.config.itemsPerPage, '<div class="skeleton-card"></div>', "voucher-pagination");
			}
			
			try {
				if (isCacheValid) {
					CPManager.state.vouchers.current = CPManager.state.vouchers.cachedData[cacheKey].data;
				} else {
					const vouchers = await CPManager.api.callApi(`/voucher/list_vouchers/${providerId}/${groupName}`);
					const data = Array.isArray(vouchers) ? vouchers : [];
					CPManager.state.vouchers.cachedData[cacheKey] = { data: data, lastFetched: Date.now() };
					CPManager.state.vouchers.current = data;
				}
			} catch (error) {
				CPManager.ui.showToast("Error loading vouchers for group: " + error.message, "error");
				CPManager.state.vouchers.current = [];
				if (CPManager.state.vouchers.cachedData[cacheKey]) {
					CPManager.state.vouchers.cachedData[cacheKey].lastFetched = 0;
				}
			} finally {
				this.applyVoucherFiltersAndRender(groupName);
			}
		},

		applyVoucherFiltersAndRender: function(groupName) {
			if (!CPManager.elements.voucherCardContainer) return;
			CPManager.state.vouchers.currentPage = 1;
			const searchTerm = CPManager.elements.voucherSearchInput ? CPManager.elements.voucherSearchInput.value.toLowerCase() : "";
			const selectedState = CPManager.elements.voucherStateFilterSelect ? CPManager.elements.voucherStateFilterSelect.value : "";
			let filteredVouchers = CPManager.state.vouchers.current;
			if (searchTerm) filteredVouchers = filteredVouchers.filter((v) => v.username && v.username.toLowerCase().includes(searchTerm));
			if (selectedState) filteredVouchers = filteredVouchers.filter((v) => v.state === selectedState);
			this.currentlyVisibleVouchers = filteredVouchers;
			this.renderVouchers(filteredVouchers, groupName);
		},

		renderVouchers: function (vouchersToRender, groupName) {
			const container = CPManager.elements.voucherCardContainer;
			const selectAllContainer = CPManager.elements.voucherSelectAllContainer;
			if (!container || !selectAllContainer) return;

			CPManager.ui.clearContainer(container, "voucher-pagination");
			this.updateSelectAllUI(vouchersToRender);
			
			if (vouchersToRender.length > 0) {
				selectAllContainer.classList.remove('hidden');
			} else {
				selectAllContainer.classList.add('hidden');
			}

			if (!vouchersToRender || vouchersToRender.length === 0) {
				const searchTerm = CPManager.elements.voucherSearchInput?.value;
				const selectedState = CPManager.elements.voucherStateFilterSelect?.value;
				let message = groupName ? `No vouchers found in group "<strong>${groupName}</strong>"` : "Select a group to see vouchers.";
				if (groupName && (searchTerm || selectedState)) message += " matching your filters.";
				else if (groupName) message += ".";
				CPManager.ui.showNoDataMessage(container, message, "fas fa-folder-open", "voucher-pagination");
				return;
			}

			const paginatedVouchers = vouchersToRender.slice((CPManager.state.vouchers.currentPage - 1) * CPManager.config.itemsPerPage, CPManager.state.vouchers.currentPage * CPManager.config.itemsPerPage);
			paginatedVouchers.forEach((voucher) => {
				const card = document.createElement("div");
				card.className = "voucher-card p-2 rounded-lg shadow border group";
				const stateTagColor = voucher.state === "valid" ? "bg-green-500" : voucher.state === "unused" ? "bg-sky-500" : "bg-red-500";
				const isChecked = this.selectedVouchers.has(voucher.username);
				const isExpired = voucher.state === 'expired';
				const checkboxHTML = `<div class="flex-shrink-0"><input type="checkbox" class="voucher-select-checkbox form-checkbox h-5 w-5" data-voucher-username="${voucher.username}" ${isChecked ? 'checked' : ''} ${isExpired ? 'disabled' : ''}></div>`;
				card.innerHTML = `<div class="flex justify-between items-center mb-1">${checkboxHTML}<div class="flex items-center"><span class="info-tag ${stateTagColor} truncate" title="State: ${voucher.state}">${voucher.state}</span></div></div><div class="card-summary cursor-pointer pb-1" role="button" tabindex="0" aria-expanded="false"><div class="info-row"><span class="info-label text-sm">Voucher Code</span><span class="info-value summary-main-value text-sm">${voucher.username}</span></div></div><div class="card-details-content text-sm space-y-1" id="voucher-details-${voucher.username}" aria-hidden="true"><div class="info-row"><span class="info-label">Validity</span> <span class="info-value">${CPManager.utils.formatDuration(voucher.validity, "seconds")}</span></div><div class="info-row"><span class="info-label">Start Time</span> <span class="info-value">${CPManager.utils.formatVoucherTimestamp(voucher.starttime)}</span></div><div class="info-row"><span class="info-label">End Time</span> <span class="info-value">${CPManager.utils.formatVoucherTimestamp(voucher.endtime)}</span></div><div class="info-row"><span class="info-label">Expires At</span><span class="info-value">${voucher.expirytime && voucher.expirytime !== 0 ? CPManager.utils.formatVoucherTimestamp(voucher.expirytime) : "Never"}</span></div></div>`;
				container.appendChild(card);
			});
			CPManager.ui.renderPaginationControls(CPManager.elements.voucherPaginationContainer, CPManager.state.vouchers.currentPage, vouchersToRender.length, CPManager.config.itemsPerPage, (newPage) => {
				CPManager.state.vouchers.currentPage = newPage;
				this.renderVouchers(vouchersToRender, groupName);
			});
		},

		updateVoidSelectedButton: function() {
			const button = CPManager.elements.voidSelectedVouchersBtn;
			if (!button) return;
			const selectedCount = this.selectedVouchers.size;
			const providerSelected = CPManager.elements.voucherProviderSelect && CPManager.elements.voucherProviderSelect.value;
			const groupSelected = CPManager.elements.voucherGroupSelect && CPManager.elements.voucherGroupSelect.value;
			button.innerHTML = `<i class="fas fa-times-circle mr-2"></i>Void Selected`;
			button.disabled = selectedCount === 0 || !providerSelected || !groupSelected;
		},

		updateSelectAllUI: function(vouchersToRender = this.currentlyVisibleVouchers) {
			const { voucherSelectAllContainer, voucherSelectAllCheckbox, voucherSelectedCountText } = CPManager.elements;
			if (!voucherSelectAllContainer || !voucherSelectAllCheckbox || !voucherSelectedCountText) return;
			this.updateVoidSelectedButton();
			const selectedCount = this.selectedVouchers.size;
			voucherSelectedCountText.textContent = `(${selectedCount} voucher${selectedCount === 1 ? '' : 's'} selected)`;
			const eligibleVouchers = vouchersToRender.filter(v => v.state !== 'expired');
			const allEligibleVisibleSelected = eligibleVouchers.length > 0 && eligibleVouchers.every(v => this.selectedVouchers.has(v.username));
			voucherSelectAllCheckbox.checked = allEligibleVisibleSelected;
			voucherSelectAllCheckbox.indeterminate = selectedCount > 0 && !allEligibleVisibleSelected;
			voucherSelectAllCheckbox.disabled = eligibleVouchers.length === 0;
		},
		
		handleSelectAll: function(isChecked) {
			const eligibleVouchers = this.currentlyVisibleVouchers.filter(v => v.state !== 'expired');
			eligibleVouchers.forEach(voucher => {
				if (isChecked) {
					this.selectedVouchers.add(voucher.username);
				} else {
					this.selectedVouchers.delete(voucher.username);
				}
			});
			this.renderVouchers(this.currentlyVisibleVouchers, CPManager.elements.voucherGroupSelect.value);
		},

		handleVoidSelectedVouchers: async function () {
			const selectedVouchers = Array.from(this.selectedVouchers);
			if (selectedVouchers.length === 0) {
				return;
			}
			const providerId = CPManager.elements.voucherProviderSelect.value;
			const groupName = CPManager.elements.voucherGroupSelect.value;
			if (!providerId || !groupName) {
				CPManager.ui.showToast("Cannot void: Provider or Group not selected.", "error");
				return;
			}
			const confirmationMsg = `Are you sure you want to void the <strong>${selectedVouchers.length}</strong> selected voucher(s) from group "<strong>${groupName}</strong>"? This will mark them as expired.`;
			CPManager.ui.showConfirmationModal("Confirm Void Selected", confirmationMsg, async () => {
				CPManager.ui.showToast(`Voiding ${selectedVouchers.length} voucher(s)...`, "info", 5000);
				let successCount = 0;
				let failureCount = 0;
				const voidPromises = selectedVouchers.map(voucherCode =>
					CPManager.api.callApi(`/voucher/expire_voucher/${providerId}`, "POST", { username: voucherCode })
						.then(result => (result && result.status !== 'error' ? successCount++ : failureCount++))
						.catch(() => failureCount++)
				);
				await Promise.all(voidPromises);
				let summaryMessage = successCount > 0 && failureCount === 0 ? `Successfully voided all ${successCount} selected voucher(s).`
					: successCount > 0 && failureCount > 0 ? `Voided ${successCount} voucher(s). Failed for ${failureCount}.`
					: `Failed to void any of the ${failureCount} selected voucher(s).`;
				CPManager.ui.showToast(summaryMessage, failureCount > 0 ? (successCount > 0 ? "warning" : "error") : "success");
				this.selectedVouchers.clear();
				this.updateVoidSelectedButton();
				CPManager.state.vouchers.currentPage = 1;
				await this.loadVouchersForGroup(providerId, groupName, true);
			});
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
			if (cardOutputRadio) cardOutputRadio.checked = true;
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
			let count = CPManager.elements.voucherCountSelect.value === "custom" ? parseInt(CPManager.elements.voucherCountCustom.value) : parseInt(CPManager.elements.voucherCountSelect.value);
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
					CPManager.ui.showToast("Custom Expires In (hours) must be non-negative.", "error");
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
			const defaultGroupName = `g${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, "0")}${String(now.getDate()).padStart(2, "0")}${String(now.getHours()).padStart(2, "0")}${String(now.getMinutes()).padStart(2, "0")}`;
			const groupname = CPManager.elements.voucherGroupNameInput.value.trim() || defaultGroupName;
			const payload = { count: String(count), validity: String(lifetimeInSeconds), expirytime: String(usageInSeconds), vouchergroup: groupname };
			CPManager.elements.submitGenerateVoucherBtn.disabled = true;
			CPManager.elements.submitGenerateVoucherBtn.innerHTML = '<i class="fas fa-spinner fa-spin mr-2"></i>Generating...';
			try {
				const result = await CPManager.api.callApi(`/voucher/generate_vouchers/${selectedProvider}`, "POST", payload);
				if (result && Array.isArray(result) && result.length > 0 && result[0].username) {
					CPManager.state.vouchers.lastGenerated = result;
					const outputFormat = document.querySelector('input[name="voucher-output-format"]:checked').value;
					const { jsPDF } = window.jspdf;
					const doc = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });
					if (outputFormat === "card") {
						this.generateVouchersAsCardPDF(CPManager.state.vouchers.lastGenerated, groupname, doc);
					} else if (outputFormat === "table") {
						this.generateVouchersAsTablePDF(CPManager.state.vouchers.lastGenerated, groupname, doc);
					} else if (outputFormat === "both") {
						this.generateVouchersAsCardPDF(CPManager.state.vouchers.lastGenerated, groupname, doc);
						doc.addPage();
						this.generateVouchersAsTablePDF(CPManager.state.vouchers.lastGenerated, groupname, doc);
					}
					const timestamp = new Date().toISOString().slice(0, 10).replace(/-/g, "");
					doc.save(`${groupname}_${timestamp}_vouchers.pdf`);
					CPManager.ui.showToast("Vouchers PDF generated!", "success");
					CPManager.ui.hideModal(CPManager.elements.generateVoucherModal);
					CPManager.state.vouchers.currentPage = 1;
					await this.loadVoucherGroups(selectedProvider, true);
					if (CPManager.elements.voucherGroupSelect) CPManager.elements.voucherGroupSelect.value = groupname;
					await this.loadVouchersForGroup(selectedProvider, groupname, true);
				} else {
					CPManager.ui.showToast(`Failed to generate vouchers: ${result.message || (result.status === "error" ? "API error." : "Unknown error.")}`, "error");
					CPManager.state.vouchers.lastGenerated = [];
				}
			} catch (error) {
				CPManager.state.vouchers.lastGenerated = [];
				CPManager.ui.showToast("Error during voucher generation or PDF creation: " + error.message, "error");
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
					{ align: "center" }
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
				styles: { fontSize: 8, cellPadding: 2, valign: "middle", halign: "center" },
				columnStyles: { 0: { cellWidth: 30 }, 1: { cellWidth: 25 }, 2: { cellWidth: 25 }, 3: { cellWidth: 40 }, 4: { cellWidth: "auto" } },
				didDrawPage: function (data) {
					let str = "Page " + doc.internal.getNumberOfPages();
					doc.setFontSize(8);
					doc.text(str, doc.internal.pageSize.width - data.settings.margin.right, doc.internal.pageSize.height - 5);
				},
			});
		},
		
		handleDropExpiredVouchers: async function () {
			if (!CPManager.elements.voucherProviderSelect || !CPManager.elements.voucherGroupSelect) return;
			const selectedProvider = CPManager.elements.voucherProviderSelect.value;
			const selectedGroup = CPManager.elements.voucherGroupSelect.value;
			if (!selectedProvider) {
				CPManager.ui.showToast("Select voucher provider.", "error");
				return;
			}
			if (!selectedGroup) {
				CPManager.ui.showToast("Select voucher group.", "error");
				return;
			}
			CPManager.ui.showConfirmationModal("Drop Expired Vouchers?", `Remove all expired vouchers from group "<strong>${selectedGroup}</strong>" for provider "<strong>${selectedProvider}</strong>"?`, async () => {
				try {
					const result = await CPManager.api.callApi(`/voucher/drop_expired_vouchers/${selectedProvider}/${selectedGroup}`, "POST", {});
					if (result && result.status === "drop") {
						CPManager.ui.showToast(`Expired vouchers from group "${selectedGroup}" (Provider: ${selectedProvider}) cleaned. Count: ${result.count || 0}`, "success");
					} else {
						CPManager.ui.showToast(`Cleanup for group "${selectedGroup}" (Provider: ${selectedProvider}) processed. Status: ${result.status || "unknown"}. Count: ${result.count || 0}`, "info");
					}
					CPManager.state.vouchers.currentPage = 1;
					await this.loadVouchersForGroup(selectedProvider, selectedGroup, true);
				} catch (error) {
					CPManager.ui.showToast("Error dropping expired vouchers: " + error.message, "error");
				}
			});
		},

		handleDropVoucherGroup: async function () {
			if (!CPManager.elements.voucherProviderSelect || !CPManager.elements.voucherGroupSelect) return;
			const selectedProvider = CPManager.elements.voucherProviderSelect.value;
			const selectedGroup = CPManager.elements.voucherGroupSelect.value;
			if (!selectedProvider) {
				CPManager.ui.showToast("Select voucher provider.", "warning");
				return;
			}
			if (!selectedGroup) {
				CPManager.ui.showToast("Select voucher group to delete.", "warning");
				return;
			}
			CPManager.ui.showConfirmationModal("Drop Voucher Group?", `Delete entire voucher group "<strong>${selectedGroup}</strong>" for provider "<strong>${selectedProvider}</strong>"? This deletes all vouchers within.`, async () => {
				try {
					const result = await CPManager.api.callApi(`/voucher/drop_voucher_group/${selectedProvider}/${selectedGroup}`, "POST", {});
					if (result && result.status !== "error") {
						CPManager.ui.showToast(`Voucher group "${selectedGroup}" (Provider: ${selectedProvider}) deleted.`, "success");
						if (CPManager.state.vouchers.cachedGroups[selectedProvider]) {
							CPManager.state.vouchers.cachedGroups[selectedProvider] = CPManager.state.vouchers.cachedGroups[selectedProvider].filter((g) => g !== selectedGroup);
						}
						delete CPManager.state.vouchers.cachedData[`${selectedProvider}_${selectedGroup}`];
						CPManager.state.vouchers.currentPage = 1;
						await this.loadVoucherGroups(selectedProvider, true);
						if (CPManager.elements.voucherGroupSelect && !CPManager.elements.voucherGroupSelect.value) {
							if (CPManager.elements.voucherCardContainer) {
								CPManager.ui.showNoDataMessage(CPManager.elements.voucherCardContainer, "Select a group to see its vouchers.", "fas fa-ticket-alt", "voucher-pagination");
							}
							CPManager.state.vouchers.current = [];
						}
						CPManager.ui.disableVoucherActionButtons(false, true, true);
					} else {
						CPManager.ui.showToast(`Failed to delete voucher group "${selectedGroup}". API: ${result ? result.message : "Unknown error."}`, "error");
					}
				} catch (error) {
					CPManager.ui.showToast("Error dropping voucher group: " + error.message, "error");
				}
			});
		},

		initializeVoucherEventListeners: function () {
			if (CPManager.elements.voucherProviderSelect) {
				CPManager.elements.voucherProviderSelect.addEventListener("change", (e) => this.handleProviderSelection(e.target.value));
			}
			if (CPManager.elements.voucherGroupSelect) {
				CPManager.elements.voucherGroupSelect.addEventListener("change", async (e) => {
					const selectedProvider = CPManager.elements.voucherProviderSelect?.value;
					const selectedGroup = e.target.value;
					this.selectedVouchers.clear();
					this.updateSelectAllUI([]);
					if (CPManager.elements.voucherSearchInput) CPManager.elements.voucherSearchInput.value = "";
					if (CPManager.elements.voucherStateFilterSelect) CPManager.elements.voucherStateFilterSelect.value = "";
					if (!selectedProvider) {
						CPManager.ui.showToast("Select a voucher provider.", "warning");
						e.target.value = "";
						return;
					}
					const groupFilterKey = `${CPManager.config.localStorageKeys.voucherGroupFilterPrefix}${selectedProvider}`;
					localStorage.setItem(groupFilterKey, selectedGroup);
					CPManager.state.vouchers.currentPage = 1;
					if (selectedGroup) {
						await this.loadVouchersForGroup(selectedProvider, selectedGroup);
						CPManager.ui.disableVoucherActionButtons(false, false, false);
					} else {
						if (CPManager.elements.voucherCardContainer) CPManager.ui.showNoDataMessage(CPManager.elements.voucherCardContainer, "Select a group to see its vouchers.", "fas fa-ticket-alt", "voucher-pagination");
						CPManager.state.vouchers.current = [];
						this.renderVouchers([], "");
						CPManager.ui.disableVoucherActionButtons(false, true, true);
					}
				});
			}

			const applyFilters = () => {
				const selectedGroup = CPManager.elements.voucherGroupSelect?.value;
				if (selectedGroup) this.applyVoucherFiltersAndRender(selectedGroup);
			};
			if (CPManager.elements.voucherSearchInput) CPManager.elements.voucherSearchInput.addEventListener("input", applyFilters);
			if (CPManager.elements.voucherStateFilterSelect) CPManager.elements.voucherStateFilterSelect.addEventListener("change", applyFilters);
			
			if (CPManager.elements.voidSelectedVouchersBtn) {
				CPManager.elements.voidSelectedVouchersBtn.addEventListener('click', () => this.handleVoidSelectedVouchers());
			}
			if(CPManager.elements.voucherSelectAllCheckbox) {
				CPManager.elements.voucherSelectAllCheckbox.addEventListener('change', (e) => this.handleSelectAll(e.target.checked));
			}
			if (CPManager.elements.voucherCardContainer) {
				CPManager.elements.voucherCardContainer.addEventListener("click", (e) => {
					const checkbox = e.target.closest('.voucher-select-checkbox');
					if (checkbox) {
						if (checkbox.checked) {
							this.selectedVouchers.add(checkbox.dataset.voucherUsername);
						} else {
							this.selectedVouchers.delete(checkbox.dataset.voucherUsername);
						}
						this.updateSelectAllUI();
						return;
					}
					const summary = e.target.closest('.card-summary');
					if (summary) {
						const card = summary.closest('.voucher-card');
						if (card) CPManager.ui.toggleCardDetails(card, CPManager.elements.voucherCardContainer);
					}
				});
			}
			
			if (CPManager.elements.createVouchersBtn) CPManager.elements.createVouchersBtn.addEventListener("click", () => this.openGenerateVoucherModal());
			if (CPManager.elements.dropExpiredVouchersBtn) CPManager.elements.dropExpiredVouchersBtn.addEventListener("click", () => this.handleDropExpiredVouchers());
			if (CPManager.elements.dropVoucherGroupBtn) CPManager.elements.dropVoucherGroupBtn.addEventListener("click", () => this.handleDropVoucherGroup());
			if (CPManager.elements.submitGenerateVoucherBtn) CPManager.elements.submitGenerateVoucherBtn.addEventListener("click", () => this.handleSubmitGenerateVoucher());
			if (CPManager.elements.cancelGenerateVoucherBtn) CPManager.elements.cancelGenerateVoucherBtn.addEventListener("click", () => CPManager.ui.hideModal(CPManager.elements.generateVoucherModal));

			if (CPManager.elements.voucherCountSelect && CPManager.elements.voucherCountCustom) {
				CPManager.elements.voucherCountSelect.addEventListener("change", (e) => {
					CPManager.elements.voucherCountCustom.classList.toggle("hidden", e.target.value !== "custom");
				});
			}
			if (CPManager.elements.voucherLifetimeSelect && CPManager.elements.voucherLifetimeCustom) {
				CPManager.elements.voucherLifetimeSelect.addEventListener("change", (e) => {
					CPManager.elements.voucherLifetimeCustom.classList.toggle("hidden", e.target.value !== "custom");
				});
			}
			if (CPManager.elements.voucherUsageSelect && CPManager.elements.voucherUsageCustom) {
				CPManager.elements.voucherUsageSelect.addEventListener("change", (e) => {
					CPManager.elements.voucherUsageCustom.classList.toggle("hidden", e.target.value !== "custom");
				});
			}
		},
	};
	if (!CPManager.state.vouchers.selectedVouchers) {
		CPManager.state.vouchers.selectedVouchers = new Set();
	}
})(CPManager);
