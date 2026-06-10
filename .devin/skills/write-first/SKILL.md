# write-first — Prefer `write` over `edit`

## Problem

The built-in `edit` tool matches on `old_string`, which frequently fails due to:
- Whitespace or formatting drift between the file on disk and the model's memory
- Concurrent edits changing line numbers or context
- Minor character differences (tabs vs spaces, trailing whitespace)

When `edit` fails, the agent wastes turns retrying with larger context strings or falls back to `write` anyway.

## Rule

**Always use `write` instead of `edit` for every file change.**

This eliminates `old_string` matching entirely and guarantees the tool succeeds on the first attempt.

## How to apply

1. **Read the file first** (if you don't already have the full contents in context).
2. **Reconstruct the entire file content** in your reasoning with the desired changes applied.
3. **Call `write`** with the complete new content.

This is the same workflow the user already mandates in `global_rules.md`:
> *"For each change, rewrite the entire file (`write`) rather than applying a patch (`edit`)."*

This skill simply reinforces that rule as a first-class Devin skill so every agent remembers it.

## Exceptions

There are **no exceptions**. Even for tiny one-line fixes, `write` the whole file. The overhead is negligible compared to the reliability gain.

## Rationale

- **Deterministic**: `write` never fails due to string matching.
- **Explicit final state**: The full file content is visible in the tool call, making review easier.
- **Consistent with project rules**: Aligns with the existing "Prefer writes over edits" guideline.
