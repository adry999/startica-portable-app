import { describe, expect, it } from 'vitest';
import { readdirSync, readFileSync } from 'node:fs';
import { dirname, join, relative, resolve, sep } from 'node:path';

const SRC_ROOT: string = import.meta.dirname;
const FEATURES_ROOT = join(SRC_ROOT, 'features');
const APP_ROOT = join(SRC_ROOT, 'app');

const IMPORT_PATTERN = /(?:from|import)\s*\(?\s*['"]([^'"]+)['"]/g;

/** Colectează fișierele .ts/.tsx dintr-un folder de feature, cu excepția testelor. */
function collectFeatureSourceFiles(featureDir: string): string[] {
  return readdirSync(featureDir, { withFileTypes: true, recursive: true })
    .filter(entry => entry.isFile() && /\.tsx?$/.test(entry.name) && !/\.test\.tsx?$/.test(entry.name))
    .map(entry => join(entry.parentPath, entry.name));
}

function readImportSpecifiers(sourceText: string): string[] {
  return [...sourceText.matchAll(IMPORT_PATTERN)].map(match => match[1]);
}

/** Rezolvă un specificator de import la o cale absolută, dacă e relativ sau un alias intern (@app/@features). */
function resolveSpecifier(fileDir: string, specifier: string): string | null {
  if (specifier.startsWith('.')) return resolve(fileDir, specifier);
  if (specifier.startsWith('@features/')) return join(FEATURES_ROOT, specifier.slice('@features/'.length));
  if (specifier.startsWith('@app/')) return join(APP_ROOT, specifier.slice('@app/'.length));
  return null;
}

interface Violation {
  file: string;
  specifier: string;
  rule: 'feature-imports-feature' | 'feature-imports-app';
}

function findViolations(): Violation[] {
  const featureNames = readdirSync(FEATURES_ROOT, { withFileTypes: true })
    .filter(entry => entry.isDirectory())
    .map(entry => entry.name);

  const violations: Violation[] = [];

  for (const featureName of featureNames) {
    const featureDir = join(FEATURES_ROOT, featureName);
    for (const absolutePath of collectFeatureSourceFiles(featureDir)) {
      const fileDir = dirname(absolutePath);
      const specifiers = readImportSpecifiers(readFileSync(absolutePath, 'utf8'));
      const relativeFile = relative(SRC_ROOT, absolutePath).split(sep).join('/');

      for (const specifier of specifiers) {
        const resolved = resolveSpecifier(fileDir, specifier);
        if (!resolved) continue;

        if (resolved === APP_ROOT || resolved.startsWith(APP_ROOT + sep)) {
          violations.push({ file: relativeFile, specifier, rule: 'feature-imports-app' });
          continue;
        }

        if (resolved.startsWith(FEATURES_ROOT + sep)) {
          const otherFeature = relative(FEATURES_ROOT, resolved).split(sep)[0];
          if (otherFeature && otherFeature !== featureName) {
            violations.push({ file: relativeFile, specifier, rule: 'feature-imports-feature' });
          }
        }
      }
    }
  }

  return violations;
}

describe('granițele dintre module (webapp/src/features)', () => {
  it('niciun fișier dintr-un feature nu importă direct dintr-un alt feature', () => {
    const violations = findViolations().filter(v => v.rule === 'feature-imports-feature');
    expect(violations).toEqual([]);
  });

  it('niciun fișier dintr-un feature nu importă din app/ (doar app/ poate importa features)', () => {
    const violations = findViolations().filter(v => v.rule === 'feature-imports-app');
    expect(violations).toEqual([]);
  });
});
