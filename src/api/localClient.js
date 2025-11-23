// API client using Supabase for persistence
import { supabase } from '@/lib/supabaseClient';

// Generate a simple ID
const generateId = () => {
  return Date.now().toString(36) + Math.random().toString(36).substr(2);
};

// Entity operations using Supabase
class EntityClient {
  constructor(entityName) {
    this.entityName = entityName;
    // Handle irregular plurals
    if (entityName === 'Batch') {
      this.tableName = 'batches';
    } else if (entityName === 'Receipt') {
      this.tableName = 'receipts';
    } else {
      this.tableName = entityName.toLowerCase() + 's';
    }
  }

  async list(orderBy = null) {
    let query = supabase.from(this.tableName).select('*');
    
    if (orderBy) {
      const descending = orderBy.startsWith('-');
      const field = descending ? orderBy.slice(1) : orderBy;
      query = query.order(field, { ascending: !descending });
    }
    
    const { data, error } = await query;
    if (error) throw error;
    return data || [];
  }

  async filter(filters, orderBy = null) {
    let query = supabase.from(this.tableName).select('*');
    
    // Apply filters
    Object.entries(filters).forEach(([key, value]) => {
      query = query.eq(key, value);
    });
    
    // Apply ordering
    if (orderBy) {
      const descending = orderBy.startsWith('-');
      const field = descending ? orderBy.slice(1) : orderBy;
      query = query.order(field, { ascending: !descending });
    }
    
    const { data, error } = await query;
    if (error) throw error;
    return data || [];
  }

  async get(id) {
    const { data, error } = await supabase
      .from(this.tableName)
      .select('*')
      .eq('id', id)
      .single();
    
    if (error) throw error;
    return data;
  }

  async create(data) {
    const now = new Date().toISOString();
    const item = {
      ...data,
      created_date: now,
      updated_date: now
    };
    
    const { data: created, error } = await supabase
      .from(this.tableName)
      .insert([item])
      .select()
      .single();
    
    if (error) throw error;
    return created;
  }

  async update(id, data) {
    const updated = {
      ...data,
      updated_date: new Date().toISOString()
    };
    
    const { data: result, error } = await supabase
      .from(this.tableName)
      .update(updated)
      .eq('id', id)
      .select()
      .single();
    
    if (error) throw error;
    return result;
  }

  async delete(id) {
    const { error } = await supabase
      .from(this.tableName)
      .delete()
      .eq('id', id);
    
    if (error) throw error;
    return { success: true };
  }
}

// Auth client
class AuthClient {
  constructor() {
    this.currentUser = null;
  }

  async me() {
    // Return mock user for local development
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

// App logs client (mock for local development)
class AppLogsClient {
  async logUserInApp(pageName) {
    console.log(`[AppLogs] User in app: ${pageName}`);
    return { success: true };
  }
}

// Integrations client
class IntegrationsClient {
  constructor() {
    this.Core = {
      UploadFile: this.uploadFile.bind(this),
      InvokeLLM: this.invokeLLM.bind(this),
      SendEmail: this.sendEmail.bind(this),
      SendSMS: this.sendSMS.bind(this),
      GenerateImage: this.generateImage.bind(this),
      ExtractDataFromUploadedFile: this.extractDataFromUploadedFile.bind(this)
    };
    
    // Define backend URL - use same origin in production, localhost in dev
    this.backendUrl = import.meta.env.PROD
      ? '/api'  // In production, use relative path (same domain)
      : 'http://localhost:3000/api';  // In dev, use localhost
  }

  async uploadFile({ file }) {
    try {
      const formData = new FormData();
      formData.append('file', file);
      
      const response = await fetch(`${this.backendUrl}/upload`, {
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
        formData.append('prompt', prompt);
        
        if (fileUrl.startsWith('data:')) {
           const res = await fetch(fileUrl);
           const blob = await res.blob();
           formData.append('file', blob, 'receipt.jpg');
        } else {
           formData.append('file_url', fileUrl);
        }
        
        const response = await fetch(`${this.backendUrl}/process-receipt`, {
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

  async sendEmail({ to, subject, body }) {
    console.log('Mock SendEmail:', { to, subject, body });
    return { success: true, message_id: generateId() };
  }

  async sendSMS({ to, message }) {
    console.log('Mock SendSMS:', { to, message });
    return { success: true, message_id: generateId() };
  }

  async generateImage({ prompt }) {
    console.log('Mock GenerateImage:', { prompt });
    return { image_url: 'https://via.placeholder.com/512' };
  }

  async extractDataFromUploadedFile({ file_url, schema }) {
    return this.invokeLLM({ 
      prompt: 'Extract data from this file', 
      file_urls: [file_url], 
      response_json_schema: schema 
    });
  }
}

// Main local client
export const localClient = {
  entities: {
    Batch: new EntityClient('Batch'),
    Receipt: new EntityClient('Receipt'),
    Query: {
      filter: async (entityName, filters, orderBy) => {
        const client = new EntityClient(entityName);
        return client.filter(filters, orderBy);
      }
    }
  },
  auth: new AuthClient(),
  integrations: new IntegrationsClient(),
  appLogs: new AppLogsClient()
};
