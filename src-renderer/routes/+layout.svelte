<script lang="ts">
	import '../app.css';
	import Devtools from '$lib/Devtools.svelte';
	import { preferredTheme } from '$lib/preferredTheme.svelte';

	let { children } = $props();

	$effect(() => {
		window.setTitleBarColors('#2a2a2a', '#fff');
	});
</script>

<div id='titlebar' class='shrink-0 bg-gradient-to-r from-gray-100 to-gray-200 flex text-slate-950 dark:from-[#2a2a2a] dark:to-[#2a2a2a] dark:text-slate-50'>
	<div class='px-4 select-none grow text-xs flex items-center' style='-webkit-app-region: drag;'>Kproxy</div>
	{#if import.meta.env.DEV}
		<Devtools/>
	{/if}
</div>
<div class='overflow-auto h-full bg-gradient-to-br from-white to-zinc-50 text-slate-950 dark:from-zinc-800 dark:to-zinc-900 dark:text-slate-50'>
	{@render children()}
</div>

<style>
	#titlebar {
		margin-right: env(titlebar-area-x);
		width: env(titlebar-area-width);
		height: env(titlebar-area-height);
	}
</style>