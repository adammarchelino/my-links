from pathlib import Path
import sys
sys.path.insert(0, str(Path(__file__).resolve().parents[1] / 'scripts'))
from import_bookmarks import parse_bookmarks

SOURCE = Path('C:/Users/ASUS/Downloads/bookmarks_10_27_26.html')


def test_import_has_real_bookmarks():
    items = parse_bookmarks(SOURCE)
    assert len(items) > 50
    assert any(item['title'] == 'ChatGPT' for item in items)
    assert any(item['title'] == 'Flaticon' for item in items)


def test_import_preserves_folder_categories():
    items = parse_bookmarks(SOURCE)
    by_title = {item['title']: item for item in items}
    assert by_title['ChatGPT']['category'] == 'AI'
    assert by_title['Classroom']['category'] == 'Study / Course'
    assert by_title['UXPilot']['category'] == 'Tools / Media'


def test_import_skips_duplicate_urls():
    items = parse_bookmarks(SOURCE)
    urls = [item['url'] for item in items]
    assert len(urls) == len(set(urls))
