import { json } from '@sveltejs/kit';
import type { RequestHandler } from '@sveltejs/kit';

// Define interfaces for the request body
interface ChatRequestBody {
  message: string;
  provider: 'openai' | 'deepseek' | 'gemini' | 'anthropic' | 'axonbox';
  apiKey: string;
  history: ChatMessage[];
  model?: string; // Optional model parameter
}

interface ChatMessage {
  role: 'user' | 'assistant' | 'system';
  content: string;
  timestamp?: Date;
}

// OpenAI and Deepseek message format
interface OpenAIMessage {
  role: string;
  content: string;
}

// Gemini message format
interface GeminiContent {
  role: 'user' | 'model';
  parts: { text: string }[];
}

// Anthropic message format
interface AnthropicMessage {
  role: 'user' | 'assistant';
  content: string;
}

// Axonbox message format
interface AxonboxMessage {
  role: 'user' | 'assistant' | 'tool' | 'system';
  content: string;
  timestamp: string;
}

export const POST: RequestHandler = async ({ request }) => {
  try {
    const { message, provider, apiKey, history, model } = await request.json() as ChatRequestBody;
    
    if (!message || !provider || !apiKey) {
      return json({ error: 'Missing required parameters' }, { status: 400 });
    }
    
    let response: string;
    
    switch (provider) {
      case 'openai':
        response = await callOpenAI(message, apiKey, history, model);
        break;
      case 'deepseek':
        response = await callDeepseek(message, apiKey, history, model);
        break;
      case 'gemini':
        response = await callGemini(message, apiKey, history, model);
        break;
      case 'anthropic':
        response = await callAnthropic(message, apiKey, history, model);
        break;
      case 'axonbox':
        response = await callAxonbox(message, apiKey, history, model);
        break;
      default:
        return json({ error: 'Invalid provider' }, { status: 400 });
    }
    
    return json({ response });
  } catch (error) {
    console.error('Error in chat API:', error);
    return json({ error: (error as Error).message }, { status: 500 });
  }
};

async function callOpenAI(message: string, apiKey: string, history: ChatMessage[], model: string = 'gpt-4o'): Promise<string> {
  const url = 'https://api.openai.com/v1/chat/completions';
  
  const messages: OpenAIMessage[] = formatHistoryForOpenAI(history);
  messages.push({ role: 'user', content: message });
  
  const response = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${apiKey}`
    },
    body: JSON.stringify({
      model,
      messages,
      temperature: 0.7,
    })
  });
  
  if (!response.ok) {
    const error = await response.json();
    throw new Error(`OpenAI API error: ${error.error?.message || 'Unknown error'}`);
  }
  
  const data = await response.json();
  return data.choices[0].message.content;
}

async function callDeepseek(message: string, apiKey: string, history: ChatMessage[], model: string = 'deepseek-chat'): Promise<string> {
  const url = 'https://api.deepseek.com/v1/chat/completions';
  
  const messages: OpenAIMessage[] = formatHistoryForOpenAI(history); // Deepseek uses OpenAI-compatible format
  messages.push({ role: 'user', content: message });
  
  const response = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${apiKey}`
    },
    body: JSON.stringify({
      model,
      messages,
      temperature: 0.7,
    })
  });
  
  if (!response.ok) {
    const error = await response.json();
    throw new Error(`Deepseek API error: ${error.error?.message || 'Unknown error'}`);
  }
  
  const data = await response.json();
  return data.choices[0].message.content;
}

async function callGemini(message: string, apiKey: string, history: ChatMessage[], model: string = 'gemini-pro'): Promise<string> {
  // Extract model name from the input (remove 'gemini-' prefix if present)
  const modelName = model.startsWith('gemini-') ? model : `gemini-${model}`;
  
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${modelName}:generateContent?key=${apiKey}`;
  
  const contents: GeminiContent[] = formatHistoryForGemini(history);
  contents.push({
    role: 'user',
    parts: [{ text: message }]
  });
  
  const response = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      contents,
      generationConfig: {
        temperature: 0.7,
      }
    })
  });
  
  if (!response.ok) {
    const error = await response.json();
    throw new Error(`Gemini API error: ${error.error?.message || 'Unknown error'}`);
  }
  
  const data = await response.json();
  return data.candidates[0].content.parts[0].text;
}

async function callAnthropic(message: string, apiKey: string, history: ChatMessage[], model: string = 'claude-3-sonnet-20240229'): Promise<string> {
  const url = 'https://api.anthropic.com/v1/messages';
  
  const messages: AnthropicMessage[] = formatHistoryForAnthropic(history);
  
  const response = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': apiKey,
      'anthropic-version': '2023-06-01'
    },
    body: JSON.stringify({
      model,
      messages: [...messages, { role: 'user', content: message }],
      max_tokens: 4000,
      temperature: 0.7,
    })
  });
  
  if (!response.ok) {
    const error = await response.json();
    throw new Error(`Anthropic API error: ${error.error?.message || 'Unknown error'}`);
  }
  
  const data = await response.json();
  return data.content[0].text;
}

function formatHistoryForOpenAI(history: ChatMessage[]): OpenAIMessage[] {
  if (!history || !history.length) return [];
  
  return history.map(msg => ({
    role: msg.role,
    content: msg.content
  }));
}

function formatHistoryForGemini(history: ChatMessage[]): GeminiContent[] {
  if (!history || !history.length) return [];
  
  return history.map(msg => ({
    role: msg.role === 'assistant' ? 'model' : 'user',
    parts: [{ text: msg.content }]
  }));
}

function formatHistoryForAnthropic(history: ChatMessage[]): AnthropicMessage[] {
  if (!history || !history.length) return [];
  
  return history.map(msg => {
    // Anthropic only supports user and assistant roles
    if (msg.role === 'system') {
      return { role: 'user', content: msg.content };
    }
    return {
      role: msg.role as 'user' | 'assistant',
      content: msg.content
    };
  });
}

async function callAxonbox(message: string, apiKey: string, history: ChatMessage[], model: string = 'axon-standard'): Promise<string> {
  const url = 'https://api.axonbox.net/chat';
  
  const messages: AxonboxMessage[] = formatHistoryForAxonbox(history);
  messages.push({ 
    role: 'user', 
    content: message,
    timestamp: new Date().toISOString()
  });
  
  const response = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      token: apiKey, // Use the JWT token for auth
      model: model,
      messages: messages,
      options: {
        temperature: 0.7
      }
    })
  });
  
  if (!response.ok) {
    const error = await response.json();
    throw new Error(`Axonbox API error: ${error.message || 'Unknown error'}`);
  }
  
  const data = await response.json();
  return data.response || data.content || data.message || ''; // Handle different possible response formats
}

function formatHistoryForAxonbox(history: ChatMessage[]): AxonboxMessage[] {
  if (!history || !history.length) return [];
  
  return history.map(msg => ({
    role: msg.role,
    content: msg.content,
    timestamp: msg.timestamp ? new Date(msg.timestamp).toISOString() : new Date().toISOString()
  }));
}
