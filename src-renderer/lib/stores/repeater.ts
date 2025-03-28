import { writable, derived, get } from 'svelte/store';
import type { Writable } from 'svelte/store';

// Define types
export interface RepeaterResponse {
  status: number;
  responseHeaders: Record<string, string>;
  responseBody: string;
  responseLength: number;
  responseTime: number;
  timestamp: number;
  requestData?: {
    method: string;
    url: string;
    headers: Record<string, string>;
    body: string;
    timestamp: string;
  };
}

// Add this to your repeater store file

// Function to reorder the repeater requests
export function reorderRepeaterRequests(newOrder: number[]) {
  repeaterRequests.update(requests => {
    // Create a new array with the requests in the new order
    const reorderedRequests = newOrder.map(index => requests[index]);
    
    // Update request numbers to match new order
    reorderedRequests.forEach((request, index) => {
      request.requestNumber = index + 1;
    });
    
    // If we have a selected request, update the selected index
    if (get(selectedRepeaterIndex) !== -1) {
      const selectedId = get(selectedRepeaterRequest)?.repeaterId;
      if (selectedId) {
        const newIndex = reorderedRequests.findIndex(req => req.repeaterId === selectedId);
        selectedRepeaterIndex.set(newIndex);
      }
    }
    
    return reorderedRequests;
  });
}

export interface RepeaterRequest extends Omit<CapturedRequest, 'id'> {
  id?: number; // Make id optional since we delete it for new repeater requests
  repeaterId: number;
  requestNumber: number;
  name?: string;
  responses: RepeaterResponse[];
  currentResponseIndex: number;
}

// Create a writable store for repeater requests
export const repeaterRequests: Writable<RepeaterRequest[]> = writable([]);

// Store for currently selected request index
export const selectedRepeaterIndex = writable(0);

// Derived store for the currently selected request
export const selectedRepeaterRequest = derived(
  [repeaterRequests, selectedRepeaterIndex],
  ([$repeaterRequests, $selectedRepeaterIndex]) => {
    if ($repeaterRequests.length === 0) return null;
    return $repeaterRequests[$selectedRepeaterIndex] || null;
  }
);

  // Function to add a new request to the store
export function addRepeaterRequest(request: CapturedRequest): void {
  // Check if this request already exists in the store
  const existingRequests = get(repeaterRequests);
  
  // Normalize request data for comparison
  const normalizedRequest = {
    method: request.method,
    host: request.host,
    path: request.path,
    body: request.body,
    headers: request.headers ? Object.entries(request.headers)
      .filter(([key]) => !key.toLowerCase().includes('cookie')) // Ignore cookies
      .sort(([a], [b]) => a.localeCompare(b))
      .reduce((acc, [key, val]) => ({...acc, [key]: val}), {})
    : {}
  };

  const isDuplicate = existingRequests.some(existing => {
    // Normalize existing request data
    const normalizedExisting = {
      method: existing.method,
      host: existing.host,
      path: existing.path,
      body: existing.body,
      headers: existing.headers ? Object.entries(existing.headers)
        .filter(([key]) => !key.toLowerCase().includes('cookie')) // Ignore cookies
        .sort(([a], [b]) => a.localeCompare(b))
        .reduce((acc, [key, val]) => ({...acc, [key]: val}), {})
      : {}
    };

    return JSON.stringify(normalizedRequest) === JSON.stringify(normalizedExisting);
  });

  if (isDuplicate) {
    console.log('Duplicate request detected, skipping:', request);
    return;
  }

  // Create a completely new request object with stable ID
  const newRequest: RepeaterRequest = {
    ...JSON.parse(JSON.stringify(request)),
    repeaterId: generateStableRequestId(request),
    requestNumber: existingRequests.length + 1,
    name: `Request ${existingRequests.length + 1}`,
    responses: [],
    currentResponseIndex: -1
  };

  // Helper function to generate stable ID based on request content
  function generateStableRequestId(req: CapturedRequest): number {
    const str = `${req.method}|${req.host}|${req.path}|${req.body}|${
      req.headers ? Object.entries(req.headers)
        .filter(([key]) => !key.toLowerCase().includes('cookie'))
        .sort(([a], [b]) => a.localeCompare(b))
        .map(([k,v]) => `${k}:${v}`)
        .join('|')
      : ''
    }`;
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
      const char = str.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash; // Convert to 32bit integer
    }
    return hash;
  }

  // Clear any existing ID to ensure this is treated as new
  delete newRequest.id;
  
  // Add as new request
  repeaterRequests.update(requests => [...requests, newRequest]);
  
  // Select the newly added request
  selectRepeaterRequest(existingRequests.length);
}

// Function to select a request by index
export function selectRepeaterRequest(index: number): void {
  selectedRepeaterIndex.set(index);
}

// Function to update a request after sending
export function updateRepeaterRequest(
  repeaterId: number,
  updates: Partial<RepeaterRequest>
): void {
  repeaterRequests.update(requests => {
    const index = requests.findIndex(r => r.repeaterId === repeaterId);
    if (index === -1) return requests;
    
    const updatedRequests = [...requests];
    updatedRequests[index] = { ...updatedRequests[index], ...updates };
    return updatedRequests;
  });
}

// Function to add a new response to a request
export function addRepeaterResponse(
  repeaterId: number,
  response: Omit<RepeaterResponse, 'timestamp'>
): void {
  repeaterRequests.update(requests => {
    const index = requests.findIndex(r => r.repeaterId === repeaterId);
    if (index === -1) return requests;
    
    const newResponse = {
      ...response,
      timestamp: Date.now()
    };
    
    const updatedRequests = [...requests];
    updatedRequests[index] = {
      ...updatedRequests[index],
      responses: [...updatedRequests[index].responses, newResponse],
      currentResponseIndex: updatedRequests[index].responses.length
    };
    
    return updatedRequests;
  });
}

// Function to navigate responses for a request
export function navigateRepeaterResponse(
  repeaterId: number,
  direction: 'prev' | 'next'
): void {
  repeaterRequests.update(requests => {
    const index = requests.findIndex(r => r.repeaterId === repeaterId);
    if (index === -1) return requests;
    
    const request = requests[index];
    if (request.responses.length === 0) return requests;
    
    let newIndex = request.currentResponseIndex;
    if (direction === 'prev' && request.currentResponseIndex > 0) {
      newIndex--;
    } else if (direction === 'next' && request.currentResponseIndex < request.responses.length - 1) {
      newIndex++;
    } else {
      return requests;
    }
    
    const updatedRequests = [...requests];
    updatedRequests[index] = {
      ...updatedRequests[index],
      currentResponseIndex: newIndex
    };
    
    return updatedRequests;
  });
}

// Function to clear all requests (e.g., when a new project is created)
export function clearRepeaterRequests(): void {
  repeaterRequests.set([]);
  selectedRepeaterIndex.set(0);
}

// Function to get all requests (useful for sending to main process)
export function getAllRepeaterRequests(): RepeaterRequest[] {
  return get(repeaterRequests);
}

// Initialize listeners if in Electron environment
if (typeof window !== 'undefined' && window.electronAPI) {
  const api = window.electronAPI;
  
  // Listen for requests sent to repeater from main process or other windows
  api.receive('send-to-repeater', (request: CapturedRequest) => {
    addRepeaterRequest(request);
  });
  
  // Listen for project state changes
  api.receive('project-state-changed', (data: { action: string; project: Project }) => {
    if (data.action === 'new') {
      // Clear existing requests when a new project is created
      clearRepeaterRequests();
    } else if (data.action === 'open' && data.project) {
      // Clear existing requests and load project requests when opening an existing project
      clearRepeaterRequests();
      data.project.requests?.forEach(request => {
        addRepeaterRequest(request);
      });
    }
  });
  
  // Listen for request to send current repeater requests back to main process
  api.receive('get-repeater-requests', () => {
    const requests = getAllRepeaterRequests();
    
    // Send the current repeater requests back to the main process
    api.proxy.sendRepeaterRequests(requests)
      .then((result: { success: boolean; error?: string }) => {
        if (result.success) {
          console.log('Successfully sent repeater requests to main process');
        } else {
          console.error('Failed to send repeater requests:', result.error);
        }
      })
      .catch((err: Error) => {
        console.error('Error sending repeater requests:', err);
      });
  });
  
  // Listen for request to get current repeater state
  api.receive('request-repeater-state', () => {
    const requests = getAllRepeaterRequests();
    
    console.log('Received request for repeater state, sending', requests.length, 'requests');
    
    // Since this is in response to a direct IPC request, we'll send back to the main process
    // via the same IPC channel that the main process uses to notify windows of repeater state
    if (window.electronAPI) {
      // This doesn't need a response, so we'll use send instead of invoke
      // We're just pushing our current state back to the main process
      api.receive('get-repeater-state-response', (result: any) => {
        console.log('Received response from main process:', result);
      });
      
      // Send the repeater state to the main process
      // @ts-ignore - Using the send method added to electronAPI
      api.send('current-repeater-state-from-window', requests);
    }
  });
}
