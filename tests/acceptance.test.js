import { it } from 'vitest';
import { describe } from 'vitest';
import { execa } from 'execa';
import { expect } from 'vitest';
import { readdirSync } from 'node:fs';

describe('basic acceptance test', () => {
  it.for(readdirSync('./tests/acceptance-fixtures'))(
    'can run the cli with %s',
    async folderName => {
      const { stdout } = await execa({
        cwd: `./tests/acceptance-fixtures/${folderName}`,
      })`node ../../../bin/cli.js`;
      expect(stdout).toMatchSnapshot();
    }
  );
});
