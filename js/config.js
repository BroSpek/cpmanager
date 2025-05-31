    // js/config.js

    /**
     * Configuration object for the OPNsense Captive Portal Manager.
     * baseUrl will be loaded from app-config.json.
     */
    const OPNsenseConfig = {
        baseUrl: null, // Will be populated from app-config.json
        // Add other global configurations here if needed
        // e.g., defaultTimeout: 5000,
    };

    // (Keep other existing constants like placeholderValue, predefinedColors, authViaMapping, zoneFieldMappings)
    // ...

    /**
     * Placeholder value for display when actual data is missing or not applicable.
     */
    const placeholderValue = '—';

    /**
     * Predefined colors for dynamically assigning to zones or other categorized items
     * to maintain visual consistency.
     */
    const predefinedColors = [
        'bg-pink-500', 'bg-purple-500', 'bg-indigo-500', 'bg-teal-500',
        'bg-lime-500', 'bg-amber-500', 'bg-orange-500', 'bg-cyan-500',
        'bg-red-600', 'bg-green-600', 'bg-blue-600', 'bg-yellow-600'
    ];

    /**
     * Mapping for human-readable authentication methods.
     */
    const authViaMapping = {
        '---ip---': 'IP',
        '---mac---': 'MAC',
        'Local Database': 'Local DB',
        'Voucher': 'Voucher',
        '': 'Anon'
    };

    /**
     * Field mappings for displaying OPNsense zone settings in a user-friendly way.
     */
    const zoneFieldMappings = {
        enabled: "Enabled",
        zoneid: "Zone ID",
        interfaces: "Interfaces",
        disableRules: "Disable Auto Rules",
        authservers: "Auth Servers",
        alwaysSendAccountingReqs: "RADIUS Accounting",
        authEnforceGroup: "Enforce Group",
        idletimeout: "Idle Timeout",
        hardtimeout: "Hard Timeout",
        concurrentlogins: "Concurrent Logins",
        certificate: "SSL Certificate",
        servername: "HTTPS Server Name",
        allowedAddresses: "Allowed IPs",
        allowedMACAddresses: "Allowed MACs",
        extendedPreAuthData: "Extended Pre-Auth Data",
        template: "Login Page Template",
        description: "Description",
        uuid: "UUID"
    };

    // Note: currentApiKey and currentApiSecret are still managed in main.js via localStorage
    let currentApiKey = '';
    let currentApiSecret = '';
    