#!/usr/bin/env python3
"""Copy the two offline releases into pages/ and check local asset links."""

from html.parser import HTMLParser
from pathlib import Path
import re
import shutil
from urllib.parse import unquote, urlsplit

ROOT = Path(__file__).resolve().parents[1]
SITE = ROOT / "pages"
RELEASES = {
    "tensorscope": ("Project_gpt6.1/release", ("index.html", "app.js", "style.css")),
    "game": ("game", ("index.html", "three.min.js")),
}


def check_reference(source, reference):
    url = urlsplit(reference)
    if url.scheme or url.netloc or not url.path:
        return
    if url.path.startswith("/"):
        raise ValueError(f"{source.relative_to(SITE)}: absolute URL breaks project Pages: {reference}")
    target = (source.parent / unquote(url.path)).resolve()
    if not target.is_relative_to(SITE.resolve()):
        raise ValueError(f"Reference escapes pages/: {reference}")
    if target.is_dir():
        target = target / "index.html"
    if not target.is_file():
        raise FileNotFoundError(f"{source.relative_to(SITE)}: missing {reference}")


class AssetLinks(HTMLParser):
    def __init__(self, source):
        super().__init__()
        self.source = source

    def handle_starttag(self, tag, attrs):
        for name, value in attrs:
            if name in ("src", "href", "poster") and value:
                check_reference(self.source, value)


def main():
    if not (SITE / "index.html").is_file():
        raise FileNotFoundError("Missing pages/index.html landing page")
    for source, names in RELEASES.values():
        for name in names:
            if not (ROOT / source / name).is_file():
                raise FileNotFoundError(ROOT / source / name)
    for destination, (source, names) in RELEASES.items():
        folder = SITE / destination
        folder.mkdir(parents=True, exist_ok=True)
        for name in names:
            shutil.copyfile(ROOT / source / name, folder / name)
    (SITE / ".nojekyll").touch()
    for source in SITE.rglob("*.html"):
        AssetLinks(source).feed(source.read_text(encoding="utf-8"))
    for source in SITE.rglob("*.css"):
        for match in re.finditer(r"url\(\s*([^)]*)\)", source.read_text(encoding="utf-8")):
            check_reference(source, match[1].strip().strip("\"'"))
    print("Pages ready: landing page, TensorScope, Aim Trainer; all local asset links exist.")


if __name__ == "__main__":
    main()
