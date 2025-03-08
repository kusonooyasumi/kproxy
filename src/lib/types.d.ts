declare global {
  interface Window {
    electronAPI?: {
      send: (channel: string, data: any) => void;
      receive: (channel: string, func: (data: any) => void) => void;
      project: {
        new: () => Promise<void>;
        open: () => Promise<{ success: boolean; project?: Project; error?: string }>;
        save: (project: Project) => Promise<{ success: boolean; path?: string; error?: string }>;
        saveAs: (project: Project) => Promise<{ success: boolean; path?: string; error?: string }>;
        getCurrentProject: () => Promise<Project | null>;
      };
      proxy: {
        start: (options?: { port?: number }) => Promise<{ isRunning: boolean; port: number; certificatePath: string }>;
        stop: () => Promise<{ isRunning: boolean; port: number; certificatePath: string }>;
        getStatus: () => Promise<{ isRunning: boolean; port: number; certificatePath: string }>;
        getSettings: () => Promise<{ port: number; autoStart: boolean }>;
        updateSettings: (settings: { port?: number; autoStart?: boolean }) => Promise<{ port: number; autoStart: boolean }>;
        getRequests: () => Promise<Array<CapturedRequest>>;
        clearRequests: () => Promise<{ success: boolean }>;
        exportCertificate: () => Promise<{ success: boolean; certPath?: string; message?: string; error?: string; canceled?: boolean }>;
        getCertificateInstructions: () => Promise<{ windows: string; macos: string; firefox: string; chrome: string }>;
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

  // Interface for captured HTTP/HTTPS requests
  interface CapturedRequest {
    id: number;
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

export {};
