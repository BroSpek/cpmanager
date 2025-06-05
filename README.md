# Captive Portal Manager

**OPNsense Captive Portal Manager** is a web-based tool designed to manage the OPNsense Captive Portal, providing a user-friendly interface for monitoring and controlling various aspects of the portal.

## Features

-   **Dashboard Overview**: Displays aggregated data for all configured zones, including a data usage distribution chart showing client upload and download statistics.
-   **Session Management**: Allows viewing and managing active sessions. Users can search sessions by IP, MAC, or username, filter by zone, find their own session, and disconnect all (filtered) sessions.
-   **Voucher Management**: Enables the creation and management of vouchers. Users can select a voucher provider, view voucher groups, create new vouchers with customizable counts and validity periods, and drop expired vouchers or entire voucher groups.
-   **Zone Management**: Provides an interface for viewing and managing captive portal zones. Users can apply captive portal configurations and edit zone details such as status (enabled/disabled), description, allowed addresses, and allowed MAC addresses.
-   **API Credential Management**: Securely stores OPNsense API Key, Secret, and Base URL in the browser's local storage for API interaction.
-   **Theme Switching**: Supports light, dark, and system preference themes for an adaptable user interface.
-   **Responsive Design**: Utilizes Tailwind CSS for a responsive layout suitable for various screen sizes.
-   **Progressive Web App (PWA)**: Includes a service worker for caching app shell resources (`index.html`, icons) and a manifest file for "add to home screen" functionality.
-   **Notifications**: Provides local notifications for new user sign-ins on your configured captive portal zones.

## Mobile Screenshots

Here's a glimpse of how the Captive Portal Manager looks on mobile devices in both light and dark modes:

<div style="display: flex; flex-wrap: wrap; justify-content: space-around; align-items: flex-start;">
  <div style="text-align: center; margin: 10px; padding: 5px; width: 100%; max-width: 630px;">
    <b>1. Dashboard View</b><br>
    <div style="display: flex; justify-content: space-around; align-items: flex-start; margin-top: 5px; flex-wrap: wrap;">
        <img src="img/screenshot_mobile_dashboard_light.png" alt="Mobile Dashboard View - Light Mode" width="300" style="height: auto; border: 1px solid #ddd; border-radius: 4px; box-shadow: 2px 2px 5px #ccc; margin: 5px;">
        <img src="img/screenshot_mobile_dashboard_dark.png" alt="Mobile Dashboard View - Dark Mode" width="300" style="height: auto; border: 1px solid #ddd; border-radius: 4px; box-shadow: 2px 2px 5px #ccc; margin: 5px;">
    </div>
  </div>
  <div style="text-align: center; margin: 10px; padding: 5px; width: 100%; max-width: 630px;">
    <b>2. Active Sessions List</b><br>
    <div style="display: flex; justify-content: space-around; align-items: flex-start; margin-top: 5px; flex-wrap: wrap;">
        <img src="img/screenshot_mobile_sessions_light.png" alt="Mobile Sessions List - Light Mode" width="300" style="height: auto; border: 1px solid #ddd; border-radius: 4px; box-shadow: 2px 2px 5px #ccc; margin: 5px;">
        <img src="img/screenshot_mobile_sessions_dark.png" alt="Mobile Sessions List - Dark Mode" width="300" style="height: auto; border: 1px solid #ddd; border-radius: 4px; box-shadow: 2px 2px 5px #ccc; margin: 5px;">
    </div>
  </div>
  <div style="text-align: center; margin: 10px; padding: 5px; width: 100%; max-width: 630px;">
    <b>3. Voucher Creation/Management</b><br>
    <div style="display: flex; justify-content: space-around; align-items: flex-start; margin-top: 5px; flex-wrap: wrap;">
        <img src="img/screenshot_mobile_vouchers_light.png" alt="Mobile Voucher Management - Light Mode" width="300" style="height: auto; border: 1px solid #ddd; border-radius: 4px; box-shadow: 2px 2px 5px #ccc; margin: 5px;">
        <img src="img/screenshot_mobile_vouchers_dark.png" alt="Mobile Voucher Management - Dark Mode" width="300" style="height: auto; border: 1px solid #ddd; border-radius: 4px; box-shadow: 2px 2px 5px #ccc; margin: 5px;">
    </div>
  </div>
  <div style="text-align: center; margin: 10px; padding: 5px; width: 100%; max-width: 630px;">
    <b>4. Zone Information Display</b><br>
    <div style="display: flex; justify-content: space-around; align-items: flex-start; margin-top: 5px; flex-wrap: wrap;">
        <img src="img/screenshot_mobile_zones_light.png" alt="Mobile Zone Information - Light Mode" width="300" style="height: auto; border: 1px solid #ddd; border-radius: 4px; box-shadow: 2px 2px 5px #ccc; margin: 5px;">
        <img src="img/screenshot_mobile_zones_dark.png" alt="Mobile Zone Information - Dark Mode" width="300" style="height: auto; border: 1px solid #ddd; border-radius: 4px; box-shadow: 2px 2px 5px #ccc; margin: 5px;">
    </div>
  </div>
  <div style="text-align: center; margin: 10px; padding: 5px; width: 100%; max-width: 630px;">
    <b>5. API Credential Input Screen</b><br>
    <div style="display: flex; justify-content: space-around; align-items: flex-start; margin-top: 5px; flex-wrap: wrap;">
        <img src="img/screenshot_mobile_credentials_light.png" alt="Mobile API Credential Input - Light Mode" width="300" style="height: auto; border: 1px solid #ddd; border-radius: 4px; box-shadow: 2px 2px 5px #ccc; margin: 5px;">
        <img src="img/screenshot_mobile_credentials_dark.png" alt="Mobile API Credential Input - Dark Mode" width="300" style="height: auto; border: 1px solid #ddd; border-radius: 4px; box-shadow: 2px 2px 5px #ccc; margin: 5px;">
    </div>
  </div>
</div>

## Requirements

-   An operational OPNsense® firewall.
-   The OPNsense Captive Portal module configured for at least one zone.
-   The OPNsense API enabled, with an API Key and Secret generated that have sufficient permissions for captive portal and voucher management. Navigate your `OPNsense > System > Access > Users`.
-   Network connectivity from the device running this tool to the OPNsense API endpoint (ensure the API Base URL, whether from `app-config.json` or entered in-app, is reachable).
-   A modern web browser (e.g., Chrome, Firefox, Safari, Edge) that supports JavaScript, localStorage, Service Workers for PWA functionality, and Notifications.

## Setup and Usage

1.  Clone or download the repository.
2.  **(Optional for initial setup):** Copy `app-config.example.json` to `app-config.json` and set `apiBaseUrl` to your OPNsense API endpoint URL (example: `https://192.168.1.1`). This file is loaded first, but subsequent changes made in the app's UI will be saved to local storage and take precedence.
    ```json
    {
    	"apiBaseUrl": "https://192.168.1.1"
    }
    ```
3.  Open `index.html` in a modern web browser.
4.  When prompted, enter your OPNsense API Key, Secret, and the correct API Base URL. These credentials will be securely saved in your browser's local storage for future sessions.
5.  Use the navigation tabs (Dashboard, Sessions, Vouchers, Zones) to manage your captive portal.
6.  To enable notifications, click the 🔕 icon in the navigation bar and grant permission when prompted by your browser.

## Configuration

1.  **API Endpoint**: The application first attempts to load the API Base URL from `app-config.json`. However, the primary method for configuring and persisting the API Base URL is through the dedicated input field in the application's UI, which saves the value to the browser's local storage. This local storage value will override the `app-config.json` setting if present.
2.  **API Credentials**: Upon first launch, or if credentials are cleared, the application will prompt for your OPNsense API Key and Secret. These, along with the API Base URL, are stored in the browser's local storage.

## Troubleshooting

### API Connection Issues (Cross-Origin Resource Sharing - CORS)

If you encounter "Failed to fetch" errors or "Cannot reach OPNsense API" messages when using the application, especially if you are hosting it on a different domain, subdomain, IP address, or port than your OPNsense firewall's web interface, you are likely experiencing a **Cross-Origin Resource Sharing (CORS)** issue.

**What is CORS?**
CORS is a browser-level security mechanism that prevents a web page loaded from one origin (domain, protocol, and port) from making requests to a resource on a _different_ origin unless the server explicitly grants permission.

**How to resolve:**

The most straightforward way to avoid CORS issues is to ensure the Captive Portal Manager application is served from the **same origin** as your OPNsense API. If that's not feasible, you'll need to configure CORS on your OPNsense firewall.

-   **Option 1: Easiest Setup (Recommended for direct deployment)**:
    To completely bypass CORS, host this application directly within a **subfolder inside** your OPNsense web server's document root. For example, you might place the application files (like `index.html`, `js`, `css`, etc.) into a new directory such as `/usr/local/www/cpmanager/` on your OPNsense firewall.
    Then browse to you OPNsense URL (example: `https://192.168.1.1/cpmanager/index.html`).
    When served from the same domain/IP and port as the OPNsense GUI and API, browser security policies will recognize them as the same origin, thus eliminating CORS errors without any extra configuration.

-   **Option 2: Configure OPNsense for CORS (for external hosting)**:
    If you host this application on a separate web server, domain, or even a different port on the same server, your OPNsense firewall needs to be configured to allow requests from your application's origin. This typically involves adding CORS headers to OPNsense's web server configuration. You will need to specify your application's full origin (e.g., `https://your-app-host.com:port`) in OPNsense's API settings (if available) or through custom web server rules. Refer to the official OPNsense documentation on API access and CORS settings for precise instructions on how to add "Allowed Origins".

**Common Symptoms of CORS issues**:

-   "Failed to fetch" errors displayed in the application or browser console.
-   Console messages like "Access to XMLHttpRequest at '...' from origin '...' has been blocked by CORS policy: No 'Access-Control-Allow-Origin' header is present on the requested resource."
-   The application gets stuck on "Initializing..." or continuously shows "Connection Failed" after entering credentials.

**Crucial Check**: Regardless of your hosting method, ensure that the "OPNsense API Base URL" you enter in the application's configuration is precise and correctly points to your OPNsense API endpoint.

## Creating Vouchers

The Captive Portal Manager allows you to easily generate new vouchers for guest access through your OPNsense Captive Portal.

**Important Prerequisites for Voucher Functionality in OPNsense**:

To ensure vouchers generated by this tool function correctly, your OPNsense environment must be properly configured first:

1.  **Create a Voucher Authentication Server (Provider) in OPNsense**:

    -   Navigate to **System > Access > Servers** in your OPNsense interface.
    -   Click the `+` (Add) button to create a new server.
    -   Set the `Type` to **"Vouchers"**.
    -   Give it a descriptive `Name` (e.g., "GuestVouchers"). This name will appear as the "Voucher Provider" in this management tool.
    -   Configure other settings as needed and save the server.

2.  **Configure Your Captive Portal Zone to Use Voucher Authentication**:
    -   Navigate to **Services > Captive Portal > Administration** in OPNsense.
    -   Identify the Captive Portal Zone where you intend to use the vouchers and click the pencil icon (edit) for that zone.
    -   In the zone's configuration page, locate the **Authentication method** settings.
    -   From the `Authenticate using` (or similarly named) dropdown list, select the Voucher authentication server (provider) you created in the previous step (e.g., "GuestVouchers").
    -   Save the changes to the zone configuration.
    -   Remember to **Apply** changes in the Captive Portal main page if prompted.

Vouchers generated by this tool will only be valid and usable on zones that are explicitly configured to use a compatible voucher authentication server.

---

1.  **Navigate to Voucher Management in this Tool**:

    -   In the Captive Portal Manager interface, select the **"Vouchers" tab** from the main navigation bar.

2.  **Select a Voucher Provider**:

    -   You will see a dropdown labeled "Voucher Provider".
    -   Click on it and select the OPNsense voucher provider you configured (e.g., "GuestVouchers"). If your provider isn't listed, ensure it was created correctly in OPNsense (as described in the prerequisites) and that the API user has permissions to access it.

3.  **Initiate Voucher Creation**:

    -   Once a provider is selected, click the **"Create New Vouchers"** button.
    -   This action will open the "Generate Vouchers" dialog window.

4.  **Configure Voucher Parameters** (in the "Generate Vouchers" dialog):

    -   **Number of Vouchers**:
        -   Choose a predefined quantity (e.g., 1, 5, 10, 25, 50, 100, 250) from the "Number of vouchers" dropdown.
        -   Alternatively, select "Custom" from the dropdown and enter the exact number of vouchers you wish to create in the input field that appears.
    -   **Validity**: This defines how long a voucher will be active _once a user redeems it_.
        -   Select a predefined duration from the "Validity" dropdown (e.g., 4 hours, 1 day, 1 week). These values are typically represented in minutes.
        -   Alternatively, select "Custom (minutes)" and enter the desired validity period in minutes in the input field that appears (e.g., `60` for 1 hour).
    -   **Expires In**: This sets the lifespan of an _unused_ voucher. After this period, an unredeemed voucher will automatically expire.
        -   Select a predefined duration from the "Expires in" dropdown (e.g., Never, 6 hours, 1 day, 1 week).
        -   Alternatively, select "Custom (hours)" and enter the desired expiry period in hours in the input field that appears. Enter `0` if you want the unused vouchers to never expire.
    -   **Group Name**:
        -   You can assign the batch of new vouchers to a specific group by typing a name in the "Group name" field (e.g., `EventVouchers_Spring2025`).
        -   If you leave this field empty, a group name will be automatically generated based on the current timestamp (e.g., `gYYYYMMDDHHMM`).
    -   **Output Format**:
        -   Choose the format for the generated voucher codes, which will be provided as a downloadable PDF file:
            -   **Card Style PDF**: Vouchers are formatted as individual cards, suitable for printing and distributing.
            -   **Table Style PDF**: Vouchers are listed in a tabular format.
            -   **Both (Card then Table)**: The PDF will contain both the card style and table style layouts.

5.  **Generate the Vouchers**:

    -   After configuring all parameters, click the **"Generate"** button at the bottom of the dialog.
    -   The system will process your request, create the vouchers on your OPNsense firewall, and then automatically initiate a download of a PDF file containing the new voucher codes in your selected format(s).

6.  **Verify and View**:
    -   Once the PDF is downloaded, you can close the "Generate Vouchers" dialog.
    -   The newly created voucher group (if you provided a new name) should now be available in the "Voucher Group" dropdown. If you added vouchers to an existing group, that group will be updated.
    -   Select the relevant group to view all its vouchers, including the ones you just created.

## Notifications

The Captive Portal Manager supports local notifications for new user sign-ins on your configured captive portal zones.

-   **Functionality**: When a new user authenticates through the captive portal, you can receive a desktop notification. Clicking the notification will open the application and navigate to the "Sessions" tab.
-   **Enabling/Disabling**:
    -   Click the 🔕 (bell-slash) icon in the top navigation bar to enable notifications. Your browser will prompt you for permission.
    -   If enabled, the icon will change to 🔔 (bell). Click it again to disable notifications.
    -   If notifications encounter repeated errors (e.g., API connectivity issues), the icon may change to ⚠️ (warning triangle) and notifications will be temporarily disabled. Clicking it will attempt to re-enable them.
-   **Testing Notifications**:
    -   To send a test notification, **long-press** (press and hold for about 1 seconds) the notification toggle button (🔔/🔕/⚠️).
    -   A test notification will only be sent if notifications are currently enabled (i.e., the icon is 🔔). If they are disabled or in an error state, you'll receive a prompt to enable them first.
    -   This allows you to verify that the notification system is working correctly on your device.
-   **Requirements**:
    -   Your browser must support notifications.
    -   You must grant notification permission to the application when prompted.
-   **Technology**: This feature utilizes a Service Worker to enable notifications even if the application tab is not actively focused and to handle notification interactions.

## Service Worker

The application uses a service worker (`sw.js`):

-   To cache the core application shell (e.g., `index.html`, icons) for faster load times on subsequent visits and potential offline access to the basic UI.
-   To handle incoming push messages and display desktop notifications for new user sign-ins.
-   To manage notification click events, allowing users to open or focus the application when a notification is interacted with.

## Technologies Used

-   <img src="https://upload.wikimedia.org/wikipedia/commons/thumb/6/61/HTML5_logo_and_wordmark.svg/20px-HTML5_logo_and_wordmark.svg.png" alt="HTML5 Logo" width="20" height="20" style="vertical-align:middle; margin-right:5px;"> [HTML](https://developer.mozilla.org/en-US/docs/Web/HTML)
-   <img src="https://upload.wikimedia.org/wikipedia/commons/thumb/d/d5/Tailwind_CSS_Logo.svg/20px-Tailwind_CSS_Logo.svg.png" alt="Tailwind CSS Logo" width="20" style="vertical-align:middle; margin-right:5px;"> [Tailwind CSS](https://tailwindcss.com/) (Theming)
-   <img src="https://upload.wikimedia.org/wikipedia/commons/thumb/9/99/Unofficial_JavaScript_logo_2.svg/20px-Unofficial_JavaScript_logo_2.svg.png" alt="JavaScript Logo" width="20" height="20" style="vertical-align:middle; margin-right:5px;"> [JavaScript](https://developer.mozilla.org/en-US/docs/Web/JavaScript)
-   <img src="https://raw.githubusercontent.com/chartjs/Chart.js/refs/heads/master/docs/.vuepress/public/logo.svg" alt="Chart.js Logo" width="20" height="20" style="vertical-align:middle; margin-right:5px;"> [Chart.js](https://www.chartjs.org/) (Dashboard data visualization)
-   <img src="https://upload.wikimedia.org/wikipedia/commons/5/5f/Font_Awesome_logomark_blue.svg" alt="Font Awesome Logo" width="20" height="20" style="vertical-align:middle; margin-right:5px;"> [Font Awesome](https://fontawesome.com/) (Icons)
-   <img src="img/opnsense_icon.svg" alt="OPNsense Logo" width="20" height="20" style="vertical-align:middle; margin-right:5px;"> [OPNsense API](https://docs.opnsense.org/development/api.html) (Interact with OPNsense)
