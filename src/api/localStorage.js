// Local storage utilities for entities
const STORAGE_PREFIX = 'olsh_app_';

export const storage = {
  get: (key) => {
    try {
      if (typeof window === 'undefined' || !window.localStorage) {
        return null;
      }
      const item = window.localStorage.getItem(STORAGE_PREFIX + key);
      return item ? JSON.parse(item) : null;
    } catch (e) {
      console.error('Error reading from localStorage:', e);
      return null;
    }
  },

  set: (key, value) => {
    try {
      if (typeof window === 'undefined' || !window.localStorage) {
        return;
      }
      window.localStorage.setItem(STORAGE_PREFIX + key, JSON.stringify(value));
    } catch (e) {
      console.error('Error writing to localStorage:', e);
    }
  },

  remove: (key) => {
    try {
      if (typeof window === 'undefined' || !window.localStorage) {
        return;
      }
      window.localStorage.removeItem(STORAGE_PREFIX + key);
    } catch (e) {
      console.error('Error removing from localStorage:', e);
    }
  },

  getAll: (prefix) => {
    const items = [];
    try {
      if (typeof window === 'undefined' || !window.localStorage) {
        return items;
      }
      for (let i = 0; i < window.localStorage.length; i++) {
        const key = window.localStorage.key(i);
        if (key && key.startsWith(STORAGE_PREFIX + prefix)) {
          const value = window.localStorage.getItem(key);
          if (value) {
            items.push(JSON.parse(value));
          }
        }
      }
    } catch (e) {
      console.error('Error reading all from localStorage:', e);
    }
    return items;
  }
};

// Initialize with sample data if empty
export const initializeStorage = () => {
  const batches = storage.getAll('batch_');
  const receipts = storage.getAll('receipt_');
  
  if (batches.length === 0 && receipts.length === 0) {
    // Initialize with empty arrays
    console.log('Initializing local storage...');
  }
};

