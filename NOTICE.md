# Origin and scope

This is an independently packaged extraction of selected AgentsToZ memory-agent code, published by its owner. The parent product is [AgentsToZ](https://github.com/intenet1001-commits/AgentsToZ-public).

The MIT license in this repository covers this SDK distribution. It does not assign a license to the whole parent app or to third-party services mentioned in the documentation. No Hermes, Honcho, Hindsight or Mem0 implementation is bundled.

`PROVENANCE.json` records the agent version and SHA-256 hashes of the selected source files and distributed adaptations. It is a source audit manifest, not a claim that every parent-app feature is available here. The 0.3.0 extraction (2026-10-08) follows agent version 23. Since 0.2.0 only two vendored files changed, both byte-identical to the app: the version marker, and the project-tester policy text, which now reconciles the app-owned common test layer once per session even when tester files exist and keeps the project's own test layer separate. The 0.2.0 extraction (2026-09-27) added the journal cache and durability helpers that feedback uses, the model/effort advice and project-tester policy texts that the output-style prompt embeds, and the CommonMark fence rule (first shipped in this SDK and now also in the app). Agent versions are the setup/instruction lineage, not a benchmark score or an app build number.

The filesystem SDK, CLI, tests and release packaging are new. In the extracted core, relative imports use explicit `.js` extensions for Node ESM. The document splitter additionally matches closing fence type and length so code examples do not become phantom memory sections. The feedback module contains only two pure functions: scope-key validation and promotion-state classification. The SDK store does not collect feedback or enable autonomous promotion. Direct users of the low-level recall function are responsible for supplying verified, version-scoped feedback; the default store passes none.

Private repository history, actual project memories, raw conversations, runtime configuration, user screenshots and credentials are not distributed.
