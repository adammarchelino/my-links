from __future__ import annotations

import json
import re
from html.parser import HTMLParser
from pathlib import Path
from urllib.parse import urlparse


class ChromeBookmarkParser(HTMLParser):
    """Parse Chrome's Netscape bookmark export while preserving folder paths."""

    def __init__(self) -> None:
        super().__init__(convert_charrefs=True)
        self.folder_stack: list[str] = []
        self.pending_folder: str | None = None
        self.in_h3 = False
        self.h3_parts: list[str] = []
        self.link: dict[str, str] | None = None
        self.items: list[dict[str, object]] = []

    def handle_starttag(self, tag: str, attrs: list[tuple[str, str | None]]) -> None:
        attrs_dict = dict(attrs)
        if tag == "h3":
            self.in_h3 = True
            self.h3_parts = []
        elif tag == "dl" and self.pending_folder:
            self.folder_stack.append(self.pending_folder)
            self.pending_folder = None
        elif tag == "a" and attrs_dict.get("href"):
            self.link = {
                "title": "",
                "url": attrs_dict["href"] or "",
                "path": " / ".join(self.folder_stack),
            }

    def handle_endtag(self, tag: str) -> None:
        if tag == "h3" and self.in_h3:
            self.pending_folder = "".join(self.h3_parts).strip()
            self.in_h3 = False
        elif tag == "a" and self.link:
            title = self.link["title"].strip() or self.link["url"]
            self.items.append({**self.link, "title": title})
            self.link = None
        elif tag == "dl" and self.folder_stack:
            self.folder_stack.pop()

    def handle_data(self, data: str) -> None:
        if self.in_h3:
            self.h3_parts.append(data)
        elif self.link is not None:
            self.link["title"] += data


def parse_bookmarks(source: Path) -> list[dict[str, object]]:
    parser = ChromeBookmarkParser()
    parser.feed(source.read_text(encoding="utf-8"))
    seen: set[str] = set()
    result: list[dict[str, object]] = []
    for item in parser.items:
        url = str(item["url"]).strip()
        if not url or url in seen or url.startswith(("javascript:", "chrome://")):
            continue
        seen.add(url)
        path = str(item["path"])
        # Remove the export's technical root folder from the user-facing category.
        parts = [part for part in path.split(" / ") if part and part.lower() != "bookmarks bar"]
        category = " / ".join(parts) or "Lainnya"
        domain = urlparse(url).netloc or url.split("/")[0]
        result.append({
            "id": len(result) + 1,
            "title": str(item["title"]).strip(),
            "url": url,
            "description": "",
            "category": category,
            "icon": (str(item["title"]).strip()[:1] or domain[:1] or "?").upper(),
            "favicon": f"https://www.google.com/s2/favicons?domain={domain}&sz=64" if domain else "",
            "favorite": False,
        })
    return result


def js_string(value: object) -> str:
    return json.dumps(value, ensure_ascii=False)


def write_data(items: list[dict[str, object]], output: Path) -> None:
    categories: list[str] = []
    for item in items:
        category = str(item["category"])
        if category not in categories:
            categories.append(category)
    lines = ["export const categories = ["]
    for category in categories:
        lines.append(f"  {{ name: {js_string(category)}, count: 0 }},")
    lines += ["];", "", "export const bookmarks = ["]
    for item in items:
        lines.append("  " + json.dumps(item, ensure_ascii=False) + ",")
    lines += ["];"]
    output.write_text("\n".join(lines) + "\n", encoding="utf-8")


if __name__ == "__main__":
    import argparse
    parser = argparse.ArgumentParser()
    parser.add_argument("source", type=Path)
    parser.add_argument("output", type=Path)
    args = parser.parse_args()
    items = parse_bookmarks(args.source)
    write_data(items, args.output)
    categories = sorted({str(item["category"]) for item in items})
    print(json.dumps({"bookmarks": len(items), "categories": len(categories), "category_names": categories}, ensure_ascii=False))
