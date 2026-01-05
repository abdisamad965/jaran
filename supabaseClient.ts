
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://qjlzzppimrzthgrpjdeu.supabase.co';
const supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InFqbHp6cHBpbXJ6dGhncnBqZGV1Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3Njc1OTk4MzcsImV4cCI6MjA4MzE3NTgzN30.LsDiMyzJEgqW2ppj2mtk9Mxj0fcbRSIssnvpI6XWyY0';

export const supabase = createClient(supabaseUrl, supabaseAnonKey);
