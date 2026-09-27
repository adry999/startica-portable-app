import { describe, expect, it } from 'vitest';
import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { dirname, join, relative, resolve } from 'node:path';

const SRC_ROOT: string = import.meta.dirname;
const CSS_MODULE_IMPORT = /import\s+(\w+)\s+from\s+['"]([^'"]+\.module\.css)['"]/g;

function collectComponentFiles(): string[] {
  return readdirSync(SRC_ROOT, { withFileTypes: true, recursive: true })
    .filter(entry => entry.isFile() && entry.name.endsWith('.tsx') && !entry.name.includes('.test.'))
    .map(entry => join(entry.parentPath, entry.name));
}

function findMissingClasses(): string[] {
  const missing: string[] = [];
  for (const file of collectComponentFiles()) {
    const source = readFileSync(file, 'utf8');
    for (const [, moduleName, cssPath] of source.matchAll(CSS_MODULE_IMPORT)) {
      const absoluteCss = resolve(dirname(file), cssPath);
      if (!existsSync(absoluteCss)) {
        missing.push(`${relative(SRC_ROOT, file)}: ${cssPath} nu există`);
        continue;
      }
      const css = readFileSync(absoluteCss, 'utf8');
      const usedClasses = new Set(
        [...source.matchAll(new RegExp(`\\b${moduleName}\\.(\\w+)`, 'g'))].map(match => match[1]),
      );
      for (const className of usedClasses) {
        if (!new RegExp(`\\.${className}(?![\\w-])`).test(css))
          missing.push(`${relative(SRC_ROOT, file)}: ${moduleName}.${className} lipsește din ${cssPath}`);
      }
    }
  }
  return missing;
}

describe('CSS Modules', () => {
  // O clasă ștearsă din .module.css devine `undefined` fără nicio eroare: elementul rămâne nestilizat.
  it('fiecare clasă folosită dintr-un .module.css există în fișierul importat', () => {
    expect(findMissingClasses()).toEqual([]);
  });
});
