const decodeHtml = (value) => {
  const document = new DOMParser().parseFromString(value, 'text/html');
  return document.body.textContent || '';
};

const normalizeImportedUrl = (value) => {
  try {
    const url = new URL(value.trim());
    return ['http:', 'https:'].includes(url.protocol) ? url.href : null;
  } catch {
    return null;
  }
};

export function parseChromeBookmarksHtml(markup) {
  const tokens = markup.match(/<[^>]*>|[^<]+/g) || [];
  const folders = [];
  const items = [];
  const seenUrls = new Set();
  let pendingFolder = '';
  let headingParts = [];
  let titleParts = [];
  let inHeading = false;
  let inAnchor = false;
  let currentUrl = '';
  let skipped = 0;

  for (const token of tokens) {
    if (/^<h3\b/i.test(token)) {
      inHeading = true;
      headingParts = [];
      continue;
    }
    if (/^<\/h3\s*>/i.test(token)) {
      pendingFolder = headingParts.join('').trim();
      inHeading = false;
      continue;
    }
    if (/^<dl\b/i.test(token)) {
      if (pendingFolder) folders.push(pendingFolder);
      pendingFolder = '';
      continue;
    }
    if (/^<\/dl\s*>/i.test(token)) {
      folders.pop();
      continue;
    }
    if (/^<a\b/i.test(token)) {
      const href = token.match(/\bhref\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s>]+))/i);
      currentUrl = normalizeImportedUrl(decodeHtml(href?.[1] ?? href?.[2] ?? href?.[3] ?? ''));
      titleParts = [];
      inAnchor = true;
      continue;
    }
    if (/^<\/a\s*>/i.test(token)) {
      const title = titleParts.join('').trim() || currentUrl || '';
      if (!currentUrl || seenUrls.has(currentUrl)) {
        skipped += 1;
      } else {
        seenUrls.add(currentUrl);
        const categoryParts = folders.filter((folder) => folder.toLowerCase() !== 'bookmarks bar');
        const domain = new URL(currentUrl).hostname;
        items.push({
          title,
          url: currentUrl,
          description: '',
          category: categoryParts.join(' / ') || 'Lainnya',
          icon: title.charAt(0).toUpperCase() || domain.charAt(0).toUpperCase() || '?',
          favicon: `https://www.google.com/s2/favicons?domain=${domain}&sz=64`,
          favorite: false,
        });
      }
      inAnchor = false;
      currentUrl = '';
      continue;
    }
    if (token.startsWith('<')) continue;
    const text = decodeHtml(token);
    if (inHeading) headingParts.push(text);
    else if (inAnchor) titleParts.push(text);
  }

  return { bookmarks: items, skipped };
}

const escapeHtml = (value) => String(value ?? '').replace(/[&<>"']/g, (character) => ({
  '&': '&amp;',
  '<': '&lt;',
  '>': '&gt;',
  '"': '&quot;',
  "'": '&#39;',
}[character]));

export function createChromeBookmarksHtml(bookmarks) {
  const root = { folders: new Map(), bookmarks: [] };
  const timestamp = Math.floor(Date.now() / 1000);

  for (const bookmark of bookmarks) {
    const parts = String(bookmark.category || 'Lainnya').split(' / ').map((part) => part.trim()).filter(Boolean);
    let current = root;
    for (const part of parts) {
      if (!current.folders.has(part)) current.folders.set(part, { folders: new Map(), bookmarks: [] });
      current = current.folders.get(part);
    }
    current.bookmarks.push(bookmark);
  }

  const renderFolder = (name, node, depth) => {
    const indent = '    '.repeat(depth);
    const children = [
      ...[...node.folders.entries()].map(([folderName, child]) => renderFolder(folderName, child, depth + 1)),
      ...node.bookmarks.map((bookmark) => `${indent}    <DT><A HREF="${escapeHtml(bookmark.url)}" ADD_DATE="${timestamp}">${escapeHtml(bookmark.title || bookmark.url)}</A>`),
    ].join('\n');
    return `${indent}<DT><H3 ADD_DATE="${timestamp}" LAST_MODIFIED="${timestamp}">${escapeHtml(name)}</H3>\n${indent}<DL><p>\n${children}\n${indent}</DL><p>`;
  };

  const contents = [
    ...[...root.folders.entries()].map(([name, node]) => renderFolder(name, node, 2)),
    ...root.bookmarks.map((bookmark) => `        <DT><A HREF="${escapeHtml(bookmark.url)}" ADD_DATE="${timestamp}">${escapeHtml(bookmark.title || bookmark.url)}</A>`),
  ].join('\n');

  return `<!DOCTYPE NETSCAPE-Bookmark-file-1>\n<!-- Exported from Lokalinks -->\n<META HTTP-EQUIV="Content-Type" CONTENT="text/html; charset=UTF-8">\n<TITLE>Bookmarks</TITLE>\n<H1>Bookmarks</H1>\n<DL><p>\n    <DT><H3 ADD_DATE="${timestamp}" LAST_MODIFIED="${timestamp}" PERSONAL_TOOLBAR_FOLDER="true">Bookmarks bar</H3>\n    <DL><p>\n${contents}\n    </DL><p>\n</DL><p>\n`;
}
