// js/ui.js

// --- DOM Element Selections (Grouped for clarity) ---



// Configuration Section Elements
const configInputSection = document.getElementById('config-input-section');
const configApiKeyInput = document.getElementById('config-api-key');
const configApiSecretInput = document.getElementById('config-api-secret');
const saveApiCredsBtn = document.getElementById('save-api-creds-btn');
const clearApiCredsBtn = document.getElementById('clear-api-creds-btn');

// Main Navigation and Tab Elements
const mainTabs = document.getElementById('mainTabs');
const tabPanes = {
    dashboard: document.getElementById('dashboard-content'),
    sessions: document.getElementById('sessions-content'),
    vouchers: document.getElementById('vouchers-content'),
    info: document.getElementById('info-content'),
};

// Sessions Tab Elements
const sessionCardContainer = document.getElementById('session-card-container');
const sessionSearchInput = document.getElementById('session-search-input');
const sessionZoneFilterSelect = document.getElementById('session-zone-filter-select');
const findMySessionBtn = document.getElementById('find-my-session-btn');
const disconnectAllSessionsBtn = document.getElementById('disconnect-all-sessions-btn');

// Vouchers Tab Elements
const voucherProviderSelect = document.getElementById('voucher-provider-select');
const voucherGroupSelect = document.getElementById('voucher-group-select');
const voucherCardContainer = document.getElementById('voucher-card-container');
const createVouchersBtn = document.getElementById('create-vouchers-btn');
const dropVoucherGroupBtn = document.getElementById('drop-voucher-group-btn');
const dropExpiredVouchersBtn = document.getElementById('drop-expired-vouchers-btn');

// Voucher Generation Modal Elements
const generateVoucherModal = document.getElementById('generateVoucherModal');
const voucherCountSelect = document.getElementById('voucher-count-select');
const voucherCountCustom = document.getElementById('voucher-count-custom');
const voucherLifetimeSelect = document.getElementById('voucher-lifetime-select');
const voucherLifetimeCustom = document.getElementById('voucher-lifetime-custom');
const voucherUsageSelect = document.getElementById('voucher-usage-select');
const voucherUsageCustom = document.getElementById('voucher-usage-custom');
const voucherGroupNameInput = document.getElementById('voucher-groupname'); // Corrected ID
const cancelGenerateVoucherBtn = document.getElementById('cancel-generate-voucher-btn');
const submitGenerateVoucherBtn = document.getElementById('submit-generate-voucher-btn');

// Zone Info Tab Elements
const zoneListContainer = document.getElementById('zone-list-container');

// Edit Zone Modal Elements
const editZoneModal = document.getElementById('editZoneModal');
const editZoneModalTitleName = document.getElementById('editZoneModalTitleName');
const editZoneUuidInput = document.getElementById('editZoneUuidInput');
const zoneEditDescriptionInput = document.getElementById('zone-edit-description');
const zoneEditEnabledCheckbox = document.getElementById('zone-edit-enabled');
const zoneEditEnabledText = document.getElementById('zone-edit-enabled-text');
const zoneEditAllowedAddressesTextarea = document.getElementById('zone-edit-allowedAddresses');
const zoneEditAllowedMACAddressesTextarea = document.getElementById('zone-edit-allowedMACAddresses');
const cancelEditZoneBtn = document.getElementById('cancel-edit-zone-btn');
const submitEditZoneBtn = document.getElementById('submit-edit-zone-btn');
const applyCpConfigBtn = document.getElementById('apply-cp-config-btn');

// Confirmation Modal Elements
const confirmationModal = document.getElementById('confirmationModal');
const confirmationTitle = document.getElementById('confirmationTitle');
const confirmationMessage = document.getElementById('confirmationMessage');
const confirmCancelBtn = document.getElementById('confirm-cancel-btn'); // Corrected ID
const confirmProceedBtn = document.getElementById('confirm-proceed-btn');

// Toast Notification Elements
const toastNotification = document.getElementById('toast-notification');
const toastMessage = document.getElementById('toast-message');

// Footer Elements
const apiStatusFooterText = document.getElementById('api-status-footer').querySelector('span');

// Dashboard Elements
const dashboardStatsContainer = document.getElementById('dashboard-stats-container');
const dataUsageCanvas = document.getElementById('dataUsageCanvas'); // Canvas element itself
const donutTotalData = document.getElementById('donut-total-data');
const uploadLegendValue = document.getElementById('upload-legend-value');
const downloadLegendValue = document.getElementById('download-legend-value');
const uploadPercentageSpan = document.getElementById('upload-percentage');
const downloadPercentageSpan = document.getElementById('download-percentage');
const legendItems = document.querySelectorAll('.chart-legend .legend-item'); // NodeList


// --- UI Feedback Functions ---

/**
 * Displays a toast notification message.
 * @param {string} message - The message to display.
 * @param {string} [type='info'] - Type of toast ('info', 'success', 'error', 'warning').
 * @param {number} [duration=5000] - Duration in milliseconds to show the toast.
 */
function showToast(message, type = 'info', duration = 5000) {
    if (!toastNotification || !toastMessage) {
        console.warn("Toast elements not found in the DOM.");
        alert(`Toast (${type}): ${message}`); // Fallback to alert if toast elements are missing
        return;
    }
    toastMessage.textContent = message;
    // Reset classes
    toastNotification.className = 'fixed bottom-5 right-5 text-white py-3 px-5 rounded-lg shadow-lg opacity-0 transition-opacity duration-300 max-w-xs z-50';

    switch (type) {
        case 'success':
            toastNotification.classList.add('bg-green-600');
            break;
        case 'error':
            toastNotification.classList.add('bg-red-600');
            break;
        case 'warning':
            toastNotification.classList.add('bg-yellow-500', 'text-black'); // Yellow often needs black text for contrast
            break;
        case 'info':
        default:
            toastNotification.classList.add('bg-gray-800'); // Or a blue color like bg-blue-600
            break;
    }

    toastNotification.classList.add('opacity-100'); // Make it visible

    // Clear any existing timeouts to prevent premature hiding if called rapidly
    if (toastNotification.timer) {
        clearTimeout(toastNotification.timer);
    }

    toastNotification.timer = setTimeout(() => {
        toastNotification.classList.remove('opacity-100');
        toastNotification.classList.add('opacity-0'); // Fade out
    }, duration);
}

/**
 * Shows a confirmation modal.
 * @param {string} title - The title of the confirmation dialog.
 * @param {string} message - The message/question to display (can include HTML).
 * @param {function} callback - The function to call if the user confirms.
 */
function showConfirmationModal(title, message, callback) {
    if (!confirmationModal || !confirmationTitle || !confirmationMessage) {
        console.error("Confirmation modal elements not found.");
        if (confirm(title + "\n" + message.replace(/<br\/>/g, "\n").replace(/<strong>|<\/strong>/g, ""))) { // Basic fallback
            if (callback) callback();
        }
        return;
    }
    confirmationTitle.textContent = title;
    confirmationMessage.innerHTML = message; // Allow HTML in message
    confirmCallback = callback; // confirmCallback should be defined in main.js or a shared scope

    confirmationModal.classList.remove('modal-inactive');
    confirmationModal.classList.add('modal-active');
}

/**
 * Hides the currently active modal (generic).
 * @param {HTMLElement} modalElement - The modal element to hide.
 */
function hideModal(modalElement) {
    if (modalElement) {
        modalElement.classList.add('modal-inactive');
        modalElement.classList.remove('modal-active');
    }
}

// --- Card and UI Element Toggling ---

/**
 * Toggles the visibility of details within a card.
 * Closes other open cards in the same container.
 * @param {HTMLElement} clickedCard - The card element that was clicked.
 * @param {HTMLElement} container - The container holding multiple cards of the same type.
 */
function toggleCardDetails(clickedCard, container) {
    const cardClass = clickedCard.classList[0]; // Assumes first class is the primary identifier (e.g., 'session-card')
    if (!cardClass) {
        console.warn("Clicked card has no class to identify its type for toggling.", clickedCard);
        return;
    }
    const allCardsInContainer = container.querySelectorAll(`.${cardClass}`);
    const detailsContent = clickedCard.querySelector('.card-details-content');

    if (!detailsContent) {
        console.warn("Card details content not found in clicked card.", clickedCard);
        return;
    }

    // Close other cards
    allCardsInContainer.forEach(card => {
        if (card !== clickedCard) {
            const otherDetails = card.querySelector('.card-details-content');
            if (otherDetails && otherDetails.classList.contains('expanded')) {
                otherDetails.classList.remove('expanded');
                // Potentially add ARIA attributes for accessibility: otherDetails.setAttribute('aria-hidden', 'true');
            }
        }
    });

    // Toggle the clicked card
    detailsContent.classList.toggle('expanded');
    // Potentially add ARIA attributes:
    // if (detailsContent.classList.contains('expanded')) {
    //     detailsContent.setAttribute('aria-hidden', 'false');
    // } else {
    //     detailsContent.setAttribute('aria-hidden', 'true');
    // }
}


/**
 * Disables or enables voucher action buttons based on current selections.
 * @param {boolean} generate - True to disable generate button, false to enable.
 * @param {boolean} cleanup - True to disable cleanup (drop expired) button, false to enable.
 * @param {boolean} deleteGroup - True to disable delete group button, false to enable.
 */
function disableVoucherActionButtons(generate, cleanup, deleteGroup) {
    if (createVouchersBtn) createVouchersBtn.disabled = generate;
    if (dropExpiredVouchersBtn) dropExpiredVouchersBtn.disabled = cleanup;
    if (dropVoucherGroupBtn) dropVoucherGroupBtn.disabled = deleteGroup;
}


// --- Skeleton Loader Functions ---

/**
 * Shows skeleton loaders in a given container.
 * @param {HTMLElement} container - The container to fill with skeleton cards.
 * @param {number} [count=2] - Number of skeleton cards to show.
 * @param {string} [skeletonHtml='<div class="skeleton-card"></div>'] - HTML for a single skeleton item.
 */
function showSkeletonLoaders(container, count = 2, skeletonHtml = '<div class="skeleton-card"></div>') {
    if (container) {
        let skeletons = '';
        for (let i = 0; i < count; i++) {
            skeletons += skeletonHtml;
        }
        container.innerHTML = skeletons;
    }
}

/**
 * Clears skeleton loaders or any content from a container.
 * @param {HTMLElement} container - The container to clear.
 */
function clearContainer(container) {
    if (container) {
        container.innerHTML = '';
    }
}

/**
 * Displays a "no data" message in a container.
 * @param {HTMLElement} container - The container to display the message in.
 * @param {string} message - The message to display.
 * @param {string} [iconClass='fas fa-info-circle'] - FontAwesome icon class.
 */
function showNoDataMessage(container, message = "No data available.", iconClass = 'fas fa-info-circle') {
    if (container) {
        container.innerHTML = `
            <div class="text-center p-4 text-gray-500">
                <i class="${iconClass} fa-3x mb-2"></i>
                <p>${message}</p>
            </div>
        `;
    }
}
