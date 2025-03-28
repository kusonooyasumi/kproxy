/// <reference types="svelte" />
/// <reference types="@sveltejs/kit" />
/// <reference types="vite/client" />

import type { ExposeInRendererTypes, ProxyAPI, ProjectAPI, FfufAPI, TabAPI } from './preload.ts';

interface ElectronAPI extends ExposeInRendererTypes {
  proxy: ProxyAPI;
  project: ProjectAPI;
  ffuf: FfufAPI;
  tab: TabAPI;
}

declare global {
  // Lets typescript know about exposed preload functions
  interface Window {
    electronAPI: ElectronAPI;
    setTitleBarColors: (backgroundColor: string, textColor: string) => void;
  }

  // See https://kit.svelte.dev/docs/types#app
  // for information about these interfaces
  namespace App {
    interface Error {}
    // interface Locals {}
    // interface PageData {}
    // interface PageState {}
    // interface Platform {}
  }
}

export {};
