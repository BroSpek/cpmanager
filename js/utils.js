// js/utils.js

(function (CPManager) {
  CPManager.utils = {
    /**
     * Gets a consistent color class for a given zone ID.
     * Cycles through predefinedColors.
     * @param {string|number} zoneId - The ID of the zone.
     * @returns {string} Tailwind CSS background color class.
     */
    getZoneColor: function (zoneId) {
      if (!CPManager.state.zoneColors[zoneId]) {
        CPManager.state.zoneColors[zoneId] =
          CPManager.config.predefinedColors[
            CPManager.state.zoneColorIndex %
              CPManager.config.predefinedColors.length
          ];
        CPManager.state.zoneColorIndex =
          (CPManager.state.zoneColorIndex + 1) %
          CPManager.config.predefinedColors.length;
      }
      return CPManager.state.zoneColors[zoneId];
    },

    /**
     * Gets a consistent color class for a given authentication method.
     * Cycles through predefinedColors, trying to avoid immediate reuse from zone colors.
     * @param {string} authMethod - The authentication method string.
     * @returns {string} Tailwind CSS background color class.
     */
    getAuthViaColor: function (authMethod) {
      if (!CPManager.state.authViaColors[authMethod]) {
        CPManager.state.authViaColors[authMethod] =
          CPManager.config.predefinedColors[
            CPManager.state.authViaColorIndex %
              CPManager.config.predefinedColors.length
          ];
        CPManager.state.authViaColorIndex =
          (CPManager.state.authViaColorIndex + 1) %
          CPManager.config.predefinedColors.length;
        // Simple attempt to avoid direct overlap with zoneColorIndex if they happen to align
        if (
          CPManager.state.authViaColorIndex === CPManager.state.zoneColorIndex
        ) {
          CPManager.state.authViaColorIndex =
            (CPManager.state.authViaColorIndex + 1) %
            CPManager.config.predefinedColors.length;
        }
      }
      return CPManager.state.authViaColors[authMethod];
    },

    /**
     * Formats bytes into a human-readable string (KB, MB, GB, etc.).
     * @param {number} bytes - The number of bytes.
     * @param {number} [decimals=2] - The number of decimal places to display.
     * @returns {string} Formatted string representing the data size.
     */
    formatBytes: function (bytes, decimals = 2) {
      if (bytes === 0 || !bytes || isNaN(bytes)) return "0 Bytes";
      const k = 1024;
      const dm = decimals < 0 ? 0 : decimals;
      const sizes = ["Bytes", "KB", "MB", "GB", "TB", "PB", "EB", "ZB", "YB"];
      const i = Math.floor(Math.log(bytes) / Math.log(k));
      return parseFloat((bytes / Math.pow(k, i)).toFixed(dm)) + " " + sizes[i];
    },

    /**
     * Formats an OPNsense authentication method string into a more readable version.
     * Uses the authViaMapping from config.js.
     * @param {string} authVia - The raw authentication method string from the API.
     * @returns {string} A human-readable authentication method or placeholder.
     */
    formatAuthVia: function (authVia) {
      return (
        CPManager.config.authViaMapping[authVia] ||
        authVia ||
        CPManager.config.placeholderValue
      );
    },

    /**
     * Formats a Unix timestamp (seconds) into a localized date and time string.
     * @param {number} timestamp - Unix timestamp in seconds.
     * @returns {string} Formatted date-time string or placeholder if invalid.
     */
    formatVoucherTimestamp: function (timestamp) {
      if (!timestamp || timestamp === 0)
        return CPManager.config.placeholderValue;
      try {
        return new Date(timestamp * 1000).toLocaleString();
      } catch (e) {
        console.error("Error formatting timestamp:", timestamp, e);
        return "Invalid Date";
      }
    },

    /**
     * Formats a duration value into a human-readable string (e.g., "1d 4h 30m").
     * @param {number|string} totalValue - The total duration value.
     * @param {string} [unit='minutes'] - The unit of the totalValue ('minutes' or 'seconds').
     * @returns {string} Formatted duration string or placeholder.
     */
    formatDuration: function (totalValue, unit = "minutes") {
      let totalSeconds;

      if (unit === "minutes") {
        if (parseInt(totalValue) === 0) return "No Timeout"; // Specific case for 0 minutes timeout
        totalSeconds = parseInt(totalValue) * 60;
      } else {
        // Assumed 'seconds'
        if (parseInt(totalValue) === 0 && unit === "seconds") return "0s"; // Specific for 0 seconds if needed
        totalSeconds = parseInt(totalValue);
      }

      if (isNaN(totalSeconds) || totalSeconds === null || totalSeconds < 0)
        return CPManager.config.placeholderValue;

      const days = Math.floor(totalSeconds / (60 * 60 * 24));
      totalSeconds %= 60 * 60 * 24;
      const hours = Math.floor(totalSeconds / (60 * 60));
      totalSeconds %= 60 * 60;
      const minutes = Math.floor(totalSeconds / 60);
      const seconds = totalSeconds % 60; // Only relevant if original unit was seconds or for fine-grained display

      let parts = [];
      if (days > 0) parts.push(`${days}d`);
      if (hours > 0) parts.push(`${hours}h`);
      if (minutes > 0) parts.push(`${minutes}m`);
      if (seconds > 0 && unit === "seconds" && parts.length < 3)
        parts.push(`${seconds}s`); // Show seconds if original unit was seconds and not too many parts already

      if (parts.length === 0) {
        if (unit === "seconds" && totalValue > 0) return `${totalValue}s`;
        if (unit === "minutes" && totalValue > 0) return `${totalValue}m`; // Should be caught by "No Timeout" or become parts
        if (unit === "minutes" && parseInt(totalValue) === 0)
          return "No Timeout";
        return "0s"; // Fallback
      }
      return parts.join(" ");
    },

    /**
     * Formats OPNsense selectable fields (often objects with 'selected' keys) into a comma-separated string.
     * @param {object|string} valueObject - The value from OPNsense API, which might be an object or a string.
     * @returns {string} A comma-separated string of selected values, or the original string, or an empty string.
     */
    formatOpnsenseSelectable: function (valueObject) {
      if (typeof valueObject !== "object" || valueObject === null) {
        return String(valueObject || ""); // Return as string, or empty if null/undefined
      }

      const selectedItems = [];
      for (const key in valueObject) {
        if (Object.prototype.hasOwnProperty.call(valueObject, key)) {
          const option = valueObject[key];
          // Check if the option itself is an object and has a 'selected' property that is 1
          if (
            typeof option === "object" &&
            option !== null &&
            option.selected === 1
          ) {
            selectedItems.push(option.value || key); // Use option.value if available, otherwise the key
          }
        }
      }

      if (selectedItems.length > 0) {
        return selectedItems.join(", ");
      } else {
        // Handle cases where the input object might just be a simple { value: "something" }
        if (valueObject.value && Object.keys(valueObject).length === 1) {
          return String(valueObject.value);
        }
        return ""; // Return empty if no selected items or not a recognized format
      }
    },

    /**
     * Retrieves the description for a given zone ID from the globally stored `allConfiguredZones`.
     * @param {string|number} zoneId - The ID of the zone.
     * @returns {string} The zone description or a default string if not found.
     */
    getZoneDescription: function (zoneId) {
      const zone = CPManager.state.zones.allConfigured.find(
        (z) => String(z.zoneid) === String(zoneId),
      );
      return zone ? zone.description : `Zone ${zoneId}`;
    },

    /**
     * Determines the type of MAC address based on the U/L bit.
     * 0 = 'device' (globally unique), 1 = 'private' (locally administered).
     * @param {string} macAddress - The MAC address string (e.g., "00:1A:2B:3C:4D:5E").
     * @returns {string|null} "device", "private", or null if undetermined.
     */
    getMacAddressType: function (macAddress) {
      if (!macAddress || typeof macAddress !== "string") {
        return null;
      }

      // Standard MAC address format: 6 octets separated by colons or hyphens.
      // Regex to validate and extract the first octet.
      const macRegex =
        /^([0-9A-Fa-f]{2})[:|-]([0-9A-Fa-f]{2})[:|-]([0-9A-Fa-f]{2})[:|-]([0-9A-Fa-f]{2})[:|-]([0-9A-Fa-f]{2})[:|-]([0-9A-Fa-f]{2})$/;
      const match = macAddress.match(macRegex);

      if (!match) {
        // Check for MAC without separators (e.g., 001A2B3C4D5E)
        const plainMacRegex = /^[0-9A-Fa-f]{12}$/;
        if (plainMacRegex.test(macAddress)) {
          const firstOctetHex = macAddress.substring(0, 2);
          const firstOctetInt = parseInt(firstOctetHex, 16);
          if (isNaN(firstOctetInt)) {
            return null;
          }
          // Check the U/L bit (2nd LSB of the first octet)
          // 0x02 is 00000010 in binary.
          // If (firstOctetInt & 0x02) is non-zero, the U/L bit is 1 (locally administered).
          return (firstOctetInt & 0x02) !== 0 ? "private" : "device";
        }
        return null; // Invalid format
      }

      const firstOctetHex = match[1];
      const firstOctetInt = parseInt(firstOctetHex, 16);

      if (isNaN(firstOctetInt)) {
        return null; // Should not happen if regex matches, but good for safety.
      }

      // Check the U/L bit (2nd LSB of the first octet)
      // 0x02 is 00000010 in binary.
      // If (firstOctetInt & 0x02) is non-zero, the U/L bit is 1 (locally administered).
      return (firstOctetInt & 0x02) !== 0 ? "private" : "device";
    },
  };
})(window.CPManager); // Explicitly pass window.CPManager
