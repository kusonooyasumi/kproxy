<script>
	import { onMount } from 'svelte';
  
  // Make sure to use onMount and render deep-chat on load
	onMount(async () => {
		await import("deep-chat");
    isLoaded = true;
	});

  let isLoaded = false;
	const history = [
		{ role: "user", text: "Hey, how are you today?" },
		{ role: "ai", text: "I am doing very well!" }
	];
</script>

<main>
  {#if isLoaded}
    <!-- demo/textInput are examples of passing an object directly into a property -->
    <!-- history is an example of passing an object from script into a property -->
    <deep-chat
      style="border-radius: 7px; border: unset; background-color: transparent; width: 66vw; height: calc(100vh - 150px); padding-top: 10px"
      textInput={{"placeholder":{"text": "Welcome to the demo!"}}}
      history={history}
      connect={{url: 'https://api.deepseek.com/v1', stream: true}}
      messageStyles={{"default":{"user": {"bubble": {"backgroundColor": "#ff5252"}}}}}
      >
    </deep-chat>

  {/if}
</main>

<style>
  main {
    font-family: sans-serif;
    text-align: center;
    justify-content: center;
    display: grid;
  }
</style>