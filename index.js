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
  let writeToFile = options.writeToFile || fs.writeFileSync;
  let shouldFix = options.fix || false;

  let chalkOptions = {};
  if (options.color === false) {
    chalkOptions.level = 0;
  }
  let chalk = new _chalk.Instance(chalkOptions);

  const NUM_STEPS = 4;
  const step = num => chalk.dim(`[${num}/${NUM_STEPS}]`);

  let config = readConfig(rootDir);
  let intlConfig = readIntlConfig(rootDir);

  log(`${step(1)} 🔍  Finding JS and HBS files...`);
  let files = await findAppFiles(rootDir);

  log(`${step(2)} 🔍  Searching for translations keys in JS and HBS files...`);
  let usedTranslationKeys = await analyzeFiles(rootDir, files);

  log(`${step(3)} ⚙️   Checking for unused translations...`);

  let translationFiles = await findTranslationFiles(rootDir, intlConfig);
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
    if (!shouldFix) {
      log('     You can use --fix to remove all unused translations.');
    }
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

  if (shouldFix) {
    removeUnusedTranslations(writeToFile, rootDir, translationFiles, unusedTranslations);
    log();
    log(' 👏 All unused translations were removed');
  }

  return totalErrors > 0 && !shouldFix ? 1 : 0;
}

function readConfig(cwd) {
  let configPath = `${cwd}/config/ember-intl-analyzer.js`;

  let config = {};
  if (fs.existsSync(configPath)) {
    let requireESM = require('esm')(module, { cjs: { dedefault: true } });
    config = requireESM(configPath);
  }

  return config;
}

function readIntlConfig(cwd) {
  let configPath = `${cwd}/config/ember-intl.js`;

  let config;
  if (fs.existsSync(configPath)) {
    let requireESM = require('esm')(module);
    config = requireESM(configPath);
    if (config) {
      if (typeof config === 'function') {
        config = config();
      } else if (Object.prototype.hasOwnProperty.call(config, 'default')) {
        config = config.default;
      }
    }
  }

  return config || {};
}

async function findAppFiles(cwd) {
  return globby(['app/**/*.js', 'app/**/*.hbs', 'app/**/*.emblem'], { cwd });
}

async function findTranslationFiles(cwd, intlConfig) {
  let { inputPath = 'translations/' } = intlConfig;

  return globby([`${inputPath}**/*.json`, `${inputPath}**/*.yaml`, `${inputPath}**/*.yml`], {
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
      if (firstParam.type === 'StringLiteral') {
        translationKeys.add(firstParam.value);
      } else if (firstParam.type === 'ConditionalExpression') {
        if (firstParam.alternate.type === 'StringLiteral') {
          translationKeys.add(firstParam.alternate.value);
        }
        if (firstParam.consequent.type === 'StringLiteral') {
          translationKeys.add(firstParam.consequent.value);
        }
      }
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
      if (firstParam.type === 'StringLiteral') {
        translationKeys.add(firstParam.value);
      } else if (firstParam.type === 'SubExpression' && firstParam.path.original === 'if') {
        if (firstParam.params[1].type === 'StringLiteral') {
          translationKeys.add(firstParam.params[1].value);
        }
        if (firstParam.params[2].type === 'StringLiteral') {
          translationKeys.add(firstParam.params[2].value);
        }
      }
    },

    // handle {{some-component foo=(t "bar")}} case
    SubExpression(node) {
      if (node.path.type !== 'PathExpression') return;
      if (node.path.original !== 't') return;
      if (node.params.length === 0) return;

      let firstParam = node.params[0];
      if (firstParam.type === 'StringLiteral') {
        translationKeys.add(firstParam.value);
      } else if (firstParam.type === 'SubExpression' && firstParam.path.original === 'if') {
        if (firstParam.params[1].type === 'StringLiteral') {
          translationKeys.add(firstParam.params[1].value);
        }
        if (firstParam.params[2].type === 'StringLiteral') {
          translationKeys.add(firstParam.params[2].value);
        }
      }
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

function removeUnusedTranslations(writeToFile, cwd, files, unusedTranslations) {
  for (let file of files) {
    let translationsToRemove = [];
    for (let [key, files] of unusedTranslations) {
      if (files.has(file)) {
        translationsToRemove.push(key);
      }
    }
    let content = fs.readFileSync(`${cwd}/${file}`, 'utf8');
    let translations = YAML.parse(content); // json is valid yaml
    translationsToRemove.forEach(translation => {
      if (translations[translation]) {
        delete translations[translation];
      } else {
        deleteNestedTranslation(translations, translation, true);
      }
    });
    let updatedTranslations;
    if (file.includes('.json')) {
      updatedTranslations = JSON.stringify(translations, null, 2);
    }
    if (file.includes('.yaml') || file.includes('.yml')) {
      updatedTranslations = YAML.stringify(translations);
    }

    writeToFile(`${cwd}/${file}`, updatedTranslations, 'utf-8');
  }
}

function deleteNestedTranslation(file, translationKey, isFullPath = false) {
  let objectKeys = translationKey.split('.');
  let attributeKey = objectKeys[objectKeys.length - 1];

  let translationParentKeys = objectKeys.slice(0, -1);
  let translationParent = translationParentKeys.length
    ? getNestedAttribute(file, translationParentKeys)
    : file;
  //Check if this object has another translations if not delete the key.
  if (Object.keys(translationParent[attributeKey]).length === 0 || isFullPath) {
    delete translationParent[attributeKey];
    if (objectKeys.length > 0 && translationParentKeys.length > 0) {
      let parentKey = translationParentKeys.join('.');
      //continue to travel up parents to remove empty translation key objects.
      deleteNestedTranslation(file, parentKey);
    }
  }
}

function getNestedAttribute(parent, keys) {
  let attribute = parent[keys[0]];
  if (keys.length > 1) {
    let childKeys = keys.slice(1);
    return getNestedAttribute(attribute, childKeys);
  }
  return attribute;
}

module.exports = { run, generateFileList };
