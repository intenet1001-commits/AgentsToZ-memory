#!/usr/bin/env node
import { ProjectMemory, MemoryError, MAX_MEMORY_BYTES } from './memory.js';
import { buildStandaloneInitPrompt } from './core/externalMemorySetupPrompts.js';

async function stdin(): Promise<string> {
  const chunks: Buffer[] = [];
  let bytes = 0;
  for await (const chunk of process.stdin) {
    const buffer = Buffer.from(chunk);
    bytes += buffer.length;
    if (bytes > MAX_MEMORY_BYTES) throw new MemoryError('INVALID_INPUT', 'Input is too large.');
    chunks.push(buffer);
  }
  return Buffer.concat(chunks).toString('utf8');
}
try {
  const [command, root, ...args] = process.argv.slice(2);
  if (command === 'setup-prompt' && !root) console.log(buildStandaloneInitPrompt());
  else if (!command || command === '--help') console.log('agentstoz-memory init|show|inspect|upgrade <project-root>\nagentstoz-memory recall <project-root> <query>\nagentstoz-memory commit <project-root> <expected-revision> < curated.md\nagentstoz-memory setup-prompt\nAll root paths are explicit. No auto-save, app, API server or provider required.');
  else {
    if (!root) throw new MemoryError('INVALID_INPUT', 'Specify a project root.');
    const memory = new ProjectMemory(root);
    let result: unknown;
    if (['init', 'show', 'inspect', 'upgrade'].includes(command) && args.length) throw new MemoryError('INVALID_INPUT', 'Unexpected arguments.');
    switch (command) {
      case 'init': result = memory.initialize(); break;
      case 'show': result = memory.load(); break;
      case 'inspect': result = memory.inspect(); break;
      case 'upgrade': result = memory.upgrade(); break;
      case 'recall':
        if (!args.length) throw new MemoryError('INVALID_INPUT', 'Specify a query.');
        result = memory.recall(args.join(' ')); break;
      case 'commit':
        if (args.length !== 1 || process.stdin.isTTY) throw new MemoryError('INVALID_INPUT', 'Supply one expected revision and curated Markdown on stdin.');
        result = memory.commit(await stdin(), { expectedRevision: args[0]! }); break;
      default: throw new MemoryError('INVALID_INPUT', 'Unknown command. Use --help.');
    }
    console.log(JSON.stringify(result, null, 2));
  }
} catch (error) {
  // Do not echo model output, local paths, or raw filesystem errors into agent logs.
  console.error(JSON.stringify(error instanceof MemoryError ? { error: error.code, message: error.message } : { error: 'IO_ERROR', message: 'Operation failed. Inspect local store permissions and state.' }));
  process.exitCode = 1;
}
