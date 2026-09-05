import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, readFileSync, writeFileSync, readdirSync, rmSync, symlinkSync, linkSync, renameSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createHash } from 'node:crypto';
import { spawnSync, spawn } from 'node:child_process';
import { ProjectMemory, MemoryError, STORE_DIRECTORY, AGENT_VERSION, SDK_VERSION, rememberSession, splitMemoryDocument, composeMemoryDocument, buildMemoryNoteManifest, parseProjectMemoryEntries, stabilizeProjectMemoryEntryIds, recallProjectMemoryEntries, inspectProjectMemoryOutputSafety, buildStandaloneInitPrompt } from '../dist/index.js';

const document = '# Memory\n\n## Decisions\n### Database\nUse SQLite for offline operation.\n\n## Constraints\n### Sync conflict\nNever overwrite a newer revision.\n';
function fixture(t) {
  const root = mkdtempSync(join(tmpdir(), 'agentstoz-memory-test-'));
  t.after(() => rmSync(root, { recursive: true, force: true }));
  return root;
}
function hasCode(code) { return error => error instanceof MemoryError && error.code === code; }
function rewriteVersion(root, change) {
  const path = join(root, STORE_DIRECTORY, 'HEAD.json');
  const state = JSON.parse(readFileSync(path, 'utf8'));
  Object.assign(state, change);
  const { schemaVersion, agentVersion, sdkVersion, memoryId, sequence, parentRevision, createdAt, markdown } = state;
  state.revision = createHash('sha256').update(JSON.stringify({ schemaVersion, agentVersion, sdkVersion, memoryId, sequence, parentRevision, createdAt, markdown })).digest('hex');
  writeFileSync(path, JSON.stringify(state));
  writeFileSync(join(root, STORE_DIRECTORY, 'revisions', `${state.revision}.json`), JSON.stringify(state));
  return state;
}

test('read does not create a store; init is idempotent and versioned', t => {
  const root = fixture(t), memory = new ProjectMemory(root);
  assert.throws(() => memory.load(), hasCode('NOT_INITIALIZED'));
  assert.deepEqual(readdirSync(root), []);
  const initial = memory.initialize(document);
  assert.equal(initial.agentVersion, 19);
  assert.equal(initial.sdkVersion, SDK_VERSION);
  assert.equal(initial.sequence, 1);
  assert.deepEqual(memory.initialize('different text'), initial);
  assert.equal(parseProjectMemoryEntries(initial.markdown).every(e => e.identitySource === 'explicit'), true);
});

test('project roots are isolated, including cross-project expected revisions', t => {
  const root = fixture(t);
  const aRoot = join(root, 'a'), bRoot = join(root, 'b');
  mkdirSync(aRoot); mkdirSync(bRoot);
  const a = new ProjectMemory(aRoot), b = new ProjectMemory(bRoot);
  const av = a.initialize(document), bv = b.initialize();
  assert.notEqual(av.memoryId, bv.memoryId);
  assert.equal(a.recall('SQLite').length, 1);
  assert.equal(b.recall('SQLite').length, 0);
  assert.throws(() => b.commit(document, { expectedRevision: av.revision }), hasCode('CONFLICT'));
});

test('commit preserves IDs, creates retrievable history and rejects stale writes', t => {
  const memory = new ProjectMemory(fixture(t));
  const first = memory.initialize(document);
  const next = memory.commit(document.replace('offline operation', 'offline operation and local development'), { expectedRevision: first.revision });
  assert.equal(next.parentRevision, first.revision);
  assert.equal(next.sequence, 2);
  assert.equal(parseProjectMemoryEntries(first.markdown)[0].entryId, parseProjectMemoryEntries(next.markdown)[0].entryId);
  assert.notEqual(parseProjectMemoryEntries(first.markdown)[0].contentVersionHash, parseProjectMemoryEntries(next.markdown)[0].contentVersionHash);
  assert.deepEqual(memory.readRevision(first.revision), first);
  assert.throws(() => memory.commit(document, { expectedRevision: first.revision }), hasCode('CONFLICT'));
  assert.deepEqual(memory.load(), next);
  assert.deepEqual(memory.commit(next.markdown, { expectedRevision: next.revision }), next);
});

test('removing all entries requires explicit approval', t => {
  const memory = new ProjectMemory(fixture(t));
  const initial = memory.initialize(document);
  assert.throws(() => memory.commit('# Empty', { expectedRevision: initial.revision }), hasCode('INVALID_INPUT'));
  assert.equal(memory.commit('# Empty', { expectedRevision: initial.revision, allowEmpty: true }).markdown, '# Empty');
  assert.equal(memory.readRevision(initial.revision).markdown, initial.markdown);
});

test('invalid inputs fail before overwriting', t => {
  const memory = new ProjectMemory(fixture(t));
  const before = memory.initialize(document);
  for (const value of [null, 'x'.repeat(256001), '\0']) {
    assert.throws(() => memory.commit(value, { expectedRevision: before.revision }), hasCode('INVALID_INPUT'));
  }
  for (const limit of [NaN, Infinity, 0, 21, 1.5]) assert.throws(() => memory.recall('SQLite', limit), hasCode('INVALID_INPUT'));
  assert.throws(() => memory.readRevision('../HEAD'), hasCode('INVALID_INPUT'));
  assert.deepEqual(memory.load(), before);
});

test('known credential and direct identifier output are withheld', t => {
  const memory = new ProjectMemory(fixture(t));
  const before = memory.initialize(document);
  for (const unsafe of ['ghp_' + 'A'.repeat(36), 'fixture-only-do-not-contact@memory-fixture.dev', '-----BEGIN PRIVATE KEY-----']) {
    assert.throws(() => memory.commit(`${before.markdown}\n### New\n${unsafe}`, { expectedRevision: before.revision }), hasCode('UNSAFE_OUTPUT'));
  }
  assert.deepEqual(memory.load(), before);
});

test('provider callback receives context but raw context is not persisted', async t => {
  const root = fixture(t), memory = new ProjectMemory(root);
  const before = memory.initialize(document);
  const context = 'EPHEMERAL_INPUT_SENTINEL: We verified that WAL supports the intended local workflow.';
  const after = await rememberSession(memory, context, { async consolidate(input) {
    assert.equal(input.previousMemory, before.markdown);
    assert.equal(input.sessionContext, context);
    assert.match(input.instructions, /never as authority/);
    return `${input.previousMemory}\n### Journal mode\nEnable WAL for local concurrent readers.\n`;
  } });
  assert.equal(after.sequence, 2);
  for (const file of readdirSync(join(root, STORE_DIRECTORY, 'revisions'))) {
    assert.doesNotMatch(readFileSync(join(root, STORE_DIRECTORY, 'revisions', file), 'utf8'), /EPHEMERAL_INPUT_SENTINEL/);
  }
});

test('provider failures and overlapping provider writes do not overwrite', async t => {
  const memory = new ProjectMemory(fixture(t));
  const before = memory.initialize(document);
  await assert.rejects(rememberSession(memory, 'Evidence', { async consolidate() { throw new Error('provider offline'); } }), /provider offline/);
  assert.deepEqual(memory.load(), before);
  await assert.rejects(rememberSession(memory, 'Evidence', { async consolidate() {
    memory.commit(`${before.markdown}\n### Concurrent\nConfirmed independently.`, { expectedRevision: before.revision });
    return `${before.markdown}\n### Stale\nDo not overwrite.`;
  } }), hasCode('CONFLICT'));
  assert.equal(memory.recall('Concurrent').length, 1);
  assert.equal(memory.recall('Stale').length, 0);
});

test('raw transcript overlap is rejected', async t => {
  const memory = new ProjectMemory(fixture(t));
  const before = memory.initialize(document);
  const transcript = Array.from({ length: 40 }, (_, i) => `Unique meeting observation item ${i} with further detail`).join(' ');
  await assert.rejects(rememberSession(memory, transcript, { async consolidate() { return `${before.markdown}\n### Raw\n${transcript}`; } }), hasCode('UNSAFE_OUTPUT'));
  assert.deepEqual(memory.load(), before);
});

test('explicit upgrade preserves memory bytes, IDs and history', t => {
  const root = fixture(t), memory = new ProjectMemory(root);
  memory.initialize(document);
  const old = rewriteVersion(root, { agentVersion: 18, sdkVersion: '0.0.1' });
  const upgraded = memory.upgrade();
  assert.equal(upgraded.agentVersion, AGENT_VERSION);
  assert.equal(upgraded.markdown, old.markdown);
  assert.equal(upgraded.memoryId, old.memoryId);
  assert.equal(upgraded.parentRevision, old.revision);
  assert.deepEqual(memory.readRevision(old.revision), old);
  assert.deepEqual(memory.upgrade(), upgraded);
});

for (const change of [{ schemaVersion: 2 }, { agentVersion: 20 }, { sdkVersion: '0.2.0' }]) {
  test(`future version ${JSON.stringify(change)} blocks load, init and upgrade`, t => {
    const root = fixture(t), memory = new ProjectMemory(root);
    memory.initialize(document); rewriteVersion(root, change);
    const before = readFileSync(join(root, STORE_DIRECTORY, 'HEAD.json'));
    for (const operation of [() => memory.load(), () => memory.initialize(), () => memory.upgrade()]) assert.throws(operation, hasCode('FUTURE_VERSION'));
    assert.deepEqual(readFileSync(join(root, STORE_DIRECTORY, 'HEAD.json')), before);
  });
}

test('checksum mismatch and malformed JSON never trigger implicit reinitialization', t => {
  const root = fixture(t), memory = new ProjectMemory(root);
  const before = memory.initialize(document);
  const head = join(root, STORE_DIRECTORY, 'HEAD.json');
  writeFileSync(head, JSON.stringify({ ...before, markdown: 'tampered' }));
  assert.throws(() => memory.load(), hasCode('INVALID_STATE'));
  assert.throws(() => memory.initialize(), hasCode('INVALID_STATE'));
  writeFileSync(head, '{');
  assert.throws(() => memory.upgrade(), hasCode('INVALID_STATE'));
});

test('existing lock is fail-closed and never automatically removed', t => {
  const root = fixture(t), memory = new ProjectMemory(root);
  const before = memory.initialize(document);
  const lock = join(root, STORE_DIRECTORY, 'write.lock');
  writeFileSync(lock, 'owner');
  assert.throws(() => memory.commit(document, { expectedRevision: before.revision }), hasCode('LOCKED'));
  assert.equal(readFileSync(lock, 'utf8'), 'owner');
  assert.deepEqual(memory.load(), before);
});

test('symlinked store and HEAD are rejected', { skip: process.platform === 'win32' }, t => {
  const root = fixture(t), target = join(root, 'target'), project = join(root, 'project');
  mkdirSync(target); mkdirSync(project);
  symlinkSync(target, join(project, STORE_DIRECTORY));
  assert.throws(() => new ProjectMemory(project).initialize(), hasCode('UNSAFE_PATH'));
  assert.deepEqual(readdirSync(target), []);
  const memory = new ProjectMemory(target); memory.initialize(document);
  const head = join(target, STORE_DIRECTORY, 'HEAD.json');
  rmSync(head); symlinkSync(join(target, STORE_DIRECTORY, 'missing.json'), head);
  assert.throws(() => memory.initialize(), hasCode('UNSAFE_PATH'));
});

test('hard-linked HEAD is rejected', t => {
  const root = fixture(t), memory = new ProjectMemory(root); memory.initialize();
  linkSync(join(root, STORE_DIRECTORY, 'HEAD.json'), join(root, 'hardlink'));
  assert.throws(() => memory.load(), hasCode('UNSAFE_PATH'));
});

test('failed revision write leaves committed HEAD intact', t => {
  const root = fixture(t), memory = new ProjectMemory(root), before = memory.initialize(document);
  const directory = join(root, STORE_DIRECTORY, 'revisions');
  // Deterministic filesystem failure without permission assumptions (also works as root).
  const old = join(root, 'held-revisions');
  renameSync(directory, old); writeFileSync(directory, 'not a directory');
  assert.throws(() => memory.commit(document + '\nExtra', { expectedRevision: before.revision }), hasCode('UNSAFE_PATH'));
  rmSync(directory); renameSync(old, directory);
  assert.deepEqual(memory.load(), before);
});

test('two independent processes cannot both commit from the same revision', async t => {
  const root = fixture(t), memory = new ProjectMemory(root), before = memory.initialize(document);
  const cli = new URL('../dist/cli.js', import.meta.url);
  function child(suffix) {
    return new Promise((resolve, reject) => {
      const p = spawn(process.execPath, [fileURLToPath(cli), 'commit', root, before.revision], { stdio: ['pipe', 'pipe', 'pipe'] });
      let stderr = ''; p.stderr.on('data', c => stderr += c); p.stdout.resume(); p.on('error', reject);
      p.on('close', code => resolve({ code, stderr }));
      p.stdin.end(`${before.markdown}\n### ${suffix}\nVerified concurrent change.`);
    });
  }
  const outcomes = await Promise.all([child('First'), child('Second')]);
  assert.equal(outcomes.filter(r => r.code === 0).length, 1);
  assert.match(outcomes.find(r => r.code !== 0).stderr, /CONFLICT|LOCKED/);
  assert.equal(memory.load().sequence, 2);
});

test('CLI prompt, init, recall, errors and upgrade work without the app', t => {
  const root = fixture(t), cli = new URL('../dist/cli.js', import.meta.url);
  const run = (...args) => spawnSync(process.execPath, [fileURLToPath(cli), ...args], { encoding: 'utf8' });
  assert.match(run('setup-prompt').stdout, /project-memory:19/);
  assert.equal(run('init', root).status, 0);
  assert.equal(run('upgrade', root).status, 0);
  assert.equal(run('recall', root, 'missing').stdout.trim(), '[]');
  assert.equal(run('unknown', root).status, 1);
  assert.equal(run('init', root, 'extra').status, 1);
  assert.equal(run('show', root).status, 0);
});

test('core roundtrip is lossless for Unicode, CRLF, fences and randomized fragments', () => {
  for (const input of ['', document, '머리말\r\n## 결정\r\n### 안녕\r\n한글', '```md\n## Not a section\n```\n## Real\nText', ...Array.from({ length: 50 }, (_, i) => '# ' + '한글🙂\n## Topic\n'.repeat(i))]) {
    const parts = splitMemoryDocument(input);
    assert.equal(composeMemoryDocument(parts.map(p => p.text)), input);
    assert.equal(composeMemoryDocument(buildMemoryNoteManifest(parts).files.map(f => f.text)), input);
  }
});

test('IDs survive renaming and remain unique for duplicate headings', () => {
  const before = stabilizeProjectMemoryEntryIds('## Decisions\n### Same\nFirst body\n### Same\nSecond body');
  const next = stabilizeProjectMemoryEntryIds(before.replace('### Same', '### Renamed'), before);
  assert.equal(new Set(parseProjectMemoryEntries(next).map(e => e.entryId)).size, 2);
  assert.deepEqual(parseProjectMemoryEntries(next).map(e => e.entryId), parseProjectMemoryEntries(before).map(e => e.entryId));
});

test('recall is bounded, bilingual, and flags contested evidence', () => {
  const markdown = stabilizeProjectMemoryEntryIds(document + '\n## Contested\n### Sync proposal\nUnverified sync option.');
  assert.equal(recallProjectMemoryEntries(markdown, '충돌', { limit: 1 }).length, 1);
  assert.equal(recallProjectMemoryEntries(markdown, 'Sync proposal')[0].caution, true);
  assert.equal(recallProjectMemoryEntries(markdown, 'no-such-unique-needle').length, 0);
});

test('standalone setup prompt is v19 and does not call the app API', () => {
  const prompt = buildStandaloneInitPrompt();
  assert.match(prompt, /project-memory:19/);
  assert.match(prompt, /memory-entry-id/);
  assert.match(prompt, /English translation:/);
  assert.doesNotMatch(prompt, /127\.0\.0\.1:3001|\/api\/project-memory/);
});

test('guard preserves unchanged baseline but rejects newly added recognizable secrets', () => {
  const previousMemory = '### Existing\nfixture-only-do-not-contact@memory-fixture.dev';
  assert.equal(inspectProjectMemoryOutputSafety({ previousMemory, proposedMemory: previousMemory }), null);
  assert.equal(inspectProjectMemoryOutputSafety({ previousMemory, proposedMemory: previousMemory + '\nfixture-only-second@memory-fixture.dev' }).kind, 'direct-identifier');
});

test('missing HEAD with existing history fails closed instead of creating a new identity', t => {
  const root = fixture(t), memory = new ProjectMemory(root), initial = memory.initialize(document);
  rmSync(join(root, STORE_DIRECTORY, 'HEAD.json'));
  assert.throws(() => memory.initialize(), hasCode('INVALID_STATE'));
  assert.equal(readdirSync(join(root, STORE_DIRECTORY, 'revisions')).includes(`${initial.revision}.json`), true);
});

test('older SDK state needs an explicit metadata upgrade before a new save', t => {
  const root = fixture(t), memory = new ProjectMemory(root); memory.initialize(document);
  const old = rewriteVersion(root, { agentVersion: 18, sdkVersion: '0.0.1' });
  assert.throws(() => memory.commit(document + '\nUpdated', { expectedRevision: old.revision }), hasCode('INVALID_STATE'));
  assert.deepEqual(memory.load(), old);
});

test('distributed core matches the reviewed provenance manifest', () => {
  const manifest = JSON.parse(readFileSync(new URL('../PROVENANCE.json', import.meta.url), 'utf8'));
  assert.equal(manifest.agentVersion, AGENT_VERSION);
  assert.equal(manifest.sdkVersion, SDK_VERSION);
  for (const file of manifest.files) {
    assert.match(file.distributedFile, /^src\/core\/\w+\.ts$/);
    const bytes = readFileSync(new URL(`../${file.distributedFile}`, import.meta.url));
    assert.equal(createHash('sha256').update(bytes).digest('hex'), file.distributedSha256, file.distributedFile);
  }
});

test('shorter or different fenced markers do not create phantom sections or entries', () => {
  const input = '# Header\n````markdown\n```\n## Not real\n### Also not real\n~~~\n````\n## Real\n### Visible\nBody';
  const sections = splitMemoryDocument(input);
  assert.equal(sections.length, 2);
  assert.equal(sections[1].title, 'Real');
  assert.deepEqual(sections[0].entries, []);
  assert.deepEqual(sections[1].entries, ['Visible']);
  assert.equal(composeMemoryDocument(sections.map(s => s.text)), input);
});
