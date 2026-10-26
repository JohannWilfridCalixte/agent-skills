---
name: agentic-configure
description: Guide the user through creating or updating the agentic config (~/.agentic/config.json and/or .agentic.json) - detects installed harnesses (Cursor, Claude Code, Codex) and their available models, proposes a per-step model/effort config, confirms work-output and worktree folders, profiles and limits, then writes and validates the file. Use on first setup, when models change, or when the user wants to review or edit their agentic config.
argument-hint: "[--global | --project]"
---

# Configure

Walk the user to a valid config they understand. The contract (fields, step keys, built-in defaults, resolution, limits) is `references/config.md` in `agentic-use-workflow`: read it first and follow it exactly.

Ask one thing at a time, always with a recommended answer. Use the harness's multiple-choice tool when available.

## 1. Scope and existing files

- **Global** `~/.agentic/config.json`: personal, mostly models per harness. **Project** `.agentic.json`: folders, profiles, project-specific overrides. Recommend models in global, the rest in project; `--global` / `--project` skip the question.
- Read both files if present. Review them against the contract: unknown keys, keys with no effect (e.g. a parent key whose only child is set explicitly), model ids the harness doesn't offer, effort levels the model doesn't support, invalid JSON. Report findings before proposing anything.

## 2. Harnesses and models

Detect every installed harness, not only the one you run in: CLI on `PATH` (`agent` / `cursor-agent`, `claude`, `codex`) or its config folder (`~/.cursor`, `~/.claude`, `~/.codex`). Confirm which ones to configure (default: all detected).

List the models each one actually offers:

- **Cursor**: `agent models`. Ids often encode effort (`claude-opus-5-5-high`); config can use the base id + `effort`.
- **Codex**: `codex debug models` (JSON catalog with slugs and supported efforts). Current defaults in `~/.codex/config.toml`.
- **Claude Code**: no list command. Offer the aliases `opus`, `sonnet`, `haiku` (always the latest) or full model ids the user provides.

Never propose a model id that isn't in the list (or a Claude Code alias). A command fails → say so and ask the user for the ids.

## 3. Propose the steps

Map the built-in defaults to real models per harness: `frontier`, `code`, `fast` → the best match in each list; `chore` and `explore` → their pinned defaults if available, else the closest cheap / mid model. Show one table: step key × harness → model / effort, with a one-line why per capability class.

Ask: does it suit? If not, which steps, harnesses or values to change. Validate every change (model in the list, effort supported) and show the updated table until approved. Remind that `triage` and `grill` run in the session: their value is a recommendation.

## 4. Folders, profiles, limits

Confirm, with defaults from the contract:

- `output` (work items, default `.agentic/work`) and `commitWork` (default `false`). `false` and `{output}` missing from `.gitignore` → offer to add it.
- `worktrees` (default `../{repo}-worktrees`). Resolve it for this repo and show the absolute path.
- Project scope: profiles (built-in and configured) whose `detect` files exist → propose `selectedProfiles` and their codestyle skills. Mention that `agentic-clean-architecture` / `agentic-write-instrumented-code` are assigned per task unless the user wants them forced through a profile.
- `limits`: show defaults, ask if they fit.

## 5. Write and validate

Show the final JSON and the diff with any existing file; never overwrite without a yes. Write explicit values for everything confirmed, so the file documents what runs. Then re-read it: valid JSON, only known keys, every model in its harness list. Report the file paths and a one-line summary per harness.
