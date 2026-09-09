# Contributing to the catalog

Thank you for helping keep the Medical Referring Segmentation survey accurate and current. Submit additions and corrections through a pull request. The maintainer reviews every change before it is merged.

Please keep each pull request focused on one logical addition or correction and use authoritative public sources. Do not include private patient information, unpublished institutional data, local file paths, or copies of papers and datasets.

The catalog has one source of truth:

- `catalog/papers.json` for papers
- `catalog/datasets.json` for datasets

`data/papers.js`, `data/datasets.js`, and the catalog tables in `README.md` are generated mirrors. Do not edit those generated regions by hand.

## Add or edit an entry

Edit the relevant JSON array, keeping one object per record. Copy a nearby entry as a template so every field remains present. Do not edit generated files by hand.

Paper fields:

```json
{
  "id": "paper-stable-unique-id",
  "title": "Paper title",
  "authors": ["First Author", "Second Author"],
  "year": 2026,
  "venue": "Venue",
  "categories": ["2D"],
  "identifier": "DOI: 10.xxxx/example",
  "paperUrl": "https://example.org/paper",
  "pdfUrl": "https://example.org/paper.pdf",
  "codeUrls": ["https://github.com/owner/repository"]
}
```

Dataset fields:

```json
{
  "name": "Dataset name",
  "categories": ["3D"],
  "formatTypes": ["3D"],
  "modalities": ["CT"],
  "version": "Version or release",
  "content": "Data format and contents",
  "origin": "Detailed anatomical or biological origin",
  "anatomicalOrigins": ["Abdomen"],
  "subjectTypes": ["Human"],
  "annotation": "Segmentation annotation description",
  "access": "Public",
  "url": "https://example.org/dataset",
  "aliases": []
}
```

Allowed category values are exactly:

- `2D`
- `3D`
- `Video / sequences`
- `Pathology / microscopy`

For datasets, categories describe the native files supplied by the released dataset, not every view that can be derived from them. A volumetric CT or MRI dataset remains `3D` even when processed slice by slice; a video, cine acquisition, or temporal sequence remains `Video / sequences` even when annotated frame by frame; and histopathology, cytology, or microscopy data use `Pathology / microscopy` rather than an additional `2D` tag. Use multiple categories only when the release genuinely supplies independent source types.

Use an empty string for an unavailable optional paper identifier or PDF URL, and an empty array when no paper repository or dataset alias is available. Dataset descriptive fields should state when the official source does not provide a detail rather than guessing it.

Use the canonical venue label without a year; the paper year belongs in the `year` field. Approved aliases are centralized in `scripts/build_catalog.py` (for example, full MICCAI names become `MICCAI`, `arXiv preprint` becomes `arXiv`, and `CVPRW` becomes `CVPR Workshops`). The validator reports the expected label if a manually added paper uses a known variant.

## Update both mirrors

From the repository root, run:

```powershell
uv run python scripts/build_catalog.py
```

If Python is already installed, `python scripts/build_catalog.py` works as well. The command validates required fields, categories, uniqueness, and URLs before it updates the webpage data and README tables.

To confirm everything is synchronized without changing files:

```powershell
uv run python scripts/build_catalog.py --check
```

The committed files in `catalog/` are self-contained; rebuilding the project does not require any external spreadsheet or private source file.

## Pull request checklist

Before opening a pull request, confirm that:

- The paper or dataset is in scope for linguistic-prompt medical segmentation.
- Names, authors, identifiers, venues, and links match authoritative sources.
- Paper repositories are official or author-maintained.
- Dataset links point to the official source or a clearly disclosed archival source.
- Optional missing values use an empty string or array rather than invented information.
- `uv run python scripts/build_catalog.py` completed successfully.
- `uv run python scripts/build_catalog.py --check` reports that both mirrors are synchronized.
- The pull request includes the changed canonical JSON, `README.md`, and the generated file under `data/`.
