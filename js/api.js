// js/api.js

(function (CPManager) {
  CPManager.api = {
    /**
     * Makes an API call to the OPNsense Captive Portal backend.
     * Handles authorization, request method, body, and basic error handling.
     * @param {string} endpoint - The API endpoint (e.g., '/session/search').
     * @param {string} [method='GET'] - HTTP method (GET, POST, etc.).
     * @param {object|null} [body=null] - The request body for POST/PUT requests.
     * @returns {Promise<object>} A promise that resolves with the JSON response from the API.
     * @throws {Error} Throws an error if the API call fails or returns an error status.
     */
    callApi: async function (endpoint, method = "GET", body = null) {
      // Add check for baseUrl
      if (!CPManager.config.baseUrl) {
        const errorMessage =
          "OPNsense API Base URL is not configured. Cannot make API call.";
        console.error(errorMessage, "Endpoint:", endpoint); // Log the error
        CPManager.ui.showToast(
          "API Base URL not set. Please configure in settings.",
          "error",
          8000,
        );
        throw new Error(errorMessage);
      }

      const url = `${CPManager.config.baseUrl}/api/captiveportal${endpoint}`;
      const headers = new Headers();

      if (CPManager.state.currentApiKey && CPManager.state.currentApiSecret) {
        headers.append(
          "Authorization",
          "Basic " +
            btoa(
              CPManager.state.currentApiKey +
                ":" +
                CPManager.state.currentApiSecret,
            ),
        );
      } else {
        const errorMessage =
          "API Key or Secret is missing. Cannot make API call.";
        console.error(errorMessage, "Endpoint:", endpoint); // Log the error
        CPManager.ui.showToast(
          "API Key or Secret not set. Please configure in settings.",
          "error",
        );
        throw new Error("API Key or Secret not set.");
      }

      if (method === "POST" && body) {
        headers.append("Content-Type", "application/json");
      }

      const options = { method, headers };
      if (body) {
        options.body = JSON.stringify(body);
      }

      try {
        const response = await fetch(url, options);
        const responseText = await response.text(); // Get text first to handle various response types

        if (!response.ok) {
          let errorData = {
            message: `HTTP error! Status: ${response.status}.`,
          };
          if (responseText) {
            try {
              // Attempt to parse as JSON for more detailed error messages
              const parsedError = JSON.parse(responseText);
              errorData.detail =
                parsedError.message ||
                parsedError.detail ||
                JSON.stringify(parsedError);
            } catch (jsonParseError) {
              // Caught error from JSON.parse is logged here
              errorData.detail =
                responseText.substring(0, 200) +
                (responseText.length > 200 ? "..." : "");
              console.error(
                `Failed to parse error response as JSON for ${method} ${url}:`,
                jsonParseError,
                "Raw response:",
                responseText,
              );
            }
          } else {
            errorData.detail =
              response.statusText || "No response body from server.";
          }
          console.error(
            "API Error:",
            method,
            url,
            response.status,
            errorData.detail,
            { response, responseText }, // Include response objects for full context
          );
          CPManager.ui.showToast(
            `API Error: ${errorData.message} ${errorData.detail}`,
            "error",
          );
          throw new Error(
            `HTTP error! status: ${response.status}, message: ${errorData.detail}`,
          );
        }

        // Handle successful responses that might not have content (e.g., 204 No Content)
        // or text responses that indicate success.
        if (response.status === 204 || !responseText) {
          console.info(
            `API Success: ${method} ${url} - No content or empty response.`,
          ); // Info log for success
          return {
            status: "ok",
            message: `Operation successful (${response.status === 204 ? "No Content" : "Empty Response"})`,
          };
        }

        try {
          // Attempt to parse successful response as JSON
          const jsonData = JSON.parse(responseText);
          // Check for application-level errors within a 2xx response
          if (jsonData && jsonData.status === "error") {
            console.warn(
              `API Operational Error for ${method} ${url}:`,
              jsonData.message || "Error status received in JSON.",
              { jsonData }, // Log the problematic JSON data
            );
            CPManager.ui.showToast(
              `API Operation Failed: ${jsonData.message || "Error status received."}`,
              "warning",
            );
          } else {
            console.info(`API Success: ${method} ${url}`, { jsonData }); // Info log for successful JSON response
          }
          return jsonData;
        } catch (jsonParseError) {
          // Catch and log specific JSON parsing error
          // If parsing JSON fails but response was OK, it might be a simple text confirmation
          if (
            response.ok &&
            (responseText.toLowerCase().includes("ok") ||
              responseText.toLowerCase().includes("saved") ||
              responseText.toLowerCase().includes("deleted") ||
              responseText.toLowerCase().includes("success"))
          ) {
            console.info(
              `API Success: ${method} ${url} - Text confirmation:`,
              responseText,
            );
            return { status: "ok_text", message: responseText };
          }
          // If it's not recognized text and not JSON, log a warning.
          console.warn(
            `API Warning for ${method} ${url}: Successful response was not valid JSON and not recognized text. JSON parse error:`,
            jsonParseError,
            "Content snippet:",
            responseText.substring(0, 100),
          );
          return { status: "ok_non_json", message: responseText }; // Return the raw text
        }
      } catch (fetchOrProcessError) {
        // Catch network errors or re-thrown errors from internal checks
        console.error(
          `Fetch/Process Error for ${method} ${url}:`,
          fetchOrProcessError.message,
          fetchOrProcessError, // Log the full error object for more details
        );
        if (!String(fetchOrProcessError.message).startsWith("HTTP error!")) {
          // Check if it's not already an HTTP error we've handled
          let userMessage =
            "API request failed. This could be a network issue, or the OPNsense server might be unavailable or misconfigured.";
          // The 'Failed to fetch' message is very common for CORS issues or actual network failures.
          if (
            CPManager.config.baseUrl &&
            CPManager.config.baseUrl.startsWith("http") &&
            !CPManager.config.baseUrl.includes(window.location.origin)
          ) {
            userMessage +=
              " If the app is hosted on a different domain than OPNsense, please check server's CORS configuration.";
          }
          userMessage +=
            " More details may be available in the browser's developer console.";
          CPManager.ui.showToast(userMessage, "error", 8000); // Increased duration for more text
        }
        throw fetchOrProcessError; // Re-throw the error to be caught by the caller
      }
    },
  };
})(window.CPManager); // Explicitly pass window.CPManager
