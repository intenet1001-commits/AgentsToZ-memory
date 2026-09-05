// Run after installing the release tarball: node examples/local-agent.mjs <project-root>
import { ProjectMemory, rememberSession } from '@agentstoz/memory';

const root = process.argv[2];
if (!root) throw new Error('Pass the explicitly selected project directory.');
const memory = new ProjectMemory(root);
memory.initialize();

// Deterministic reference adapter: replace with your approved model callback.
// This example has no network calls and does not pretend to be an LLM evaluation.
await rememberSession(memory, 'The project must remain usable offline.', {
  async consolidate({ previousMemory }) {
    if (previousMemory.includes('### Offline operation')) return previousMemory;
    return `${previousMemory}\n### Offline operation\nThe project must remain usable offline.\n`;
  },
});
console.log(memory.recall('offline'));
