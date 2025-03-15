import { writable } from 'svelte/store';
import { browser } from '$app/environment';

// Message interface
export interface Message {
  role: 'user' | 'assistant' | 'system';
  content: string;
  timestamp: Date;
}

// Create the messages store
export const messages = writable<Message[]>([]);

// Load chat history from localStorage
if (browser) {
  try {
    const savedMessages = localStorage.getItem('chat_history');
    if (savedMessages) {
      const parsedMessages = JSON.parse(savedMessages).map((msg: any) => ({
        ...msg,
        timestamp: new Date(msg.timestamp)
      }));
      messages.set(parsedMessages);
    }
  } catch (error) {
    console.error('Failed to load chat history:', error);
  }
}

// Save messages to localStorage when they change
if (browser) {
  messages.subscribe($messages => {
    localStorage.setItem('chat_history', JSON.stringify($messages));
  });
}

// Helper function to add a message
export function addMessage(message: Message): void {
  messages.update(msgs => [...msgs, message]);
}

// Helper function to clear messages
export function clearMessages(): void {
  messages.set([]);
}