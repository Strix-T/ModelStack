# Scoring Model

ModelStack uses five scoring stages:

1. Eligibility filters remove gated, clearly oversized, or capability-mismatched models.
2. Performance fit scores memory headroom, startup realism, and installed-runtime affinity.
3. Quality fit scores task relevance per capability instead of one generic quality number.
4. Preference fit reweights candidates around speed, quality, and local-only bias.
5. Bundle fit ranks the full stack, not isolated models, and estimates peak RAM/VRAM under the chosen load strategy.

The final output always tries to emit:

- `best_overall`
- `fastest`
- `best_quality`
- `most_local_friendly`

If there are fewer than four unique viable bundles, ModelStack reuses the best available bundle with label-specific reasons instead of inventing unsupported combinations.
