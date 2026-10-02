import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, writeFileSync, readFileSync, mkdirSync, existsSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import {
  parseSemver,
  bumpVersion,
  sha256File,
  installerFileName,
  releaseDownloadUrl,
  buildLatestManifest,
  readPackageVersion,
  writePackageVersion,
  runRelease,
} from './release.mjs';

const REPO = 'adry999/startica-portable-app';

test('parseSemver acceptă doar X.Y.Z și aruncă pe orice altceva', () => {
  assert.deepEqual(parseSemver('2.1.0'), { major: 2, minor: 1, patch: 0 });
  assert.throws(() => parseSemver('2.1'), /Versiune invalidă/);
  assert.throws(() => parseSemver('v2.1.0'), /Versiune invalidă/);
});

test('bumpVersion', () => {
  assert.equal(bumpVersion('2.1.5', 'patch'), '2.1.6');
  assert.equal(bumpVersion('2.1.5', 'minor'), '2.2.0');
  assert.equal(bumpVersion('2.1.5', 'major'), '3.0.0');
  assert.throws(() => bumpVersion('2.1.5', 'alta'), /Tip de bump necunoscut/);
});

test('installerFileName și releaseDownloadUrl', () => {
  assert.equal(installerFileName('2.2.0'), 'Startica_Setup_2.2.0.exe');
  assert.equal(
    releaseDownloadUrl(REPO, '2.2.0'),
    'https://github.com/adry999/startica-portable-app/releases/download/v2.2.0/Startica_Setup_2.2.0.exe',
  );
});

test('buildLatestManifest construiește manifestul citit de update-check.service.mjs', () => {
  const manifest = buildLatestManifest({
    repo: REPO,
    version: '2.2.0',
    sha256: 'abc123',
    notes: 'Note',
    now: () => new Date('2026-10-02T10:00:00.000Z'),
  });

  assert.deepEqual(manifest, {
    version: '2.2.0',
    downloadUrl: releaseDownloadUrl(REPO, '2.2.0'),
    sha256: 'abc123',
    notes: 'Note',
    publishedAt: '2026-10-02T10:00:00.000Z',
  });
});

test('readPackageVersion/writePackageVersion pe un package.json temporar', () => {
  const dir = mkdtempSync(join(tmpdir(), 'startica-release-pkg-'));
  const packageJsonPath = join(dir, 'package.json');
  writeFileSync(packageJsonPath, JSON.stringify({ name: 'x', version: '1.0.0' }, null, 2) + '\n');

  assert.equal(readPackageVersion(packageJsonPath), '1.0.0');

  writePackageVersion('1.1.0', packageJsonPath);

  assert.equal(readPackageVersion(packageJsonPath), '1.1.0');
  assert.ok(readFileSync(packageJsonPath, 'utf8').endsWith('\n'));
});

test('sha256File e determinist și sensibil la conținut', () => {
  const dir = mkdtempSync(join(tmpdir(), 'startica-release-sha-'));
  const fileA = join(dir, 'a.txt');
  const fileB = join(dir, 'b.txt');
  writeFileSync(fileA, 'continut identic');
  writeFileSync(fileB, 'continut identic');
  const fileC = join(dir, 'c.txt');
  writeFileSync(fileC, 'continut diferit');

  assert.equal(sha256File(fileA), sha256File(fileB));
  assert.notEqual(sha256File(fileA), sha256File(fileC));
  assert.match(sha256File(fileA), /^[0-9a-f]{64}$/);
});

/** Pregătește un „repo” temporar cu doar package.json — runRelease nu are nevoie de altceva. */
function setupRepo(version = '2.1.0') {
  const root = mkdtempSync(join(tmpdir(), 'startica-release-run-'));
  const packageJsonPath = join(root, 'package.json');
  writeFileSync(packageJsonPath, JSON.stringify({ name: 'startica', version }, null, 2) + '\n');
  const outputDir = join(root, 'Livrare');
  mkdirSync(outputDir, { recursive: true });
  return { root, packageJsonPath, outputDir };
}

function collectLog() {
  const lines = [];
  return { log: line => lines.push(line), lines };
}

test('runRelease dry-run (implicit): nu scrie package.json, nu cheamă git/PowerShell/gh', async () => {
  const { root, packageJsonPath, outputDir } = setupRepo('2.1.0');
  const calls = { git: 0, powershell: 0, gh: 0 };
  const { log, lines } = collectLog();

  const result = await runRelease({
    root,
    packageJsonPath,
    outputDir,
    runGit: () => {
      calls.git++;
      return '';
    },
    runPowerShell: () => calls.powershell++,
    runGh: () => calls.gh++,
    log,
  });

  assert.equal(result.executed, false);
  assert.equal(result.currentVersion, '2.1.0');
  assert.equal(result.nextVersion, '2.1.1');
  assert.equal(calls.git, 0);
  assert.equal(calls.powershell, 0);
  assert.equal(calls.gh, 0);
  assert.equal(readPackageVersion(packageJsonPath), '2.1.0', 'package.json neschimbat în dry-run');
  assert.ok(lines.some(line => line.includes('DRY RUN')));
});

test('runRelease --execute: bump → commit → build → SHA-256 → latest.json → gh release create, în ordine', async () => {
  const { root, packageJsonPath, outputDir } = setupRepo('2.1.0');
  const calls = [];

  const result = await runRelease({
    root,
    packageJsonPath,
    outputDir,
    repo: 'adry999/startica-releases',
    notes: 'Note de test',
    execute: true,
    runGit: ({ args }) => {
      calls.push({ step: 'git', args });
      return '';
    },
    runPowerShell: ({ outputDirectory }) => {
      calls.push({ step: 'powershell', outputDirectory });
      // Simulează ISCC: scrie exact instalerul pe care runRelease îl așteaptă după build.
      writeFileSync(join(outputDirectory, installerFileName('2.1.1')), 'continut-instaler-fals');
    },
    runGh: ({ args }) => calls.push({ step: 'gh', args }),
    log: () => {},
  });

  assert.equal(result.executed, true);
  assert.equal(result.nextVersion, '2.1.1');
  assert.equal(readPackageVersion(packageJsonPath), '2.1.1', 'package.json a fost actualizat');

  const steps = calls.map(call => call.step);
  assert.deepEqual(steps, ['git', 'git', 'powershell', 'gh']);
  assert.deepEqual(calls[0].args, ['add', '--', packageJsonPath]);
  assert.equal(calls[1].args[0], 'commit');
  assert.match(calls[1].args[2], /chore\(packaging\): pregătire v2\.1\.1/);

  assert.ok(existsSync(result.manifestPath), 'latest.json a fost scris');
  const manifest = JSON.parse(readFileSync(result.manifestPath, 'utf8'));
  assert.equal(manifest.version, '2.1.1');
  assert.equal(manifest.sha256, sha256File(result.installerPath));
  assert.equal(
    manifest.downloadUrl,
    'https://github.com/adry999/startica-releases/releases/download/v2.1.1/Startica_Setup_2.1.1.exe',
  );
  assert.equal(manifest.notes, 'Note de test');

  const ghCall = calls.find(call => call.step === 'gh');
  assert.deepEqual(ghCall.args.slice(0, 3), ['release', 'create', 'v2.1.1']);
  assert.ok(ghCall.args.includes(result.installerPath));
  assert.ok(ghCall.args.includes(result.manifestPath));
  assert.ok(ghCall.args.includes('adry999/startica-releases'));
  assert.ok(ghCall.args.includes('Note de test'));
});

test('runRelease --execute aruncă dacă instalerul așteptat lipsește după build (ISCC eșuat în tăcere)', async () => {
  const { root, packageJsonPath, outputDir } = setupRepo('2.1.0');

  await assert.rejects(
    () =>
      runRelease({
        root,
        packageJsonPath,
        outputDir,
        execute: true,
        runGit: () => '',
        runPowerShell: () => {}, // nu scrie niciun instaler — simulează un build eșuat
        runGh: () => {},
        log: () => {},
      }),
    /Instalerul așteptat lipsește/,
  );
});
