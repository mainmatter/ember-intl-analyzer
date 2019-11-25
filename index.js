'use strict';

const fs = require('fs');
const path = require('path');

const _chalk = require('chalk');
const globby = require('globby');
const BabelParser = require('@babel/parser');
const traverse = require('@babel/traverse').default;
const Glimmer = require('@glimmer/syntax');
const Emblem = require('emblem').default;
const YAML = require('yaml');

async function run(rootDir, options = {}) {
  let log = options.log || console.log;

  let chalkOptions = {};
  if ('color' in options) {
    chalkOptions.enabled = options.color;
  }
  let chalk = new _chalk.constructor(chalkOptions);

  const NUM_STEPS = 4;
  const step = num => chalk.dim(`[${num}/${NUM_STEPS}]`);

  let config = readConfig(rootDir);

  log(`${step(1)} 🔍  Finding JS and HBS files...`);
  let files = await findAppFiles(rootDir);

  log(`${step(2)} 🔍  Searching for translations keys in JS and HBS files...`);
  let usedTranslationKeys = await analyzeFiles(rootDir, files);

  log(`${step(3)} ⚙️   Checking for unused translations...`);

  let translationFiles = await findTranslationFiles(rootDir);
  let existingTranslationKeys = await analyzeTranslationFiles(rootDir, translationFiles);
  let whitelist = config.whitelist || [];

  let unusedTranslations = findDifferenceInTranslations(
    existingTranslationKeys,
    usedTranslationKeys,
    whitelist
  );

  log(`${step(4)} ⚙️   Checking for missing translations...`);
  log();
  let missingTranslations = findDifferenceInTranslations(
    usedTranslationKeys,
    existingTranslationKeys,
    whitelist
  );

  if (unusedTranslations.size === 0) {
    log(' 👏  No unused translations were found!');
  } else {
    log(` ⚠️   Found ${chalk.bold.yellow(unusedTranslations.size)} unused translations!`);
    log();
    for (let [key, files] of unusedTranslations) {
      log(`   - ${key} ${chalk.dim(`(used in ${generateFileList(files)})`)}`);
    }
  }
  log();

  if (missingTranslations.size === 0) {
    log(' 👏  No missing translations were found!');
  } else {
    log(` ⚠️   Found ${chalk.bold.yellow(missingTranslations.size)} missing translations!`);
    log();
    for (let [key, files] of missingTranslations) {
      log(`   - ${key} ${chalk.dim(`(used in ${generateFileList(files)})`)}`);
    }
  }

  let totalErrors = missingTranslations.size + unusedTranslations.size;

  return totalErrors > 0 ? 1 : 0;
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
  return globby(['translations/**/*.json', 'translations/**/*.yaml', 'translations/**/*.yml'], {
    cwd,
  });
}

async function analyzeFiles(cwd, files) {
  let allTranslationKeys = new Map();

  for (let file of files) {
    let translationKeys = await analyzeFile(cwd, file);

    for (let key of translationKeys) {
      if (allTranslationKeys.has(key)) {
        allTranslationKeys.get(key).add(file);
      } else {
        allTranslationKeys.set(key, new Set([file]));
      }
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
    plugins: ['decorators-legacy', 'dynamicImport', 'classProperties'],
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
    let translations = YAML.parse(content); // json is valid yaml
    forEachTranslation(translations, key => {
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

// Find all translation keys that appear in translation map A, but not
// in translation map B
function findDifferenceInTranslations(mapA, mapB, whitelist) {
  let missingTranslations = new Map();

  for (let [key, files] of mapA) {
    const keyTrimmed = key.trim();
    const isKeyMissing = !mapB.has(keyTrimmed);
    const isKeyAllowed = !whitelist.some(regex => regex.test(keyTrimmed));

    if (isKeyMissing && isKeyAllowed) {
      missingTranslations.set(keyTrimmed, files);
    }
  }

  return missingTranslations;
}

function generateFileList(files) {
  let filesWithoutPrefix = Array.from(files)
    .map(file => (file.startsWith('translations/') ? file.substring(13) : file))
    .sort();

  if (filesWithoutPrefix.length === 0) {
    throw new Error('Unexpected empty file list');
  } else if (filesWithoutPrefix.length === 1) {
    return filesWithoutPrefix[0];
  } else if (filesWithoutPrefix.length === 2) {
    return `${filesWithoutPrefix[0]} and ${filesWithoutPrefix[1]}`;
  } else {
    let lastFile = filesWithoutPrefix.pop();
    return `${filesWithoutPrefix.join(', ')} and ${lastFile}`;
  }
}

module.exports = { run, generateFileList };
