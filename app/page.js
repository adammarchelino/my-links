'use client';

import { useEffect, useMemo, useState, useRef } from 'react';
import { bookmarks as initialBookmarks } from '../lib/data';

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
  const [activeCategory, setActiveCategory] = useState('Semua bookmark');
  const [query, setQuery] = useState('');
  const [dark, setDark] = useState(true);
  const [bookmarks, setBookmarks] = useState(initialBookmarks);
  const [bookmarksLoaded, setBookmarksLoaded] = useState(false);
  const [modal, setModal] = useState(null);
  const [arrangeMode, setArrangeMode] = useState(false);
  const [draggedId, setDraggedId] = useState(null);
  const [sortMode, setSortMode] = useState('custom');
  const [orderMap, setOrderMap] = useState({});
  const [collapsedSections, setCollapsedSections] = useState({});
  const [form, setForm] = useState({ title: '', url: '', description: '', category: 'Tools' });
  const [editingId, setEditingId] = useState(null);

  // Mouse drag to scroll state
  const [isDraggingScroll, setIsDraggingScroll] = useState(false);
  const [startX, setStartX] = useState(0);
  const [scrollLeftState, setScrollLeftState] = useState(0);

  const categoryScrollRef = useRef(null);
  const gridScrollRefs = useRef({});

  const folderTree = useMemo(() => {
    const tree = {};
    bookmarks.forEach((item) => {
      const { parent, child } = splitCategory(item.category);
      if (!tree[parent]) tree[parent] = { count: 0, children: {} };
      tree[parent].count += 1;
      if (child) tree[parent].children[child] = (tree[parent].children[child] || 0) + 1;
    });
    return tree;
  }, [bookmarks]);

  const folderNames = Object.keys(folderTree);
  const categoryNames = ['Semua bookmark', 'Favorit', ...folderNames];
  const categoryOptions = [...new Set([...folderNames, ...bookmarks.map((item) => item.category)])].sort((a, b) => a.localeCompare(b));

  useEffect(() => {
    try {
      const savedBookmarks = window.localStorage.getItem('my-links-bookmarks');
      const savedOrder = window.localStorage.getItem('my-links-order');
      const savedCollapsed = window.localStorage.getItem('my-links-collapsed-sections');
      if (savedBookmarks) setBookmarks(JSON.parse(savedBookmarks));
      if (savedOrder) setOrderMap(JSON.parse(savedOrder));
      if (savedCollapsed) setCollapsedSections(JSON.parse(savedCollapsed));
    } catch { /* optional */ }
    setBookmarksLoaded(true);
  }, []);

  useEffect(() => {
    if (bookmarksLoaded) {
      try {
        window.localStorage.setItem('my-links-bookmarks', JSON.stringify(bookmarks));
      } catch { /* optional */ }
    }
  }, [bookmarks, bookmarksLoaded]);

  useEffect(() => {
    try {
      window.localStorage.setItem('my-links-order', JSON.stringify(orderMap));
    } catch { /* optional */ }
  }, [orderMap]);

  useEffect(() => {
    try {
      window.localStorage.setItem('my-links-collapsed-sections', JSON.stringify(collapsedSections));
    } catch { /* optional */ }
  }, [collapsedSections]);

  const matchesCategory = (item) => {
    if (activeCategory === 'Semua bookmark') return true;
    if (activeCategory === 'Favorit') return item.favorite;
    if (folderNames.includes(activeCategory)) return parentOf(item) === activeCategory;
    return item.category === activeCategory;
  };

  const visible = useMemo(() => bookmarks.filter((item) => {
    const searchable = `${item.title} ${item.url} ${item.description} ${item.category}`.toLowerCase();
    return matchesCategory(item) && searchable.includes(query.toLowerCase());
  }), [activeCategory, bookmarks, folderNames, query]);

  const sections = useMemo(() => {
    if (activeCategory === 'Semua bookmark' || activeCategory === 'Favorit') {
      return [{ key: activeCategory, title: null, items: customSort(visible, orderMap, sortMode) }];
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
      items: customSort(items, orderMap, sortMode)
    }));
  }, [activeCategory, orderMap, sortMode, visible]);

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
    setCollapsedSections((current) => ({
      ...current,
      [key]: !current[key]
    }));
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

  function deleteBookmark(item) {
    if (window.confirm(`Hapus bookmark "${item.title}"?`)) {
      setBookmarks((items) => items.filter((current) => current.id !== item.id));
      setOrderMap((current) => Object.fromEntries(Object.entries(current).map(([key, ids]) => [key, ids.filter((id) => id !== item.id)])));
    }
  }

  function saveBookmark(event) {
    event.preventDefault();
    if (!form.title.trim() || !form.url.trim()) return;
    const url = normalizeUrl(form.url);
    if (editingId) {
      setBookmarks((items) => items.map((item) => item.id === editingId ? { ...item, ...form, url, icon: form.title.trim().charAt(0).toUpperCase() } : item));
    } else {
      setBookmarks((items) => [{ id: Date.now(), ...form, url, icon: form.title.trim().charAt(0).toUpperCase(), favorite: false }, ...items]);
    }
    setModal(null);
    setEditingId(null);
  }

  const toggleFavorite = (id) => setBookmarks((items) => items.map((item) => item.id === id ? { ...item, favorite: !item.favorite } : item));

  const scrollCategories = (direction) => {
    if (categoryScrollRef.current) {
      categoryScrollRef.current.scrollBy({ left: direction * 240, behavior: 'smooth' });
    }
  };

  const scrollGrid = (key, direction) => {
    const el = gridScrollRefs.current[key];
    if (el) {
      const cardWidth = el.querySelector('.bookmark-card') ? el.querySelector('.bookmark-card').offsetWidth + 16 : 300;
      el.scrollBy({ left: direction * cardWidth * 4, behavior: 'smooth' });
    }
  };

  return (
    <main className={dark ? 'app dark' : 'app'}>
      {/* Main Page Layout (Centered Canvas) */}
      <div className="layout-canvas">
        {/* Top Header Bar */}
        <header className="topbar">
          <div className="topbar-left">
            <div className="brand-text-only large">
              MY LINKS
            </div>
          </div>

          <div className="topbar-right">
            <button
              className="icon-button"
              onClick={() => setDark(!dark)}
              aria-label={dark ? 'Mode terang' : 'Mode gelap'}
              title={dark ? 'Ganti ke mode terang' : 'Ganti ke mode gelap'}
            >
              {dark ? icons.sun : icons.moon}
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

        {/* Section 2: Category Navbar (Simple & Clean) */}
        <section className="category-section" aria-label="Navigasi Kategori">
          <button className="nav-arrow left" onClick={() => scrollCategories(-1)} aria-label="Geser kategori ke kiri">
            {icons.arrowLeft}
          </button>
          <div className="category-track" ref={categoryScrollRef}>
            {categoryNames.map((name) => (
              <button
                key={name}
                className={activeCategory === name ? 'cat-item active' : 'cat-item'}
                onClick={() => selectCategory(name)}
              >
                <span>{name}</span>
                <span className="cat-badge">{counts(name)}</span>
              </button>
            ))}
          </div>
          <button className="nav-arrow right" onClick={() => scrollCategories(1)} aria-label="Geser kategori ke kanan">
            {icons.arrowRight}
          </button>
        </section>

        {/* Section Header & View Options */}
        <div className="content-toolbar">
          <div className="active-meta">
            <h1 className="active-title">{activeCategory}</h1>
            <span className="active-count">{visible.length} bookmark</span>
          </div>
          <div className="toolbar-actions">
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
          {sections.map((section) => {
            const isCollapsed = !!collapsedSections[section.key];
            const hasManyItems = section.items.length > 10 && !arrangeMode;
            const targetCategoryForAdd = activeCategory === 'Semua bookmark' || activeCategory === 'Favorit' ? (folderNames[0] || 'Lainnya') : (section.title ? `${activeCategory} / ${section.title}` : activeCategory);

            return (
              <div className="section-block" key={section.key}>
                {section.title && (
                  <div className="section-header-title clickable" onClick={() => toggleSectionCollapse(section.key)}>
                    <div className="section-title-left">
                      <span className={isCollapsed ? 'section-chevron collapsed' : 'section-chevron'}>
                        {icons.chevron}
                      </span>
                      <h2>{section.title}</h2>
                      <span className="badge">{section.items.length}</span>
                    </div>
                  </div>
                )}

                {!isCollapsed && (
                  <div className="grid-wrapper">
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
                      {!arrangeMode && (
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

          {visible.length === 0 && (
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
    </main>
  );
};
