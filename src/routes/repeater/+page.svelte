<script lang="ts">
  import { onMount } from 'svelte';
  import RepeaterTab from '$lib/components/RepeaterTab.svelte';
  
  // Check if running in Electron
  const isElectron = typeof window !== 'undefined' && window.electronAPI !== undefined;
  
  onMount(() => {
    console.log('Standalone Repeater page mounted');
    
    // Set the page title
    document.title = 'KProxy - Repeater';
    
    // Ensure any parent page elements are removed
    // This is a more direct approach than trying to hide them after rendering
    document.querySelectorAll('.app-container, .sidebar, .tabs').forEach(elem => {
      if (elem.parentNode) {
        elem.parentNode.removeChild(elem);
      }
    });
  });
</script>

<div class="standalone-container">
  <RepeaterTab standalone={true} />
</div>

<style>
  :global(body) {
    background-color: #212121;
    color: #fff;
    height: 100vh;
    overflow: hidden;
    margin: 0;
    padding: 0;
  }
  
  .standalone-container {
    height: 100vh;
    width: 100vw;
  }
</style>
