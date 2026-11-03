import { supabase } from './supabase';

export async function fetchBookmarksFromSupabase(userId) {
  if (!userId) return null;
  const { data, error } = await supabase
    .from('bookmarks')
    .select('*')
    .eq('user_id', userId);
  if (error) {
    console.error('Error fetching bookmarks:', error);
    return null;
  }
  return data;
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
