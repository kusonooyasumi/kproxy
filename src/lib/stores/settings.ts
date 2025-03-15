import { writable } from 'svelte/store';
import { browser } from '$app/environment';

// Provider type
export type Provider = 'openai' | 'deepseek' | 'gemini' | 'anthropic';

// API Keys interface
export interface ApiKeyStore {
  openai: string;
  deepseek: string;
  gemini: string;
  anthropic: string;
}

// Default values
const defaultApiKeys: ApiKeyStore = {
  openai: '',
  deepseek: '',
  gemini: '',
  anthropic: ''
};

// Create stores with default values
export const apiKeys = writable<ApiKeyStore>(defaultApiKeys);
export const currentProvider = writable<Provider>('openai');

// Load from localStorage if in browser
if (browser) {
  try {
    const savedApiKeys: ApiKeyStore = {
      openai: localStorage.getItem('openai_api_key') || '',
      deepseek: localStorage.getItem('deepseek_api_key') || '',
      gemini: localStorage.getItem('gemini_api_key') || '',
      anthropic: localStorage.getItem('anthropic_api_key') || ''
    };
    
    apiKeys.set(savedApiKeys);
    
    const savedProvider = localStorage.getItem('current_provider') as Provider;
    if (savedProvider) {
      currentProvider.set(savedProvider);
    }
  } catch (error) {
    console.error('Failed to load settings from localStorage:', error);
  }
}

// Subscribe to changes and save to localStorage
if (browser) {
  apiKeys.subscribe($apiKeys => {
    Object.entries($apiKeys).forEach(([provider, key]) => {
      localStorage.setItem(`${provider}_api_key`, key);
    });
  });
  
  currentProvider.subscribe($provider => {
    localStorage.setItem('current_provider', $provider);
  });
}