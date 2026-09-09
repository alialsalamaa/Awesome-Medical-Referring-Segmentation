#!/usr/bin/env python3
"""Validate the catalog and generate both website data and README tables."""

from __future__ import annotations

import argparse
import html
import json
import re
import sys
from pathlib import Path
from urllib.parse import urlparse


CATEGORIES = (
    "2D",
    "3D",
    "Video / sequences",
    "Pathology / microscopy",
)

CATEGORY_SECTIONS = {
    "2D": ("2d-medical-imaging", "2D medical imaging"),
    "3D": ("3d-volumetric-imaging", "3D volumetric imaging"),
    "Video / sequences": ("video-and-sequences", "Video and sequences"),
    "Pathology / microscopy": ("pathology-and-microscopy", "Pathology and microscopy"),
}

DATASET_START = "<!-- BEGIN GENERATED DATASET CATALOG -->"
DATASET_END = "<!-- END GENERATED DATASET CATALOG -->"
PAPER_START = "<!-- BEGIN GENERATED PAPER CATALOG -->"
PAPER_END = "<!-- END GENERATED PAPER CATALOG -->"

VENUE_ALIASES = {
    "arXiv preprint": "arXiv",
    "European Conference on Computer Vision (ECCV)": "ECCV",
    "IEEE International Conference on Acoustics, Speech and Signal Processing (ICASSP)": "ICASSP",
    "ICCVW": "ICCV Workshops",
    "IEEE/CVF International Conference on Computer Vision Workshops": "ICCV Workshops",
    "Proceedings of the IEEE/CVF International Conference on Computer Vision (ICCV) Workshops": "ICCV Workshops",
    "Medical Image Computing and Computer Assisted Intervention (MICCAI)": "MICCAI",
    "Medical Imaging with Deep Learning (MIDL)": "MIDL",
    "Medical Imaging with Deep Learning (MIDL) Short Paper": "MIDL",
    "IEEE International Symposium on Biomedical Imaging (ISBI)": "ISBI",
    "IEEE 22nd International Symposium on Biomedical Imaging (ISBI)": "ISBI",
    "IEEE 23rd International Symposium on Biomedical Imaging (ISBI)": "ISBI",
    "Medical Image Understanding and Analysis (MIUA)": "MIUA",
    "30th Conference on Medical Image Understanding and Analysis (MIUA)": "MIUA",
    "CVPRW": "CVPR Workshops",
    "SPIE Medical Imaging: Image Processing": "SPIE Medical Imaging",
    "CVPR Workshop on Foundation Models for 3D Biomedical Image Segmentation (MedSegFM)": "MedSegFM (CVPR Workshop)",
    "MedSegFM / CVPR Workshop proceedings": "MedSegFM (CVPR Workshop)",
}


class CatalogError(ValueError):
    """Raised when catalog data cannot be safely generated."""


def load_json(path: Path) -> list[dict]:
    try:
        value = json.loads(path.read_text(encoding="utf-8"))
    except FileNotFoundError as exc:
        raise CatalogError(f"Missing catalog file: {path}") from exc
    except json.JSONDecodeError as exc:
        raise CatalogError(f"Invalid JSON in {path}: {exc}") from exc
    if not isinstance(value, list):
        raise CatalogError(f"{path} must contain a JSON array.")
    return value


def require_text(record: dict, key: str, context: str, *, allow_empty: bool = False) -> str:
    value = record.get(key)
    if not isinstance(value, str):
        raise CatalogError(f"{context}: '{key}' must be text.")
    if not allow_empty and not value.strip():
        raise CatalogError(f"{context}: '{key}' cannot be empty.")
    return value.strip()


def require_text_list(record: dict, key: str, context: str, *, allow_empty: bool = False) -> list[str]:
    value = record.get(key)
    if not isinstance(value, list) or any(not isinstance(item, str) or not item.strip() for item in value):
        raise CatalogError(f"{context}: '{key}' must be a list of non-empty strings.")
    if not allow_empty and not value:
        raise CatalogError(f"{context}: '{key}' cannot be empty.")
    return [item.strip() for item in value]


def require_url(value: str, context: str, *, allow_empty: bool = False) -> None:
    if not value and allow_empty:
        return
    parsed = urlparse(value)
    if parsed.scheme not in {"http", "https"} or not parsed.netloc:
        raise CatalogError(f"{context}: expected an http(s) URL, got {value!r}.")


def normalize_venue_label(value: str) -> str:
    """Remove year-only variation and resolve approved venue aliases."""
    normalized = re.sub(r"\b(?:19|20)\d{2}\b", "", value)
    normalized = re.sub(r"\(\s*(?:published\s*)?\)", "", normalized, flags=re.IGNORECASE)
    normalized = re.sub(r"\s+", " ", normalized)
    normalized = re.sub(r"\s+([),;:])", r"\1", normalized)
    normalized = re.sub(r"\(\s+", "(", normalized)
    normalized = re.sub(r"[\s,;:/\-–—]+$", "", normalized).strip()
    return VENUE_ALIASES.get(normalized, normalized)


def validate_categories(record: dict, context: str) -> None:
    categories = require_text_list(record, "categories", context)
    unknown = sorted(set(categories) - set(CATEGORIES))
    if unknown:
        raise CatalogError(f"{context}: unsupported categories: {', '.join(unknown)}")
    if len(categories) != len(set(categories)):
        raise CatalogError(f"{context}: categories must not contain duplicates.")


def validate_catalog(papers: list[dict], datasets: list[dict]) -> None:
    seen_paper_ids: set[str] = set()
    seen_paper_titles: set[str] = set()
    seen_paper_pages: set[str] = set()
    for index, paper in enumerate(papers, start=1):
        context = f"paper #{index}"
        if not isinstance(paper, dict):
            raise CatalogError(f"{context}: record must be an object.")
        paper_id = require_text(paper, "id", context)
        title = require_text(paper, "title", context)
        context = f"paper #{index} ({title})"
        require_text_list(paper, "authors", context)
        year = paper.get("year")
        if not isinstance(year, int) or not 1900 <= year <= 2200:
            raise CatalogError(f"{context}: 'year' must be an integer between 1900 and 2200.")
        venue = require_text(paper, "venue", context)
        normalized_venue = normalize_venue_label(venue)
        if normalized_venue != venue:
            raise CatalogError(
                f"{context}: venue must use its normalized label {normalized_venue!r}, got {venue!r}."
            )
        validate_categories(paper, context)
        require_text(paper, "identifier", context, allow_empty=True)
        paper_url = require_text(paper, "paperUrl", context)
        require_url(paper_url, f"{context} paperUrl")
        pdf_url = require_text(paper, "pdfUrl", context, allow_empty=True)
        require_url(pdf_url, f"{context} pdfUrl", allow_empty=True)
        for code_index, code_url in enumerate(require_text_list(paper, "codeUrls", context, allow_empty=True), start=1):
            require_url(code_url, f"{context} codeUrls[{code_index}]")

        folded_title = title.casefold()
        if paper_id in seen_paper_ids:
            raise CatalogError(f"{context}: duplicate id {paper_id!r}.")
        if folded_title in seen_paper_titles:
            raise CatalogError(f"{context}: duplicate title {title!r}.")
        if paper_url.casefold() in seen_paper_pages:
            raise CatalogError(f"{context}: duplicate paper URL {paper_url!r}.")
        seen_paper_ids.add(paper_id)
        seen_paper_titles.add(folded_title)
        seen_paper_pages.add(paper_url.casefold())

    seen_dataset_names: set[str] = set()
    for index, dataset in enumerate(datasets, start=1):
        context = f"dataset #{index}"
        if not isinstance(dataset, dict):
            raise CatalogError(f"{context}: record must be an object.")
        name = require_text(dataset, "name", context)
        context = f"dataset #{index} ({name})"
        validate_categories(dataset, context)
        require_text_list(dataset, "formatTypes", context)
        require_text_list(dataset, "modalities", context)
        require_text_list(dataset, "anatomicalOrigins", context)
        require_text_list(dataset, "subjectTypes", context)
        require_text_list(dataset, "aliases", context, allow_empty=True)
        require_text(dataset, "version", context)
        require_text(dataset, "content", context)
        require_text(dataset, "origin", context)
        require_text(dataset, "annotation", context)
        require_text(dataset, "access", context)
        source_url = require_text(dataset, "url", context)
        require_url(source_url, f"{context} url")
        folded_name = name.casefold()
        if folded_name in seen_dataset_names:
            raise CatalogError(f"{context}: duplicate name {name!r}.")
        seen_dataset_names.add(folded_name)


def markdown_text(value: object) -> str:
    rendered = html.escape(str(value), quote=False).replace("\r", " ").replace("\n", " ")
    return rendered.replace("|", "\\|").strip()


def markdown_link(label: str, url: str) -> str:
    return f"[{markdown_text(label)}](<{url}>)"


def render_dataset_sections(datasets: list[dict]) -> str:
    sections: list[str] = []
    for category in CATEGORIES:
        anchor, title = CATEGORY_SECTIONS[category]
        records = sorted(
            (dataset for dataset in datasets if category in dataset["categories"]),
            key=lambda dataset: dataset["name"].casefold(),
        )
        lines = [
            f'<a id="{anchor}"></a>',
            "<details>",
            f"<summary><strong>{title}</strong> ({len(records)} datasets)</summary>",
            "",
            "| Dataset | Data | Origin | Annotation | Access |",
            "|:--|:--|:--|:--|:--|",
        ]
        for dataset in records:
            dataset_cell = markdown_link(dataset["name"], dataset["url"])
            dataset_cell += f"<br><sub>{markdown_text(dataset['version'])}</sub>"
            data_cell = markdown_text("; ".join(dataset["modalities"]))
            data_cell += f"<br><sub>{markdown_text('; '.join(dataset['formatTypes']))}: {markdown_text(dataset['content'])}</sub>"
            origin_cell = markdown_text("; ".join(dataset["anatomicalOrigins"]))
            origin_cell += f"<br><sub>{markdown_text(dataset['origin'])}</sub>"
            lines.append(
                "| "
                + " | ".join(
                    (
                        dataset_cell,
                        data_cell,
                        origin_cell,
                        markdown_text(dataset["annotation"]),
                        markdown_text(dataset["access"]),
                    )
                )
                + " |"
            )
        lines.extend(("", "</details>"))
        sections.append("\n".join(lines))
    return "\n\n".join(sections)


def render_paper_sections(papers: list[dict]) -> str:
    sections: list[str] = []
    for category in CATEGORIES:
        base_anchor, title = CATEGORY_SECTIONS[category]
        records = sorted(
            (paper for paper in papers if category in paper["categories"]),
            key=lambda paper: (-paper["year"], paper["title"].casefold()),
        )
        lines = [
            f'<a id="papers-{base_anchor}"></a>',
            "<details>",
            f"<summary><strong>{title}</strong> ({len(records)} papers)</summary>",
            "",
            "| Paper | Year | Venue | Links |",
            "|:--|:--:|:--|:--|",
        ]
        for paper in records:
            paper_cell = markdown_link(paper["title"], paper["paperUrl"])
            paper_cell += f"<br><sub>{markdown_text('; '.join(paper['authors']))}</sub>"
            if paper["identifier"]:
                paper_cell += f"<br><sub>{markdown_text(paper['identifier'])}</sub>"
            links: list[str] = []
            links.extend(markdown_link("GitHub" if len(paper["codeUrls"]) == 1 else f"GitHub {index}", url)
                         for index, url in enumerate(paper["codeUrls"], start=1))
            lines.append(
                f"| {paper_cell} | {paper['year']} | {markdown_text(paper['venue'])} | {' · '.join(links) if links else '—'} |"
            )
        lines.extend(("", "</details>"))
        sections.append("\n".join(lines))
    return "\n\n".join(sections)


def replace_generated_region(source: str, start: str, end: str, body: str) -> str:
    pattern = re.compile(re.escape(start) + r".*?" + re.escape(end), flags=re.DOTALL)
    replacement = f"{start}\n{body.rstrip()}\n{end}"
    updated, count = pattern.subn(lambda _: replacement, source)
    if count != 1:
        raise CatalogError(f"README must contain exactly one {start!r}/{end!r} marker pair.")
    return updated


def render_javascript(variable: str, records: list[dict]) -> str:
    payload = json.dumps(records, ensure_ascii=False, indent=2)
    return (
        "// Generated by scripts/build_catalog.py. Edit catalog/*.json, then rebuild.\n"
        f"window.{variable} = {payload};\n"
    )


def expected_outputs(repo_root: Path, papers: list[dict], datasets: list[dict]) -> dict[Path, str]:
    readme_path = repo_root / "README.md"
    readme = readme_path.read_text(encoding="utf-8")
    readme = replace_generated_region(readme, DATASET_START, DATASET_END, render_dataset_sections(datasets))
    readme = replace_generated_region(readme, PAPER_START, PAPER_END, render_paper_sections(papers))
    return {
        repo_root / "data" / "papers.js": render_javascript("PAPERS", papers),
        repo_root / "data" / "datasets.js": render_javascript("DATASETS", datasets),
        readme_path: readme,
    }


def build(repo_root: Path, *, check: bool = False) -> int:
    papers = load_json(repo_root / "catalog" / "papers.json")
    datasets = load_json(repo_root / "catalog" / "datasets.json")
    validate_catalog(papers, datasets)
    outputs = expected_outputs(repo_root, papers, datasets)

    stale: list[Path] = []
    for path, content in outputs.items():
        current = path.read_text(encoding="utf-8") if path.exists() else None
        if current == content:
            continue
        if check:
            stale.append(path)
            continue
        path.parent.mkdir(parents=True, exist_ok=True)
        path.write_text(content, encoding="utf-8", newline="\n")

    if stale:
        for path in stale:
            print(f"Out of date: {path.relative_to(repo_root)}", file=sys.stderr)
        print("Run: python scripts/build_catalog.py", file=sys.stderr)
        return 1

    action = "Verified" if check else "Generated"
    print(f"{action} {len(papers)} papers and {len(datasets)} datasets.")
    return 0


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--check", action="store_true", help="Fail if generated files differ from the catalog.")
    parser.add_argument(
        "--repo-root",
        type=Path,
        default=Path(__file__).resolve().parents[1],
        help="Repository root (defaults to the parent of scripts/).",
    )
    return parser.parse_args()


def main() -> int:
    args = parse_args()
    try:
        return build(args.repo_root.resolve(), check=args.check)
    except CatalogError as exc:
        print(f"Catalog error: {exc}", file=sys.stderr)
        return 2


if __name__ == "__main__":
    raise SystemExit(main())
