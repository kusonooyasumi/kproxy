export declare global {
  interface Window {
    electronAPI?: {
      // Core functions from exposeInRenderer
      toggleDevTools: () => void;
      setTitleBarColors: (bgColor: string, iconColor: string) => void;
      receive: (channel: string, func: (...args: any[]) => void) => void;
      openTabInNewWindow: (tabName: string) => void;
      startWithoutProject: () => void;
      
      // FFuf API
      ffuf: {
        run: (args: string[]) => Promise<string>;
        stop: () => Promise<string>;
      };
      
      // Project API
      project: {
        initialize: (name?: string) => Promise<any>;
        getCurrent: () => Promise<any>;
        getPath: () => Promise<string | null>;
        load: (path: string) => Promise<{ success: boolean; project?: Project; error?: string; canceled?: boolean }>;
        save: (projectData: Project) => Promise<{ success: boolean; path?: string; error?: string; canceled?: boolean }>;
        saveAs: (projectData: Project) => Promise<{ success: boolean; path?: string; error?: string; canceled?: boolean }>;
        open: () => Promise<{ success: boolean; project?: Project; error?: string; canceled?: boolean }>;
        update: (projectData: Project) => Promise<any>;
        hasUnsavedChanges: () => Promise<boolean>;
        getProjectsDirectory: () => Promise<string>;
        // Legacy method for backwards compatibility
        new: () => Promise<void>;
      };
      
      // Proxy API
      proxy: {
        getStatus: () => Promise<{ isRunning: boolean; port: number; certificatePath: string }>;
        getSettings: () => Promise<{ port: number; autoStart: boolean; customHeaders?: Record<string, string> }>;
        start: (settings: { port: number }) => Promise<{ isRunning: boolean; port: number; certificatePath: string }>;
        stop: () => Promise<{ isRunning: boolean; port: number; certificatePath: string }>;
        updateSettings: (settings: { port: number; autoStart: boolean; customHeaders?: Record<string, string> }) => Promise<{ port: number; autoStart: boolean; customHeaders?: Record<string, string> }>;
        exportCertificate: () => Promise<{ success: boolean; message?: string; path?: string; error?: string; canceled?: boolean }>;
        exportCaCertificate: () => Promise<{ success: boolean; message?: string; certPath?: string; error?: string; canceled?: boolean }>;
        getCertificateInstructions: () => Promise<{ windows: string; macos: string; firefox: string; chrome: string }>;
        getCustomHeaders: () => Promise<Record<string, string>>;
        updateCustomHeaders: (headers: Record<string, string>) => Promise<Record<string, string>>;
        getRequests: () => Promise<Array<CapturedRequest>>;
        clearRequests: () => Promise<{ success: boolean }>;
        getScopeSettings: () => Promise<{ inScope: string[]; outOfScope: string[] }>;
        saveScopeSettings: (settings: { inScope: string[]; outOfScope: string[] }) => Promise<{ success: boolean }>;
        sendToRepeater: (request: CapturedRequest) => Promise<{ success: boolean; error?: string }>;
        sendRequest: (request: CapturedRequest) => Promise<{ 
          status: number; 
          headers: Record<string, string>; 
          body: string; 
          time: number; 
          size?: number;
          error?: string;
        }>;
        sendRepeaterRequests: (requests: CapturedRequest[]) => Promise<{ 
          success: boolean; 
          error?: string;
        }>;
      };
      
      // Tab API
      tab: {
        openInNewWindow: (tabName: string) => void;
        sendToRepeater: (request: CapturedRequest) => Promise<{ success: boolean; error?: string }>;
        sendRequest: (request: CapturedRequest) => Promise<any>;
      };
      
      // Scope API
      scope: {
        getSettings: () => Promise<{ inScope: string[]; outOfScope: string[] }>;
        saveSettings: (settings: { inScope: string[]; outOfScope: string[] }) => Promise<{ success: boolean }>;
      };
    };
    
    appInfo?: {
      getVersion: () => string;
    };
  }

  // Project data interface
  interface Project {
    name: string;
    path?: string;
    lastSaved?: string;
    requests: CapturedRequest[];
    repeaterRequests?: CapturedRequest[];
    proxiedRequests?: CapturedRequest[];
    chats?: ChatConversation[];
    scopes?: {
      inScope: string[];
      outOfScope: string[];
    };
    settings?: {
      proxy?: {
        port: number;
        autoStart: boolean;
      };
    };
  }

  // Interface for chat conversations
  interface ChatConversation {
    id: string;
    name: string;
    messages: Message[];
    createdAt: string;
    updatedAt: string;
  }

  // Chat message interface
  interface Message {
    role: 'user' | 'assistant' | 'system';
    content: string;
    timestamp: Date | string;
  }

  // Interface for captured HTTP/HTTPS requests
  interface CapturedRequest {
    id?: number;
    host: string;
    method: string;
    path: string;
    query?: string;
    protocol: 'http' | 'https';
    headers: Record<string, string>;
    body?: string;
    timestamp: string;
    status: number;
    responseHeaders?: Record<string, string>;
    responseBody?: string;
    responseLength: number;
    responseTime: number;
    error?: string;
  }
}

export { CapturedRequest };
