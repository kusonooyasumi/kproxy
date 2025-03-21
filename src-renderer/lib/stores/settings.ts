import { writable } from 'svelte/store';
import { browser } from '$app/environment';

// Provider type
export type Provider = 'openai' | 'deepseek' | 'gemini' | 'anthropic' | 'axonbox';

// Model configuration for each provider
export interface ModelConfig {
  models: string[];
  defaultModel: string;
}

// Provider model configurations
export interface ProviderModelConfigs {
  openai: ModelConfig;
  deepseek: ModelConfig;
  gemini: ModelConfig;
  anthropic: ModelConfig;
  axonbox: ModelConfig;
}

// API Keys interface
export interface ApiKeyStore {
  openai: string;
  deepseek: string;
  gemini: string;
  anthropic: string;
  axonbox: string;
}

// Default model configurations for each provider
export const defaultModelConfigs: ProviderModelConfigs = {
  openai: {
    models: ['gpt-4o', 'gpt-4-turbo', 'gpt-3.5-turbo'],
    defaultModel: 'gpt-4o'
  },
  deepseek: {
    models: ['deepseek-chat', 'deepseek-coder'],
    defaultModel: 'deepseek-chat'
  },
  gemini: {
    models: ['gemini-pro', 'gemini-pro-vision'],
    defaultModel: 'gemini-pro'
  },
  anthropic: {
    models: ['claude-3-sonnet-20240229', 'claude-3-opus-20240229', 'claude-3-haiku-20240307'],
    defaultModel: 'claude-3-sonnet-20240229'
  },
  axonbox: {
    models: ['mistral-nemo', 'qwen2.5-1.5b','qwen2.5-14b','axonbox-llama3.1', 'llama3.1', 'codestral', 'deepseek-coder-v2', 'gemma2'],
    defaultModel: 'qwen2.5-1.5b'
  }
};

// Default values
const defaultApiKeys: ApiKeyStore = {
  openai: '',
  deepseek: '',
  gemini: '',
  anthropic: '',
  axonbox: ''
};

// Create stores with default values
export const apiKeys = writable<ApiKeyStore>(defaultApiKeys);
export const currentProvider = writable<Provider>('openai');
export const modelConfigs = writable<ProviderModelConfigs>(defaultModelConfigs);
export const currentModel = writable<string>(defaultModelConfigs.openai.defaultModel);

// Load from localStorage if in browser
if (browser) {
  try {
    const savedApiKeys: ApiKeyStore = {
      openai: localStorage.getItem('openai_api_key') || '',
      deepseek: localStorage.getItem('deepseek_api_key') || '',
      gemini: localStorage.getItem('gemini_api_key') || '',
      anthropic: localStorage.getItem('anthropic_api_key') || '',
      axonbox: localStorage.getItem('axonbox_api_key') || ''
    };
    
    apiKeys.set(savedApiKeys);
    
    const savedProvider = localStorage.getItem('current_provider') as Provider;
    if (savedProvider) {
      currentProvider.set(savedProvider);
      
      // Load the saved model for this provider if available
      const savedModel = localStorage.getItem(`${savedProvider}_current_model`);
      if (savedModel) {
        currentModel.set(savedModel);
      } else {
        // Set default model for the provider
        currentModel.set(defaultModelConfigs[savedProvider].defaultModel);
      }
    }
    
    // Load saved model configurations if available
    const savedModelConfigs = localStorage.getItem('model_configs');
    if (savedModelConfigs) {
      try {
        const parsedConfigs = JSON.parse(savedModelConfigs) as ProviderModelConfigs;
        modelConfigs.set(parsedConfigs);
      } catch (e) {
        console.error('Failed to parse saved model configurations:', e);
      }
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
    
    // When provider changes, set the current model to the default or saved model for that provider
    const savedModel = localStorage.getItem(`${$provider}_current_model`);
    if (savedModel && defaultModelConfigs[$provider].models.includes(savedModel)) {
      currentModel.set(savedModel);
    } else {
      currentModel.set(defaultModelConfigs[$provider].defaultModel);
    }
  });
  
  currentModel.subscribe($model => {
    // Get current provider to save the model selection for this provider
    const $provider = localStorage.getItem('current_provider') as Provider;
    if ($provider) {
      localStorage.setItem(`${$provider}_current_model`, $model);
    }
  });
  
  modelConfigs.subscribe($configs => {
    localStorage.setItem('model_configs', JSON.stringify($configs));
  });
}
