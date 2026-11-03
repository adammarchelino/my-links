import { supabase } from './supabase';

export async function fetchBookmarksFromSupabase() {
  const { data, error } = await supabase.from('bookmarks').select('*');
  if (error) {
    console.error('Error fetching bookmarks:', error);
    return null;
  }
  return data;
}

export async function saveBookmarkToSupabase(bookmark) {
  const { data, error } = await supabase.from('bookmarks').upsert([bookmark]);
  if (error) {
    console.error('Error saving bookmark:', error);
    return false;
  }
  return true;
}

export async function deleteBookmarkFromSupabase(id) {
  const { error } = await supabase.from('bookmarks').delete().eq('id', id);
  if (error) {
    console.error('Error deleting bookmark:', error);
    return false;
  }
  return true;
}
