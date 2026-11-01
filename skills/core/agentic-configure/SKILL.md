---
name: agentic-configure
description: "Set up agentic: write the config (models per step, reviewers, folders, profiles, limits)."
disable-model-invocation: true
argument-hint: "[--global | --project]"
---

# Configure

Walk the user to a valid config they understand. First, read the config contract: `../agentic-use-workflow/references/config.md` next to this skill (else in the installed `agentic-use-workflow`): fields, step keys, built-in defaults, resolution, limits. Follow it exactly. That file is all of the runtime this skill uses: it opens no work item and logs no events.

Ask one thing at a time, always with a recommended answer. Use the harness's multiple-choice tool when available.

## 1. Scope and existing files

- **Global** `~/.agentic/config.json`: personal, mostly models per harness. **Project** `.agentic.json`: folders, profiles, reviewers, project-specific overrides. Recommend models in global, the rest in project; `--global` / `--project` skip the question.
- Read both files if present. Review them against the contract: unknown keys, removed step keys (`triage`, `review.fix`, `babysit.fix`, old lens keys like `review.security`), keys with no effect (e.g. a parent key whose only child is set explicitly), model ids the harness doesn't offer, effort levels the model doesn't support, invalid JSON. Report findings before proposing anything.

## 2. Harnesses

Detect every installed harness, not only the one you run in: CLI on `PATH` (`agent` / `cursor-agent`, `claude`, `codex`) or its config folder (`~/.cursor`, `~/.claude`, `~/.codex`). Confirm which ones to configure (default: all detected). Their `npx skills` agent ids: `cursor`, `claude-code`, `codex`.

## 3. Reviewers

Show `reviewers` (configured, else the default list). Ask which to add or remove. Every reviewer is a skill the harness can load: one shipped with agentic (config.md Default reviewers and its opt-in `pr-security-review`, `agentic-review-*`) or one installed separately. Check each added name is installed: listed by `npx skills@latest list` (`-g` too), or a `<name>/SKILL.md` in a harness skills folder (`.claude/skills`, `.agents/skills`, their `~/` twins, the agentic plugin's skills). Not installed → ask its source (`owner/repo`) and offer, after the user's yes, `npx skills@latest add <source> --skill <name> -a <agent> -y` per harness from step 2 (`-g` for global), then confirm it with `npx skills@latest list`. Each reviewer gets its own step key `review.<name>` in step 4.

## 4. Steps → models

List the models each harness actually offers:

- **Cursor**: `agent models`. Ids often encode effort (`claude-opus-5-5-high`); config can use the base id + `effort`.
- **Codex**: `codex debug models` (JSON catalog with slugs and supported efforts). Current defaults in `~/.codex/config.toml`.
- **Claude Code**: no list command. Offer the aliases `opus`, `sonnet`, `haiku` (always the latest) or full model ids the user provides.

Propose only ids from those lists (or a Claude Code alias). A command fails → say so and ask the user for the ids.

Map the built-in defaults to real models per harness: `frontier`, `code`, `fast` → the best match in each list; `chore` and `explore` → their pinned defaults if available, else the closest cheap / mid model. Show one table: step key (every built-in key plus `review.<name>` per reviewer) × harness → model / effort, with a one-line why per capability class.

Ask: does it suit? If not, which steps, harnesses or values to change. Validate every change (model in the list, effort supported) and show the updated table until approved. Remind that `grill` runs in the session: its value is a recommendation.

## 5. Folders, profiles, limits

Confirm, with defaults from the contract:

- `output` (work items, default `.agentic/work`) and `commitWork` (default `false`). `false` and `{output}` missing from `.gitignore` → offer to add it.
- `worktrees` (default `../{repo}-worktrees`). Resolve it for this repo and show the absolute path.
- Project scope: profiles (built-in and configured) whose `detect` files exist → propose `selectedProfiles` and their codestyle skills. Any installed skill works as codestyle, third-party too; one not installed (check as in step 3) → offer to install it as in step 3. Mention that `agentic-clean-architecture` / `agentic-write-instrumented-code` are assigned per task unless the user wants them forced through a profile.
- `limits`: show defaults, ask if they fit.

## 6. Write and validate

Write only what the user changed from the proposals and defaults, plus existing values they kept; accepted proposals stay defaults, so later default updates still reach them. Show the final JSON and the diff with any existing file; write only after a yes. Then re-read it: valid JSON, only known keys, every model in its harness list, every reviewer and profile skill exists. Report the file paths, any skill installed, and a one-line summary per harness.
