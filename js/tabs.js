// js/tabs.js

/**
 * Sets the active tab and corresponding content pane.
 * Handles visual styling of tab buttons and visibility of tab content.
 * Also triggers data loading functions for the newly active tab.
 * @param {string} tabId - The ID of the tab to activate (e.g., 'dashboard', 'sessions').
 * @param {boolean} [forceRefreshData=false] - If true, forces data re-fetch for the tab.
 */
function setActiveTab(tabId, forceRefreshData = false) {
	// Added forceRefreshData parameter
	if (!mainTabs || !tabPanes[tabId]) {
		console.error(`Tab or tab pane not found for ID: ${tabId}`);
		return;
	}

	// Update tab button styles
	mainTabs.querySelectorAll(".tab-btn").forEach((btn) => {
		if (btn.dataset.tab === tabId) {
			btn.classList.add("active", "text-blue-600", "border-blue-600");
			btn.classList.remove("border-transparent", "hover:text-gray-700", "hover:border-gray-400");
			btn.setAttribute("aria-selected", "true"); // Accessibility
		} else {
			btn.classList.remove("active", "text-blue-600", "border-blue-600");
			btn.classList.add("border-transparent", "hover:text-gray-700", "hover:border-gray-400");
			btn.setAttribute("aria-selected", "false"); // Accessibility
		}
	});

	// Show/hide tab content panes
	Object.keys(tabPanes).forEach((paneKey) => {
		if (tabPanes[paneKey]) {
			if (paneKey === tabId) {
				tabPanes[paneKey].classList.remove("hidden");
				tabPanes[paneKey].classList.add("active");
				tabPanes[paneKey].removeAttribute("hidden"); // Accessibility
			} else {
				tabPanes[paneKey].classList.add("hidden");
				tabPanes[paneKey].classList.remove("active");
				tabPanes[paneKey].setAttribute("hidden", ""); // Accessibility
			}
		}
	});

	// Trigger data loading for the active tab, passing forceRefreshData
	// These functions (e.g., loadDashboardData) should now also accept forceRefreshData
	switch (tabId) {
		case "dashboard":
			if (typeof loadDashboardData === "function") loadDashboardData(forceRefreshData);
			break;
		case "sessions":
			if (typeof loadSessions === "function") loadSessions(forceRefreshData);
			break;
		case "vouchers":
			// loadVoucherProviders is the entry point; it and subsequent functions now have caching
			if (typeof loadVoucherProviders === "function") loadVoucherProviders(forceRefreshData);
			break;
		case "info": // Assuming 'info' is the Zones tab
			if (typeof loadZoneInfo === "function") loadZoneInfo(forceRefreshData);
			break;
		default:
			console.warn(`No specific load function for tab: ${tabId}`);
	}

	// Save the active tab to localStorage for persistence
	try {
		localStorage.setItem("activeHelpdeskTab", tabId);
	} catch (e) {
		console.warn("Could not save active tab to localStorage:", e.message);
	}
}

/**
 * Initializes tab functionality by adding an event listener to the main tabs container.
 */
function initializeTabs() {
	if (mainTabs) {
		mainTabs.addEventListener("click", (e) => {
			const tabButton = e.target.closest(".tab-btn");
			if (tabButton && tabButton.dataset.tab) {
				e.preventDefault(); // Prevent default anchor behavior
				// When user clicks a tab, use cached data by default.
				// A separate refresh button within tab content would call setActiveTab(..., true) or the load function directly with true.
				setActiveTab(tabButton.dataset.tab, false);
			}
		});
	} else {
		console.error("Main tabs container (mainTabs) not found.");
	}

	// Note: The actual call to setActiveTab with the initialTab
	// is typically handled by the main `initializeAppLogic` function (in main.js)
	// after basic setup (like API credential checks) is complete.
	// This ensures that the initial tab load also respects the forceRefreshData parameter (usually false for initial load).
	// Example in main.js's initializeAppLogic:
	//   let initialTab = localStorage.getItem('activeHelpdeskTab') || 'dashboard';
	//   setActiveTab(initialTab, false); // Call with false to use cache if available (though unlikely on fresh load)
}
