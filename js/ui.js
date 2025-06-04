// js/ui.js

(function (CPManager) {
	// --- DOM Element Selections ---
	CPManager.elements = {
		// Theme Toggle Button
		themeToggleBtn: document.getElementById("theme-toggle-btn"),

		// Configuration Section Elements
		configInputSection: document.getElementById("config-input-section"),
		configApiBaseUrlInput: document.getElementById("config-api-base-url"),
		configApiKeyInput: document.getElementById("config-api-key"),
		configApiSecretInput: document.getElementById("config-api-secret"),
		saveApiCredsBtn: document.getElementById("save-api-creds-btn"),
		clearApiCredsBtn: document.getElementById("clear-api-creds-btn"),

		// Main Navigation and Tab Elements
		mainTabs: document.getElementById("mainTabs"),
		tabPanes: {
			dashboard: document.getElementById("dashboard-content"),
			sessions: document.getElementById("sessions-content"),
			vouchers: document.getElementById("vouchers-content"),
			info: document.getElementById("info-content"),
		},

		// Sessions Tab Elements
		sessionCardContainer: document.getElementById("session-card-container"),
		sessionSearchInput: document.getElementById("session-search-input"),
		sessionZoneFilterSelect: document.getElementById("session-zone-filter-select"),
		findMySessionBtn: document.getElementById("find-my-session-btn"),
		disconnectAllSessionsBtn: document.getElementById("disconnect-all-sessions-btn"),

		// Vouchers Tab Elements
		voucherProviderSelect: document.getElementById("voucher-provider-select"),
		voucherGroupSelect: document.getElementById("voucher-group-select"),
		voucherCardContainer: document.getElementById("voucher-card-container"),
		createVouchersBtn: document.getElementById("create-vouchers-btn"),
		dropVoucherGroupBtn: document.getElementById("drop-voucher-group-btn"),
		dropExpiredVouchersBtn: document.getElementById("drop-expired-vouchers-btn"),

		// Voucher Generation Modal Elements
		generateVoucherModal: document.getElementById("generateVoucherModal"),
		voucherCountSelect: document.getElementById("voucher-count-select"),
		voucherCountCustom: document.getElementById("voucher-count-custom"),
		voucherLifetimeSelect: document.getElementById("voucher-lifetime-select"),
		voucherLifetimeCustom: document.getElementById("voucher-lifetime-custom"),
		voucherUsageSelect: document.getElementById("voucher-usage-select"),
		voucherUsageCustom: document.getElementById("voucher-usage-custom"),
		voucherGroupNameInput: document.getElementById("voucher-groupname"),
		cancelGenerateVoucherBtn: document.getElementById("cancel-generate-voucher-btn"),
		submitGenerateVoucherBtn: document.getElementById("submit-generate-voucher-btn"),

		// Zone Info Tab Elements
		zoneListContainer: document.getElementById("zone-list-container"),

		// Edit Zone Modal Elements
		editZoneModal: document.getElementById("editZoneModal"),
		editZoneModalTitleName: document.getElementById("editZoneModalTitleName"),
		editZoneUuidInput: document.getElementById("editZoneUuidInput"),
		zoneEditDescriptionInput: document.getElementById("zone-edit-description"),
		zoneEditEnabledCheckbox: document.getElementById("zone-edit-enabled"),
		zoneEditEnabledText: document.getElementById("zone-edit-enabled-text"),
		zoneEditAllowedAddressesTextarea: document.getElementById("zone-edit-allowedAddresses"),
		zoneEditAllowedMACAddressesTextarea: document.getElementById("zone-edit-allowedMACAddresses"),
		cancelEditZoneBtn: document.getElementById("cancel-edit-zone-btn"),
		submitEditZoneBtn: document.getElementById("submit-edit-zone-btn"),
		applyCpConfigBtn: document.getElementById("apply-cp-config-btn"),

		// Confirmation Modal Elements
		confirmationModal: document.getElementById("confirmationModal"),
		confirmationTitle: document.getElementById("confirmationTitle"),
		confirmationMessage: document.getElementById("confirmationMessage"),
		confirmCancelBtn: document.getElementById("confirm-cancel-btn"),
		confirmProceedBtn: document.getElementById("confirm-proceed-btn"),

		// Toast Notification Elements
		toastNotification: document.getElementById("toast-notification"),
		toastMessage: document.getElementById("toast-message"),

		// Footer Elements
		apiStatusFooterText: document.getElementById("api-status-footer")?.querySelector("span"),

		// Dashboard Elements
		dashboardStatsContainer: document.getElementById("dashboard-stats-container"),
		dataUsageCanvas: document.getElementById("dataUsageCanvas"),
		donutTotalData: document.getElementById("donut-total-data"),
		uploadLegendValue: document.getElementById("upload-legend-value"),
		downloadLegendValue: document.getElementById("download-legend-value"),
		uploadPercentageSpan: document.getElementById("upload-percentage"),
		downloadPercentageSpan: document.getElementById("download-percentage"),
		legendItems: document.querySelectorAll(".chart-legend .legend-item"),
	};

	// --- UI Feedback Functions ---
	CPManager.ui = {
		/**
		 * Displays a toast notification message.
		 * @param {string} message - The message to display.
		 * @param {string} [type='info'] - Type of toast ('info', 'success', 'error', 'warning').
		 * @param {number} [duration=5000] - Duration in milliseconds to show the toast.
		 */
		showToast: function (message, type = "info", duration = 5000) {
			const toastNotification = CPManager.elements.toastNotification;
			const toastMessage = CPManager.elements.toastMessage;

			if (!toastNotification || !toastMessage) {
				console.warn("Toast elements not found in the DOM.");
				alert(`Toast (${type}): ${message}`); // Fallback to alert if toast elements are missing
				return;
			}
			toastMessage.textContent = message;
			// Reset classes
			toastNotification.className =
				"fixed bottom-5 right-5 text-white py-3 px-5 rounded-lg shadow-lg opacity-0 transition-opacity duration-300 max-w-xs z-50";

			switch (type) {
				case "success":
					toastNotification.classList.add("bg-green-600");
					break;
				case "error":
					toastNotification.classList.add("bg-red-600");
					break;
				case "warning":
					toastNotification.classList.add("bg-yellow-500", "text-black"); // Yellow often needs black text for contrast
					break;
				case "info":
				default:
					toastNotification.classList.add("bg-gray-800"); // Or a blue color like bg-blue-600
					break;
			}

			toastNotification.classList.add("opacity-100"); // Make it visible

			// Clear any existing timeouts to prevent premature hiding if called rapidly
			if (toastNotification.timer) {
				clearTimeout(toastNotification.timer);
			}

			toastNotification.timer = setTimeout(() => {
				toastNotification.classList.remove("opacity-100");
				toastNotification.classList.add("opacity-0"); // Fade out
			}, duration);
		},

		/**
		 * Shows a confirmation modal.
		 * @param {string} title - The title of the confirmation dialog.
		 * @param {string} message - The message/question to display (can include HTML).
		 * @param {function} callback - The function to call if the user confirms.
		 */
		showConfirmationModal: function (title, message, callback) {
			const confirmationModal = CPManager.elements.confirmationModal;
			const confirmationTitle = CPManager.elements.confirmationTitle;
			const confirmationMessage = CPManager.elements.confirmationMessage;

			if (!confirmationModal || !confirmationTitle || !confirmationMessage) {
				console.error("Confirmation modal elements not found.");
				if (confirm(title + "\n" + message.replace(/<br\/>/g, "\n").replace(/<strong>|<\/strong>/g, ""))) {
					// Basic fallback
					if (callback) callback();
				}
				return;
			}
			confirmationTitle.textContent = title;
			confirmationMessage.innerHTML = message; // Allow HTML in message
			CPManager.state.confirmCallback = callback; // Store callback in shared state

			confirmationModal.classList.remove("modal-inactive");
			confirmationModal.classList.add("modal-active");
		},

		/**
		 * Hides the currently active modal (generic).
		 * @param {HTMLElement} modalElement - The modal element to hide.
		 */
		hideModal: function (modalElement) {
			if (modalElement) {
				modalElement.classList.add("modal-inactive");
				modalElement.classList.remove("modal-active");
			}
		},

		// --- Card and UI Element Toggling ---

		/**
		 * Toggles the visibility of details within a card.
		 * Closes other open cards in the same container.
		 * @param {HTMLElement} clickedCard - The card element that was clicked.
		 * @param {HTMLElement} container - The container holding multiple cards of the same type.
		 */
		toggleCardDetails: function (clickedCard, container) {
			const cardClass = clickedCard.classList[0]; // Assumes first class is the primary identifier (e.g., 'session-card')
			if (!cardClass) {
				console.warn("Clicked card has no class to identify its type for toggling.", clickedCard);
				return;
			}
			const allCardsInContainer = container.querySelectorAll(`.${cardClass}`);
			const detailsContent = clickedCard.querySelector(".card-details-content");

			if (!detailsContent) {
				console.warn("Card details content not found in clicked card.", clickedCard);
				return;
			}

			// Close other cards
			allCardsInContainer.forEach((card) => {
				if (card !== clickedCard) {
					const otherDetails = card.querySelector(".card-details-content");
					if (otherDetails && otherDetails.classList.contains("expanded")) {
						otherDetails.classList.remove("expanded");
						// Potentially add ARIA attributes for accessibility: otherDetails.setAttribute('aria-hidden', 'true');
					}
				}
			});

			// Toggle the clicked card
			detailsContent.classList.toggle("expanded");
			// Potentially add ARIA attributes:
			// if (detailsContent.classList.contains('expanded')) {
			//     detailsContent.setAttribute('aria-hidden', 'false');
			// } else {
			//     detailsContent.setAttribute('aria-hidden', 'true');
			// }
		},

		/**
		 * Disables or enables voucher action buttons based on current selections.
		 * @param {boolean} generate - True to disable generate button, false to enable.
		 * @param {boolean} cleanup - True to disable cleanup (drop expired) button, false to enable.
		 * @param {boolean} deleteGroup - True to disable delete group button, false to enable.
		 */
		disableVoucherActionButtons: function (generate, cleanup, deleteGroup) {
			const createVouchersBtn = CPManager.elements.createVouchersBtn;
			const dropExpiredVouchersBtn = CPManager.elements.dropExpiredVouchersBtn;
			const dropVoucherGroupBtn = CPManager.elements.dropVoucherGroupBtn;

			if (createVouchersBtn) createVouchersBtn.disabled = generate;
			if (dropExpiredVouchersBtn) dropExpiredVouchersBtn.disabled = cleanup;
			if (dropVoucherGroupBtn) dropVoucherGroupBtn.disabled = deleteGroup;
		},

		// --- Skeleton Loader Functions ---

		/**
		 * Shows skeleton loaders in a given container.
		 * @param {HTMLElement} container - The container to fill with skeleton cards.
		 * @param {number} [count=2] - Number of skeleton cards to show.
		 * @param {string} [skeletonHtml='<div class="skeleton-card"></div>'] - HTML for a single skeleton item.
		 */
		showSkeletonLoaders: function (container, count = 2, skeletonHtml = '<div class="skeleton-card"></div>') {
			if (container) {
				let skeletons = "";
				for (let i = 0; i < count; i++) {
					skeletons += skeletonHtml;
				}
				container.innerHTML = skeletons;
			}
		},

		/**
		 * Clears skeleton loaders or any content from a container.
		 * @param {HTMLElement} container - The container to clear.
		 */
		clearContainer: function (container) {
			if (container) {
				container.innerHTML = "";
			}
		},

		/**
		 * Displays a "no data" message in a container.
		 * @param {HTMLElement} container - The container to display the message in.
		 * @param {string} message - The message to display.
		 * @param {string} [iconClass='fas fa-info-circle'] - FontAwesome icon class.
		 */
		showNoDataMessage: function (container, message = "No data available.", iconClass = "fas fa-info-circle") {
			if (container) {
				container.innerHTML = `
            <div class="text-center p-4 text-gray-500">
                <i class="${iconClass} fa-3x mb-2"></i>
                <p>${message}</p>
            </div>
        `;
			}
		},
	};
})(CPManager);
