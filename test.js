const fs = require('fs');
const { run, generateFileList } = require('./index');

let fixtures = fs.readdirSync(`${__dirname}/fixtures/`);

describe('Test Fixtures', () => {
  let output;
  let writtenFiles;
  let fixturesWithErrors = [
    'emblem',
    'missing-translations',
    'unused-translations',
    'in-repo-translations',
    'external-addon-translations',
    'concat-expression',
    'chosen-translations',
    'unused-whitelist',
  ];
  let fixturesWithFix = ['remove-unused-translations', 'remove-unused-translations-nested'];
  let fixturesWithConcat = ['concat-expression'];
  let fixturesWithConfig = {
    'external-addon-translations': {
      externalPaths: ['@*/*', 'external-addon'],
    },
    'chosen-translations': {
      translationFiles: ['**/en.yaml'],
    },
    'plugin-config': {
      babelParserPlugins: ['typescript'],
      extensions: ['.ts'],
    },
    'first-class-component-templates': {
      babelParserPlugins: ['typescript'],
      extensions: ['.gts'],
    },
    'unused-whitelist': {
      errorOnUnusedWhitelistEntries: true,
      whitelist: [
        /some\.whitelisted\.translation-(a|b)/,
        /some\.unused\.whitelisted\.translation-(a|b)/,
      ],
    },
    'custom-t-helpers': {
      helpers: ['t-error'],
    },
  };

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
        config: fixturesWithConfig[fixture],
        analyzeConcatExpression: fixturesWithConcat.includes(fixture),
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
