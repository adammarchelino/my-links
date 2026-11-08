'use client';

import { useEffect, useMemo, useState, useRef } from 'react';
import { bookmarks as initialBookmarks } from '../lib/data';
import { fetchBookmarksFromSupabase, saveBookmarkToSupabase, saveBookmarksToSupabase, deleteBookmarkFromSupabase } from '../lib/sync';
import { supabase, signInWithGoogle, signOut } from '../lib/supabase';
import { createChromeBookmarksHtml, parseChromeBookmarksHtml } from '../lib/bookmark-files';

const icons = {
  search: <svg viewBox="0 0 24 24"><circle cx="11" cy="11" r="6.5"/><path d="m16 16 4.5 4.5"/></svg>,
  plus: <svg viewBox="0 0 24 24"><path d="M12 5v14M5 12h14"/></svg>,
  sun: <svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="3.5"/><path d="M12 2v2M12 20v2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M2 12h2M20 12h2M4.93 19.07l1.41-1.41M17.66 6.34l1.41-1.41"/></svg>,
  moon: <svg viewBox="0 0 24 24"><path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"/></svg>,
  star: <svg viewBox="0 0 24 24"><path d="m12 3 2.75 5.57 6.15.9-4.45 4.34 1.05 6.13L12 17.05l-5.5 2.89 1.05-6.13L3.1 9.47l6.15-.9L12 3Z"/></svg>,
  chevron: <svg viewBox="0 0 24 24"><path d="m7 9 5 5 5-5"/></svg>,
  grip: <svg viewBox="0 0 24 24"><path d="M9 5h.01M15 5h.01M9 12h.01M15 12h.01M9 19h.01M15 19h.01"/></svg>,
  up: <svg viewBox="0 0 24 24"><path d="m6 14 6-6 6 6"/></svg>,
  down: <svg viewBox="0 0 24 24"><path d="m6 10 6 6 6-6"/></svg>,
  edit: <svg viewBox="0 0 24 24"><path d="m4 16.5-.8 4.3 4.3-.8L19 8.5 15.5 5 4 16.5Z"/><path d="m13.8 6.7 3.5 3.5"/></svg>,
  trash: <svg viewBox="0 0 24 24"><path d="M4 7h16M10 11v6M14 11v6M6 7l1 13h10l1-13M9 7V4h6v3"/></svg>,
  arrowLeft: <svg viewBox="0 0 24 24"><path d="m15 18-6-6 6-6"/></svg>,
  arrowRight: <svg viewBox="0 0 24 24"><path d="m9 18 6-6-6-6"/></svg>,
  close: <svg viewBox="0 0 24 24"><path d="M18 6 6 18M6 6l12 12"/></svg>,
  google: <svg viewBox="0 0 24 24"><path fill="#4285F4" d="M23.745 12.27c0-.7-.06-1.4-.19-2.07H12v4.51h6.6c-.29 1.52-1.14 2.82-2.4 3.68v3.05h3.88c2.27-2.09 3.66-5.17 3.66-9.17z"/><path fill="#34A853" d="M12 24c3.24 0 5.95-1.08 7.93-2.91l-3.88-3.05c-1.08.72-2.45 1.16-4.05 1.16-3.13 0-5.78-2.11-6.73-4.96H1.18v3.15C3.17 21.33 7.23 24 12 24z"/><path fill="#FBBC05" d="M5.27 14.24c-.25-.72-.38-1.49-.38-2.24s.13-1.52.38-2.24V6.61H1.18C.43 8.13 0 9.84 0 11.6s.43 3.47 1.18 4.99l4.09-2.35z"/><path fill="#EA4335" d="M12 4.75c1.77 0 3.35.61 4.6 1.8l3.42-3.42C17.95 1.19 15.24 0 12 0 7.23 0 3.17 2.67 1.18 6.61l4.09 3.15c.95-2.85 3.6-4.96 6.73-4.96z"/></svg>,
  logout: <svg viewBox="0 0 24 24"><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4M16 17l5-5-5-5M21 12H9"/></svg>
};

const normalizeUrl = (value) => {
  const trimmed = value.trim();
  if (/^https?:\/\//i.test(trimmed)) return trimmed;
  return `https://${trimmed}`;
};

const getDomain = (url) => {
  try {
    return new URL(normalizeUrl(url)).hostname;
  } catch {
    return '';
  }
};

const displayUrl = (value) => value.replace(/^https?:\/\//i, '').replace(/\/$/, '');

const splitCategory = (category) => {
  const [parent, ...rest] = category.split(' / ');
  return { parent, child: rest.join(' / ') || null };
};
const parentOf = (item) => splitCategory(item.category).parent;

function customSort(items, orderMap, mode) {
  if (mode === 'name') return [...items].sort((a, b) => a.title.localeCompare(b.title));
  const order = orderMap[items[0]?.category] || [];
  return [...items].sort((a, b) => {
    const ai = order.indexOf(a.id);
    const bi = order.indexOf(b.id);
    if (ai === -1 && bi === -1) return a.title.localeCompare(b.title);
    if (ai === -1) return 1;
    if (bi === -1) return -1;
    return ai - bi;
  });
}

export default function Home() {
  const [user, setUser] = useState(null);
  const [authLoading, setAuthLoading] = useState(true);
  const [activeCategory, setActiveCategory] = useState('Semua bookmark');
  const [query, setQuery] = useState('');
  const [dark, setDark] = useState(true);
  const [bookmarks, setBookmarks] = useState([]);
  const [bookmarksLoaded, setBookmarksLoaded] = useState(false);
  const [bookmarkLoadError, setBookmarkLoadError] = useState(false);
  const [bookmarksDirty, setBookmarksDirty] = useState(false);
  const [loadAttempt, setLoadAttempt] = useState(0);
  const [modal, setModal] = useState(null);
  const [arrangeMode, setArrangeMode] = useState(false);
  const [draggedId, setDraggedId] = useState(null);
  const [sortMode, setSortMode] = useState('custom');
  const [orderMap, setOrderMap] = useState({});
  const [collapsedSections, setCollapsedSections] = useState({});
  const [form, setForm] = useState({ title: '', url: '', description: '', category: 'Tools' });
  const [editingId, setEditingId] = useState(null);
  const [profileModalOpen, setProfileModalOpen] = useState(false);
  const [profileName, setProfileName] = useState('');
  const [profileError, setProfileError] = useState('');
  const [profileSaving, setProfileSaving] = useState(false);
  const [categoryManagerOpen, setCategoryManagerOpen] = useState(false);
  const [categoryDraft, setCategoryDraft] = useState('');
  const [categoryFeedback, setCategoryFeedback] = useState('');
  const [editingCategory, setEditingCategory] = useState('');
  const [categoryNameDraft, setCategoryNameDraft] = useState('');
  const [managerBookmarkId, setManagerBookmarkId] = useState('');
  const [managerTargetCategory, setManagerTargetCategory] = useState('');
  const [managerSourceCategory, setManagerSourceCategory] = useState('');
  const [importPreview, setImportPreview] = useState(null);
  const [importError, setImportError] = useState('');
  const [importBusy, setImportBusy] = useState(false);
  const [actionNotice, setActionNotice] = useState('');

  // Mouse drag to scroll state
  const [isDraggingScroll, setIsDraggingScroll] = useState(false);
  const [startX, setStartX] = useState(0);
  const [scrollLeftState, setScrollLeftState] = useState(0);

  const gridScrollRefs = useRef({});
  const authUserIdRef = useRef(null);
  const importInputRef = useRef(null);

  const folderTree = useMemo(() => {
    const tree = {};
    bookmarks.forEach((item) => {
      const { parent, child } = splitCategory(item.category);
      const targetParent = parent || 'Tanpa folder';
      if (!tree[targetParent]) tree[targetParent] = { count: 0, children: {}, items: [] };
      tree[targetParent].count += 1;
      tree[targetParent].items.push(item);
      if (child) {
        if (!tree[targetParent].children[child]) tree[targetParent].children[child] = [];
        tree[targetParent].children[child].push(item);
      }
    });
    return tree;
  }, [bookmarks]);

  const folderNames = Object.keys(folderTree);
  const categoryOptions = [...new Set([...folderNames, ...bookmarks.map((item) => item.category).filter(Boolean)])].sort((a, b) => a.localeCompare(b));

  useEffect(() => {
    let authSubscription;
    async function initAuthAndData() {
      try {
        const { data: { session } } = await supabase.auth.getSession();
        const currentUser = session?.user || null;
        authUserIdRef.current = currentUser?.id || null;
        setUser(currentUser);

        const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
          const newUser = session?.user || null;
          if (authUserIdRef.current !== newUser?.id) {
            authUserIdRef.current = newUser?.id || null;
            setBookmarks([]);
            setOrderMap({});
            setCollapsedSections({});
            setBookmarksLoaded(false);
            setBookmarkLoadError(false);
            setBookmarksDirty(false);
          }
          setUser(newUser);
        });
        authSubscription = subscription;
      } catch (err) {
        console.error('Auth/Data init error:', err);
      }
      setAuthLoading(false);
    }
    initAuthAndData();
    return () => {
      authSubscription?.unsubscribe();
    };
  }, []);

  useEffect(() => {
    let cancelled = false;
    async function loadUserData() {
      if (!user) {
        setBookmarksLoaded(true);
        return;
      }

      setBookmarksLoaded(false);
      setBookmarkLoadError(false);
      try {
        const { data: remoteData, error: remoteError } = await fetchBookmarksFromSupabase(user.id);
        const cacheKey = `lokalinks-bookmarks-${user.id}`;
        const savedBookmarks = window.localStorage.getItem(cacheKey);
        const hasLoadError = Boolean(remoteError);
        let nextBookmarks;
        if (hasLoadError) {
          nextBookmarks = savedBookmarks ? JSON.parse(savedBookmarks) : [];
        } else if (remoteData?.length) {
          nextBookmarks = remoteData;
        } else if (savedBookmarks) {
          nextBookmarks = JSON.parse(savedBookmarks);
        } else {
          nextBookmarks = initialBookmarks;
        }
        const savedOrder = window.localStorage.getItem(`lokalinks-order-${user.id}`);
        const savedCollapsed = window.localStorage.getItem(`lokalinks-collapsed-${user.id}`);

        if (!cancelled) {
          setBookmarks(nextBookmarks);
          setOrderMap(savedOrder ? JSON.parse(savedOrder) : {});
          setCollapsedSections(savedCollapsed ? JSON.parse(savedCollapsed) : {});
          setBookmarkLoadError(hasLoadError);
          setBookmarksDirty(false);
          setBookmarksLoaded(true);
        }
      } catch (err) {
        console.error('Bookmark loading error:', { message: err?.message || 'Unknown loading error' });
        if (!cancelled) {
          setBookmarkLoadError(true);
          setBookmarksLoaded(true);
        }
      }
    }
    loadUserData();
    return () => { cancelled = true; };
  }, [user?.id, loadAttempt]);

  useEffect(() => {
    setProfileName(user?.user_metadata?.display_name || user?.user_metadata?.full_name || '');
  }, [user?.id, user?.user_metadata?.display_name, user?.user_metadata?.full_name]);

  useEffect(() => {
    if (bookmarksLoaded && user && (!bookmarkLoadError || bookmarksDirty)) {
      try {
        window.localStorage.setItem(`lokalinks-bookmarks-${user.id}`, JSON.stringify(bookmarks));
      } catch { /* optional */ }
    }
  }, [bookmarks, bookmarksDirty, bookmarksLoaded, bookmarkLoadError, user]);

  useEffect(() => {
    if (user) {
      try {
        window.localStorage.setItem(`lokalinks-order-${user.id}`, JSON.stringify(orderMap));
      } catch { /* optional */ }
    }
  }, [orderMap, user]);

  useEffect(() => {
    if (user) {
      try {
        window.localStorage.setItem(`lokalinks-collapsed-${user.id}`, JSON.stringify(collapsedSections));
      } catch { /* optional */ }
    }
  }, [collapsedSections, user]);

  const matchesCategory = (item) => {
    if (activeCategory === 'Semua bookmark') return true;
    if (activeCategory === 'Favorit') return item.favorite;
    if (activeCategory === 'Tanpa folder') return !item.category?.trim();
    if (folderNames.includes(activeCategory)) return parentOf(item) === activeCategory;
    return item.category === activeCategory;
  };

  const visible = useMemo(() => bookmarks.filter((item) => {
    const searchable = `${item.title} ${item.url} ${item.description} ${item.category}`.toLowerCase();
    return matchesCategory(item) && searchable.includes(query.toLowerCase());
  }), [activeCategory, bookmarks, folderNames, query]);

  const sections = useMemo(() => {
    if (activeCategory === 'Semua bookmark') {
      const visibleIds = new Set(visible.map((item) => item.id));
      return Object.entries(folderTree).map(([folderName, data]) => {
        const items = data.items.filter((item) => visibleIds.has(item.id));
        return {
        key: `folder-${folderName}`,
        title: folderName,
        count: items.length,
        items: customSort(items, orderMap, sortMode),
        subgroups: data.children
        };
      }).filter((section) => section.items.length > 0);
    }
    if (activeCategory === 'Favorit') {
      return [{ key: 'Favorit', title: 'Favorit', count: visible.length, items: customSort(visible, orderMap, sortMode) }];
    }
    const grouped = {};
    visible.forEach((item) => {
      const child = splitCategory(item.category).child;
      const sectionKey = child || '__flat__';
      if (!grouped[sectionKey]) grouped[sectionKey] = [];
      grouped[sectionKey].push(item);
    });
    return Object.entries(grouped).sort(([a], [b]) => a.localeCompare(b)).map(([title, items]) => ({
      key: `${activeCategory}-${title}`,
      title: title === '__flat__' ? null : title,
      count: items.length,
      items: customSort(items, orderMap, sortMode)
    }));
  }, [activeCategory, folderTree, orderMap, sortMode, visible]);

  const counts = (name) => {
    if (name === 'Semua bookmark') return bookmarks.length;
    if (name === 'Favorit') return bookmarks.filter((item) => item.favorite).length;
    return folderTree[name]?.count || bookmarks.filter((item) => item.category === name).length;
  };

  const canArrange = activeCategory !== 'Semua bookmark' && activeCategory !== 'Favorit' && !query;

  const selectCategory = (name) => {
    setActiveCategory(name);
    setArrangeMode(false);
  };

  const toggleSectionCollapse = (key) => {
    setCollapsedSections((current) => {
      const isCollapsed = current[key] !== false;
      return { ...current, [key]: !isCollapsed };
    });
  };

  const saveOrder = (category, ids) => setOrderMap((current) => ({ ...current, [category]: ids }));

  function moveItem(id, direction, category) {
    const items = customSort(bookmarks.filter((item) => item.category === category), orderMap, 'custom');
    const index = items.findIndex((item) => item.id === id);
    const next = index + direction;
    if (index < 0 || next < 0 || next >= items.length) return;
    [items[index], items[next]] = [items[next], items[index]];
    saveOrder(category, items.map((item) => item.id));
  }

  function dropItem(targetId, category) {
    if (!draggedId || draggedId === targetId) return;
    const items = customSort(bookmarks.filter((item) => item.category === category), orderMap, 'custom');
    const from = items.findIndex((item) => item.id === draggedId);
    const to = items.findIndex((item) => item.id === targetId);
    if (from < 0 || to < 0) return;
    const [moved] = items.splice(from, 1);
    items.splice(to, 0, moved);
    saveOrder(category, items.map((item) => item.id));
    setDraggedId(null);
  }

  function openBookmark(item) {
    if (!arrangeMode) window.open(normalizeUrl(item.url), '_blank', 'noopener,noreferrer');
  }

  function openAdd(defaultCategory = '') {
    setEditingId(null);
    let targetCategory = folderNames[0] || 'Lainnya';
    if (defaultCategory && defaultCategory !== 'Semua bookmark' && defaultCategory !== 'Favorit') {
      targetCategory = defaultCategory;
    }
    setForm({ title: '', url: '', description: '', category: targetCategory });
    setModal('bookmark');
  }

  function openEdit(item) {
    setEditingId(item.id);
    setForm({ title: item.title, url: item.url, description: item.description || '', category: item.category });
    setModal('bookmark');
  }

  function openProfile() {
    setProfileName(user?.user_metadata?.display_name || user?.user_metadata?.full_name || '');
    setProfileError('');
    setProfileModalOpen(true);
  }

  async function saveProfile(event) {
    event.preventDefault();
    const displayName = profileName.trim();
    if (!displayName || displayName.length > 50) {
      setProfileError('Nama wajib diisi dan maksimal 50 karakter.');
      return;
    }

    setProfileSaving(true);
    setProfileError('');
    try {
      const { data, error } = await supabase.auth.updateUser({ data: { display_name: displayName } });
      if (error) throw error;
      if (data.user) setUser(data.user);
      setProfileModalOpen(false);
    } catch {
      setProfileError('Nama belum tersimpan. Silakan coba lagi.');
    } finally {
      setProfileSaving(false);
    }
  }

  async function deleteBookmark(item) {
    if (window.confirm(`Hapus bookmark "${item.title}"?`)) {
      setBookmarks((items) => items.filter((current) => current.id !== item.id));
      setBookmarksDirty(true);
      setOrderMap((current) => Object.fromEntries(Object.entries(current).map(([key, ids]) => [key, ids.filter((id) => id !== item.id)])));
      if (user) {
        await deleteBookmarkFromSupabase(item.id, user.id);
      }
    }
  }

  async function saveBookmark(event) {
    event.preventDefault();
    if (!form.title.trim() || !form.url.trim()) return;
    const url = normalizeUrl(form.url);
    let savedItem;
    if (editingId) {
      setBookmarks((items) => items.map((item) => {
        if (item.id === editingId) {
          savedItem = { ...item, ...form, url, icon: form.title.trim().charAt(0).toUpperCase() };
          return savedItem;
        }
        return item;
      }));
    } else {
      savedItem = { id: Date.now(), ...form, url, icon: form.title.trim().charAt(0).toUpperCase(), favorite: false };
      setBookmarks((items) => [savedItem, ...items]);
    }
    setBookmarksDirty(true);
    setModal(null);
    setEditingId(null);
    if (savedItem && user) {
      await saveBookmarkToSupabase(savedItem, user.id);
    }
  }

  async function toggleFavorite(id) {
    let updatedItem;
    setBookmarks((items) => items.map((item) => {
      if (item.id === id) {
        updatedItem = { ...item, favorite: !item.favorite };
        return updatedItem;
      }
      return item;
    }));
    setBookmarksDirty(true);
    if (updatedItem && user) {
      await saveBookmarkToSupabase(updatedItem, user.id);
    }
  }

  async function persistBookmarkUpdates(updatedItems, successMessage) {
    if (!updatedItems.length) return false;
    const saved = await saveBookmarksToSupabase(updatedItems, user?.id);
    if (!saved) {
      setCategoryFeedback('Perubahan belum tersimpan. Periksa koneksi, lalu coba lagi.');
      return false;
    }
    const updatesById = new Map(updatedItems.map((item) => [item.id, item]));
    setBookmarks((current) => current.map((item) => updatesById.get(item.id) || item));
    setBookmarksDirty(true);
    setCategoryFeedback(successMessage);
    return true;
  }

  const cleanCategoryName = (value) => value.split('/').map((part) => part.trim()).filter(Boolean).join(' / ');

  async function createCategory(event) {
    event.preventDefault();
    const name = cleanCategoryName(categoryDraft);
    const selectedBookmark = bookmarks.find((item) => String(item.id) === String(managerBookmarkId));
    if (!name || !selectedBookmark) {
      setCategoryFeedback('Isi nama kategori dan pilih satu bookmark untuk ditempatkan di dalamnya.');
      return;
    }
    if (categoryOptions.includes(name)) {
      setCategoryFeedback('Kategori tersebut sudah ada. Gunakan bagian pindahkan bookmark untuk menambahkan isinya.');
      return;
    }
    const updatedItem = { ...selectedBookmark, category: name };
    if (await persistBookmarkUpdates([updatedItem], `Kategori “${name}” dibuat dan bookmark dipindahkan.`)) {
      setCategoryDraft('');
      setManagerBookmarkId('');
      setManagerTargetCategory(name);
      setActiveCategory(name);
    }
  }

  async function renameCategory(event, oldName) {
    event.preventDefault();
    const nextName = cleanCategoryName(categoryNameDraft);
    if (!nextName) {
      setCategoryFeedback('Nama kategori tidak boleh kosong.');
      return;
    }
    if (nextName === oldName) {
      setEditingCategory('');
      return;
    }
    const isInsideRenamedTree = (name) => name === oldName || name.startsWith(`${oldName} / `);
    if (categoryOptions.some((name) => !isInsideRenamedTree(name) && (name === nextName || name.startsWith(`${nextName} / `)))) {
      setCategoryFeedback('Nama itu sudah digunakan kategori lain.');
      return;
    }
    const updatedItems = bookmarks
      .filter((item) => isInsideRenamedTree(item.category || ''))
      .map((item) => ({ ...item, category: `${nextName}${item.category.slice(oldName.length)}` }));
    if (await persistBookmarkUpdates(updatedItems, `Kategori “${oldName}” diubah menjadi “${nextName}”.`)) {
      if (isInsideRenamedTree(activeCategory)) setActiveCategory(`${nextName}${activeCategory.slice(oldName.length)}`);
      setEditingCategory('');
    }
  }

  async function moveCategoryItems(sourceCategory, destinationCategory) {
    if (!destinationCategory || sourceCategory === destinationCategory) {
      setCategoryFeedback('Pilih kategori tujuan yang berbeda.');
      return;
    }
    const isInsideSource = (name) => name === sourceCategory || name.startsWith(`${sourceCategory} / `);
    const updatedItems = bookmarks
      .filter((item) => isInsideSource(item.category || ''))
      .map((item) => ({ ...item, category: `${destinationCategory}${item.category.slice(sourceCategory.length)}` }));
    if (await persistBookmarkUpdates(updatedItems, `${updatedItems.length} bookmark dipindahkan ke “${destinationCategory}”.`)) {
      if (isInsideSource(activeCategory)) setActiveCategory(destinationCategory);
    }
  }

  async function moveManagedBookmark(event) {
    event.preventDefault();
    const selected = bookmarks.find((item) => String(item.id) === String(managerBookmarkId));
    if (!selected || !managerTargetCategory) {
      setCategoryFeedback('Pilih bookmark dan kategori tujuan.');
      return;
    }
    if (selected.category === managerTargetCategory) {
      setCategoryFeedback('Bookmark sudah berada di kategori tersebut.');
      return;
    }
    if (await persistBookmarkUpdates([{ ...selected, category: managerTargetCategory }], `“${selected.title}” dipindahkan ke “${managerTargetCategory}”.`)) {
      setManagerBookmarkId('');
    }
  }

  async function previewImportFile(event) {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file) return;
    try {
      const parsed = parseChromeBookmarksHtml(await file.text());
      const existingUrls = new Set(bookmarks.map((item) => {
        try { return new URL(normalizeUrl(item.url)).href.toLowerCase(); } catch { return item.url.toLowerCase(); }
      }));
      const uniqueBookmarks = parsed.bookmarks.filter((item) => {
        const key = item.url.toLowerCase();
        if (existingUrls.has(key)) return false;
        existingUrls.add(key);
        return true;
      });
      setImportPreview({ fileName: file.name, bookmarks: uniqueBookmarks, skipped: parsed.skipped + parsed.bookmarks.length - uniqueBookmarks.length });
      setImportError('');
      setActionNotice('');
    } catch (error) {
      console.error('Bookmark import preview error:', error);
      setActionNotice('File tidak dapat dibaca. Pilih file HTML hasil ekspor bookmark Chrome.');
    }
  }

  async function confirmImport() {
    if (!importPreview?.bookmarks.length || importBusy) return;
    setImportBusy(true);
    setImportError('');
    const idBase = Date.now();
    const newBookmarks = importPreview.bookmarks.map((item, index) => ({ ...item, id: idBase + index }));
    try {
      const saved = await saveBookmarksToSupabase(newBookmarks, user?.id);
      if (!saved) {
        setImportError('Bookmark impor belum tersimpan. Periksa koneksi dan kebijakan Supabase, lalu coba lagi.');
        return;
      }
      setBookmarks((current) => [...newBookmarks, ...current]);
      setBookmarksDirty(true);
      setImportPreview(null);
      setActionNotice(`${newBookmarks.length} bookmark berhasil diimpor${importPreview.skipped ? `, ${importPreview.skipped} duplikat atau tautan tidak didukung dilewati` : ''}.`);
    } finally {
      setImportBusy(false);
    }
  }

  function exportBookmarks() {
    const file = new Blob([createChromeBookmarksHtml(bookmarks)], { type: 'text/html;charset=utf-8' });
    const downloadUrl = URL.createObjectURL(file);
    const anchor = document.createElement('a');
    anchor.href = downloadUrl;
    anchor.download = 'lokalinks-bookmarks.html';
    document.body.appendChild(anchor);
    anchor.click();
    anchor.remove();
    window.setTimeout(() => URL.revokeObjectURL(downloadUrl), 1000);
    setActionsMenuOpen(false);
    setActionNotice(`${bookmarks.length} bookmark diekspor ke file HTML Chrome.`);
  }

  const scrollGrid = (key, direction) => {
    const el = gridScrollRefs.current[key];
    if (el) {
      const cardWidth = el.querySelector('.bookmark-card') ? el.querySelector('.bookmark-card').offsetWidth + 16 : 300;
      el.scrollBy({ left: direction * cardWidth * 4, behavior: 'smooth' });
    }
  };

  if (authLoading) {
    return (
      <main className={dark ? 'app dark' : 'app'}>
        <div className="auth-loading-screen">Memuat Lokalinks...</div>
      </main>
    );
  }

  if (!user) {
    return (
      <main className={dark ? 'app dark' : 'app'}>
        <div className="auth-container">
          <div className="auth-card">
            <div className="brand-text-only large">LOKALINKS</div>
            <p className="auth-subtitle">Katalog bookmark pribadi elegan & minimalis milik Adam Marchelino</p>
            <button className="google-login-btn" onClick={signInWithGoogle}>
              <span className="google-icon">{icons.google}</span>
              <span>Masuk dengan Google</span>
            </button>
            <button className="theme-toggle-auth" onClick={() => setDark(!dark)}>
              {dark ? icons.sun : icons.moon} {dark ? 'Mode Terang' : 'Mode Gelap'}
            </button>
          </div>
        </div>
      </main>
    );
  }

  return (
    <main className={dark ? 'app dark' : 'app'}>
      {/* Main Page Layout (Centered Canvas) */}
      <div className="layout-canvas">
        {/* Top Header Bar */}
        <header className="topbar">
          <div className="topbar-left">
            <div className="brand-text-only large">
              LOKALINKS
            </div>
          </div>

          <div className="topbar-right">
            <button className="user-profile-pill" title={user.email} onClick={openProfile} aria-label="Edit profil">
              {user.user_metadata?.avatar_url ? (
                <img src={user.user_metadata.avatar_url} alt="" className="user-avatar" />
              ) : <span className="user-avatar user-avatar-fallback" aria-hidden="true">{(user.user_metadata?.display_name || user.user_metadata?.full_name || user.email || '?').charAt(0).toUpperCase()}</span>}
              <span className="user-name">{user.user_metadata?.display_name || user.user_metadata?.full_name || user.email}</span>
            </button>
            <button
              className="icon-button"
              onClick={() => setDark(!dark)}
              aria-label={dark ? 'Mode terang' : 'Mode gelap'}
              title={dark ? 'Ganti ke mode terang' : 'Ganti ke mode gelap'}
            >
              {dark ? icons.sun : icons.moon}
            </button>
            <button
              className="icon-button logout"
              onClick={signOut}
              aria-label="Keluar"
              title="Keluar dari akun"
            >
              {icons.logout}
            </button>
          </div>
        </header>

        {/* Section 1: Hero Search Box ("PENCARIAN") */}
        <section className="search-section">
          <div className="search-bar-hero">
            <span className="search-icon">{icons.search}</span>
            <input
              type="text"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Pencarian bookmark, nama, link, atau deskripsi..."
              aria-label="Pencarian bookmark"
            />
            {query ? (
              <button className="clear-search" onClick={() => setQuery('')} aria-label="Hapus pencarian">×</button>
            ) : (
              <kbd className="search-shortcut">⌘ K</kbd>
            )}
          </div>
        </section>

        {/* Simple, always-visible category navigation */}
        <section className="category-section" aria-label="Navigasi bookmark">
          <nav className="category-nav" aria-label="Kategori bookmark">
            {['Semua bookmark', 'Favorit', ...categoryOptions].map((name, index) => (
              <button
                key={`${name}-${index}`}
                type="button"
                className={activeCategory === name ? 'category-nav-item active' : 'category-nav-item'}
                aria-current={activeCategory === name ? 'page' : undefined}
                onClick={() => selectCategory(name)}
              >
                <span>{name}</span>
                <span className="category-nav-count">{counts(name)}</span>
              </button>
            ))}
          </nav>
          <div className="category-actions" aria-label="Aksi bookmark">
            <button type="button" onClick={() => { setCategoryFeedback(''); setEditingCategory(''); setManagerBookmarkId(''); setManagerTargetCategory(''); setManagerSourceCategory(''); setCategoryManagerOpen(true); }}>Kategori</button>
            <button type="button" onClick={() => importInputRef.current?.click()}>Impor</button>
            <button type="button" onClick={exportBookmarks} disabled={!bookmarks.length}>Ekspor</button>
          </div>
          <input ref={importInputRef} className="visually-hidden-input" type="file" accept=".html,text/html" onChange={previewImportFile} aria-label="Pilih file HTML bookmark" />
        </section>
        {actionNotice && <div className="action-notice" role="status">{actionNotice}<button type="button" onClick={() => setActionNotice('')} aria-label="Tutup pesan">×</button></div>}

        {/* Section Header & View Options */}
        <div className="content-toolbar">
          <div className="active-meta">
            <h1 className="active-title">{activeCategory}</h1>
            <span className="active-count">{visible.length} bookmark</span>
          </div>
          <div className="toolbar-actions">
            <button type="button" className="add-bookmark-button" onClick={() => openAdd(activeCategory)}>
              <span aria-hidden="true">+</span> Tambah bookmark
            </button>
            <select
              className="sort-select"
              value={sortMode}
              onChange={(event) => setSortMode(event.target.value)}
              aria-label="Urutan bookmark"
            >
              <option value="custom">Urutan kustom</option>
              <option value="name">Nama A–Z</option>
            </select>
            {canArrange && (
              arrangeMode ? (
                <button className="done-button" onClick={() => setArrangeMode(false)}>Selesai</button>
              ) : (
                <button className="arrange-button" onClick={() => setArrangeMode(true)}>Atur posisi</button>
              )
            )}
          </div>
        </div>

        {arrangeMode && (
          <div className="arrange-note">
            Tarik card dari handle untuk mengatur urutan. Klik <strong>Selesai</strong> jika sudah rapi.
          </div>
        )}

        {/* Section 3: Bookmark Cards Grid ("CARD") with Notion-style Section Collapse Dropdown */}
        <section className={arrangeMode ? 'cards-section arranging' : 'cards-section'}>
          {bookmarkLoadError && (
            <div className="bookmark-load-error" role="alert">
              <div>
                <strong>Bookmark belum berhasil dimuat.</strong>
                <span>Data yang tersimpan di browser tetap dipertahankan. Periksa koneksi atau kebijakan akses Supabase, lalu coba lagi.</span>
              </div>
              <button type="button" onClick={() => setLoadAttempt((attempt) => attempt + 1)}>Coba lagi</button>
            </div>
          )}
          {!bookmarksLoaded && <div className="bookmark-loading" role="status">Memuat bookmark…</div>}
          {sections.map((section) => {
            const isCollapsed = collapsedSections[section.key] !== false; // Default closed (true) for "Semua bookmark" unless explicitly opened
            const hasManyItems = section.items.length > 10 && !arrangeMode;
            const targetCategoryForAdd = activeCategory === 'Semua bookmark' || activeCategory === 'Favorit' ? (folderNames[0] || 'Lainnya') : (section.title ? `${activeCategory} / ${section.title}` : activeCategory);

            return (
              <div className="section-block" key={section.key}>
                <button
                  type="button"
                  className="section-header-title clickable"
                  aria-expanded={!isCollapsed}
                  aria-controls={`${section.key.replace(/[^a-z0-9_-]/gi, '-')}-content`}
                  onClick={() => toggleSectionCollapse(section.key)}
                >
                  <div className="section-title-left">
                    <span className={isCollapsed ? 'section-chevron collapsed' : 'section-chevron'}>
                      {icons.chevron}
                    </span>
                    <h2>{section.title}</h2>
                    <span className="badge">{section.count || section.items.length}</span>
                  </div>
                </button>

                {!isCollapsed && (
                  <div className="grid-wrapper" id={`${section.key.replace(/[^a-z0-9_-]/gi, '-')}-content`}>
                    {hasManyItems && (
                      <button className="grid-scroll-arrow left" onClick={() => scrollGrid(section.key, -1)} aria-label="Geser kiri">
                        {icons.arrowLeft}
                      </button>
                    )}

                    <div
                      className={hasManyItems ? 'cards-grid scrollable-grid' : 'cards-grid'}
                      ref={(el) => { if (el) gridScrollRefs.current[section.key] = el; }}
                      onMouseDown={(e) => {
                        if (!hasManyItems || arrangeMode) return;
                        setIsDraggingScroll(true);
                        setStartX(e.pageX - e.currentTarget.offsetLeft);
                        setScrollLeftState(e.currentTarget.scrollLeft);
                      }}
                      onMouseLeave={() => setIsDraggingScroll(false)}
                      onMouseUp={() => setIsDraggingScroll(false)}
                      onMouseMove={(e) => {
                        if (!isDraggingScroll || !hasManyItems || arrangeMode) return;
                        e.preventDefault();
                        const el = e.currentTarget;
                        const x = e.pageX - el.offsetLeft;
                        const walk = (x - startX) * 1.5;
                        el.scrollLeft = scrollLeftState - walk;
                      }}
                    >
                      {section.items.map((item) => (
                        <article
                          className={draggedId === item.id ? 'bookmark-card dragging compact' : arrangeMode ? 'bookmark-card arranging-card compact' : 'bookmark-card compact'}
                          key={item.id}
                          onClick={() => openBookmark(item)}
                          draggable={arrangeMode}
                          onDragStart={() => { if (arrangeMode) setDraggedId(item.id); }}
                          onDragEnd={() => setDraggedId(null)}
                          onDragOver={(event) => { if (arrangeMode) event.preventDefault(); }}
                          onDrop={(event) => { event.stopPropagation(); dropItem(item.id, item.category); }}
                        >
                          <div className="card-top">
                            {arrangeMode && <span className="drag-handle" aria-hidden="true">{icons.grip}</span>}
                            <div className={`site-icon icon-${item.icon.toLowerCase()}`}>
                              {item.url ? (
                                <img
                                  src={`https://www.google.com/s2/favicons?domain=${getDomain(item.url)}&sz=64`}
                                  alt=""
                                  onError={(event) => {
                                    const img = event.currentTarget;
                                    if (img.src.includes('google.com')) {
                                      img.src = `https://icons.duckduckgo.com/ip3/${getDomain(item.url)}.ico`;
                                    } else {
                                      img.style.display = 'none';
                                      if (img.nextElementSibling) {
                                        img.nextElementSibling.style.visibility = 'visible';
                                      }
                                    }
                                  }}
                                />
                              ) : null}
                              <span className="fallback-letter">{item.title ? item.title.charAt(0).toUpperCase() : '?'}</span>
                            </div>
                            <button
                              className={item.favorite ? 'favorite active' : 'favorite'}
                              onClick={(event) => { event.stopPropagation(); toggleFavorite(item.id); }}
                              aria-label={item.favorite ? 'Hapus dari favorit' : 'Tambah ke favorit'}
                              title={item.favorite ? 'Favorit' : 'Jadikan favorit'}
                            >
                              {icons.star}
                            </button>
                          </div>

                          <div className="bookmark-title prominent" title={item.title}>{item.title}</div>
                          <span className="bookmark-url" title={displayUrl(item.url)}>{displayUrl(item.url)}</span>

                          <div className="card-footer">
                            <span className="category-label">{splitCategory(item.category).child || item.category}</span>
                            {arrangeMode ? (
                              <div className="mobile-move" onClick={(event) => event.stopPropagation()}>
                                <button onClick={() => moveItem(item.id, -1, item.category)} aria-label="Pindah ke kiri/atas">{icons.up}</button>
                                <button onClick={() => moveItem(item.id, 1, item.category)} aria-label="Pindah ke kanan/bawah">{icons.down}</button>
                              </div>
                            ) : (
                              <div className="card-actions" onClick={(event) => event.stopPropagation()}>
                                <button className="card-action" onClick={() => openEdit(item)} aria-label={`Edit ${item.title}`} title="Edit bookmark">{icons.edit}</button>
                                <button className="card-action delete" onClick={() => deleteBookmark(item)} aria-label={`Hapus ${item.title}`} title="Hapus bookmark">{icons.trash}</button>
                              </div>
                            )}
                          </div>
                        </article>
                      ))}

                      {/* Add Card as last item in each section grid */}
                      {!arrangeMode && activeCategory !== 'Semua bookmark' && activeCategory !== 'Favorit' && (
                        <article className="bookmark-card compact add-card-item" onClick={() => openAdd(targetCategoryForAdd)} title="Tambah bookmark baru">
                          <div className="add-card-content">
                            <div className="add-card-icon">+</div>
                            <span className="add-card-label">Tambah bookmark</span>
                          </div>
                        </article>
                      )}
                    </div>

                    {hasManyItems && (
                      <button className="grid-scroll-arrow right" onClick={() => scrollGrid(section.key, 1)} aria-label="Geser kanan">
                        {icons.arrowRight}
                      </button>
                    )}
                  </div>
                )}
              </div>
            );
          })}

          {visible.length === 0 && !bookmarkLoadError && (
            <div className="empty-state">
              <strong>Bookmark tidak ditemukan</strong>
              <span>Tidak ada hasil yang cocok dengan kata kunci atau kategori ini.</span>
            </div>
          )}
        </section>

        {/* Section 5: Footer ("COPYRIGHT 2026 MARDEV") */}
        <footer className="footer-bar">
          <p className="copyright-text">COPYRIGHT 2026 MARDEV</p>
        </footer>
      </div>

      {/* Add / Edit Modal */}
      {modal === 'bookmark' && (
        <div className="modal-backdrop" onMouseDown={() => { setModal(null); setEditingId(null); }}>
          <form
            className="modal"
            role="dialog"
            aria-modal="true"
            aria-labelledby="bookmark-modal-title"
            onSubmit={saveBookmark}
            onMouseDown={(event) => event.stopPropagation()}
          >
            <div className="modal-heading">
              <div>
                <p className="eyebrow">Koleksi pribadi</p>
                <h2 id="bookmark-modal-title">{editingId ? 'Edit bookmark' : 'Tambah bookmark'}</h2>
              </div>
              <button
                type="button"
                className="close-button"
                onClick={() => { setModal(null); setEditingId(null); }}
                aria-label="Tutup modal"
              >
                ×
              </button>
            </div>

            <div className="modal-form">
              <label>
                Nama website
                <input
                  required
                  value={form.title}
                  onChange={(event) => setForm({ ...form, title: event.target.value })}
                  placeholder="Contoh: GitHub"
                />
              </label>

              <div className="modal-form-grid">
                <label>
                  URL
                  <input
                    required
                    value={form.url}
                    onChange={(event) => setForm({ ...form, url: event.target.value })}
                    placeholder="https://github.com"
                  />
                </label>
                <label>
                  Kategori
                  <select
                    value={form.category}
                    onChange={(event) => setForm({ ...form, category: event.target.value })}
                  >
                    {categoryOptions.map((name) => (
                      <option key={name}>{name}</option>
                    ))}
                  </select>
                </label>
              </div>

              <label>
                Deskripsi <span className="optional">Opsional</span>
                <textarea
                  rows="3"
                  value={form.description}
                  onChange={(event) => setForm({ ...form, description: event.target.value })}
                  placeholder="Deskripsi singkat website..."
                />
              </label>
            </div>

            <div className="modal-actions">
              <button
                type="button"
                className="cancel-button"
                onClick={() => { setModal(null); setEditingId(null); }}
              >
                Batal
              </button>
              <button className="save-button">
                {editingId ? 'Simpan perubahan' : 'Simpan bookmark'}
              </button>
            </div>
          </form>
        </div>
      )}

      {categoryManagerOpen && (
        <div className="modal-backdrop" onMouseDown={() => setCategoryManagerOpen(false)}>
          <div
            className="modal category-manager-modal"
            role="dialog"
            aria-modal="true"
            aria-labelledby="category-manager-title"
            onMouseDown={(event) => event.stopPropagation()}
          >
            <div className="modal-heading">
              <div>
                <p className="eyebrow">Ruang kerja</p>
                <h2 id="category-manager-title">Kelola kategori</h2>
                <p className="manager-intro">Ganti nama folder atau pindahkan bookmark tanpa menghapus tautannya.</p>
              </div>
              <button type="button" className="close-button" onClick={() => setCategoryManagerOpen(false)} aria-label="Tutup kelola kategori">×</button>
            </div>

            {categoryFeedback && <p className="manager-feedback" role="status">{categoryFeedback}</p>}

            <form className="manager-action-panel" onSubmit={createCategory}>
              <div className="manager-panel-heading">
                <strong>Buat kategori</strong>
                <span>Kategori baru langsung memiliki bookmark pertama.</span>
              </div>
              <div className="manager-form-row create-category-row">
                <input
                  value={categoryDraft}
                  onChange={(event) => setCategoryDraft(event.target.value)}
                  placeholder="Contoh: Kerja / Desain"
                  aria-label="Nama kategori baru"
                  required
                />
                <select value={managerBookmarkId} onChange={(event) => setManagerBookmarkId(event.target.value)} aria-label="Bookmark untuk kategori baru" required>
                  <option value="">Pilih bookmark…</option>
                  {bookmarks.map((item) => <option key={item.id} value={item.id}>{item.title}</option>)}
                </select>
                <button className="manager-primary-button" type="submit" disabled={!bookmarks.length}>Buat</button>
              </div>
            </form>

            <form className="manager-action-panel" onSubmit={moveManagedBookmark}>
              <div className="manager-panel-heading">
                <strong>Pindahkan satu bookmark</strong>
                <span>Perubahan ini ikut tersimpan ke akunmu.</span>
              </div>
              <div className="manager-form-row move-bookmark-row">
                <select value={managerBookmarkId} onChange={(event) => setManagerBookmarkId(event.target.value)} aria-label="Pilih bookmark yang dipindahkan" required>
                  <option value="">Pilih bookmark…</option>
                  {bookmarks.map((item) => <option key={item.id} value={item.id}>{item.title} · {item.category || 'Tanpa folder'}</option>)}
                </select>
                <select value={managerTargetCategory} onChange={(event) => setManagerTargetCategory(event.target.value)} aria-label="Pilih kategori tujuan" required>
                  <option value="">Kategori tujuan…</option>
                  {categoryOptions.map((name) => <option key={name} value={name}>{name}</option>)}
                </select>
                <button className="manager-secondary-button" type="submit">Pindahkan</button>
              </div>
            </form>

            <div className="manager-category-list">
              <div className="manager-list-heading">
                <strong>Folder saat ini</strong>
                <span>{categoryOptions.length} kategori</span>
              </div>
              {categoryOptions.length ? categoryOptions.map((name) => (
                <div className="manager-category-row" key={name}>
                  {editingCategory === name ? (
                    <form className="manager-rename-form" onSubmit={(event) => renameCategory(event, name)}>
                      <input autoFocus value={categoryNameDraft} onChange={(event) => setCategoryNameDraft(event.target.value)} aria-label={`Nama baru untuk ${name}`} />
                      <button className="manager-primary-button" type="submit">Simpan</button>
                      <button className="manager-quiet-button" type="button" onClick={() => setEditingCategory('')}>Batal</button>
                    </form>
                  ) : (
                    <>
                      <span className="manager-category-name" title={name}>{name}</span>
                      <span className="manager-category-count">{counts(name)}</span>
                      <button className="manager-quiet-button" type="button" onClick={() => { setEditingCategory(name); setCategoryNameDraft(name); setCategoryFeedback(''); }}>Ubah nama</button>
                    </>
                  )}
                </div>
              )) : <p className="manager-empty">Kategori muncul di sini setelah ada bookmark di dalamnya.</p>}
            </div>

            <form className="manager-action-panel bulk-move-panel" onSubmit={(event) => { event.preventDefault(); moveCategoryItems(managerSourceCategory, managerTargetCategory); }}>
              <div className="manager-panel-heading">
                <strong>Pindahkan seluruh isi folder</strong>
                <span>Folder sumber akan hilang setelah semua bookmark dipindahkan.</span>
              </div>
              <div className="manager-form-row">
                <select value={managerSourceCategory} onChange={(event) => setManagerSourceCategory(event.target.value)} aria-label="Pilih kategori sumber">
                  <option value="">Folder sumber…</option>
                  {categoryOptions.map((name) => <option key={name} value={name}>{name}</option>)}
                </select>
                <select value={managerTargetCategory} onChange={(event) => setManagerTargetCategory(event.target.value)} aria-label="Pilih folder tujuan">
                  <option value="">Folder tujuan…</option>
                  {categoryOptions.filter((name) => name !== managerSourceCategory && !name.startsWith(`${managerSourceCategory} / `)).map((name) => <option key={name} value={name}>{name}</option>)}
                </select>
                <button className="manager-secondary-button" type="submit">Pindahkan semua</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {importPreview && (
        <div className="modal-backdrop" onMouseDown={() => !importBusy && setImportPreview(null)}>
          <div
            className="modal import-preview-modal"
            role="dialog"
            aria-modal="true"
            aria-labelledby="import-preview-title"
            onMouseDown={(event) => event.stopPropagation()}
          >
            <div className="modal-heading">
              <div>
                <p className="eyebrow">Impor Chrome</p>
                <h2 id="import-preview-title">Tinjau bookmark</h2>
                <p className="manager-intro">{importPreview.fileName}</p>
              </div>
              <button type="button" className="close-button" onClick={() => !importBusy && setImportPreview(null)} aria-label="Tutup pratinjau impor">×</button>
            </div>
            <div className="import-summary">
              <strong>{importPreview.bookmarks.length} bookmark siap diimpor</strong>
              <span>{importPreview.skipped} duplikat atau tautan tidak didukung dilewati.</span>
            </div>
            {importError && <p className="form-error" role="alert">{importError}</p>}
            <div className="import-preview-list">
              {importPreview.bookmarks.slice(0, 80).map((item, index) => (
                <div className="import-preview-row" key={`${item.url}-${index}`}>
                  <span className="import-preview-title">{item.title}</span>
                  <span className="import-preview-url">{item.url}</span>
                  <span className="import-preview-category">{item.category}</span>
                </div>
              ))}
              {importPreview.bookmarks.length > 80 && <p className="manager-empty">Menampilkan 80 pertama dari {importPreview.bookmarks.length} bookmark.</p>}
              {!importPreview.bookmarks.length && <p className="manager-empty">Tidak ada bookmark baru untuk diimpor.</p>}
            </div>
            <div className="modal-actions">
              <button type="button" className="cancel-button" disabled={importBusy} onClick={() => setImportPreview(null)}>Batal</button>
              <button type="button" className="save-button" disabled={importBusy || !importPreview.bookmarks.length} onClick={confirmImport}>
                {importBusy ? 'Menyimpan…' : `Impor ${importPreview.bookmarks.length} bookmark`}
              </button>
            </div>
          </div>
        </div>
      )}

      {profileModalOpen && (
        <div className="modal-backdrop" onMouseDown={() => setProfileModalOpen(false)}>
          <form
            className="modal profile-modal"
            role="dialog"
            aria-modal="true"
            aria-labelledby="profile-modal-title"
            onSubmit={saveProfile}
            onMouseDown={(event) => event.stopPropagation()}
          >
            <div className="modal-heading">
              <div>
                <p className="eyebrow">Akun Google</p>
                <h2 id="profile-modal-title">Edit nama profil</h2>
              </div>
              <button type="button" className="close-button" onClick={() => setProfileModalOpen(false)} aria-label="Tutup modal">×</button>
            </div>
            <div className="modal-form">
              <label>
                Nama tampilan
                <input
                  autoFocus
                  required
                  maxLength={50}
                  value={profileName}
                  onChange={(event) => setProfileName(event.target.value)}
                  placeholder="Nama Anda"
                />
              </label>
              {profileError && <p className="form-error" role="alert">{profileError}</p>}
            </div>
            <div className="modal-actions">
              <button type="button" className="cancel-button" onClick={() => setProfileModalOpen(false)}>Batal</button>
              <button className="save-button" disabled={profileSaving}>{profileSaving ? 'Menyimpan…' : 'Simpan nama'}</button>
            </div>
          </form>
        </div>
      )}
    </main>
  );
};
