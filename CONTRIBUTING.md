# Maintaining the catalog

The catalog has one source of truth:

- `catalog/papers.json` for papers
- `catalog/datasets.json` for datasets

`data/papers.js`, `data/datasets.js`, and the catalog tables in `README.md` are generated mirrors. Do not edit those generated regions by hand.

## Add or edit an entry

Edit the relevant JSON array, keeping one object per record. Copy a nearby entry as a template so every field remains present.

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

Use an empty string for an unavailable optional paper identifier or PDF URL, and an empty array when no paper repository or dataset alias is available. Dataset descriptive fields should state when the official source does not provide a detail rather than guessing it.

Use the canonical venue label without a year; the paper year belongs in the `year` field. Approved aliases are centralized in `scripts/build_catalog.py` (for example, full MICCAI names become `MICCAI`, `arXiv preprint` becomes `arXiv`, and `CVPRW` becomes `CVPR Workshops`). The validator reports the expected label if a manually added paper uses a known variant.

## Rebuild both mirrors

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
