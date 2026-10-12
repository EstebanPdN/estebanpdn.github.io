"""Check the built portfolio's references and owner-approved project content.

This is a static integration check. It does not replace browser checks of
animation, layout, navigation, or current remote repository availability.
"""
import argparse
from collections import Counter
from dataclasses import dataclass, field
from html.parser import HTMLParser
from pathlib import Path
import re
from urllib.parse import unquote, urlsplit


ROOT = Path(__file__).resolve().parents[1]
VOID = set("area base br col embed hr img input link meta param source track wbr".split())
PROJECTS = {
    "kart": ("mario-kart-64.html", 65, "mario-kart-64-3ds"),
    "minish": ("the-minish-cap.html", 100, "zelda-tmc-3ds"),
    "alttp": ("a-link-to-the-past.html", 100, "zelda-alttp-3ds"),
    "doom": ("legend-of-doom.html", 100, "legend-of-doom-3ds"),
    "starwing": ("star-fox.html", 70, "starwing-3ds"),
    "dusklight": ("dusklight.html", 10, None),
    "sm64ds": ("super-mario-64-ds.html", 35, None),
    "viper": ("red-viper-color.html", 75, None),
}


@dataclass
class Element:
    tag: str
    attrs: dict
    line: int
    children: list = field(default_factory=list)
    chunks: list = field(default_factory=list)

    def all(self):
        yield self
        for child in self.children:
            yield from child.all()

    def has_class(self, name):
        return name in self.attrs.get("class", "").split()

    def text(self):
        return " ".join(" ".join(self.chunks + [child.text() for child in self.children]).split())


class Document(HTMLParser):
    def __init__(self, path):
        super().__init__(convert_charrefs=True)
        self.path = path
        self.source = path.read_text()
        self.root = Element("document", {}, 1)
        self.stack = [self.root]
        self.feed(self.source)
        self.nodes = list(self.root.all())[1:]
        self.ids = {node.attrs["id"] for node in self.nodes if "id" in node.attrs}

    def handle_starttag(self, tag, attrs):
        node = Element(tag, dict(attrs), self.getpos()[0])
        self.stack[-1].children.append(node)
        if tag not in VOID:
            self.stack.append(node)

    def handle_startendtag(self, tag, attrs):
        self.handle_starttag(tag, attrs)
        if tag not in VOID:
            self.handle_endtag(tag)

    def handle_endtag(self, tag):
        for index in range(len(self.stack) - 1, 0, -1):
            if self.stack[index].tag == tag:
                del self.stack[index:]
                return

    def handle_data(self, data):
        self.stack[-1].chunks.append(data)

    def with_id(self, value):
        return next((node for node in self.nodes if node.attrs.get("id") == value), None)


def check_site(directory):
    directory = directory.resolve()
    errors, references = [], 0
    documents = {path.resolve(): Document(path) for path in directory.rglob("*.html")}

    def require(condition, message):
        if not condition:
            errors.append(message)

    def check_reference(source, value, line=0):
        nonlocal references
        if not value or value.startswith(("data:", "mailto:", "tel:", "javascript:")):
            return
        parts = urlsplit(value)
        if parts.scheme or parts.netloc:
            return
        references += 1
        name = unquote(parts.path)
        destination = (directory / name.lstrip("/") if name.startswith("/") else source.parent / name).resolve() if name else source
        if destination.is_dir():
            destination /= "index.html"
        location = f"{source.relative_to(directory)}:{line}"
        require(destination.is_relative_to(directory), f"{location}: reference escapes build: {value}")
        require(destination.is_file(), f"{location}: missing reference: {value}")
        if parts.fragment and destination in documents:
            # These two hash routes select panels in dual.js rather than scroll
            # to a same-named element. Every other fragment must identify markup.
            panel_route = destination == directory / "index.html" and parts.fragment in {"collection", "progress", "info"}
            require(panel_route or unquote(parts.fragment) in documents[destination].ids,
                    f"{location}: missing fragment: {value}")

    require(bool(documents), f"No HTML found in {directory}; run scripts/build.py first.")
    for path, document in documents.items():
        banners = [node for node in document.nodes if node.has_class('forge-header-band')]
        require(len(banners) == 1, f"{path.name}: needs one shared system bar")
        if banners:
            banner = banners[0]
            require('data-forge-persistent' in banner.attrs, f"{path.name}: system bar must survive scene changes")
            controls = [node for node in banner.all() if 'data-dual-page' in node.attrs]
            require([node.attrs['data-dual-page'] for node in controls] == ['collection', 'progress', 'info'], f"{path.name}: inconsistent primary navigation")
            require(all(any(node.has_class(name) for node in banner.all()) for name in ('brand', 'battery', 'theme-toggle', 'sound')), f"{path.name}: missing shared system controls")
            require(any('data-clock' in node.attrs for node in banner.all()), f"{path.name}: missing shared clock")
        header_styles = [node for node in document.nodes if node.tag == 'link' and urlsplit(node.attrs.get('href', '')).path == 'forge-header.css']
        require(len(header_styles) == 1 and 'data-forge-page-style' not in header_styles[0].attrs, f"{path.name}: system bar styles must stay loaded across routes")
        names = Counter(node.attrs["id"] for node in document.nodes if "id" in node.attrs)
        require(all(count == 1 for count in names.values()), f"{path.name}: duplicate IDs: {[key for key, count in names.items() if count > 1]}")
        require("butterscotch" not in document.source.casefold(), f"{path.name}: excluded project Butterscotch is present")
        for node in document.nodes:
            for attribute in ("src", "href", "xlink:href", "poster"):
                if attribute in node.attrs:
                    check_reference(path, node.attrs[attribute], node.line)
            for attribute in ("aria-labelledby", "aria-describedby", "aria-controls"):
                for target in node.attrs.get(attribute, "").split():
                    require(target in document.ids, f"{path.name}:{node.line}: {attribute} points to missing #{target}")
            if node.tag == "img":
                require("alt" in node.attrs, f"{path.name}:{node.line}: image needs an alt attribute")
    for path in directory.rglob("*.css"):
        for match in re.finditer(r"url\(\s*['\"]?([^)'\"]+)['\"]?\s*\)", path.read_text()):
            check_reference(path, match.group(1).strip())

    index = documents.get(directory / "index.html")
    require(index is not None, "Missing index.html")
    if index:
        tiles = [node for node in index.nodes if node.has_class("game-channel")]
        expected_tiles = ["minish", "doom", "alttp", "kart", "sm64ds", "dusklight", "starwing", "viper"]
        require(len(tiles) == 8, f"Collection must contain exactly eight tiles, found {len(tiles)}")
        for group_class, keys, title_id, title in (
            ("released-mosaic", expected_tiles[:4], "library-title", "Released Ports"),
            ("development-mosaic", expected_tiles[4:], "development-library-title", "Ports in Development"),
        ):
            group = next((node for node in index.nodes if node.has_class(group_class)), None)
            links = [node.attrs.get("href") for node in group.all() if node.has_class("game-channel")] if group else []
            require(links == [PROJECTS[key][0] for key in keys], f"Collection {title}: incorrect membership/order")
            heading = index.with_id(title_id)
            require(heading is not None and heading.text().strip() == title, f"Collection {title}: missing heading")
        for tile, key in zip(tiles, expected_tiles):
            filename, _, _ = PROJECTS[key]
            require(tile.tag == "a" and tile.attrs.get("href") == filename,
                    f"Collection {key}: tile must navigate to {filename}")
            require(tile.has_class("game-" + key), f"Collection order/style changed at {key}")
            require("data-console" not in tile.attrs, f"Collection {key}: tile must not select the carousel")
            require(any(node.has_class("channel-wallpaper") for node in tile.all()), f"Collection {key}: original wallpaper missing")
            require(any(node.has_class("channel-logo") for node in tile.all()), f"Collection {key}: original logo missing")
            asset_name = "starwing" if key == "starwing" else filename.removesuffix(".html")
            artwork = {"sm64ds": "assets/mario-ds/collection-ds-scene.jpg", "dusklight": "assets/dusklight/collection-amber-twilight.webp", "viper": "assets/red-viper/virtual-boy-tile.png"}.get(key, f"assets/artwork/{asset_name}.png")
            # The owner requested a clean alpha variant; its original is retained.
            logo = {"sm64ds": "assets/logos/super-mario-64-ds-clean.svg", "viper": "assets/red-viper/menu-wordmark.png"}.get(key, f"assets/logos/{asset_name}.png")
            require(any(node.has_class("channel-wallpaper") and node.attrs.get("src") == artwork for node in tile.all()), f"Collection {key}: approved artwork changed")
            require(any(node.tag == "image" and node.attrs.get("href") == logo for node in tile.all()), f"Collection {key}: approved logo changed")
        rail = [node.attrs.get("data-console") for node in index.nodes if node.has_class("rail-project")]
        require(rail == ["alttp", "minish", "kart", "doom", "starwing"], f"Carousel games/order changed: {rail}")
        ports = index.with_id("progress-ports")
        cards = [node for node in ports.all() if node.has_class("progress-card")] if ports else []
        require(len(cards) == 8, f"Owner progress must show eight projects, found {len(cards)}")
        for key, (filename, value, _) in PROJECTS.items():
            card = next((node for node in cards if node.has_class("port-" + key)), None)
            require(card is not None, f"Missing progress card: {key}")
            if card is None:
                continue
            meters = [node for node in card.all() if node.attrs.get("role") == "progressbar"]
            require(len(meters) == 1 and meters[0].attrs.get("aria-valuenow") == str(value), f"{key}: accessible progress must equal {value}%")
            require(any(node.tag == "a" and node.attrs.get("href") == filename for node in card.all()), f"{key}: missing detail link")
            text = card.text().casefold()
            if value == 100:
                require("completed" in text, f"{key}: completion is not stated")
            if key in {"alttp", "minish"}:
                require("future improvements" in text, f"{key}: future improvements are not stated")
            elif key == "doom":
                require("future improvements" not in text, "Doom must not imply future improvements")
            elif key == "dusklight":
                require("unreleased" in text, "Dusklight must be marked unreleased")
            elif key == "sm64ds":
                require("in development" in text and "nintendo ds" in text, "Super Mario 64 DS must be an in-development Nintendo DS port")
        require("Check it out!" in index.source, "Approved welcome button text is missing")

    icon = directory / "assets/brand/estebans-forge-icon.png"
    if icon.is_file():
        header = icon.read_bytes()[:24]
        require(header[:8] == b"\x89PNG\r\n\x1a\n" and int.from_bytes(header[16:20], "big") == 400 and int.from_bytes(header[20:24], "big") == 400,
                "Approved pixel-art brand icon must remain a 400 × 400 PNG")

    for key, (filename, value, repository) in PROJECTS.items():
        page = documents.get(directory / filename)
        require(page is not None, f"Missing project page: {filename}")
        if not page:
            continue
        require(any(node.tag == "h1" and node.text().strip() for node in page.nodes), f"{filename}: missing descriptive h1")
        require(any(node.tag == "a" and urlsplit(node.attrs.get("href", "")).path == "index.html" for node in page.nodes), f"{filename}: no return link to portfolio")
        meters = [node for node in page.nodes if node.attrs.get("role") == "progressbar"]
        require(len(meters) == 1 and meters[0].attrs.get("aria-valuenow") == str(value), f"{filename}: detail progress must equal index progress ({value}%)")
        if repository:
            expected = f"https://github.com/EstebanPdN/{repository}"
            links = [node.attrs.get("href", "").rstrip("/") for node in page.nodes if node.tag == "a"]
            require(expected in links, f"{filename}: missing verified project repository {expected}")
            thumbs = [node for node in page.nodes if node.has_class("gallery-thumb")]
            require(len(thumbs) >= 3, f"{filename}: gallery must provide multiple project views")
            require(sum(node.attrs.get("aria-pressed") == "true" for node in thumbs) == 1, f"{filename}: gallery needs one initial selected image")
            require(all(node.attrs.get("aria-label") and node.attrs.get("data-caption") for node in thumbs), f"{filename}: gallery controls need descriptive labels/captions")
            require(all(any(node.tag == "svg" and node.attrs.get("viewbox") == "0 0 400 240" for node in thumb.all()) for thumb in thumbs),
                    f"{filename}: every gallery thumbnail must show only the upper screen")
            lightbox = page.with_id("gallery-lightbox")
            require(lightbox is not None and lightbox.tag == "dialog", f"{filename}: gallery needs its accessible fullscreen dialog")
            enlarged = page.with_id("lightbox-image")
            require(enlarged is not None and enlarged.attrs.get("viewbox") == "0 0 400 240" and "data-gallery-display" in enlarged.attrs,
                    f"{filename}: the enlarged viewer must start with the upper screen")
            modes = [node for node in page.nodes if "data-gallery-screen" in node.attrs]
            enlarged_modes = [node for node in lightbox.all() if "data-gallery-screen" in node.attrs] if lightbox else []
            inline_modes = [node for node in modes if all(node is not candidate for candidate in enlarged_modes)]
            require(not inline_modes, f"{filename}: screen controls must appear only in the enlarged gallery")
            for location, buttons in (("enlarged", enlarged_modes),):
                require(len(buttons) == 2 and {node.attrs.get("data-gallery-screen") for node in buttons} == {"upper", "lower"},
                        f"{filename}: {location} gallery needs upper/lower screen controls")
                require(all(node.tag == "button" and node.attrs.get("type") == "button" and node.text().strip() for node in buttons),
                        f"{filename}: {location} screen controls must be labelled buttons")
                require(all(node.attrs.get("aria-pressed") == ("true" if node.attrs.get("data-gallery-screen") == "upper" else "false") for node in buttons),
                        f"{filename}: {location} screen controls must default to the upper screen")
            stage = page.with_id("gallery-image")
            require(stage is not None and stage.attrs.get("viewbox") == "0 0 400 240",
                    f"{filename}: the main gallery must start with the upper capture")
            scenes = {node.attrs.get("data-scene") for node in thumbs}
            feature_links = [node for node in page.nodes if "data-gallery-feature" in node.attrs]
            require(all(node.attrs.get("data-gallery-feature") in scenes for node in feature_links),
                    f"{filename}: a feature card references a missing gallery scene")
            require("preview" in page.source.casefold(), f"{filename}: legacy preview imagery needs its preview label")
            require(page.with_id("capture-journal") is not None, f"{filename}: completed port needs its gameplay journal")
        elif key == "viper":
            require(page.with_id("viper-gallery") is not None and len([node for node in page.nodes if node.has_class("vb-scene")]) == 7, "Red Viper Color needs its menu preview and six captured scenes")
            require("design preview" in page.root.text().casefold() and "azahar" in page.root.text().casefold(), "Red Viper Color must distinguish menu designs from Azahar captures")
        else:
            require("development captures will appear here" in page.root.text().casefold(), f"{filename}: unreleased project needs its forthcoming-captures message")

    if errors:
        print("FAIL: site integration checks")
        print("\n".join(f"  - {message}" for message in errors))
        return 1
    print(f"PASS: {len(documents)} HTML pages, {references} local references, eight collection links in two groups, eight exact progress values, and project navigation/repositories.")
    return 0


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--directory", type=Path, default=ROOT / "dist")
    raise SystemExit(check_site(parser.parse_args().directory))
