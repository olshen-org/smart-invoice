// API client using backend server for Google Sheets/Drive persistence

// Backend URL - always use /api since Vite proxy handles it in dev
const BACKEND_URL = '/api';

// Generate a simple ID (for client-side use)
const generateId = () => {
  return Date.now().toString(36) + Math.random().toString(36).substr(2);
};

// Helper for API calls
async function apiCall(endpoint, options = {}) {
  const url = `${BACKEND_URL}${endpoint}`;
  const response = await fetch(url, {
    headers: {
      'Content-Type': 'application/json',
      ...options.headers,
    },
    ...options,
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({ error: response.statusText }));
    throw new Error(error.error || 'API call failed');
  }

  return response.json();
}

// Entity operations using backend API
class EntityClient {
  constructor(entityName) {
    this.entityName = entityName;
    // Map entity names to API endpoints
    if (entityName === 'Batch') {
      this.endpoint = '/batches';
    } else if (entityName === 'Receipt') {
      this.endpoint = '/receipts';
    } else {
      this.endpoint = '/' + entityName.toLowerCase() + 's';
    }
  }

  async list(orderBy = null) {
    let url = this.endpoint;
    if (orderBy) {
      url += `?orderBy=${encodeURIComponent(orderBy)}`;
    }
    return apiCall(url);
  }

  async filter(filters, orderBy = null) {
    // For receipts, we need batch_id
    if (this.entityName === 'Receipt' && filters.batch_id) {
      let url = `${this.endpoint}?batch_id=${encodeURIComponent(filters.batch_id)}`;
      if (orderBy) {
        url += `&orderBy=${encodeURIComponent(orderBy)}`;
      }
      return apiCall(url);
    }
    
    // For other entities, just list all (filtering done client-side if needed)
    const items = await this.list(orderBy);
    
    // Apply filters client-side
    return items.filter(item => {
      return Object.entries(filters).every(([key, value]) => item[key] === value);
    });
  }

  async get(id) {
    return apiCall(`${this.endpoint}/${id}`);
  }

  async create(data) {
    return apiCall(this.endpoint, {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  async update(id, data) {
    // For receipts, we need to include batch_id in the body
    return apiCall(`${this.endpoint}/${id}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    });
  }

  async delete(id) {
    // For receipts, batch_id is needed as query param
    let url = `${this.endpoint}/${id}`;
    return apiCall(url, {
      method: 'DELETE',
    });
  }
}

// Auth client (mock for local development)
class AuthClient {
  constructor() {
    this.currentUser = null;
  }

  async me() {
    if (!this.currentUser) {
      this.currentUser = {
        id: 'local_user_1',
        email: 'local@example.com',
        name: 'Local User',
        role: 'user'
      };
    }
    return this.currentUser;
  }

  logout(redirectUrl = null) {
    this.currentUser = null;
    if (redirectUrl) {
      window.location.href = redirectUrl;
    }
  }

  redirectToLogin(returnUrl = null) {
    this.me().then(() => {
      if (returnUrl) {
        window.location.href = returnUrl;
      } else {
        window.location.reload();
      }
    });
  }
}

// App logs client (mock)
class AppLogsClient {
  async logUserInApp(pageName) {
    return { success: true };
  }
}

// Integrations client
class IntegrationsClient {
  constructor() {
    this.Core = {
      UploadFile: this.uploadFile.bind(this),
      InvokeLLM: this.invokeLLM.bind(this)
    };
  }

  async uploadFile({ file }) {
    try {
      const formData = new FormData();
      formData.append('file', file);

      const response = await fetch(`${BACKEND_URL}/upload`, {
        method: 'POST',
        body: formData
      });

      if (!response.ok) {
        throw new Error(`Upload failed: ${response.statusText}`);
      }

      const data = await response.json();
      return { file_url: data.file_url, file_id: data.file_id || generateId() };
    } catch (error) {
      console.error('Upload error:', error);
      throw error;
    }
  }

  async invokeLLM({ prompt, file_urls = [], response_json_schema }) {
    try {
      if (file_urls.length > 0) {
        const fileUrl = file_urls[0];
        const formData = new FormData();
        if (prompt) {
          formData.append('prompt', prompt);
        }

        if (fileUrl.startsWith('data:')) {
           const res = await fetch(fileUrl);
           const blob = await res.blob();
           formData.append('file', blob, 'receipt.jpg');
        } else {
           formData.append('file_url', fileUrl);
        }

        const response = await fetch(`${BACKEND_URL}/process-receipt`, {
          method: 'POST',
          body: formData
        });

        if (!response.ok) {
           const errorText = await response.text();
           throw new Error(`Processing failed: ${response.status} ${errorText}`);
        }

        return await response.json();
      }
    } catch (error) {
      console.error("Error calling backend API:", error);
      throw error;
    }
  }
}

// Receipt entity client with batch_id handling
class ReceiptEntityClient extends EntityClient {
  constructor() {
    super('Receipt');
  }

  async filter(filters, orderBy = null) {
    if (!filters.batch_id) {
      throw new Error('batch_id is required for filtering receipts');
    }
    
    let url = `${this.endpoint}?batch_id=${encodeURIComponent(filters.batch_id)}`;
    if (orderBy) {
      url += `&orderBy=${encodeURIComponent(orderBy)}`;
    }
    return apiCall(url);
  }

  async create(data) {
    if (!data.batch_id) {
      throw new Error('batch_id is required for creating receipts');
    }
    return apiCall(this.endpoint, {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  async update(id, data) {
    if (!data.batch_id) {
      throw new Error('batch_id is required for updating receipts');
    }
    return apiCall(`${this.endpoint}/${id}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    });
  }

  async delete(id, batchId) {
    if (!batchId) {
      throw new Error('batch_id is required for deleting receipts');
    }
    return apiCall(`${this.endpoint}/${id}?batch_id=${encodeURIComponent(batchId)}`, {
      method: 'DELETE',
    });
  }
}

// Main API client
export const api = {
  entities: {
    Batch: new EntityClient('Batch'),
    Receipt: new ReceiptEntityClient(),
    Query: {
      filter: async (entityName, filters, orderBy) => {
        const client = entityName === 'Receipt' 
          ? new ReceiptEntityClient() 
          : new EntityClient(entityName);
        return client.filter(filters, orderBy);
      }
    }
  },
  auth: new AuthClient(),
  integrations: new IntegrationsClient(),
  appLogs: new AppLogsClient()
};
