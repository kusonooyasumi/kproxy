import { writable } from 'svelte/store';

// Define type for scope settings
export interface ScopeSettings {
  inScope: string[];
  outOfScope: string[];
}

// Create a writable store for scope settings that can be imported in other components
export const scopeStore = writable<ScopeSettings>({
  inScope: ['example.com', '*.example.org'],
  outOfScope: ['admin.example.com']
});
