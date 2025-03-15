<script lang="ts">
  import { onMount } from 'svelte';
  import DecodeEncodeTab from '$lib/components/DecodeEncodeTab.svelte';
  
  // Check if running in Electron
  const isElectron = typeof window !== 'undefined' && window.electronAPI !== undefined;
  
  onMount(() => {
    console.log('Standalone Requests page mounted');
    
    // Set the page title
    document.title = 'KProxy - Decode';
    

  });
</script>

<div class="standalone-container">
  <DecodeEncodeTab standalone={true} />
</div>

<style>
  :global(body) {
    background-color: #212121;
    color: #fff;
    height: calc(100vh - 70px);
    margin: 0;
    padding: 0;
  }
  
  .standalone-container {
    height: 100%;
    width: 100%;
    padding: 10px;
  }

  ::-webkit-scrollbar {
    width: 8px;
    height: 8px;
  }

  ::-webkit-scrollbar-track {
    background: #1e1e1e;
  }

  ::-webkit-scrollbar-thumb {
    background: #444;
    border-radius: 4px;
  }

  ::-webkit-scrollbar-thumb:hover {
    background: #555;
  }
</style>
