# Hugging Face Integration

ModelStack v1 uses a bounded hybrid approach:

- Ship a seed registry inside the package.
- Run strict category searches against the Hugging Face API.
- Enrich each candidate with repo metadata and repo-file format clues.
- Cache the merged result locally in the user's OS app-data directory.

This keeps discovery explainable and resilient:

- seed candidates provide a stable quality floor
- discovered candidates widen the pool without crawling the full ecosystem
- enrichment failures add warnings instead of crashing the CLI
