import { rmSync } from 'node:fs';
import { resolve } from 'node:path';

const targets = ['.next', 'node_modules/.cache'];

for (const target of targets) {
  const path = resolve(target);
  try {
    rmSync(path, { recursive: true, force: true });
    console.log(`Removed ${target}`);
  } catch (error) {
    console.warn(`Skipped ${target}: ${error.message}`);
  }
}
