import { writable, derived, get } from 'svelte/store';
import { browser } from '$app/environment';
import { v4 as uuidv4 } from 'uuid';
import { projectState } from './project';

// Message interface
export interface Message {
  role: 'user' | 'assistant' | 'system';
  content: string;
  timestamp: Date;
}

// Conversation interface
export interface Conversation {
  id: string;
  name: string;
  messages: Message[];
  createdAt: Date;
  updatedAt: Date;
}

// Chat store state interface
interface ChatState {
  conversations: Conversation[];
  activeConversationId: string | null;
}

// Create the chat store
const createChatStore = () => {
  // Initial state
  const initialState: ChatState = {
    conversations: [],
    activeConversationId: null
  };

  // Create the store
  const { subscribe, set, update } = writable<ChatState>(initialState);

  // Create derived store for the active conversation
  const activeConversation = derived({ subscribe }, ($state) => {
    if (!$state.activeConversationId) return null;
    return $state.conversations.find(conv => conv.id === $state.activeConversationId) || null;
  });

  // Create derived store for messages in the active conversation
  const messages = derived(activeConversation, ($activeConversation) => {
    return $activeConversation ? $activeConversation.messages : [];
  });

  // Load chat history from localStorage
  const loadFromLocalStorage = () => {
    if (!browser) return;
    
    try {
      const savedChats = localStorage.getItem('chat_conversations');
      if (savedChats) {
        const parsedState = JSON.parse(savedChats);
        
        // Convert timestamp strings to Date objects
        const conversations = parsedState.conversations.map((conv: any) => ({
          ...conv,
          createdAt: new Date(conv.createdAt),
          updatedAt: new Date(conv.updatedAt),
          messages: conv.messages.map((msg: any) => ({
            ...msg,
            timestamp: new Date(msg.timestamp)
          }))
        }));
        
        set({
          conversations,
          activeConversationId: parsedState.activeConversationId
        });
      }
    } catch (error) {
      console.error('Failed to load chat history:', error);
      // Initialize with an empty conversation if loading fails
      if (get({ subscribe }).conversations.length === 0) {
        createNewConversation();
      }
    }
  };

  // Save chat state to localStorage
  const saveToLocalStorage = (state: ChatState) => {
    if (!browser) return;
    localStorage.setItem('chat_conversations', JSON.stringify(state));
  };

  // Create a new conversation
  const createNewConversation = (name: string = `Chat ${get({ subscribe }).conversations.length + 1}`) => {
    const newConversation: Conversation = {
      id: uuidv4(),
      name,
      messages: [],
      createdAt: new Date(),
      updatedAt: new Date()
    };

    update(state => {
      const newState = {
        conversations: [...state.conversations, newConversation],
        activeConversationId: newConversation.id
      };
      saveToLocalStorage(newState);
      return newState;
    });

    // If a project is active, save the conversations to the project
    saveChatsToProject();

    return newConversation.id;
  };

  // Set the active conversation
  const setActiveConversation = (id: string) => {
    update(state => {
      const newState = { ...state, activeConversationId: id };
      saveToLocalStorage(newState);
      return newState;
    });
  };

  // Add a message to the active conversation
  const addMessage = (message: Message) => {
    update(state => {
      // If no conversation exists or is active, create one
      if (state.conversations.length === 0 || !state.activeConversationId) {
        const id = createNewConversation();
        state = {
          ...state,
          activeConversationId: id
        };
      }

      const updatedConversations = state.conversations.map(conv => {
        if (conv.id === state.activeConversationId) {
          return {
            ...conv,
            messages: [...conv.messages, message],
            updatedAt: new Date()
          };
        }
        return conv;
      });

      const newState = {
        ...state,
        conversations: updatedConversations
      };
      
      saveToLocalStorage(newState);
      
      // If a project is active, save the conversations to the project
      saveChatsToProject();
      
      return newState;
    });
  };

  // Clear messages in the active conversation
  const clearActiveConversation = () => {
    update(state => {
      if (!state.activeConversationId) return state;

      const updatedConversations = state.conversations.filter(
        conv => conv.id !== state.activeConversationId
      );

      const newActiveId = updatedConversations.length > 0 
        ? updatedConversations[0].id 
        : null;

      const newState = {
        conversations: updatedConversations,
        activeConversationId: newActiveId
      };
      
      saveToLocalStorage(newState);
      
      // If a project is active, save the conversations to the project
      saveChatsToProject();
      
      return newState;
    });
  };

  // Rename a conversation
  const renameConversation = (id: string, newName: string) => {
    update(state => {
      const updatedConversations = state.conversations.map(conv => {
        if (conv.id === id) {
          return {
            ...conv,
            name: newName,
            updatedAt: new Date()
          };
        }
        return conv;
      });

      const newState = {
        ...state,
        conversations: updatedConversations
      };
      
      saveToLocalStorage(newState);
      saveChatsToProject();
      
      return newState;
    });
  };

  // Save chats to project if a project is open
  const saveChatsToProject = () => {
    const project = get(projectState);
    if (!project) return;

    const state = get({ subscribe });
    
    // Convert conversations to ChatConversation format for the project
    const chatConversations = state.conversations.map(conv => ({
      id: conv.id,
      name: conv.name,
      messages: conv.messages.map(msg => ({
        ...msg,
        timestamp: msg.timestamp.toISOString()
      })),
      createdAt: conv.createdAt.toISOString(),
      updatedAt: conv.updatedAt.toISOString()
    }));

    // Update the project with the chats
    projectState.update({
      ...project,
      chats: chatConversations
    });

    // Save the project
    projectState.save().catch(err => {
      console.error('Failed to save chats to project:', err);
    });
  };

  // Load chats from project
  const loadChatsFromProject = (project: Project) => {
    if (!project.chats || project.chats.length === 0) return;

    try {
      // Convert the project chats to our internal format
      const conversations = project.chats.map(chat => ({
        id: chat.id,
        name: chat.name,
        messages: chat.messages.map(msg => ({
          ...msg,
          timestamp: new Date(msg.timestamp)
        })),
        createdAt: new Date(chat.createdAt),
        updatedAt: new Date(chat.updatedAt)
      }));

      // Set the active conversation to the most recently updated
      const sortedConversations = [...conversations].sort(
        (a, b) => b.updatedAt.getTime() - a.updatedAt.getTime()
      );
      
      const activeId = sortedConversations.length > 0 ? sortedConversations[0].id : null;

      const newState = {
        conversations,
        activeConversationId: activeId
      };

      set(newState);
      saveToLocalStorage(newState);
    } catch (error) {
      console.error('Failed to load chats from project:', error);
    }
  };

  // Initialize
  if (browser) {
    // Subscribe to project changes to load chats when a project is opened
    projectState.subscribe(project => {
      if (project) {
        loadChatsFromProject(project);
      }
    });

    // Load from localStorage on initial load
    loadFromLocalStorage();
  }

  return {
    subscribe,
    messages,
    activeConversation,
    createNewConversation,
    setActiveConversation,
    addMessage,
    clearActiveConversation,
    renameConversation,
    saveChatsToProject,
    loadChatsFromProject
  };
};

// Create and export the chat store
export const chatStore = createChatStore();

// For compatibility with existing code, export these as before
export const messages = chatStore.messages;

// Helper function to add a message (for compatibility)
export function addMessage(message: Message): void {
  chatStore.addMessage(message);
}

// Helper function to clear messages (for compatibility)
export function clearMessages(): void {
  chatStore.clearActiveConversation();
}
