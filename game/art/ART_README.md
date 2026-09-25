# BURNLANDS art generation: not run

**Status (2026-09-25):** No images were generated, and $0.00 was spent.

The art pipeline session looked for an OpenRouter API key in the cloud environment (for example `OPENROUTER_API_KEY`) and did not find one. It checked environment variable names only. With no key, it could not call the image model (`google/gemini-3.1-flash-image`, with `google/gemini-2.5-flash-image` as the fallback).

- Generated: 0 of 153 manifest entries
- Skipped: all 153 entries in `game/art/manifest.json`, including the `map` entry
- Spend: $0.00 of the $35 working cap ($50 hard budget)

## To run it

1. In the cloud environment settings, add `OPENROUTER_API_KEY` as an environment variable. Open the environment menu in the session title bar and choose **Edit**.
2. Start a new session, because only new sessions see the variable. Then give it the art-pipeline task again.
