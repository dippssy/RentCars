// Supabase Configuration
const supabaseUrl = 'https://daourismxjgyfhhwyuaj.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImRhb3VyaXNteGpneWZoaHd5dWFqIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODIzODY5MDQsImV4cCI6MjA5Nzk2MjkwNH0.cV3e6NtXwH-207UXphKgA7yAV2s-O0_2ErRbP4pQnsU';

// Initialize Supabase Client
const supabaseClient = window.supabase.createClient(supabaseUrl, supabaseKey);

// Auth Helper: Check if user is logged in, redirect to login if not
async function checkAdminAuth() {
  const { data: { session } } = await supabaseClient.auth.getSession();
  if (!session) {
    window.location.href = 'login.html';
    return null;
  }
  return session.user;
}

// Auth Helper: Logout
async function adminLogout() {
  await supabaseClient.auth.signOut();
  window.location.href = 'login.html';
}
