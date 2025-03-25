import { writable, derived, get } from 'svelte/store';
import type { Writable } from 'svelte/store';

// Define types
export interface RepeaterRequest extends CapturedRequest {
  repeaterId: number;
  requestNumber: number;
  name?: string;
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
  // Clone the request to avoid reference issues
  const newRequest = JSON.parse(JSON.stringify(request));
  
  // Add unique identifier and request number
  newRequest.repeaterId = Date.now();
  newRequest.requestNumber = get(repeaterRequests).length + 1;
  newRequest.name = `Request ${newRequest.requestNumber}`;
  
  repeaterRequests.update(requests => {
    // Check if request already exists (by id)
    const existingIndex = requests.findIndex(r => r.id === newRequest.id);
    if (existingIndex === -1) {
      // Add as new
      return [...requests, newRequest];
    } else {
      // Replace existing (keep position)
      const updatedRequests = [...requests];
      updatedRequests[existingIndex] = newRequest;
      return updatedRequests;
    }
  });
  
  // Select the newly added request
  selectRepeaterRequest(get(repeaterRequests).length - 1);
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
