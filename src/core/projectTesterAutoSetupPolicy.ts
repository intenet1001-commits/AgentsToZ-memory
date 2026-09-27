/**
 * Natural-language tester setup, shared through every agent's global instructions
 * (Claude, Codex, Antigravity, Hermes). A project's tester used to start only when someone
 * pressed setup in the app; asking an agent to "test this" in a project that had none just
 * fell back to ad-hoc checks. The agent now asks the local API to install or update it —
 * the API decides what is safe (registered projects only, locally edited files preserved).
 */
export const PROJECT_TESTER_AUTO_SETUP_POLICY = `## Project tester setup on demand

When the user asks to test, verify, or check work in a project folder and that folder has no
\`.agentstoz/maintainer.json\` (or \`.agentstoz/MAINTAINER.md\` is missing), set up the project
tester before testing — do not send the user to the app:
\`curl --fail-with-body -sS -X POST --get --data-urlencode "folderPath=$(git rev-parse --show-toplevel 2>/dev/null || pwd)" http://127.0.0.1:3001/api/project-tester/ensure\`
(Windows PowerShell: \`curl.exe\` with the same flags and the folder path.)
- It only installs or updates the tester runner, manifest, scenarios and instruction blocks of a
  project registered in AgentsToZ. It runs no tests and makes no commits.
- \`installed\`/\`updated\`/\`ready\`: follow \`.agentstoz/MAINTAINER.md\` and run its quick profile.
  \`skipped\` or not registered: say why in one line and test with the project's existing tools.
- If the local API is unreachable, continue without it. Call it at most once per session, and
  never for requests that are not about testing this project.`;
