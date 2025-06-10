// js/zones.js

(function (CPManager) {
  CPManager.zones = {
    fetchAllZoneData: async function (forceRefresh = false) {
      if (
        !forceRefresh &&
        CPManager.state.zones.allConfigured.length > 0 &&
        CPManager.state.zones.allConfigured[0].description !== undefined && // Check if data is more than just basic
        Date.now() - CPManager.state.zones.lastFetched <
          CPManager.config.inMemoryCacheTTLMinutes * 60 * 1000
      ) {
        return;
      }
      try {
        const data = await CPManager.api.callApi("/settings/search_zones");
        if (data && Array.isArray(data.rows)) {
          CPManager.state.zones.allConfigured = data.rows;
          CPManager.state.zones.lastFetched = Date.now();
        } else {
          CPManager.state.zones.allConfigured = [];
          console.warn(
            "No zones found or unexpected data format from /settings/search_zones.",
            data,
          );
        }
      } catch (error) {
        console.error(
          "Failed to fetch all zone data for descriptions:",
          error.message,
        );
        CPManager.state.zones.allConfigured = [];
      }
    },

    fetchCustomTemplates: async function (forceRefresh = false) {
      if (
        !forceRefresh &&
        CPManager.state.zones.customTemplates.length > 0 &&
        Date.now() - CPManager.state.zones.customTemplatesLastFetched <
          CPManager.config.inMemoryCacheTTLMinutes * 60 * 1000
      ) {
        return;
      }
      try {
        const data = await CPManager.api.callApi("/service/search_templates");
        if (data && Array.isArray(data.rows)) {
          CPManager.state.zones.customTemplates = data.rows;
          CPManager.state.zones.customTemplatesLastFetched = Date.now();
        } else {
          CPManager.state.zones.customTemplates = [];
          console.warn(
            "No custom templates found or unexpected data format.",
            data,
          );
        }
      } catch (error) {
        console.error("Failed to fetch custom templates:", error.message);
        CPManager.state.zones.customTemplates = [];
      }
    },

    loadZoneInfo: async function (forceRefreshDetails = false) {
      if (!CPManager.elements.zoneListContainer) return;
      CPManager.state.zones.currentPage = 1; // Reset to first page

      const needsSkeleton =
        forceRefreshDetails ||
        CPManager.elements.zoneListContainer.querySelectorAll(".zone-info-card")
          .length === 0;
      if (needsSkeleton) {
        CPManager.ui.showSkeletonLoaders(
          CPManager.elements.zoneListContainer,
          CPManager.config.itemsPerPage,
          '<div class="skeleton-card"></div>',
          "zone-pagination",
        );
      }

      try {
        await CPManager.zones.fetchAllZoneData(forceRefreshDetails);
        await CPManager.zones.fetchCustomTemplates(forceRefreshDetails);

        CPManager.ui.clearContainer(
          CPManager.elements.zoneListContainer,
          "zone-pagination",
        );

        if (
          !Array.isArray(CPManager.state.zones.allConfigured) ||
          CPManager.state.zones.allConfigured.length === 0
        ) {
          CPManager.ui.showNoDataMessage(
            CPManager.elements.zoneListContainer,
            "No captive portal zones configured on OPNsense.",
            "fas fa-folder-open",
            "zone-pagination",
          );
          return;
        }

        const allZones = CPManager.state.zones.allConfigured;
        const page = CPManager.state.zones.currentPage;
        const itemsPerPage = CPManager.config.itemsPerPage;
        const startIndex = (page - 1) * itemsPerPage;
        const endIndex = startIndex + itemsPerPage;
        const paginatedZones = allZones.slice(startIndex, endIndex);

        paginatedZones.forEach((zoneSummary) => {
          const zoneCard = document.createElement("div");
          zoneCard.className = "zone-info-card cp-card";
          zoneCard.setAttribute("role", "listitem");
          zoneCard.setAttribute(
            "aria-label",
            `Zone: ${zoneSummary.description || `Zone ID ${zoneSummary.zoneid}`}`,
          );

          const statusText =
            zoneSummary.enabled === "1" ? "Enabled" : "Disabled";
          // UPDATED: Use semantic colors
          const statusColor =
            zoneSummary.enabled === "1" ? "bg-success" : "bg-danger";

          const statusTag = `<span class="info-tag ${statusColor}" title="Status: ${statusText}">${statusText}</span>`;
          const cardSummaryId = `zone-summary-${zoneSummary.uuid}`;
          const cardDetailsId = `zone-details-${zoneSummary.uuid}`;

          zoneCard.innerHTML = `
            <div class="flex justify-end items-center mb-1">
                <div class="flex items-center gap-1">
                    ${statusTag}
                </div>
            </div>
            <div id="${cardSummaryId}" class="zone-summary cursor-pointer pb-1" role="button" tabindex="0" aria-expanded="false" aria-controls="${cardDetailsId}">
              <div class="card-detail-row"><span class="card-detail-label">Name</span><span class="card-detail-value">${
                zoneSummary.description ||
                `Unnamed Zone (ID: ${zoneSummary.zoneid})`
              }</span></div>
              <div class="card-detail-row"><span class="card-detail-label">Zone ID</span><span class="card-detail-value">${
                zoneSummary.zoneid
              }</span></div>
              <div class="card-detail-row"><span class="card-detail-label">Short UUID</span><span class="card-detail-value">${zoneSummary.uuid.substring(
                0,
                8,
              )}...</span></div>
            </div>
            <div class="card-details-content max-h-0 overflow-hidden transition-all duration-300 ease-out text-sm space-y-1" id="${cardDetailsId}" aria-hidden="true">Loading details...</div>`;
          zoneCard.dataset.uuid = zoneSummary.uuid;
          zoneCard.dataset.initialZoneid = zoneSummary.zoneid;
          CPManager.elements.zoneListContainer.appendChild(zoneCard);
        });
        CPManager.ui.renderPaginationControls(
          CPManager.elements.zonePaginationContainer,
          CPManager.state.zones.currentPage,
          allZones.length,
          CPManager.config.itemsPerPage,
          (newPage) => {
            CPManager.state.zones.currentPage = newPage;
            CPManager.zones.loadZoneInfo(); // Re-call to render the new page
          },
        );
      } catch (error) {
        console.error("Error in loadZoneInfo:", error);
        CPManager.ui.showNoDataMessage(
          CPManager.elements.zoneListContainer,
          "Error loading zone information.",
          "fas fa-exclamation-triangle",
          "zone-pagination",
        );
      }
    },

    handleZoneCardClick: async function (card, detailsContainer) {
      CPManager.ui.toggleCardDetails(card);
      const isNowExpanded = detailsContainer.classList.contains("expanded");

      if (
        isNowExpanded &&
        (detailsContainer.innerHTML.includes("Loading details...") ||
          detailsContainer.innerHTML.includes("Error loading details"))
      ) {
        const uuid = card.dataset.uuid;

        try {
          const zoneDetailsResponse = await CPManager.api.callApi(
            `/settings/get_zone/${uuid}`,
          );
          let detailsHtml = "";

          const createInfoRowDiv = (label, value) => {
            const displayValue =
              value === null ||
              value === undefined ||
              String(value).trim() === ""
                ? CPManager.config.placeholderValue
                : String(value);
            return `<div class="card-detail-row"><span class="card-detail-label">${label}</span> <span class="card-detail-value-secondary">${displayValue}</span></div>`;
          };

          detailsHtml += createInfoRowDiv("UUID", uuid);

          if (zoneDetailsResponse && zoneDetailsResponse.zone) {
            const zoneData = zoneDetailsResponse.zone;
            for (const [key, value] of Object.entries(zoneData)) {
              if (
                key === "uuid" ||
                key === "description" ||
                key === "enabled" ||
                key === "zoneid"
              )
                continue;

              const readableKey =
                CPManager.config.zoneFieldMappings[key] ||
                key.charAt(0).toUpperCase() +
                  key.slice(1).replace(/([A-Z])/g, " $1");
              let displayValue;

              if (key === "idletimeout" || key === "hardtimeout") {
                displayValue = value
                  ? CPManager.utils.formatDuration(parseInt(value), "minutes")
                  : CPManager.config.placeholderValue;
              } else if (key === "template") {
                let selectedTemplateIdentifier = "";
                if (typeof value === "object" && value !== null) {
                  for (const templateKey in value) {
                    if (
                      value[templateKey] &&
                      (value[templateKey].selected === 1 ||
                        value[templateKey].selected === "1")
                    ) {
                      selectedTemplateIdentifier = templateKey;
                      break;
                    }
                  }
                }
                const templateInfo = CPManager.state.zones.customTemplates.find(
                  (t) => t.uuid === selectedTemplateIdentifier,
                );
                displayValue = templateInfo
                  ? templateInfo.name
                  : selectedTemplateIdentifier
                    ? `UUID: ${selectedTemplateIdentifier.substring(0, 8)}...`
                    : "Default";
              } else if (
                [
                  "disableRules",
                  "alwaysSendAccountingReqs",
                  "concurrentlogins",
                  "extendedPreAuthData",
                ].includes(key)
              ) {
                displayValue =
                  String(value) === "1"
                    ? "Yes"
                    : String(value) === "0"
                      ? "No"
                      : String(value);
              } else if (
                typeof value === "object" &&
                value !== null &&
                Object.values(value).some(
                  (v_obj) =>
                    typeof v_obj === "object" &&
                    v_obj !== null &&
                    Object.prototype.hasOwnProperty.call(v_obj, "selected"),
                )
              ) {
                displayValue = CPManager.utils.formatOpnsenseSelectable(value);
              } else if (Array.isArray(value)) {
                displayValue =
                  value.length > 0
                    ? value.join(", ")
                    : CPManager.config.placeholderValue;
              } else {
                displayValue = String(value);
              }

              if (
                typeof displayValue === "string" &&
                displayValue.length > 150
              ) {
                displayValue = displayValue.substring(0, 150) + "...";
              }
              detailsHtml += createInfoRowDiv(
                readableKey,
                displayValue || CPManager.config.placeholderValue,
              );
            }
          } else {
            detailsHtml +=
              "<div>No further detailed properties found or unexpected response format.</div>";
          }

          detailsHtml += `
            <div class="mt-3 grid grid-cols-2 gap-4">
              <button class="btn btn-base btn-primary" data-action="edit-zone" data-uuid="${uuid}">
                <i class="fas fa-edit mr-1"></i> Edit Settings
              </button>
            </div>
          `;
          detailsContainer.innerHTML = detailsHtml;
        } catch (error) {
          console.error(`Error loading details for zone ${uuid}:`, error);
          detailsContainer.innerHTML =
            '<p class="text-danger">Error loading details. Check console.</p>';
        }
      }
    },

    fetchAndOpenEditZoneModal: async function (uuid) {
      if (!CPManager.elements.editZoneModal) {
        console.error(
          "Edit Zone Modal element (CPManager.elements.editZoneModal) not found.",
        );
        return;
      }
      try {
        await CPManager.zones.fetchCustomTemplates();

        const response = await CPManager.api.callApi(
          `/settings/get_zone/${uuid}`,
        );
        if (response && response.zone) {
          CPManager.state.zones.originalFullDataForEdit = response;
          CPManager.zones.populateEditZoneModal(response.zone, uuid);

          if (CPManager.elements.submitEditZoneBtn) {
            CPManager.elements.submitEditZoneBtn.disabled = false;
          } else {
            console.error(
              "CPManager.elements.submitEditZoneBtn not found when trying to enable it in fetchAndOpenEditZoneModal.",
            );
          }
          if (CPManager.elements.cancelEditZoneBtn) {
            CPManager.elements.cancelEditZoneBtn.disabled = false;
          }

          CPManager.elements.editZoneModal.classList.remove("hidden");
          CPManager.elements.editZoneModal.classList.add("flex");
          if (CPManager.elements.zoneEditDescriptionInput)
            CPManager.elements.zoneEditDescriptionInput.focus();
        } else {
          CPManager.ui.showToast(
            `Could not load details for zone ${uuid}. API response issue.`,
            "error",
          );
          CPManager.state.zones.originalFullDataForEdit = null;
        }
      } catch (error) {
        CPManager.state.zones.originalFullDataForEdit = null;
        console.error("Error in fetchAndOpenEditZoneModal:", error);
      }
    },

    populateEditZoneModal: function (zoneData, uuid) {
      const requiredElements = [
        "editZoneUuidInput",
        "editZoneModalTitleName",
        "zoneEditDescriptionInput",
        "zoneEditEnabledCheckbox",
        "zoneEditEnabledText",
        "zoneEditAllowedAddressesTextarea",
        "zoneEditAllowedMACAddressesTextarea",
        "zoneEditHardTimeoutInput",
        "zoneEditIdleTimeoutInput",
        "zoneEditConcurrentLoginsCheckbox",
        "zoneEditConcurrentLoginsText",
        "zoneEditTemplateSelect",
      ];
      for (const elId of requiredElements) {
        if (!CPManager.elements[elId]) {
          console.error(`Edit Zone Modal element missing: ${elId}`);
          CPManager.ui.showToast(
            "Cannot populate edit zone dialog: form elements missing.",
            "error",
          );
          return;
        }
      }

      const formatForTextarea = (fieldValue) => {
        if (
          typeof fieldValue === "object" &&
          fieldValue !== null &&
          !Array.isArray(fieldValue)
        ) {
          const isOpnSelectableObject = Object.values(fieldValue).some(
            (item) =>
              typeof item === "object" &&
              item !== null &&
              Object.prototype.hasOwnProperty.call(item, "selected") &&
              Object.prototype.hasOwnProperty.call(item, "value"),
          );

          if (isOpnSelectableObject) {
            const selectedValues = [];
            for (const key in fieldValue) {
              if (
                typeof fieldValue[key] === "object" &&
                fieldValue[key] !== null &&
                Object.prototype.hasOwnProperty.call(
                  fieldValue[key],
                  "selected",
                ) &&
                Object.prototype.hasOwnProperty.call(fieldValue[key], "value")
              ) {
                if (
                  fieldValue[key].selected === 1 ||
                  fieldValue[key].selected === "1" ||
                  fieldValue[key].selected === true
                ) {
                  selectedValues.push(fieldValue[key].value);
                }
              }
            }
            return selectedValues.join(",");
          } else {
            return "";
          }
        }
        if (typeof fieldValue === "string") {
          return fieldValue;
        }
        return "";
      };

      CPManager.elements.editZoneUuidInput.value = uuid;
      CPManager.elements.editZoneModalTitleName.textContent =
        zoneData.description ||
        `Zone ${zoneData.zoneid || uuid.substring(0, 8)}`;
      CPManager.elements.zoneEditDescriptionInput.value =
        zoneData.description || "";

      const isEnabled = zoneData.enabled === "1";
      CPManager.elements.zoneEditEnabledCheckbox.checked = isEnabled;
      CPManager.elements.zoneEditEnabledText.textContent = isEnabled
        ? "Enabled"
        : "Disabled";

      CPManager.elements.zoneEditAllowedAddressesTextarea.value =
        formatForTextarea(zoneData.allowedAddresses);
      CPManager.elements.zoneEditAllowedMACAddressesTextarea.value =
        formatForTextarea(zoneData.allowedMACAddresses);

      CPManager.elements.zoneEditHardTimeoutInput.value =
        zoneData.hardtimeout || "";
      CPManager.elements.zoneEditIdleTimeoutInput.value =
        zoneData.idletimeout || "";

      const concurrentLoginsAllowed = zoneData.concurrentlogins === "1";
      CPManager.elements.zoneEditConcurrentLoginsCheckbox.checked =
        concurrentLoginsAllowed;
      CPManager.elements.zoneEditConcurrentLoginsText.textContent =
        concurrentLoginsAllowed ? "Allowed" : "Disallowed";

      const templateSelect = CPManager.elements.zoneEditTemplateSelect;
      templateSelect.innerHTML = '<option value="">-- Default --</option>';

      CPManager.state.zones.customTemplates.forEach((template) => {
        const option = document.createElement("option");
        option.value = template.uuid;
        option.textContent = template.name;
        templateSelect.appendChild(option);
      });

      let selectedTemplateIdentifierFromZoneData = "";
      if (typeof zoneData.template === "object" && zoneData.template !== null) {
        for (const templateKey in zoneData.template) {
          if (
            zoneData.template[templateKey] &&
            (zoneData.template[templateKey].selected === 1 ||
              zoneData.template[templateKey].selected === "1")
          ) {
            selectedTemplateIdentifierFromZoneData = templateKey;
            break;
          }
        }
      } else if (typeof zoneData.template === "string" && zoneData.template) {
        selectedTemplateIdentifierFromZoneData = zoneData.template;
      }

      if (
        selectedTemplateIdentifierFromZoneData &&
        CPManager.state.zones.customTemplates.some(
          (t) => t.uuid === selectedTemplateIdentifierFromZoneData,
        )
      ) {
        templateSelect.value = selectedTemplateIdentifierFromZoneData;
      } else {
        templateSelect.value = "";
      }
    },

    saveZoneSettings: async function () {
      if (
        !CPManager.elements.editZoneUuidInput ||
        !CPManager.elements.submitEditZoneBtn
      ) {
        CPManager.ui.showToast(
          "Zone UUID is missing or save button not found. Cannot save.",
          "error",
        );
        console.error(
          "Missing UUID input or submit button in saveZoneSettings.",
        );
        return;
      }
      const uuid = CPManager.elements.editZoneUuidInput.value;

      const zoneSettingsToUpdate = {
        description: CPManager.elements.zoneEditDescriptionInput.value.trim(),
        enabled: CPManager.elements.zoneEditEnabledCheckbox.checked ? "1" : "0",
        allowedAddresses:
          CPManager.elements.zoneEditAllowedAddressesTextarea.value.replace(
            /\s+/g,
            "",
          ),
        allowedMACAddresses:
          CPManager.elements.zoneEditAllowedMACAddressesTextarea.value
            .replace(/\s+/g, "")
            .toLowerCase(),
        hardtimeout:
          CPManager.elements.zoneEditHardTimeoutInput.value.trim() || "0",
        idletimeout:
          CPManager.elements.zoneEditIdleTimeoutInput.value.trim() || "0",
        concurrentlogins: CPManager.elements.zoneEditConcurrentLoginsCheckbox
          .checked
          ? "1"
          : "0",
        template: CPManager.elements.zoneEditTemplateSelect.value || "",
      };

      const finalApiPayload = {
        zone: zoneSettingsToUpdate,
      };

      CPManager.elements.submitEditZoneBtn.disabled = true;
      CPManager.elements.submitEditZoneBtn.innerHTML =
        '<i class="fas fa-spinner fa-spin mr-2"></i>Saving...';

      try {
        const result = await CPManager.api.callApi(
          `/settings/set_zone/${uuid}`,
          "POST",
          finalApiPayload,
        );

        if (result && result.result === "saved") {
          CPManager.ui.showToast(
            `Zone settings updated for "${zoneSettingsToUpdate.description || uuid.substring(0, 8)}".`,
            "success",
          );
          CPManager.ui.hideModal(CPManager.elements.editZoneModal);
          CPManager.state.zones.originalFullDataForEdit = null;
          CPManager.state.zones.currentPage = 1; // Reset page
          await CPManager.zones.loadZoneInfo(true);

          CPManager.ui.showToast(
            "Applying changes by reconfiguring service...",
            "info",
            7000,
          );
          const reconfigResult = await CPManager.api.callApi(
            "/service/reconfigure",
            "POST",
            {},
          );
          if (
            reconfigResult &&
            (reconfigResult.status === "ok" ||
              (reconfigResult.message &&
                reconfigResult.message.toLowerCase().includes("ok")))
          ) {
            CPManager.ui.showToast(
              "Captive portal service reconfigured successfully.",
              "success",
            );
          } else {
            CPManager.ui.showToast(
              `Service reconfigure status: ${
                reconfigResult
                  ? reconfigResult.status ||
                    reconfigResult.message ||
                    JSON.stringify(reconfigResult)
                  : "Unknown"
              }. Manual check may be needed.`,
              "warning",
              10000,
            );
          }
        } else {
          let errorMessage = `Failed to save zone settings: ${
            result?.message || result?.result || "Unknown API error"
          }`;
          if (result && result.validations) {
            for (const key in result.validations) {
              errorMessage += `\n- ${key}: ${result.validations[key]}`;
            }
          }
          CPManager.ui.showToast(errorMessage, "error", 10000);
        }
      } catch (error) {
        console.error("Error during saveZoneSettings:", error.message);
      } finally {
        if (CPManager.elements.submitEditZoneBtn) {
          CPManager.elements.submitEditZoneBtn.disabled = false;
          CPManager.elements.submitEditZoneBtn.innerHTML = "Save Changes";
        } else {
          console.error(
            "submitEditZoneBtn is null in finally block of saveZoneSettings. Cannot re-enable.",
          );
        }
      }
    },

    initializeZoneEventListeners: function () {
      if (CPManager.elements.zoneListContainer) {
        CPManager.elements.zoneListContainer.addEventListener(
          "click",
          async (e) => {
            const summaryElement = e.target.closest(".zone-summary");
            if (summaryElement) {
              const card = summaryElement.closest(".zone-info-card");
              const detailsContent = card.querySelector(
                ".card-details-content",
              );
              this.handleZoneCardClick(card, detailsContent, summaryElement);
              return;
            }

            const editButton = e.target.closest('[data-action="edit-zone"]');
            if (editButton) {
              e.stopPropagation();
              const uuid = editButton.dataset.uuid;
              if (uuid) {
                CPManager.zones.fetchAndOpenEditZoneModal(uuid);
              } else {
                console.error(
                  "Edit button clicked but no UUID found on dataset.",
                );
              }
            }
          },
        );
      }

      if (CPManager.elements.submitEditZoneBtn) {
        if (!CPManager.elements.submitEditZoneBtn.dataset.listenerAttached) {
          CPManager.elements.submitEditZoneBtn.addEventListener(
            "click",
            function () {
              console.log(
                "Save Changes button clicked (via initialized listener).",
              );
              CPManager.zones.saveZoneSettings();
            },
          );
          CPManager.elements.submitEditZoneBtn.dataset.listenerAttached =
            "true";
        }
      } else {
        console.error(
          "Submit Edit Zone Button (CPManager.elements.submitEditZoneBtn) not found during initializeZoneEventListeners.",
        );
      }

      if (CPManager.elements.cancelEditZoneBtn) {
        if (!CPManager.elements.cancelEditZoneBtn.dataset.listenerAttached) {
          CPManager.elements.cancelEditZoneBtn.addEventListener("click", () => {
            CPManager.ui.hideModal(CPManager.elements.editZoneModal);
            CPManager.state.zones.originalFullDataForEdit = null;
          });
          CPManager.elements.cancelEditZoneBtn.dataset.listenerAttached =
            "true";
        }
      } else {
        console.error(
          "Cancel Edit Zone Button (CPManager.elements.cancelEditZoneBtn) not found during initializeZoneEventListeners.",
        );
      }

      if (
        CPManager.elements.zoneEditEnabledCheckbox &&
        CPManager.elements.zoneEditEnabledText
      ) {
        if (
          !CPManager.elements.zoneEditEnabledCheckbox.dataset.listenerAttached
        ) {
          CPManager.elements.zoneEditEnabledCheckbox.addEventListener(
            "change",
            function () {
              CPManager.elements.zoneEditEnabledText.textContent = this.checked
                ? "Enabled"
                : "Disabled";
            },
          );
          CPManager.elements.zoneEditEnabledCheckbox.dataset.listenerAttached =
            "true";
        }
      }
      if (
        CPManager.elements.zoneEditConcurrentLoginsCheckbox &&
        CPManager.elements.zoneEditConcurrentLoginsText
      ) {
        if (
          !CPManager.elements.zoneEditConcurrentLoginsCheckbox.dataset
            .listenerAttached
        ) {
          CPManager.elements.zoneEditConcurrentLoginsCheckbox.addEventListener(
            "change",
            function () {
              CPManager.elements.zoneEditConcurrentLoginsText.textContent = this
                .checked
                ? "Allowed"
                : "Disallowed";
            },
          );
          CPManager.elements.zoneEditConcurrentLoginsCheckbox.dataset.listenerAttached =
            "true";
        }
      }
    },
  };
})(CPManager);
