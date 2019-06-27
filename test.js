const fs = require('fs');
const { run } = require('./index');

let fixtures = fs.readdirSync(`${__dirname}/fixtures/`);

describe('Test Fixtures', () => {
  let output;

  beforeEach(() => {
    output = '';
  });

  function log(str = '') {
    output += `${str}\n`;
  }

  for (let fixture of fixtures) {
    test(fixture, async () => {
      await run(`${__dirname}/fixtures/${fixture}`, { log, color: false });
      expect(output).toMatchSnapshot();
    });
  }
});
