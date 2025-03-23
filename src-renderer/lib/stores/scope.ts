import { writable } from 'svelte/store';

// Define type for scope settings
export interface ScopeSettings {
  inScope: string[];
  outOfScope: string[];
}

// Create a writable store with initial values
const createScopeStore = () => {
  const initialValue: ScopeSettings = {
    inScope: ['example.com', '*.example.org'],
    outOfScope: ['admin.example.com']
  };

  // Create the writable store
  const { subscribe, set, update } = writable<ScopeSettings>(initialValue);

  // Initialize the store - try to get values from main process first
  const initializeStore = async () => {
    if (typeof window !== 'undefined' && window.electronAPI) {
      try {
        // Try to get scope settings from main process via proxy IPC
        const savedScopeSettings = await window.electronAPI.proxy.getScopeSettings();
        if (savedScopeSettings) {
          set(savedScopeSettings);
          console.log('Initialized scope store from main process:', savedScopeSettings);
        }
      } catch (error) {
        console.error('Error initializing scope store:', error);
      }
    }
  };

  // Initialize when the module loads
  initializeStore();

  // Return the enhanced store
  return {
    subscribe,
    
    // Custom set method that syncs with main process
    set: (value: ScopeSettings) => {
      // Update the local store
      set(value);
      
      // Sync with main process if available
      if (typeof window !== 'undefined' && window.electronAPI) {
        // Send the update to the main process
        window.electronAPI.sendStoreUpdate('scope', value);
        
        // Also save to proxy settings if that API is available
        if (window.electronAPI.proxy) {
          window.electronAPI.proxy.saveScopeSettings(value)
            .catch((error: any) => console.error('Error saving scope settings:', error));
        }
      }
    },
    
    // Custom update method that syncs with main process
    update: (updater: (value: ScopeSettings) => ScopeSettings) => {
      let newValue: ScopeSettings;
      
      // Update local store and capture the new value
      update(currentValue => {
        newValue = updater(currentValue);
        return newValue;
      });
      
      // Sync with main process if available
      if (typeof window !== 'undefined' && window.electronAPI && newValue!) {
        // Send the update to the main process
        window.electronAPI.sendStoreUpdate('scope', newValue!);
        
        // Also save to proxy settings if that API is available
        if (window.electronAPI.proxy) {
          window.electronAPI.proxy.saveScopeSettings(newValue!)
            .catch((error: any) => console.error('Error saving scope settings:', error));
        }
      }
    }
  };
};

// Create and export the synchronized scope store
export const scopeStore = createScopeStore();

// Listen for updates from other windows via main process
if (typeof window !== 'undefined' && window.electronAPI) {
  window.electronAPI.receive('store-update', (data: { storeName: string, value: any }) => {
    if (data.storeName === 'scope') {
      // Only update the local store (without sending back to main)
      const { subscribe, set } = writable<ScopeSettings>(data.value);
      set(data.value);
      console.log('Received scope update from main process:', data.value);
    }
  });
}
