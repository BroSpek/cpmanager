// js/config.js

// Initialize the global CPManager object if it doesn't exist
// This line ensures window.CPManager is available before other scripts try to access it.
window.CPManager = window.CPManager || {};

// --- Configuration Object ---
// Directly attach config to the global CPManager object
CPManager.config = {
	baseUrl: null, // Will be populated from app-config.json or localStorage
	placeholderValue: "—",
	inMemoryCacheTTLMinutes: 1, // NEW: Default in-memory cache TTL in minutes
	predefinedColors: [
		"bg-pink-500",
		"bg-purple-500",
		"bg-indigo-500",
		"bg-teal-500",
		"bg-lime-500",
		"bg-amber-500",
		"bg-orange-500",
		"bg-cyan-500",
		"bg-red-600",
		"bg-green-600",
		"bg-blue-600",
		"bg-yellow-600",
	],
	authViaMapping: {
		"---ip---": "IP",
		"---mac---": "MAC",
		"Local Database": "Local DB",
		Voucher: "Voucher",
		"": "Anon",
	},
	zoneFieldMappings: {
		enabled: "Enabled",
		zoneid: "Zone ID",
		interfaces: "Interfaces",
		disableRules: "Disable Auto Rules",
		authservers: "Auth Servers",
		alwaysSendAccountingReqs: "RADIUS Accounting",
		authEnforceGroup: "Enforce Group",
		idletimeout: "Idle Timeout", // Already exists, but ensure it's used for the new field
		hardtimeout: "Hard Timeout", // New
		concurrentlogins: "Concurrent Logins", // New
		certificate: "SSL Certificate",
		servername: "HTTPS Server Name",
		allowedAddresses: "Allowed IPs",
		allowedMACAddresses: "Allowed MACs",
		extendedPreAuthData: "Extended Pre-Auth Data",
		template: "Login Page Template", // Already exists, ensure it's used for the new field
		description: "Description",
		uuid: "UUID",
	},
};

// --- State Variables ---
// Directly attach state to the global CPManager object
CPManager.state = {
	currentApiKey: "",
	currentApiSecret: "",
	confirmCallback: null, // Used by the confirmation modal in CPManager.ui

	// For color assignment in CPManager.utils
	zoneColors: {},
	authViaColors: {},
	zoneColorIndex: 0,
	authViaColorIndex: Math.floor(CPManager.config.predefinedColors.length / 2), // Start from a different part of the array

	// Module-specific state will be initialized in their respective files under this namespace
	sessions: {
		all: [], // Stores all fetched sessions to allow client-side filtering
		lastFetched: 0, // Timestamp when sessions.all was last fetched
		managerDetails: null, // Stores details of the current device's session
	},
	vouchers: {
		current: [], // Stores vouchers for the currently selected group (for rendering)
		lastGenerated: [], // Stores the last batch of generated vouchers for PDF download
		cachedProviders: [],
		lastFetchedProviders: 0, // Timestamp when cachedProviders was last fetched
		cachedGroups: {}, // Key: providerId, Value: array of group names
		cachedGroupsTimestamps: {}, // Key: providerId, Value: timestamp
		cachedData: {}, // Key: `${providerId}_${groupName}`, Value: { data: array of voucher objects, lastFetched: timestamp }
	},
	zones: {
		allConfigured: [], // Stores all configured zones (summary data)
		lastFetched: 0, // Timestamp when allConfigured was last fetched
		originalFullDataForEdit: null, // Stores the full data of the zone being edited
		customTemplates: [], // To store fetched custom templates
		customTemplatesLastFetched: 0, // Timestamp for customTemplates
	},
	dashboard: {
		chartInstance: null, // Holds the Chart.js instance for the data usage donut chart
		originalUploadBytes: 0,
		originalDownloadBytes: 0,
		originalTotalBytes: 0,
		apiDataCache: {
			sessions: null, // To store rows from /session/search
			sessionsLastFetched: 0, // Timestamp for dashboard sessions
			voucherStats: null, // To store { totalVouchers, activeVouchers }
			voucherStatsLastFetched: 0, // Timestamp for dashboard voucher stats
		},
	},
	notifications: {
		previousSessionIds: new Set(),
		isFirstPoll: true,
		sessionPollIntervalId: null,
		POLLING_INTERVAL: 30000, // 30 seconds
		POLLING_INTERVAL_HIDDEN_TAB: 300000, // 5 minutes when tab is hidden
		consecutivePollErrors: 0,
		MAX_POLL_ERRORS_BEFORE_DISABLE: 5, // Disable notifications after this many consecutive errors
	},
};
