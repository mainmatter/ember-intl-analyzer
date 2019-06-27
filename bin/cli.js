#!/usr/bin/env node

'use strict';

const chalk = require('chalk');
const { run } = require('../index');

run().catch(error => {
  console.error(chalk.red(error.stack));
});
