/**
 * @type {import('electron-builder').Configuration}
 * @see https://www.electron.build/configuration/configuration
 */
export default {
  appId: "com.kproxy.app",
  productName: "KProxy",
  copyright: "Copyright © " + new Date().getFullYear(),
  
  // Where to find the built SvelteKit app
  directories: {
    output: "dist",
    buildResources: "resources"
  },
  
  // Files to include in the build
  files: [
    "build/**/*",
    "electron/**/*"
  ],
  
  // Configure build targets for each platform
  mac: {
    target: ["dmg"],
    category: "public.app-category.utilities"
  },
  win: {
    target: ["nsis"],
    artifactName: "${productName}-Setup-${version}.${ext}"
  },
  linux: {
    target: ["AppImage", "deb"],
    category: "Utility"
  },
  
  // Publish configuration (for auto-updates, if needed later)
  publish: {
    provider: "github",
    owner: "kusonooyasumi", // Replace with your actual GitHub username
    repo: "kproxy", // Replace with your actual repo name
    releaseType: "release"
  }
};
