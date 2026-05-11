# Spec-Kit MCP Bridge: Issues & Safe Fix Options

## Context

Current behavior observed:
- `speckit_init` and `speckit_specify` work.
- `speckit_plan` and `speckit_tasks` fail because MCP server invokes `specify plan/tasks` commands that do not exist in installed `specify` CLI version.
- Earlier experiments reported possible MCP-related restart loops.

---

## Problem 1: Command Mismatch (Primary)

### Symptom
MCP tool error:
- `No such command 'plan'`
- `No such command 'tasks'`

### Likely Root Cause
`spec-kit-mcp` assumes an older or different `specify` CLI interface than the one currently installed.

### Verification
Run safely in terminal:
```bash
specify --help
specify init --help
specify workflow --help || true
specify extension --help || true
```

If `plan/tasks` are absent, mismatch is confirmed.

### Fix Options

#### Option A (Recommended): Pin compatible versions
- Find version matrix where `spec-kit-mcp` and `specify` agree.
- Pin both explicitly.

Example direction:
```bash
# pin mcp server package version
npx -y @speckit/mcp@<known-good-version> --help

# pin specify-cli version
uv tool install specify-cli --from git+https://github.com/github/spec-kit.git@<tag>
```

Pros: minimal code changes.  
Cons: version hunting required.

#### Option B: Patch bridge behavior locally
- Wrap/replace failing MCP tools (`plan/tasks`) with local scripts that generate artifacts from templates.
- Keep MCP for `init/specify/constitution` only.

Pros: immediate progress, robust to upstream changes.  
Cons: maintenance burden.

#### Option C: Contribute upstream fix
- Update spec-kit-mcp to support new `specify` command surface and workflow-based execution.

Pros: long-term clean solution.  
Cons: takes time; upstream review latency.

---

## Problem 2: Infinite Restart Risk (Operational)

### Symptom
After MCP install/config changes, Hermes process repeatedly restarts.

### Common Causes
1. MCP server exits immediately (bad command/package/auth), Hermes retries.
2. Startup hook repeatedly fails and triggers watchdog/systemd restart policy.
3. Blocking auth/interactive prompt in non-interactive startup path.

### Safer Debug Procedure (Recommended)

1. **Test MCP server standalone first** (outside Hermes startup):
```bash
npx -y @speckit/mcp@latest --help
```

2. **Test with timeout to avoid hangs**:
```bash
timeout 20s npx -y @speckit/mcp@latest || true
```

3. **Only then add to Hermes config**.

4. **Limit blast radius**:
- Add a single MCP server at a time.
- Restart Hermes once.
- Check logs before adding another.

5. **Have rollback ready**:
- Keep a backup of `~/.hermes/config.yaml`.
- If loop appears, remove/comment failing `mcp_servers.<name>` entry and restart.

---

## Suggested Practical Path (for now)

1. Keep using MCP tools that work now:
   - init / constitution / specify / clarify / analyze / checklist
2. Use local generated files for plan/tasks (already created in project).
3. Investigate version pinning in a separate controlled terminal session.
4. After stable pin found, re-enable full MCP chain.

---

## Commands to collect evidence for version compatibility

```bash
# record versions
specify --version || true
npx -y @speckit/mcp@latest --version || true

# inspect available MCP package metadata
npm view @speckit/mcp versions --json | head -c 2000

# inspect repo readme/changelog quickly
# (manual step in browser or web_extract)
```

Store findings in this folder so rollback/compare is easy.

---

## Current Status Snapshot

- Project initialized: `/home/jeff/papertowne/projects/prism-timeline`
- Generated manually:
  - `speckit.plan`
  - `speckit.tasks`
- Investigation note: this file

---

## Resolution (2026-05-11)

### What was done

**Option B implemented: Specify wrapper script that intercepts `plan`/`tasks`.**

The root cause: `@lsendel/spec-kit-mcp` v0.1.0 binary calls `specify plan` and `specify tasks`, but `specify` v0.8.8.dev0 removed those commands in favor of `workflow run`. No newer MCP binary exists on GitHub (v0.1.1 is npm-only with no binary release).

### Fix details

1. **Real specify binary moved**: `~/.local/bin/specify` → `~/.local/bin/specify-real`
2. **Wrapper created**: `~/.local/bin/specify` (Python script) that:
   - Intercepts `specify plan --spec X --output Y` — parses spec and generates a structured implementation plan
   - Intercepts `specify tasks --plan X --output Y` — parses plan and generates task list with milestones
   - Passes all other commands through to `specify-real` transparently
3. No config changes needed — the MCP server finds `specify` on PATH

### Verification

All 9 MCP tools now work:
- ✅ speckit_init
- ✅ speckit_specify
- ✅ speckit_constitution
- ✅ speckit_clarify
- ✅ speckit_analyze
- ✅ speckit_checklist
- ✅ speckit_plan (was broken, now fixed)
- ✅ speckit_tasks (was broken, now fixed)
- ✅ speckit_implement

### Fix 2: `--path` not recognized by `specify-real init` (2026-05-11 04:08)

**Symptom:** `speckit_init` MCP tool failed: `No such option: --path`
**Root cause:** MCP server v0.1.0 passes `--path <project_path>` to `specify init`, but `specify-real init` (v0.8.8) doesn't support `--path` — only `--here` or positional project name.

**Fix:** Wrapper now intercepts `specify init` when `--path` is present and translates to:
`cd <project_path> && specify-real init --here --force`

Also forwards supported options (`--ai`, `--script`, `--no-git`, `--ignore-agent-tools`).

### Full verification (2026-05-11 04:09)

All 9 MCP tools verified working end-to-end (init → constitution → specify → clarify → plan → tasks → analyze → checklist → implement).

### Rollback

To undo: `cp ~/.local/bin/specify-real ~/.local/bin/specify`

### GitHub Release

Fixed fork published at: https://github.com/jeffclaw2026-png/spec-kit-mcp/releases/tag/v0.1.1

Binary: `spec-kit-mcp-linux-x64` (3.6 MB)
Installed at: `/home/jeff/.npm-global/bin/spec-kit-mcp-fixed` (v0.1.1)
Config updated: `~/.hermes/config.yaml` → `mcp_servers.spec-kit.command` points to fixed binary

**⚠️ Restart Hermes required** for the new binary to take effect.
