#!/usr/bin/env node

'use strict';

const chalk = require('chalk');
const pkgDir = require('pkg-dir');
const { run } = require('../index');

let rootDir = pkgDir.sync();

run(rootDir, { fix: process.argv.includes('--fix') })
  .then(exitCode => {
    process.exitCode = exitCode;
  })
  .catch(error => {
    console.error(chalk.red(error.stack));
  });
