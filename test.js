const fs = require('fs');
const { run, generateFileList } = require('./index');

let fixtures = fs.readdirSync(`${__dirname}/fixtures/`);

describe('Test Fixtures', () => {
  let output;
  let fixturesWithErrors = ['emblem', 'missing-translations', 'unused-translations'];

  beforeEach(() => {
    output = '';
  });

  function log(str = '') {
    output += `${str}\n`;
  }

  for (let fixture of fixtures) {
    test(fixture, async () => {
      let returnValue = await run(`${__dirname}/fixtures/${fixture}`, { log, color: false });

      let expectedReturnValue = fixturesWithErrors.includes(fixture) ? 1 : 0;

      expect(returnValue).toEqual(expectedReturnValue);
      expect(output).toMatchSnapshot();
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
