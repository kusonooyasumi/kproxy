<script lang="ts">
  import { onMount, onDestroy } from 'svelte';
  
  // Props that can be passed to the component
  export let standalone = false; // Whether the component is running in standalone mode (new window)
  
  // Initialize the UI after component is mounted
  onMount(() => {
    console.log(`DecodeEncodeTab mounted, standalone: ${standalone}`);
    
    // Hide parent sidebar and tabs if in standalone mode
    if (standalone) {
      // This is a workaround to hide the sidebar and tabs when in standalone mode
      const sidebar = document.querySelector('.sidebar') as HTMLElement;
      const tabs = document.querySelector('.tabs') as HTMLElement;
      
      if (sidebar) sidebar.style.display = 'none';
      if (tabs) tabs.style.display = 'none';
    }
  });
</script>

<!-- DecodeEncode Tab Content -->
<div class="decode-encode-container">
  <iframe 
    src="https://gchq.github.io/CyberChef" 
    title="GCHQ CyberChef" 
    class="cyberchef-iframe"
    allow="clipboard-read; clipboard-write"
  ></iframe>
</div>

<style>
  .decode-encode-container {
    display: flex;
    flex-direction: column;
    height: 100%;
    width: 100%;
    background-color: transparent;
  }
  
  .cyberchef-iframe {
    width: 100%;
    height: 100%;
    border: none;
    border-radius: 7px;
    background-color: #fff;
    box-shadow: 0 4px 8px rgba(0, 0, 0, 0.3);
  }
</style>
