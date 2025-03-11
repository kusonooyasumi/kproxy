interface ElectronAPI {

    invoke(channel: string, data?: any): Promise<any>;
  
    on(channel: string, callback: (...args: any[]) => void): void;
  
    removeAllListeners(channel: string): void;
  
  }
  
  
  interface Window {
  
    electron: ElectronAPI;
  
  }