// Acoperirea Storybook (PROMPT-CLAUDE-CODE-6.md §4): fiecare export din @shared/ui/index.ts are o
// poveste, fiecare cheie din empty-states.ts are o poveste, iar fiecare poveste rulează ca test
// (composeStories + jest-axe), fără încălcări de accesibilitate.
import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import type { ComponentType } from 'react';
import { render } from '@testing-library/react';
import { composeStories } from '@storybook/react';
import { axe } from 'jest-axe';
import { describe, expect, it } from 'vitest';
import * as SharedUi from '@shared/ui';
import { EMPTY_STATES } from '@shared/ui';
import * as projectAnnotations from '../.storybook/preview';

const UI_ROOT = join(import.meta.dirname, 'shared', 'ui');
const RUNTIME_EXPORT_NAMES = Object.keys(SharedUi);
const EMPTY_STATE_KEYS = Object.keys(EMPTY_STATES);

interface SourceFile {
  path: string;
  name: string;
  text: string;
}

function collectFiles(pattern: RegExp): SourceFile[] {
  return readdirSync(UI_ROOT, { withFileTypes: true, recursive: true })
    .filter(entry => entry.isFile() && pattern.test(entry.name))
    .map(entry => {
      const path = join(entry.parentPath, entry.name);
      return { path, name: entry.name, text: readFileSync(path, 'utf8') };
    });
}

const storyFiles = collectFiles(/\.stories\.tsx$/);
const componentFiles = collectFiles(/\.tsx$/).filter(f => !/\.(stories|test)\.tsx$/.test(f.name));
const combinedStoriesText = storyFiles.map(f => f.text).join('\n');

/** Fișierul de poveste al unui export, dacă are unul dedicat (`<Export>.stories.tsx`). */
function storyFileFor(exportName: string): SourceFile | undefined {
  return storyFiles.find(f => f.name === `${exportName}.stories.tsx`);
}

/** Fișierul sursă al unui export (componentă/hook), căutat după declarația de export. */
function sourceFileFor(exportName: string): SourceFile | undefined {
  const pattern = new RegExp(`export\\s+(function|const)\\s+${exportName}\\b`);
  return componentFiles.find(f => pattern.test(f.text));
}

describe('Storybook §4 — acoperire completă pentru @shared/ui', () => {
  it('există cel puțin un fișier .stories.tsx', () => {
    expect(storyFiles.length).toBeGreaterThan(0);
  });

  for (const exportName of RUNTIME_EXPORT_NAMES) {
    it(`„${exportName}" apare într-o poveste`, () => {
      const pattern = new RegExp(`\\b${exportName}\\b`);
      expect(pattern.test(combinedStoriesText), `niciun .stories.tsx nu menționează exportul „${exportName}"`).toBe(
        true,
      );
    });
  }
});

describe('Storybook §4 — Disabled/Loading/Error doar dacă prop-ul există', () => {
  const STATE_PROP_PATTERNS: Record<string, RegExp> = {
    Disabled: /\bdisabled\?:/,
    Loading: /\b(loading|isLoading)\?:/,
    Error: /\b(error|errorMessage)\?:/,
  };

  for (const exportName of RUNTIME_EXPORT_NAMES) {
    const source = sourceFileFor(exportName);
    const story = storyFileFor(exportName);
    if (!source || !story) continue;

    for (const [stateName, propPattern] of Object.entries(STATE_PROP_PATTERNS)) {
      if (!propPattern.test(source.text)) continue;
      it(`${exportName} are propul „${stateName.toLowerCase()}" → poveste „${stateName}"`, () => {
        const storyExportPattern = new RegExp(`export const ${stateName}\\b`);
        expect(
          storyExportPattern.test(story.text),
          `${story.path} nu are "export const ${stateName}", deși ${source.path} are propul`,
        ).toBe(true);
      });
    }
  }
});

describe('Storybook §4 — fiecare cheie din empty-states.ts are o poveste', () => {
  const emptyStatesStoryFile = storyFiles.find(f => f.name === 'EmptyState.stories.tsx');

  it('EmptyState.stories.tsx există', () => {
    expect(emptyStatesStoryFile).toBeDefined();
  });

  it('are o poveste „no-results" (căutare/filtre, prioritate peste catalog)', () => {
    expect(emptyStatesStoryFile?.text ?? '').toMatch(/no-results/);
  });

  for (const key of EMPTY_STATE_KEYS) {
    it(`cheia „${key}" are o poveste`, () => {
      expect(
        (emptyStatesStoryFile?.text ?? '').includes(key),
        `EmptyState.stories.tsx nu menționează cheia „${key}"`,
      ).toBe(true);
    });
  }
});

describe('Storybook §4 — fiecare poveste randează fără erori, fără încălcări axe', () => {
  const modules = import.meta.glob<Record<string, unknown>>('./shared/ui/**/*.stories.tsx', { eager: true });

  it('s-a găsit cel puțin un modul de povești', () => {
    expect(Object.keys(modules).length).toBeGreaterThan(0);
  });

  for (const [path, mod] of Object.entries(modules)) {
    const stories = composeStories(mod as never, (projectAnnotations as { default?: unknown }).default as never);
    for (const [storyName, Story] of Object.entries(stories)) {
      const StoryComponent = Story as unknown as ComponentType;
      it(`${path} → ${storyName}: fără încălcări axe`, async () => {
        const { container, unmount } = render(<StoryComponent />);
        try {
          expect(await axe(container)).toHaveNoViolations();
        } finally {
          unmount();
        }
      });
    }
  }
});
