import { readdirSync, readFileSync, statSync } from 'node:fs';
import path from 'node:path';

import { describe, expect, it } from 'vitest';

function collectTsFiles(dir: string): string[] {
  const entries = readdirSync(dir);
  const files: string[] = [];

  for (const entry of entries) {
    const fullPath = path.join(dir, entry);
    const stats = statSync(fullPath);

    if (stats.isDirectory()) {
      files.push(...collectTsFiles(fullPath));
      continue;
    }

    if (entry.endsWith('.ts') && !entry.endsWith('.test.ts')) {
      files.push(fullPath);
    }
  }

  return files;
}

const RELATIVE_IMPORT_RE = /from ['"](\.\.?\/[^'"]+)['"]/g;

describe('server ESM relative imports', () => {
  it('uses .js extensions for runtime imports in api and packages/core', () => {
    const root = process.cwd();
    const files = [
      ...collectTsFiles(path.join(root, 'api')),
      ...collectTsFiles(path.join(root, 'packages', 'core')),
    ];

    const missingJsExtensions: string[] = [];

    for (const file of files) {
      const content = readFileSync(file, 'utf8');
      const matches = content.matchAll(RELATIVE_IMPORT_RE);

      for (const match of matches) {
        const specifier = match[1];
        if (!specifier.endsWith('.js')) {
          missingJsExtensions.push(
            `${path.relative(root, file).replaceAll('\\', '/')}: ${specifier}`,
          );
        }
      }
    }

    expect(missingJsExtensions).toEqual([]);
  });
});
