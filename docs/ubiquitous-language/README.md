# Ubiquitous language

| Term | Definition |
|------|------------|
| Harness | An agent runtime agentic runs in: `claude`, `cursor` or `codex`. |
| Project config | `.agentic.json` at a project root; wins over global config. |
| Global config | `~/.agentic/config.json`, user-wide defaults. |
| Effective config | The merged result of defaults, global and project config, with each value's origin. |
| Step key | Name of a workflow step (`grill`, `implement`, `review.<reviewer>`) that config can assign a model and effort. |
| Routing key | A step key for non-step work: `chore` or `explore`. |
| Capability class | Built-in default model tier: `frontier`, `code` or `fast`. |
| Profile | Named set of codestyle skills, applied when its `detect` files match. |
| Reviewer | A skill `agentic-review` runs as one subagent, step key `review.<name>`. |
| Work item | Folder under `{output}` holding one piece of work's state, events and documents. |
| Known project | A folder the webapp manages, stored in its sqlite database. |
| History entry | Append-only record of a config write or an install/update run in the webapp. |
| Vendored skill | A third-party skill copied into `skills/` and pinned in `vendor.json`. |
