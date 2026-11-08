import { supabase } from './supabase';

export async function fetchBookmarksFromSupabase(userId) {
  if (!userId) return { data: null, error: null };
  const { data, error } = await supabase
    .from('bookmarks')
    .select('*')
    .eq('user_id', userId);
  if (error) {
    console.error('Error fetching bookmarks:', {
      message: error.message,
      code: error.code,
      details: error.details,
      hint: error.hint,
      status: error.status
    });
    return { data: null, error };
  }
  return { data, error: null };
}

export async function saveBookmarkToSupabase(bookmark, userId) {
  if (!userId) return false;
  const payload = { ...bookmark, user_id: userId };
  const { error } = await supabase.from('bookmarks').upsert([payload]);
  if (error) {
    console.error('Error saving bookmark:', error);
    return false;
  }
  return true;
}

export async function deleteBookmarkFromSupabase(id, userId) {
  if (!userId) return false;
  const { error } = await supabase
    .from('bookmarks')
    .delete()
    .eq('id', id)
    .eq('user_id', userId);
  if (error) {
    console.error('Error deleting bookmark:', error);
    return false;
  }
  return true;
}
