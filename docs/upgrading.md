# Versioning and upgrades

Three versions have different meanings:

| Field | First release | Meaning |
|---|---|---|
| SDK/package | `0.1.0` | Public API and packaged implementation |
| Agent lineage | `19` | Extracted AgentsToZ setup/instruction version, not feature parity |
| Store schema | `1` | Standalone snapshot format, not the app's store schema |

The app and SDK have independent release schedules. A parent-app change is not available here until it has been extracted, reviewed, tested and released. Updates never download or execute code automatically. Newer does not necessarily mean better for every workload.

1. Read the target release notes and verify the tarball against its `SHA256SUMS`. The checksum detects a mismatch; it is not a signature from a separate trust authority.
2. Stop writers and back up the complete `.agent-memory-sdk` directory privately. Retain your old dependency lockfile.
3. Install the exact target tarball URL with `--save-exact`; inspect and retain the lockfile change.
4. Open the explicit project and call `memory.upgrade()` (CLI: `upgrade <root>`). Within schema 1 this updates metadata through a new revision, preserving Markdown bytes, memoryId and prior snapshots. It is idempotent. This method does not migrate the app's files or update global agent instructions.
5. Compare pre/post Markdown hashes and IDs, then run representative recall queries. Resume writers only after verification.

Future schema/agent versions are rejected without writes; there is no forced downgrade. A future breaking schema needs a separately documented migration, not a changed version number alone. To roll back a failed consumer upgrade, stop writers and restore the matching private store backup **and** package lockfile. Do not force an old package to rewrite new-format data.

The setup-prompt route is separate: review `buildStandaloneInitPrompt()` from the new release and ask your agent to follow its backup/validation steps against `.agent-memory`. Its v19 instruction version does not certify that an LLM performed those instructions correctly.

## Maintainer release checklist

- Update package.json, `SDK_VERSION`, examples/tests and exact release URLs together. Keep schema compatibility explicit.
- Review the parent memory modules. Do not copy the private repository, `.agent-memory`, transcripts, screenshots, app configuration or Git history.
- Update `PROVENANCE.json` from the selected source files; explain adaptations in NOTICE. Do not claim an unchanged parent version includes new untested functionality.
- Run `npm ci --ignore-scripts`, `npm test`, `npm run check:package` and the OS/Node CI matrix.
- Audit Git-tracked files separately from npm pack contents: the repository and the tarball are both public surfaces.
- Create a new tag from the tested commit, attach the npm tarball and SHA256SUMS, then verify a clean consumer can install that exact release URL. Never silently replace a released artifact to change behavior.
- Report functional fixes and measured benchmark changes separately. A release note is not evidence of higher model intelligence.
