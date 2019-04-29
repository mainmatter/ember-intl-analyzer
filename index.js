#!/usr/bin/env node

'use strict';

const fs = require('fs');
const path = require('path');

const pkgDir = require('pkg-dir');
const chalk = require('chalk');
const globby = require('globby');
const BabelParser = require('@babel/parser');
const traverse = require('@babel/traverse').default;
const Glimmer = require('@glimmer/syntax');
const Emblem = require('emblem').default;

async function run() {
  const NUM_STEPS = 3;
  const step = num => chalk.dim(`[${num}/${NUM_STEPS}]`);

  let rootDir = await pkgDir();
  let config = readConfig(rootDir);

  console.log(`${step(1)} 🔍  Finding JS and HBS files...`);
  let files = await findAppFiles(rootDir);
  console.log(`${step(2)} 🔍  Searching for translations keys in JS and HBS files...`);
  let usedTranslationKeys = await analyzeFiles(rootDir, files);
  console.log(`${step(3)} ⚙️   Checking for unused translations...`);
  let translationFiles = await findTranslationFiles(rootDir);
  let existingTranslationKeys = await analyzeTranslationFiles(rootDir, translationFiles);

  let whitelist = config.whitelist || [];
  let unusedTranslations = findUnusedTranslations(
    usedTranslationKeys,
    existingTranslationKeys,
    whitelist
  );

  console.log();
  if (unusedTranslations.size === 0) {
    console.log(' 👏  No unused translations were found!');
  } else {
    console.log(` ⚠️   Found ${chalk.bold.yellow(unusedTranslations.size)} unused translations!`);
    console.log();
    for (let [key, files] of unusedTranslations) {
      console.log(`   - ${key} ${chalk.dim(`(used in ${generateFileList(files)})`)}`);
    }
  }
}

function readConfig(cwd) {
  let configPath = `${cwd}/config/ember-intl-analyzer.js`;

  let config = {};
  if (fs.existsSync(configPath)) {
    let requireESM = require('esm')(module);
    config = requireESM(configPath).default;
  }

  return config;
}

async function findAppFiles(cwd) {
  return globby(['app/**/*.js', 'app/**/*.hbs', 'app/**/*.emblem'], { cwd });
}

async function findTranslationFiles(cwd) {
  return globby(['translations/**/*.json'], { cwd });
}

async function analyzeFiles(cwd, files) {
  let allTranslationKeys = new Set();

  for (let file of files) {
    let translationKeys = await analyzeFile(cwd, file);

    for (let translationKey of translationKeys) {
      allTranslationKeys.add(translationKey);
    }
  }

  return allTranslationKeys;
}

async function analyzeFile(cwd, file) {
  let content = fs.readFileSync(`${cwd}/${file}`, 'utf8');
  let extension = path.extname(file).toLowerCase();

  if (extension === '.js') {
    return analyzeJsFile(content);
  } else if (extension === '.hbs') {
    return analyzeHbsFile(content);
  } else if (extension === '.emblem') {
    let hbs = Emblem.compile(content, { quiet: true });
    return analyzeHbsFile(hbs);
  } else {
    throw new Error(`Unknown extension: ${extension} (${file})`);
  }
}

async function analyzeJsFile(content) {
  let translationKeys = new Set();

  // parse the JS file
  let ast = BabelParser.parse(content, {
    sourceType: 'module',
    plugins: ['dynamicImport'],
  });

  // find translation keys in the syntax tree
  traverse(ast, {
    // handle this.intl.t('foo') case
    CallExpression({ node }) {
      let { callee } = node;
      if (callee.type !== 'MemberExpression') return;
      if (callee.property.type !== 'Identifier') return;
      if (callee.property.name !== 't') return;

      if (node.arguments.length === 0) return;

      let firstParam = node.arguments[0];
      if (firstParam.type !== 'StringLiteral') return;

      translationKeys.add(firstParam.value);
    },
  });

  return translationKeys;
}

async function analyzeHbsFile(content) {
  let translationKeys = new Set();

  // parse the HBS file
  let ast = Glimmer.preprocess(content);

  // find translation keys in the syntax tree
  Glimmer.traverse(ast, {
    // handle {{t "foo"}} case
    MustacheStatement(node) {
      if (node.path.type !== 'PathExpression') return;
      if (node.path.original !== 't') return;
      if (node.params.length === 0) return;

      let firstParam = node.params[0];
      if (firstParam.type !== 'StringLiteral') return;

      translationKeys.add(firstParam.value);
    },

    // handle {{some-component foo=(t "bar")}} case
    SubExpression(node) {
      if (node.path.type !== 'PathExpression') return;
      if (node.path.original !== 't') return;
      if (node.params.length === 0) return;

      let firstParam = node.params[0];
      if (firstParam.type !== 'StringLiteral') return;

      translationKeys.add(firstParam.value);
    },
  });

  return translationKeys;
}

async function analyzeTranslationFiles(cwd, files) {
  let existingTranslationKeys = new Map();

  for (let file of files) {
    let content = fs.readFileSync(`${cwd}/${file}`, 'utf8');
    let json = JSON.parse(content);
    forEachTranslation(json, key => {
      if (!existingTranslationKeys.has(key)) {
        existingTranslationKeys.set(key, new Set());
      }

      existingTranslationKeys.get(key).add(file);
    });
  }

  return existingTranslationKeys;
}

function forEachTranslation(json, callback, prefix = '') {
  for (let key of Object.keys(json)) {
    let fullKey = prefix + key;
    let value = json[key];

    let typeOfValue = typeof value;
    if (typeOfValue === 'string') {
      callback(fullKey, value);
    } else if (typeOfValue === 'object') {
      forEachTranslation(value, callback, `${fullKey}.`);
    } else {
      throw new Error(`Unknown value type: ${typeOfValue} (for ${fullKey})`);
    }
  }
}

function findUnusedTranslations(usedTranslationKeys, existingTranslationKeys, whitelist) {
  let unusedTranslations = new Map();

  for (let [existingTranslationKey, files] of existingTranslationKeys) {
    if (usedTranslationKeys.has(existingTranslationKey)) continue;
    if (whitelist.some(regex => regex.test(existingTranslationKey))) continue;
    unusedTranslations.set(existingTranslationKey, files);
  }

  return unusedTranslations;
}

function generateFileList(files) {
  let filesWithoutPrefix = Array.from(files).map(file =>
    file.startsWith('translations/') ? file.substring(13) : file
  );

  if (filesWithoutPrefix.length === 0) {
    throw new Error('Unexpected empty file list');
  } else if (filesWithoutPrefix.length === 1) {
    return filesWithoutPrefix[0];
  } else if (filesWithoutPrefix.length === 2) {
    return `${filesWithoutPrefix[0]} and ${filesWithoutPrefix[1]}`;
  } else {
    let lastFile = filesWithoutPrefix.pop();
    return `${filesWithoutPrefix.join(',')} and ${lastFile}`;
  }
}

run().catch(error => {
  console.error(chalk.red(error.stack));
});
