const execa = require('execa');
const fs = require('fs');
const { run, generateFileList } = require('./index');

let fixtures = fs.readdirSync(`${__dirname}/fixtures/`);

describe('Test Fixtures', () => {
  let output;
  let writtenFiles;
  let fixturesWithErrors = ['emblem', 'missing-translations', 'unused-translations'];
  let fixturesWithFix = ['remove-unused-translations', 'remove-unused-translations-nested'];

  beforeEach(() => {
    output = '';
    writtenFiles = new Map();
  });

  function log(str = '') {
    output += `${str}\n`;
  }
  function writeToFile(filePath, updatedTranslations) {
    let fileName = filePath.split('/').slice(-2).join('/');
    writtenFiles.set(fileName, updatedTranslations);
  }

  for (let fixture of fixtures) {
    test(fixture, async () => {
      let returnValue = await run(`${__dirname}/fixtures/${fixture}`, {
        log,
        fix: fixturesWithFix.includes(fixture),
        color: false,
        writeToFile,
      });

      let expectedReturnValue = fixturesWithErrors.includes(fixture) ? 1 : 0;

      expect(returnValue).toEqual(expectedReturnValue);
      expect(output).toMatchSnapshot();
      expect(writtenFiles).toMatchSnapshot();
    });
  }
});

describe('generateFileList', () => {
  const TESTS = [
    [['a.js'], 'a.js'],
    [['a.js', 'b.js'], 'a.js and b.js'],
    [['a.js', 'b.js', 'c.js'], 'a.js, b.js and c.js'],
    [['a.js', 'b.js', 'd.js', 'c.js'], 'a.js, b.js, c.js and d.js'],
    [['translations/en.json', 'translations/de.json'], 'de.json and en.json'],
  ];

  for (let [input, expected] of TESTS) {
    test(expected, () => {
      expect(generateFileList(input)).toBe(expected);
    });
  }

  test('passing an empty array throws an error', () => {
    expect(() => generateFileList([])).toThrow('Unexpected empty file list');
  });
});

describe('Running from cli', () => {
  test('without unused translations', async () => {
    let { stdout } = await execa('node', ['../../bin/cli'], {
      cwd: `${__dirname}/fixtures/no-issues`,
    });

    expect(stdout).toMatch('No unused translations');
  });

  test('with unused translations', async () => {
    expect(
      execa('node', ['../../bin/cli'], { cwd: `${__dirname}/fixtures/unused-translations` })
    ).rejects.toThrowError('Found 2 unused translations');
  });

  test('with missing translations', async () => {
    expect(
      execa('node', ['../../bin/cli'], { cwd: `${__dirname}/fixtures/missing-translations` })
    ).rejects.toThrowError('Found 2 missing translations');
  });

  describe('with auto-fix', () => {
    afterEach(async function () {
      await execa('git', ['checkout', 'HEAD', 'fixtures/remove-unused-translations/translations'], {
        cwd: __dirname,
      });
    });

    test('with unused translations', async () => {
      let { stdout } = await execa('node', ['../../bin/cli', '--fix'], {
        cwd: `${__dirname}/fixtures/remove-unused-translations`,
      });

      expect(stdout).toMatch('All unused translations were removed');
    });
  });
});
