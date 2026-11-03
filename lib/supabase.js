import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';

export const supabase = createClient(supabaseUrl, supabaseAnonKey);

export async function signInWithGoogle() {
  const { data, error } = await supabase.auth.signInWithOAuth({
    provider: 'google',
    options: {
      redirectTo: typeof window !== 'undefined' ? window.location.origin : '',
    },
  });
  if (error) console.error('Google login error:', error);
  return { data, error };
}

export async function signOut() {
  if (typeof window !== 'undefined') {
    // Clear user scoped cache on logout
    const keys = Object.keys(localStorage);
    keys.forEach(key => {
      if (key.startsWith('lokalinks-')) {
        localStorage.removeItem(key);
      }
    });
  }
  const { error } = await supabase.auth.signOut();
  if (error) console.error('Sign out error:', error);
  window.location.reload();
}

export async function getCurrentUser() {
  const { data: { session } } = await supabase.auth.getSession();
  return session?.user || null;
}
