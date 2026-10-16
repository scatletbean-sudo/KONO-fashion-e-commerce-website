import assert from 'node:assert/strict';
import test from 'node:test';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import vm from 'node:vm';
import ts from 'typescript';

const root = process.cwd();
const password = '\u0110\u1ed3-th\u1eddi-trang-KONO-2026';

for (const scenario of ['utf8', 'mismatch', 'caseMismatch', 'short', 'over72', 'exact72', 'checkFail', 'resetFail']) {
  test(`Windows PowerShell 5.1 wrapper: ${scenario}`, { skip: process.platform !== 'win32' }, () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'kono-reset-mock-'));
    try {
      fs.mkdirSync(path.join(dir, 'scripts'));
      fs.copyFileSync(path.join(root, 'scripts/reset-media-dev-admin.ps1'), path.join(dir, 'scripts/reset-media-dev-admin.ps1'));
      const selected = scenario === 'short' ? 'short' : scenario === 'over72' ? '\u00e9'.repeat(37) : scenario === 'exact72' ? '\u00e9'.repeat(36) : password;
      const confirm = scenario === 'mismatch' ? selected + 'x' : scenario === 'caseMismatch' ? selected.toLowerCase() : selected;
      fs.writeFileSync(path.join(dir, 'scripts/reset-media-dev-admin.mjs'), `
        if (process.argv[2] === '--check') { console.log('MOCK_CHECK'); process.exit(${scenario === 'checkFail' ? 7 : 0}); }
        const chunks = []; for await (const c of process.stdin) chunks.push(c);
        const bytes = Buffer.concat(chunks); const input = JSON.parse(bytes.toString('utf8'));
        if (bytes[0] === 239 || input.password !== ${JSON.stringify(selected)} || input.confirm !== input.password || process.argv.length !== 3) process.exit(9);
        console.log('MOCK_UTF8_STDIN_OK'); process.exit(${scenario === 'resetFail' ? 8 : 0});
      `);
      // Fixtures contain only synthetic test inputs. The real reset command never writes a secret file.
      fs.writeFileSync(path.join(dir, 'runner.ps1'), `
        $ErrorActionPreference = 'Stop'
        $script:reads = 0
        function Read-Host { param($Prompt, [switch]$AsSecureString)
          $script:reads++; Write-Host 'MOCK_HIDDEN_PROMPT'
          if (-not $AsSecureString) { throw 'Hidden prompt required' }
          $text = if ($script:reads -eq 1) { [Text.Encoding]::UTF8.GetString([Convert]::FromBase64String('${Buffer.from(selected).toString('base64')}')) } else { [Text.Encoding]::UTF8.GetString([Convert]::FromBase64String('${Buffer.from(confirm).toString('base64')}')) }
          ConvertTo-SecureString -String $text -AsPlainText -Force
        }
        & "$PSScriptRoot/scripts/reset-media-dev-admin.ps1"
        exit $LASTEXITCODE
      `);
      const result = spawnSync('powershell.exe', ['-NoProfile', '-NonInteractive', '-ExecutionPolicy', 'Bypass', '-File', path.join(dir, 'runner.ps1')], { encoding: 'utf8', timeout: 20000 });
      const output = result.stdout + result.stderr;
      assert.equal(result.error, undefined);
      assert.equal(result.status, ['utf8', 'exact72'].includes(scenario) ? 0 : 1);
      assert.equal(output.includes('MOCK_UTF8_STDIN_OK'), ['utf8', 'exact72', 'resetFail'].includes(scenario));
      assert.equal(output.includes('MOCK_HIDDEN_PROMPT'), scenario !== 'checkFail');
      assert.equal(output.includes(selected), false);
      assert.equal(output.includes('StandardInputEncoding'), false);
    } finally {
      fs.rmSync(dir, { recursive: true, force: true });
    }
  });
}

async function mockNode({ confirm = password, url, identityPatch = {}, accountPatch = {} } = {}) {
  const expected = { project: 'hidden-forest-64993760', branch: 'br-proud-field-b3xjljxh', endpoint: 'ep-lucky-fire-b3froe7u', database: 'neondb', schema: 'public' };
  const identity = { ...expected, ...identityPatch };
  const statements = [];
  const logs = [];
  const account = { id: 'mock-admin', email: 'admin@kono.local', role: 'ADMIN', status: 'ACTIVE', passwordHash: 'mock-old-hash', ...accountPatch };
  const settings = url ? { KONO_MEDIA_DEV_DATABASE_URL: url } : { DATABASE_URL: 'postgresql://synthetic:synthetic@ep-icy-butterfly-b3dbylfa.aws.neon.tech/neondb' };
  const fakeProcess = { argv: ['node', 'reset.mjs', '--reset'], env: {}, stdin: { isTTY: false, async *[Symbol.asyncIterator]() { yield Buffer.from(JSON.stringify({ password, confirm })); } }, exitCode: 0 };
  class Client {
    constructor() { this.connection = { stream: { authorized: true } }; }
    on() {} async connect() {} async end() {}
    async query(sql, params) {
      statements.push(sql);
      if (sql.startsWith('SELECT current_database')) return { rows: [identity] };
      if (sql.startsWith('SELECT')) return { rows: [{ ...account }] };
      if (sql.startsWith('UPDATE')) { account.passwordHash = params[0]; return { rowCount: 1 }; }
      return { rows: [] };
    }
  }
  const mocks = { 'node:fs': { readFileSync: () => '' }, dotenv: { parse: () => settings }, bcryptjs: { hash: async () => 'mock-new-hash', compare: async () => true }, pg: { Client } };
  const context = { require: name => { assert.ok(name in mocks); return mocks[name]; }, exports: {}, process: fakeProcess, Buffer, URL, AbortSignal, console: { log: x => logs.push(x), error: x => logs.push(x) }, fetch: async () => ({ ok: true, json: async () => ({ success: true, identity }) }) };
  const source = ts.transpileModule(fs.readFileSync('scripts/reset-media-dev-admin.mjs', 'utf8'), { compilerOptions: { allowJs: true, module: ts.ModuleKind.CommonJS, esModuleInterop: true } }).outputText.replace('main().catch', 'globalThis.completion = main().catch');
  vm.runInNewContext(source, context);
  await context.completion;
  assert.equal(logs.join('\n').includes(password), false);
  assert.equal(logs.join('\n').includes('mock-new-hash'), false);
  return { code: fakeProcess.exitCode, statements };
}
const dev = 'postgresql://synthetic:synthetic@ep-lucky-fire-b3froe7u.aws.neon.tech/neondb?sslmode=require';
test('Node reset accepts UTF-8 stdin using only mock database and bcrypt', async () => {
  const result = await mockNode({ url: dev });
  assert.equal(result.code, 0);
  assert.ok(result.statements.includes('COMMIT'));
});
test('Node reset rejects wrong confirmation before any update', async () => {
  const result = await mockNode({ url: dev, confirm: password + 'x' });
  assert.equal(result.code, 1);
  assert.equal(result.statements.some(sql => sql.startsWith('UPDATE')), false);
});
test('Node reset never falls back to production and rejects wrong branch or inactive admin', async () => {
  for (const options of [{}, { url: dev.replace('ep-lucky-fire-b3froe7u', 'ep-icy-butterfly-b3dbylfa') }, { url: dev, identityPatch: { branch: 'wrong-branch' } }, { url: dev, accountPatch: { status: 'INACTIVE' } }]) {
    const result = await mockNode(options);
    assert.equal(result.code, 1);
    assert.equal(result.statements.some(sql => sql.startsWith('UPDATE')), false);
  }
});
