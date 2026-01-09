
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://qjlzzppimrzthgrpjdeu.supabase.co';
const supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InFqbHp6cHBpbXJ6dGhncnBqZGV1Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3Njc1OTk4MzcsImV4cCI6MjA4MzE3NTgzN30.LsDiMyzJEgqW2ppj2mtk9Mxj0fcbRSIssnvpI6XWyY0';

if (!supabaseUrl || !supabaseAnonKey) {
  console.error("Supabase configuration missing! Check your connection parameters.");
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: true,
    storage: window.localStorage,
    flowType: 'pkce'
  },
  global: {
    headers: { 'x-application-name': 'jaran-business-manager' }
  }
});

// Utility to handle session-related crashes
export const clearAuthSession = async () => {
  localStorage.removeItem('sb-qjlzzppimrzthgrpjdeu-auth-token');
  await supabase.auth.signOut();
  window.location.hash = '#/login';
};
