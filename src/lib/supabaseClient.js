import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://sqeduciomhmlnuukbwwe.supabase.co';
const supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InNxZWR1Y2lvbWhtbG51dWtid3dlIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjM2NzI1MTMsImV4cCI6MjA3OTI0ODUxM30.b8BqQe5vFOPbwTGkn3aJayyfOOJS0vS1iSGE376NIbU';

// Disable realtime - we only use REST API for CRUD operations
export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  realtime: {
    enabled: false
  }
});

