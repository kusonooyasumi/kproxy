<script lang="ts">
	import '../app.css';
	import Devtools from '$lib/Devtools.svelte';
	import { preferredTheme } from '$lib/preferredTheme.svelte';

	let { children } = $props();

	$effect(() => {
		window.setTitleBarColors('#212121', '#fff');
	});
</script>

<div id='titlebar' class='shrink-0 flex'>
	<div class='px-4 select-none grow text-xs flex items-center' style='-webkit-app-region: drag;'>Kproxy</div>
	{#if import.meta.env.DEV}
		<Devtools/>
	{/if}
</div>
<div class='overflow-auto h-full'>
	{@render children()}
</div>

<style>
	#titlebar {
		margin-right: env(titlebar-area-x);
		width: env(titlebar-area-width);
		height: env(titlebar-area-height);
	}
</style>
