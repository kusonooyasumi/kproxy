import { writable } from 'svelte/store';
import { isElectron } from '$lib/utils/env';
import type { CapturedRequest } from '$lib/types';

export interface ProxyStatus {
  isRunning: boolean;
  port: number;
  certificatePath: string;
}

export interface ProxySettings {
  port: number;
  autoStart: boolean;
}

export interface ProxyStore {
  status: ProxyStatus;
  settings: ProxySettings;
  requests: CapturedRequest[];
}

const initialState: ProxyStore = {
  status: {
    isRunning: false,
    port: 8080,
    certificatePath: ''
  },
  settings: {
    port: 8080,
    autoStart: false
  },
  requests: []
};

const proxyStore = writable<ProxyStore>(initialState);

async function clearRequests() {
  if (!isElectron || !window.electronAPI?.proxy) {
    console.error('Requests can only be cleared in the Electron app');
    return;
  }

  try {
    await window.electronAPI.proxy.clearRequests();
    proxyStore.update(store => ({
      ...store,
      requests: []
    }));
  } catch (error) {
    console.error('Failed to clear requests:', error);
  }
}

export default {
  subscribe: proxyStore.subscribe,
  update: proxyStore.update,
  set: proxyStore.set,
  clearRequests
};
