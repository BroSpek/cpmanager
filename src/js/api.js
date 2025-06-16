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
      if (!CPManager.config.baseUrl) {
        const errorMessage =
          "OPNsense API Base URL is not configured. Cannot make API call.";
        console.error(errorMessage, "Endpoint:", endpoint);
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
        console.error(errorMessage, "Endpoint:", endpoint);
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
        const responseText = await response.text();

        if (!response.ok) {
          let errorData = {
            message: `HTTP error! Status: ${response.status}.`,
          };
          if (responseText) {
            try {
              const parsedError = JSON.parse(responseText);
              errorData.detail =
                parsedError.message ||
                parsedError.detail ||
                JSON.stringify(parsedError);
            } catch (jsonParseError) {
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
            { response, responseText },
          );
          CPManager.ui.showToast(
            `API Error: ${errorData.message} ${errorData.detail}`,
            "error",
          );
          throw new Error(
            `HTTP error! status: ${response.status}, message: ${errorData.detail}`,
          );
        }

        if (response.status === 204 || !responseText) {
          console.info(
            `API Success: ${method} ${url} - No content or empty response.`,
          );
          return {
            status: "ok",
            message: `Operation successful (${response.status === 204 ? "No Content" : "Empty Response"})`,
          };
        }

        try {
          const jsonData = JSON.parse(responseText);
          if (jsonData && jsonData.status === "error") {
            console.warn(
              `API Operational Error for ${method} ${url}:`,
              jsonData.message || "Error status received in JSON.",
              { jsonData },
            );
            CPManager.ui.showToast(
              `API Operation Failed: ${jsonData.message || "Error status received."}`,
              "warning",
            );
          } else {
            console.info(`API Success: ${method} ${url}`, { jsonData });
          }
          return jsonData;
        } catch (jsonParseError) {
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
          console.warn(
            `API Warning for ${method} ${url}: Successful response was not valid JSON and not recognized text. JSON parse error:`,
            jsonParseError,
            "Content snippet:",
            responseText.substring(0, 100),
          );
          return { status: "ok_non_json", message: responseText };
        }
      } catch (fetchOrProcessError) {
        console.error(
          `Fetch/Process Error for ${method} ${url}:`,
          fetchOrProcessError.message,
          fetchOrProcessError,
        );
        if (!String(fetchOrProcessError.message).startsWith("HTTP error!")) {
          let userMessage =
            "API request failed. This could be a network issue, or the OPNsense server might be unavailable or misconfigured.";
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
          CPManager.ui.showToast(userMessage, "error", 8000);
        }
        throw fetchOrProcessError;
      }
    },

    /**
     * Performs a lightweight API call to check if the connection and credentials are valid.
     * @returns {Promise<boolean>} A promise that resolves to true if the connection is successful, false otherwise.
     */
    checkConnection: async function () {
      try {
        // This endpoint is a good candidate for a general health check.
        // The callApi function will handle throwing errors for network or auth issues.
        const data = await this.callApi("/settings/search_zones");
        // If we receive the expected data structure, the connection is good.
        return Array.isArray(data?.rows);
      } catch (error) {
        console.error("API connection check failed:", error.message);
        // The detailed error is already shown as a toast by callApi.
        // We just need to signal failure to the caller.
        return false;
      }
    },
  };
})(window.CPManager);
