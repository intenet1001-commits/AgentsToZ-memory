import { execFileSync } from 'node:child_process';
import { mkdtempSync, readFileSync, rmSync, writeFileSync, mkdirSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import assert from 'node:assert/strict';

const npm = process.env.npm_execpath;
if (!npm) throw new Error('Run through npm run check:package.');
const temporary = mkdtempSync(join(tmpdir(), 'agentstoz-package-check-'));
try {
  const manifest = JSON.parse(execFileSync(process.execPath, [npm, 'pack', '--ignore-scripts', '--json', '--pack-destination', temporary], { encoding: 'utf8' }))[0];
  assert.equal(manifest.name, '@agentstoz/memory');
  assert.ok(manifest.files.length > 10);
  for (const file of manifest.files) {
    assert.match(file.path, /^(?:dist\/[a-zA-Z0-9/.-]+\.(?:js|d\.ts)|docs\/[a-zA-Z0-9/.-]+\.md|examples\/[a-zA-Z0-9/.-]+\.mjs|package\.json|README\.md|LICENSE|NOTICE\.md|PROVENANCE\.json)$/);
    const contents = readFileSync(file.path, 'utf8');
    assert.doesNotMatch(contents, /(?:\/Users\/|\/home\/)[a-z][\w.-]*\/|supabase-service\.json|codex-remote-attachments/i);
    assert.doesNotMatch(contents, /(?:ghp_|github_pat_|sk-proj-)[A-Za-z0-9_]{24,}/);
  }
  const consumer = join(temporary, 'consumer'); mkdirSync(consumer);
  writeFileSync(join(consumer, 'package.json'), JSON.stringify({ private: true, type: 'module' }));
  execFileSync(process.execPath, [npm, 'install', '--ignore-scripts', '--offline', '--no-audit', '--no-fund', join(temporary, manifest.filename)], { cwd: consumer, stdio: 'pipe' });
  const script = `import assert from 'node:assert/strict';
    import {ProjectMemory, AGENT_VERSION, SDK_VERSION, buildStandaloneInitPrompt} from '@agentstoz/memory';
    const memory = new ProjectMemory(process.cwd());
    const first = memory.initialize('## Decisions\\n### Database\\nSQLite supports offline work.');
    assert.equal(memory.recall('SQLite').length, 1);
    assert.equal(AGENT_VERSION, 19);
    assert.equal(SDK_VERSION, '0.1.0');
    assert.match(buildStandaloneInitPrompt(), /project-memory:19/);
    assert.equal(memory.upgrade().revision, first.revision);
    console.log('Clean offline consumer: init / recall / upgrade / prompt passed');`;
  const result = execFileSync(process.execPath, ['--input-type=module', '-e', script], { cwd: consumer, encoding: 'utf8' });
  process.stdout.write(result);
  const typecheck = join(consumer, 'consumer.mts');
  writeFileSync(typecheck, "import {ProjectMemory, rememberSession, type MemoryConsolidator} from '@agentstoz/memory';\nconst m = new ProjectMemory('.');\nconst c: MemoryConsolidator = { async consolidate(i) { return i.previousMemory; } };\nvoid rememberSession(m, 'evidence', c);\n");
  execFileSync(process.execPath, [resolve('node_modules/typescript/bin/tsc'), '--noEmit', '--strict', '--skipLibCheck', '--module', 'NodeNext', '--target', 'ES2022', typecheck], { cwd: consumer, stdio: 'pipe' });
  console.log(`Package allowlist and TypeScript consumer passed: ${manifest.files.length} files, ${manifest.size} bytes.`);
} finally {
  rmSync(temporary, { recursive: true, force: true });
}
