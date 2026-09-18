---
name: agentic:skill:use-agentic
description: Use when starting an Agentic workflow or delegated task, resolving project profiles, or handling missing configuration or host capabilities
---

# Use Agentic

Resolve configuration once per run, then pass the effective context to workers. Workflows are skills with ordered phases; existing `agentic:workflow:*` identifiers remain valid. Native workers load task skills directly. Standalone engineering and knowledge reads do not require workflow initialization.

1. Read [config-schema.md](references/config-schema.md) when resolving configuration. Use the first existing project file in this order: `.agentic.json`, `.agentic.config.json`, `.agentic/config.json`; then `~/.agentic/config.json`; then documented defaults. Record selected and shadowed paths. Invalid present configuration is an error, not a reason to silently fall through.
2. Resolve profiles in stable order: explicit selection, profiles whose globs match task-relevant paths, then applicable task/language skills. Empty `selectedProfiles` does not disable detection or engineering policy. Keep `technical_skills_prompt` a deduplicated string array with selection reasons.
3. Resolve model role, effort, and available host controls using [host-adapter.md](references/host-adapter.md). Preserve configured routing. Record requested/effective settings and any fallback; unsupported controls never become imaginary tool arguments.
4. Pass this execution context by value or shared file path. Workers inherit it; recompute only for changed scope/configuration. Load complete required skills and their applicable references, including the unchanged TypeScript package.

Combine the initialization receipt with workflow startup: namespace, config source, output folder, host, run ID, and relevant fallbacks. This is an announcement. Existing user authorization persists; configuration loading creates no new approval gate. Missing required skills or capabilities are reported with their exact identity and affected operation before dependent work continues.
