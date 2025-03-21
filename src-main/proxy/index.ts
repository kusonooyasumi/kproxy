import ProxyManager from './proxy-manager';
import type { ProxyStatus, ProxySettings, ScopeSettings, RequestDetails } from './proxy-manager';
import { exportCertificate, getCertificateInstructions } from './certificate';

// Create a singleton ProxyManager instance
const proxyManager = new ProxyManager();

// Initialize the proxy functionality
const init = () => {
  proxyManager.initialize();
};

// Register IPC handlers for renderer process communication
const registerIpcHandlers = () => {
  proxyManager.registerIpcHandlers();
};

// Create wrapper functions to export the ProxyManager methods
const startProxy = (settings: { port: number }) => {
  return proxyManager.startProxy(settings);
};

const stopProxy = () => {
  return proxyManager.stopProxy();
};

const updateSettings = (settings: Partial<ProxySettings>) => {
  return proxyManager.updateSettings(settings);
};

const updateCustomHeaders = (headers: Record<string, string>) => {
  return proxyManager.updateCustomHeaders(headers);
};

// Export functions from the ProxyManager and Certificate modules
export {
  init,
  registerIpcHandlers,
  // Proxy control functions
  startProxy,
  stopProxy,
  updateSettings,
  updateCustomHeaders,
  // Certificate functions
  exportCertificate,
  getCertificateInstructions,
  // Type exports
  type ProxyStatus,
  type ProxySettings,
  type ScopeSettings,
  type RequestDetails
};
