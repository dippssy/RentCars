// Supabase Configuration
const supabaseUrl = 'https://daourismxjgyfhhwyuaj.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImRhb3VyaXNteGpneWZoaHd5dWFqIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODIzODY5MDQsImV4cCI6MjA5Nzk2MjkwNH0.cV3e6NtXwH-207UXphKgA7yAV2s-O0_2ErRbP4pQnsU';

// Initialize Supabase Client
const supabaseClient = window.supabase.createClient(supabaseUrl, supabaseKey);
