# KProxy

KProxy is an application that can proxy web requests, displaying them in a requests tab for analysis and debugging.

## Features

- HTTP/HTTPS proxy server that captures all web requests
- Certificate Authority (CA) generation for HTTPS interception
- Detailed request and response viewing
- Request history management

## Running the Application

```bash
# Development mode
npm run electron:dev

# Build and preview
npm run electron:preview

# Package the application
npm run electron:package
```

## Using the Proxy

1. Start the application
2. Go to the "Requests" tab
3. Click "Start Proxy" to begin capturing requests
4. Configure your browser or application to use localhost:8080 as the proxy server
5. For HTTPS inspection, you'll need to install the CA certificate:
   - Click "Export CA Certificate" in the Requests tab
   - Follow the installation instructions for your operating system/browser

### Installing the CA Certificate

#### Windows

1. Double-click the exported certificate file
2. Select "Place all certificates in the following store" and click "Browse"
3. Select "Trusted Root Certification Authorities" and click "OK"
4. Click "Next" and then "Finish"

#### macOS

1. Double-click the exported certificate file
2. This will open Keychain Access
3. Enter your password to install the certificate
4. Double-click the installed certificate, expand "Trust"
5. Set "When using this certificate" to "Always Trust"

#### Firefox

1. Open Firefox preferences
2. Search for "certificates" and click "View Certificates"
3. Go to the "Authorities" tab and click "Import"
4. Select the exported certificate file
5. Check "Trust this CA to identify websites" and click "OK"

#### Chrome/Edge

- On Windows and macOS, Chrome uses the system certificate store, so follow the instructions for your OS
- On Linux, open Chrome settings, search for "certificates", click "Manage certificates", go to "Authorities" tab, and import the certificate

## Proxy Configuration

- Default port: 8080
- Auto-start: Disabled by default, can be enabled in settings
