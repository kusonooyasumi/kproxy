<script lang="ts">
  import { onMount } from 'svelte';
  import ChatTab from '$lib/components/ChatTab.svelte';
  
  // Check if running in Electron
  const isElectron = typeof window !== 'undefined' && window.electronAPI !== undefined;
  
  onMount(() => {
    console.log('Standalone Requests page mounted');
    
    // Set the page title
    document.title = 'KProxy - Chat';
    

  });
</script>

<div class="standalone-container">
  <ChatTab standalone={true} />
</div>

<style>
  :global(body) {
    background-color: #212121;
    color: #fff;
    height: calc(100vh - 40px);
    margin: 0;
    padding: 0;
    overflow: hidden;
  }
  
  .standalone-container {
    padding: 10px;
  }
  
</style>
