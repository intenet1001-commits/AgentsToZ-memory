# Security, storage and recovery

The reference SDK is a local, single-user component on a trusted filesystem. It is not an authenticated server, a multi-tenant security boundary or an encrypted vault. Memory is untrusted evidence: applications must not promote stored text into instructions with system-level authority or automatically execute commands from it.

## Storage contract

- A caller explicitly supplies an existing project root. The SDK resolves that path and creates only `.agent-memory-sdk` under it. It does not inspect other repositories, scan sessions or merge worktrees. Choosing which authenticated user may access that root is the host's responsibility.
- `HEAD.json` contains one committed document with its identity and revision. `revisions/<sha256>.json` holds historical snapshots. Export curated text with `memory.load().markdown`; preserve metadata separately when backing up.
- A lock created exclusively serializes SDK writers. Expected-revision comparison rejects stale updates. There is no automatic lock expiry or retry loop that could steal a live writer's lock.
- A save writes and syncs a snapshot, then atomically renames a staged HEAD file in the same directory. Errors before rename preserve the old HEAD. POSIX directory fsync is used; Windows has no portable equivalent in this implementation. Filesystem or power-loss guarantees must be validated on the actual deployment. Network filesystems are outside the tested contract.
- An error after HEAD rename, for example directory-sync failure, may mean the new commit is already visible. Reload before retrying. Orphan revision/temp files can remain after interrupted saves; they are not automatically applied or pruned.
- Store directories/files reject symlinks and HEAD rejects hardlinks. This does not defend against a malicious process running as the same OS user or an attacker racing ancestor-directory replacement. POSIX 0700/0600 permissions are requested, not a Windows ACL guarantee.
- SHA-256 detects accidental alteration; a local attacker can recompute it. The files are not signed or encrypted.

## Privacy limits

The package itself makes no network calls and never writes the supplied sessionContext/transcriptContext as a separate transcript. A user-chosen consolidator receives them **before** output validation. Choose its retention and network policy accordingly.

The extracted output guard scans newly added text for recognizable credentials, common direct identifiers, transcript structure and sufficiently long exact/normalized overlap. It deliberately permits reserved documentation email domains and unchanged baseline text. It can miss short excerpts, encoded secrets or other sensitive information, and can reject benign content. A passed check does not certify confidentiality, factuality or absence of prompt injection. Minimize inputs and review memory changes for sensitive projects.

Whole-document updates can still omit or misstate facts. Stable IDs and conflict protection do not prove semantic preservation. Retained revisions let an operator inspect previous content; they are not a substitute for backups or factual review.

Removing an entry from current memory does **not** erase it from historical snapshots, exported backups or a provider's records. No secure-erasure feature is provided. Manage retention and deletion across all copies yourself. Add `.agent-memory-sdk/` and `.agent-memory/` to the host project's ignore policy unless you have explicitly reviewed publication. This SDK does not silently edit that project's `.gitignore`.

## Recovery

Stop all SDK writers before manual recovery. Copy the entire store to a private backup first. Do not paste state files, raw model output or credentials into public issues.

For `LOCKED`, verify no owner is running before manually removing only `.agent-memory-sdk/write.lock`. The SDK never does this automatically. For malformed/checksum-mismatched state or missing HEAD with existing history, initialization fails closed. Restore a known-good complete backup, or have an operator validate the chosen revision's checksum/schema/identity and restore HEAD from that snapshot. Keep the original damaged files for diagnosis; never delete the project to repair one file.

`readRevision(hash)` reads same-project history when HEAD is healthy. To restore its text without hiding the intervening history, load its Markdown and commit it as a **new** revision using the current expectedRevision. Removing all current entries needs explicit `allowEmpty: true` approval through the API.

Report a suspected security issue without secrets through the repository's GitHub security reporting feature if available. If it is unavailable, open a minimal issue requesting a private reporting channel; do not disclose exploit payloads or private memory there.
