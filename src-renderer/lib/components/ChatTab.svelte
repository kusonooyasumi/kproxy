<script lang="ts">
  import { onMount } from 'svelte';
  import { fade } from 'svelte/transition';
  import { marked } from 'marked';
  import type { MarkedOptions } from 'marked';
  import hljs from 'highlight.js';
  import 'highlight.js/styles/atom-one-dark.css';
  import { browser } from '$app/environment';
  import { clickOutside } from '$lib/actions/clickOutside';
  
  // Import our stores
  import { apiKeys, currentProvider, currentModel, modelConfigs, defaultModelConfigs, type Provider } from '$lib/stores/settings';
  import { chatStore, type Message, type Conversation } from '$lib/stores/chat';
  import { projectState } from '$lib/stores/project';

  // Props
  export let standalone = false;

  // Local state
  let input = '';
  let isLoading = false;
  let chatContainer: HTMLElement | null = null;
  let isSettingsOpen = false;
  let newChatName = '';
  let isEditingTitle = false;
  let activeConversation: Conversation | null = null;
  let isSidebarOpen = true;
  let editingConversationId: string | null = null;
  let editingConversationName = '';

  // Define a proper type for the highlight function
  type HighlightFunction = (code: string, lang: string) => string;

  // Create properly typed options
  const markedOptions: MarkedOptions & { highlight?: HighlightFunction } = {
    highlight: function(code: string, lang: string) {
      if (lang && hljs.getLanguage(lang)) {
        return hljs.highlight(code, { language: lang }).value;
      }
      return hljs.highlightAuto(code).value;
    },
    breaks: true
  };

  // Set the options
  marked.setOptions(markedOptions);

  // Subscribe to get the active conversation
  chatStore.activeConversation.subscribe((conversation) => {
    activeConversation = conversation;
  });

  onMount(() => {
    // Initialize chat container ref
    if (browser) {
      // If no active conversation, create one
      if (!activeConversation && $chatStore.conversations.length === 0) {
        chatStore.createNewConversation();
      }
    }
  });

  // Submit message to the selected AI provider
  async function handleSubmit(): Promise<void> {
    if (!input.trim() || isLoading) return;
    
    // Check if API key is set
    if (!$apiKeys[$currentProvider]) {
      chatStore.addMessage({
        role: 'system',
        content: `Error: No API key set for ${$currentProvider}. Please configure your API key in settings.`,
        timestamp: new Date()
      });
      return;
    }

    const userMessage: Message = {
      role: 'user',
      content: input,
      timestamp: new Date()
    };
    
    chatStore.addMessage(userMessage);
    const userInput = input;
    input = '';
    isLoading = true;
    
    try {
      // Get chat history to send
      const history = activeConversation?.messages.slice(0, -1) || [];
      
      // Send request to backend
      const response = await fetch('/api/chat', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          message: userInput,
          provider: $currentProvider,
          apiKey: $apiKeys[$currentProvider],
          model: $currentModel,
          history: history
        })
      });
      
      if (!response.ok) {
        throw new Error(`API request failed with status ${response.status}`);
      }
      
      const data = await response.json();
      
      const assistantMessage: Message = {
        role: 'assistant',
        content: data.response,
        timestamp: new Date()
      };
      
      chatStore.addMessage(assistantMessage);
      
      // Scroll to bottom
      setTimeout(() => {
        if (chatContainer) {
          chatContainer.scrollTop = chatContainer.scrollHeight;
        }
      }, 100);
      
    } catch (error: unknown) {
      console.error('Error calling AI API:', error);
      chatStore.addMessage({
        role: 'system',
        content: `Error: Failed to get response from ${$currentProvider}. ${error instanceof Error ? error.message : 'Unknown error'}`,
        timestamp: new Date()
      });
    } finally {
      isLoading = false;
    }
  }

  // Create a new conversation
  function createNewChat(): void {
    const name = newChatName.trim() || `Chat ${$chatStore.conversations.length + 1}`;
    chatStore.createNewConversation(name);
    newChatName = '';
  }

  // Start editing a conversation title
  function startEditConversation(id: string, name: string): void {
    editingConversationId = id;
    editingConversationName = name;
  }

  // Save conversation title edit
  function saveConversationEdit(): void {
    if (editingConversationId && editingConversationName.trim()) {
      chatStore.renameConversation(editingConversationId, editingConversationName.trim());
    }
    editingConversationId = null;
  }

  // Cancel conversation title edit
  function cancelConversationEdit(): void {
    editingConversationId = null;
  }

  // Delete the current conversation
  function deleteCurrentChat(): void {
    chatStore.clearActiveConversation();
  }

  // Toggle sidebar visibility
  function toggleSidebar(): void {
    isSidebarOpen = !isSidebarOpen;
  }

  // Toggle settings panel
  function toggleSettings(): void {
    isSettingsOpen = !isSettingsOpen;
  }

  // Update API key
  function updateApiKey(provider: Provider, value: string): void {
    apiKeys.update(keys => ({
      ...keys,
      [provider]: value
    }));
  }

  // Change the current provider
  function changeProvider(provider: Provider): void {
    currentProvider.set(provider);
  }
  
  // Change the current model
  function changeModel(newModel: string): void {
    currentModel.set(newModel);
  }

  // Handle key press events
  function handleKeydown(event: KeyboardEvent): void {
    if (event.key === 'Enter' && !event.shiftKey) {
      event.preventDefault();
      handleSubmit();
    }
  }

  // Format timestamp
  function formatTime(date: Date): string {
    return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  }

  // Format date
  function formatDate(date: Date): string {
    return date.toLocaleDateString([], { month: 'short', day: 'numeric' });
  }

  // Process message content with markdown
  function processContent(content: string): string {
    return marked(content) as string;
  }

  // Handle input change for API keys
  function handleInputChange(event: Event, provider: Provider): void {
    const target = event.target as HTMLInputElement;
    if (target) {
      updateApiKey(provider, target.value);
    }
  }

  // Select a conversation
  function selectConversation(id: string): void {
    chatStore.setActiveConversation(id);
  }

  // Get truncated preview of last message in a conversation
  function getConversationPreview(conversation: Conversation): string {
    if (conversation.messages.length === 0) return "No messages";
    const lastMessage = conversation.messages[conversation.messages.length - 1];
    const content = lastMessage.content;
    return content.length > 40 ? content.substring(0, 40) + "..." : content;
  }

  // Auto-scroll when messages change
  $: if (activeConversation?.messages && chatContainer && browser) {
    setTimeout(() => {
      if (chatContainer) {
        chatContainer.scrollTop = chatContainer.scrollHeight;
      }
    }, 0);
  }
</script>

<div class="chat-terminal {standalone ? 'standalone' : ''}">
  <div class="terminal-layout {isSidebarOpen ? 'with-sidebar' : 'sidebar-collapsed'}">
    <div class="sidebar" class:hidden={!isSidebarOpen}>
      <div class="sidebar-header">
        <h3>Conversations</h3>
        <button class="new-chat-btn" on:click={createNewChat}>
          <span class="icon">+</span>
          <span class="label">New Chat</span>
        </button>
      </div>
      
      <div class="conversations-list">
        {#if $chatStore.conversations.length === 0}
          <div class="empty-state">No conversations yet</div>
        {:else}
          {#each $chatStore.conversations as conversation (conversation.id)}
            <div 
              class="conversation-item {$chatStore.activeConversationId === conversation.id ? 'active' : ''}"
              on:click={() => selectConversation(conversation.id)}
            >
              {#if editingConversationId === conversation.id}
                <!-- svelte-ignore a11y-click-events-have-key-events -->
                <div class="edit-title-container" use:clickOutside={saveConversationEdit}>
                  <input 
                    type="text" 
                    bind:value={editingConversationName} 
                    on:keydown={(e) => e.key === 'Enter' && saveConversationEdit()}
                    on:blur={saveConversationEdit}
                    autofocus
                  />
                </div>
              {:else}
                <div class="conversation-info">
                  <div class="conversation-title" on:dblclick={() => startEditConversation(conversation.id, conversation.name)}>
                    {conversation.name}
                  </div>
                  <div class="conversation-preview">
                    {getConversationPreview(conversation)}
                  </div>
                  <div class="conversation-date">
                    {formatDate(conversation.updatedAt)}
                  </div>
                </div>
              {/if}
            </div>
          {/each}
        {/if}
      </div>
    </div>
    
    <div class="chat-content">
      <div class="terminal-header">
        <div class="header-left">
          <button class="toggle-sidebar-btn" on:click={toggleSidebar}>
            {isSidebarOpen ? '◀' : '▶'}
          </button>
          <div class="terminal-title">
            {activeConversation ? activeConversation.name : 'Start a new chat'} - {$currentProvider.toUpperCase()} ({$currentModel})
          </div>
        </div>
        <div class="terminal-controls">
          <button class="terminal-btn" on:click={toggleSettings}>⚙️</button>
          <button class="terminal-btn" on:click={deleteCurrentChat}>🗑️</button>
        </div>
      </div>
      
      {#if isSettingsOpen}
        <div class="settings-panel" transition:fade={{ duration: 150 }}>
          <h3>API Settings</h3>
          <div class="provider-selector">
            {#each Object.keys($apiKeys) as provider}
              <button 
                class="provider-btn {$currentProvider === provider ? 'active' : ''}" 
                on:click={() => changeProvider(provider as Provider)}
              >
                {provider}
              </button>
            {/each}
          </div>
          
          <div class="model-selector">
            <label for="model-select">Model:</label>
            <select 
              id="model-select" 
              bind:value={$currentModel}
              on:change={(e) => {
                const select = e.target as HTMLSelectElement;
                changeModel(select.value);
              }}
            >
              {#if $modelConfigs && $modelConfigs[$currentProvider]}
                {#each $modelConfigs[$currentProvider].models as model}
                  <option value={model}>{model}</option>
                {/each}
              {:else}
                <!-- Fallback to default models if modelConfigs is missing -->
                {#each defaultModelConfigs[$currentProvider].models as model}
                  <option value={model}>{model}</option>
                {/each}
              {/if}
            </select>
          </div>
          
          <div class="api-key-inputs">
            {#each Object.entries($apiKeys) as [provider, key]}
              <div class="api-key-input">
                <label for="{provider}-key">{provider} API Key:</label>
                <input 
                  type="password" 
                  id="{provider}-key" 
                  value={key} 
                  on:change={(e) => handleInputChange(e, provider as Provider)}
                  placeholder="Enter your API key"
                />
              </div>
            {/each}
          </div>
        </div>
      {/if}
      
      <div class="chat-container" bind:this={chatContainer}>
        {#if !activeConversation || activeConversation.messages.length === 0}
          <div class="welcome-message">
            <p>Welcome to the AI Chat Terminal!</p>
            <p>Choose your AI provider and start chatting.</p>
          </div>
        {:else}
          {#each activeConversation.messages as message, i (i)}
            <div class="message {message.role}">
              <div class="message-header">
                <span class="message-role">{message.role === 'assistant' ? $currentProvider : message.role}</span>
                <span class="message-time">{formatTime(message.timestamp)}</span>
              </div>
              <div class="message-content">
                {@html processContent(message.content)}
              </div>
            </div>
          {/each}
        {/if}
        
        {#if isLoading}
          <div class="loading-indicator">
            <span class="dot"></span>
            <span class="dot"></span>
            <span class="dot"></span>
          </div>
        {/if}
      </div>
      
      <div class="input-container">
        <textarea 
          bind:value={input} 
          on:keydown={handleKeydown} 
          placeholder="Type your message here... (Shift+Enter for new line)"
          rows="1"
          disabled={isLoading}
        ></textarea>
        <button class="send-btn" on:click={handleSubmit} disabled={isLoading || !input.trim()}>
          Send
        </button>
      </div>
    </div>
  </div>
</div>

<style>
  .chat-terminal {
    display: flex;
    flex-direction: column;
    color: #f0f0f0;
    border-radius: 4px;
    height: 100%;
    width: 100%;
    overflow: hidden;
    font-family: 'Fira Code', 'Cascadia Code', 'Consolas', monospace;
  }
  
  .chat-terminal.standalone {
    height: calc(100vh - 60px);
    border-radius: 0;
  }
  
  .terminal-layout {
    display: flex;
    height: 100%;
    width: 100%;
  }
  
  .terminal-layout.with-sidebar .chat-content {
    width: calc(100% - 280px);
  }
  
  .terminal-layout.sidebar-collapsed .chat-content {
    width: 100%;
  }
  
  .sidebar {
    width: 280px;
    background-color: #1e1e1e;
    display: flex;
    flex-direction: column;
    height: 100%;
    transition: width 0.2s ease;
  }
  
  .sidebar.hidden {
    width: 0;
    overflow: hidden;
  }
  
  .sidebar-header {
    padding: 15px;
    border-bottom: 1px solid #333;
    display: flex;
    justify-content: space-between;
    align-items: center;
  }
  
  .sidebar-header h3 {
    margin: 0;
    font-size: 16px;
    color: #fff;
  }
  
  .new-chat-btn {
    background-color: #333;
    border: none;
    color: #fff;
    border-radius: 4px;
    padding: 5px 10px;
    cursor: pointer;
    display: flex;
    align-items: center;
    gap: 5px;
    border: 1px solid #ddd;
  }
  
  .new-chat-btn:hover {
    background-color: #444;
  }
  
  .conversations-list {
    flex: 1;
    overflow-y: auto;
    padding: 10px;
  }
  
  .conversation-item {
    padding: 10px;
    border-radius: 4px;
    margin-bottom: 8px;
    cursor: pointer;
    transition: background-color 0.2s;
    border: 1px solid #ddd;
  }
  
  .conversation-item:hover {
    background-color: #2a2a2a;
  }
  
  .conversation-item.active {
    background-color: #333;
  }
  
  .conversation-info {
    display: flex;
    flex-direction: column;
    gap: 5px;
  }
  
  .conversation-title {
    font-weight: bold;
    color: #fff;
  }
  
  .conversation-preview {
    font-size: 12px;
    color: #aaa;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }
  
  .conversation-date {
    font-size: 10px;
    color: #666;
  }
  
  .edit-title-container {
    width: 100%;
  }
  
  .edit-title-container input {
    width: 100%;
    background-color: #333;
    border: 1px solid #555;
    color: #fff;
    padding: 5px;
    font-size: 13px;
    border-radius: 3px;
  }
  
  .empty-state {
    text-align: center;
    padding: 30px 0;
    color: #666;
    font-style: italic;
  }
  
  .chat-content {
    flex: 1;
    display: flex;
    flex-direction: column;
    height: 100%;
  }
  
  .header-left {
    display: flex;
    align-items: center;
    gap: 10px;
  }
  
  .toggle-sidebar-btn {
    background: none;
    border: none;
    color: #ccc;
    font-size: 14px;
    cursor: pointer;
    padding: 4px 8px;
    border-radius: 4px;
  }
  
  .toggle-sidebar-btn:hover {
    background-color: #333;
  }

  .terminal-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    background-color: #1a1a1a;
    padding: 11px 15px;
    border: 1px solid #ddd;
    border-radius: 4px;
  }

  .terminal-title {
    font-weight: bold;
    color: white;
  }

  .terminal-controls {
    display: flex;
    gap: 8px;
  }

  .terminal-btn {
    background: none;
    border: none;
    color: #ccc;
    cursor: pointer;
    font-size: 16px;
    padding: 2px 6px;
    border-radius: 4px;
  }

  .terminal-btn:hover {
    background-color: #444;
  }

  .settings-panel {
    background-color: #252525;
    padding: 15px;
    border-bottom: 1px solid #444;
  }

  .settings-panel h3 {
    margin-top: 0;
    margin-bottom: 10px;
    color: #ff5252;
  }

  .provider-selector {
    display: flex;
    gap: 10px;
    margin-bottom: 15px;
    flex-wrap: wrap;
  }

  .provider-btn {
    background-color: #333;
    border: 1px solid #555;
    color: #ccc;
    padding: 5px 10px;
    border-radius: 4px;
    cursor: pointer;
    text-transform: capitalize;
  }

  .provider-btn.active {
    color: #fff;
    border-color: #ff5252;
  }
  
  .model-selector {
    margin-bottom: 15px;
    display: flex;
    flex-direction: column;
    gap: 5px;
  }
  
  .model-selector label {
    font-size: 14px;
    color: #aaa;
  }
  
  .model-selector select {
    background-color: #333;
    border: 1px solid #555;
    color: #fff;
    padding: 8px 10px;
    border-radius: 4px;
    cursor: pointer;
  }

  .api-key-inputs {
    display: flex;
    flex-direction: column;
    gap: 10px;
  }

  .api-key-input {
    display: flex;
    flex-direction: column;
    gap: 5px;
  }

  .api-key-input label {
    font-size: 14px;
    color: #aaa;
    text-transform: capitalize;
  }

  .api-key-input input {
    background-color: #333;
    border: 1px solid #555;
    color: #fff;
    padding: 8px 10px;
    border-radius: 4px;
    font-family: inherit;
  }

  .chat-container {
    flex: 1;
    padding: 15px;
    overflow-y: auto;
    display: flex;
    flex-direction: column;
    gap: 15px;
    border-radius: 4px;
    margin-top: 10px;
  }

  .welcome-message {
    color: #888;
    text-align: center;
    margin: auto 0;
  }

  .message {
    display: flex;
    flex-direction: column;
    max-width: 100%;
    animation: fadeIn 0.3s ease-out;
  }

  .message-header {
    display: flex;
    justify-content: space-between;
    margin-bottom: 5px;
    font-size: 12px;
  }

  .message-role {
    color: #ff5252;
    font-weight: bold;
    text-transform: capitalize;
  }

  .message-time {
    color: #888;
  }

  .message-content {
    line-height: 1.5;
    white-space: pre-wrap;
    overflow-wrap: break-word;
  }

  .message.user .message-role {
    color: white;
  }

  .message.system .message-role {
    color: white;
  }

  .message-content :global(pre) {
    background-color: #2a2a2a;
    padding: 10px;
    border-radius: 4px;
    overflow-x: auto;
    margin: 10px 0;
  }

  .message-content :global(code) {
    font-family: 'Fira Code', 'Cascadia Code', 'Consolas', monospace;
  }

  .message-content :global(p) {
    margin: 0 0 10px 0;
  }

  .loading-indicator {
    display: flex;
    gap: 5px;
    justify-content: center;
    margin: 10px 0;
  }

  .dot {
    width: 8px;
    height: 8px;
    background-color: #ff5252;
    border-radius: 50%;
    animation: pulse 1.5s infinite;
  }

  .dot:nth-child(2) {
    animation-delay: 0.3s;
  }

  .dot:nth-child(3) {
    animation-delay: 0.6s;
  }

  .input-container {
    display: flex;
    align-items: flex-start;
    padding: 10px 15px;
    background-color: #1a1a1a;
    border: 1px solid #ddd;
    max-height: 250px;
    border-radius: 4px;
  }

  textarea {
    flex: 1;
    background-color: #2a2a2a;
    border: 1px solid #444;
    color: #fff;
    padding: 8px 8px;
    font-family: inherit;
    font-size: 14px;
    outline: none;
    overflow-y: auto;
    max-height: 220px;
    min-height: 40px;
    border-radius: 4px;
  }

  .send-btn {
    color: white;
    border: 1px solid #ff5252;
    border-radius: 4px;
    padding: 5px 10px;
    margin-left: 10px;
    cursor: pointer;
    font-family: inherit;
  }

  .send-btn:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }

  .send-btn:not(:disabled):hover {
    background-color: #ff5252;
  }

  @keyframes pulse {
    0%, 100% {
      opacity: 0.5;
      transform: scale(0.8);
    }
    50% {
      opacity: 1;
      transform: scale(1);
    }
  }

  @keyframes fadeIn {
    from {
      opacity: 0;
      transform: translateY(5px);
    }
    to {
      opacity: 1;
      transform: translateY(0);
    }
  }
</style>
