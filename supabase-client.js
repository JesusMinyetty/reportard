// Reemplaza estos valores por los de tu proyecto en Supabase
const SUPABASE_URL = "https://qntbqxtlnzigbwyghbmy.supabase.co";
const SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InFudGJxeHRsbnppZ2J3eWdoYm15Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzY5MTMxMDAsImV4cCI6MjA5MjQ4OTEwMH0.m1o6g-xqCAMYrNZ42-_9Au9mDZzsESQvOV4BDOYdp-M";

if (!window.supabase) {
  console.error("No se encontró Supabase. Revisa el script de Supabase en index.html.");
} else {
  const sb = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
  window.sb = sb;
  console.log("Supabase conectado:", sb);
}