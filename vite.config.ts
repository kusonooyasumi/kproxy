import tailwindcss from "@tailwindcss/vite";
import { sveltekit } from '@sveltejs/kit/vite';
import { defineConfig } from 'vite';

export default defineConfig({
	plugins: [sveltekit(), tailwindcss()],
	optimizeDeps: {
        exclude: ["svelte-codemirror-editor", "codemirror", "@codemirror/language-javascript" /* ... */],
    }
});
