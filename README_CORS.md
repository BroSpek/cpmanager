# Proxying the OPNsense API with CORS

Objective:
To use HAProxy on OPNsense to securely proxy the internal OPNsense Captive Portal API, making it accessible to an external web application while correctly handling all CORS (Cross-Origin Resource Sharing) requirements.

Final Architecture:

- HAProxy Frontend: Listens on a custom public port with SSL Offloading to handle incoming HTTPS traffic.
- HAProxy Backend: Forwards traffic to the OPNsense GUI using a secure HTTPS connection, with SSL certificate verification disabled.
- CORS Handling: Managed entirely by HAProxy rules, which overwrite any CORS headers from the backend to ensure consistency.

## Working Configuration Steps

1. Go to System -> Firmware -> Plugins. And in the search bar, type `haproxy`. Click the "+" icon next to the `os-haproxy` plugin to install it.

2. Go to Services -> HAProxy -> Settings -> Real Servers. And create or edit a server with the following settings:

   - Name: `api_server`
   - IP Address: `127.0.0.1`
   - Port: `443` <- Assuming your current OPNsense WebUI port.
   - SSL: Checked
   - Verify SSL Certificate: Unchecked

3. Go to Services -> HAProxy -> Virtual Services -> Backend Pools. And create or edit a backend with the following settings:

   - Name: `api_backend_pool`
   - Servers: `api_server`

4. Go to Services -> HAProxy -> Settings -> Rules & Checks

   A. Conditions

   - Name: `is_options_request`
   - Condition type: `Custom condition`
   - Custom condition: `method OPTIONS`

   B. Rules

   1. Rule 1
      - Name: `rule_cors_preflight_response`
      - Test Type: `If`
      - Select conditions: `is_options_request`
      - Execute function: `http-response set-status`
      - HTTP Status Code: `204`
      - HTTP Reason Text: `No Content`
   2. Rule 2
      - Name: `rule_cors_allowed_origin`
      - Test Type: `If`
      - Select conditions: `is_options_request`
      - Execute function: `http-response set-header`
      - HTTP Header: `Access-Control-Allow-Origin`
      - Header Content: `"https://halimstt.github.io"`<- Replace with your cpmanager URL.
   3. Rule 3
      - Name: `rule_cors_allowed_methods`
      - Test Type: `If`
      - Select conditions: `is_options_request`
      - Execute function: `http-response add-header`
      - HTTP Header: `Access-Control-Allow-Methods`
      - Header Content: `"GET, POST, PUT, DELETE, OPTIONS"`
   4. Rule 4
      - Name: `rule_cors_allowed_header`
      - Test Type: `If`
      - Select conditions: `is_options_request`
      - Execute function: `http-response add-header`
      - HTTP Header: `Access-Control-Allow-Headers`
      - Header Content: `"Authorization, Content-Type, X-Requested-With"`
   5. Rule 5
      - Name: `rule_cors_allowed_credentials`
      - Test Type: `If`
      - Select conditions: `is_options_request`
      - Execute function: `http-response add-header`
      - HTTP Header: `Access-Control-Allow-Credentials`
      - Header Content: `"true"`
   6. Rule 6
      - Name: `rule_cors_allowed_credentials`
      - Test Type: `If`
      - Select conditions: `is_options_request`
      - Execute function: `http-response add-header`
      - HTTP Header: `Access-Control-Max-Age`
      - Header Content: `"86400"`
   7. Rule 7
      - Name: `rule_add_cors_origin_to_responses`
      - Test Type: `Unless`
      - Select conditions: `is_options_request`
      - Execute function: `http-response set-header`
      - HTTP Header: `Access-Control-Allow-Origin`
      - Header Content: `"https://halimstt.github.io"`<- Replace with your cpmanager URL.

   Take note that some are `http-response add-header` and some are `http-response set-header`

5. Go to Services -> HAProxy -> Virtual Services -> Public Services. And create or edit a frontend with the following settings:

   - Name: `api_frontend`
   - Listen Address: `0.0.0.0:4343`<- If `4343` is conflict, replace with another unused port.
   - Type: `HTTP / HTTPS (SSL Offloading)`
   - Default Backend Pool: `api_backend_pool`.
   - Enable SSL offloading: Checked.
   - Certificates: Select your public SSL certificate.
   - Rules: Apply all the rules created by their **order** above: start with `rule_cors_preflight_response` and end with `rule_add_cors_origin_to_responses`.

6. Go to Firewall -> Rules -> WAN. And Ensure a rule exists to `Pass` `TCP` traffic with a Destination port of `4343` (or the port you use).

7. Go to Services -> HAProxy -> Settings. And click Test Syntax. If there are no errors, check the Enable HAProxy box and click Apply.

## Conclusion

With these steps, you have successfully configured HAProxy to handle CORS for your `cpmanager` application.
