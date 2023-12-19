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
const DEFAULT_EXTENSIONS = ['.js', '.hbs', '.emblem', '.gjs'];
const { Preprocessor } = require('content-tag');

let contentTag = new Preprocessor();

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

  let config = options.config || readConfig(rootDir);
  let analyzeConcatExpression = options.analyzeConcatExpression || config.analyzeConcatExpression;
  let userPlugins = config.babelParserPlugins || [];
  let userExtensions = config.extensions || [];
  let includeGtsExtension = userExtensions.includes('.gts');

  userExtensions = userExtensions.map(extension =>
    extension.startsWith('.') ? extension : `.${extension}`
  );
  let analyzeOptions = {
    analyzeConcatExpression,
    userPlugins,
    userExtensions,
    includeGtsExtension,
  };

  log(`${step(1)} 🔍  Finding JS and HBS files...`);
  let appFiles = await findAppFiles(rootDir, userExtensions);
  let inRepoFiles = await findInRepoFiles(rootDir, userExtensions);
  let files = [...appFiles, ...inRepoFiles];

  log(`${step(2)} 🔍  Searching for translations keys in JS and HBS files...`);
  let usedTranslationKeys = analyzeFiles(rootDir, files, analyzeOptions);

  log(`${step(3)} ⚙️   Checking for unused translations...`);

  let ownTranslationFiles = await findOwnTranslationFiles(rootDir, config);
  let externalTranslationFiles = await findExternalTranslationFiles(rootDir, config);
  let existingOwnTranslationKeys = analyzeTranslationFiles(rootDir, ownTranslationFiles);
  let existingExternalTranslationKeys = analyzeTranslationFiles(rootDir, externalTranslationFiles);
  let existingTranslationKeys = mergeMaps(
    existingOwnTranslationKeys,
    existingExternalTranslationKeys
  );
  let whitelist = config.whitelist || [];

  let unusedTranslations = findDifferenceInTranslations(
    existingOwnTranslationKeys,
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
    removeUnusedTranslations(writeToFile, rootDir, ownTranslationFiles, unusedTranslations);
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

async function findAppFiles(cwd, userExtensions) {
  let extensions = [...DEFAULT_EXTENSIONS, ...userExtensions];
  let pathsWithExtensions = extensions.map(extension => 'app/**/*' + extension);
  return globby(pathsWithExtensions, { cwd });
}

async function findInRepoFiles(cwd, userExtensions) {
  let inRepoPaths = findInRepoPaths(cwd);
  let inRepoFolders = joinPaths(inRepoPaths, ['addon', 'app']);

  let extensions = [...DEFAULT_EXTENSIONS, ...userExtensions];
  let pathsWithExtensions = extensions.map(extension => `**/*${extension}`);

  return globby(joinPaths(inRepoFolders, pathsWithExtensions), { cwd });
}

function findOwnTranslationFiles(cwd, config) {
  return findTranslationFiles(cwd, ['', ...findInRepoPaths(cwd)], config);
}

function findExternalTranslationFiles(cwd, config) {
  if (!config.externalPaths) {
    return [];
  }

  return findTranslationFiles(cwd, joinPaths('node_modules', config.externalPaths), config);
}

async function findTranslationFiles(cwd, inputFolders, config) {
  let translationPaths = joinPaths(inputFolders, ['translations']);

  return globby(
    joinPaths(translationPaths, config.translationFiles || ['**/*.json', '**/*.yaml', '**/*.yml']),
    {
      cwd,
    }
  );
}

function findInRepoPaths(cwd) {
  let pkgJSONPath = path.join(cwd, 'package.json');

  if (!fs.existsSync(pkgJSONPath)) return [];

  let pkgJSON = JSON.parse(fs.readFileSync(path.join(cwd, 'package.json')));
  let inRepoPaths = pkgJSON && pkgJSON['ember-addon'] && pkgJSON['ember-addon']['paths'];

  return inRepoPaths || [];
}

function joinPaths(inputPathOrPaths, outputPaths) {
  if (Array.isArray(inputPathOrPaths)) {
    return inputPathOrPaths.map(inputPath => joinPaths(inputPath, outputPaths)).flat();
  } else {
    return outputPaths.map(directory => path.join(inputPathOrPaths, directory));
  }
}

function analyzeFiles(cwd, files, options) {
  let allTranslationKeys = new Map();

  for (let file of files) {
    let translationKeys = analyzeFile(cwd, file, options);

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

function analyzeFile(cwd, file, options) {
  let content = fs.readFileSync(`${cwd}/${file}`, 'utf8');
  let extension = path.extname(file).toLowerCase();
  let { includeGtsExtension } = options;

  if ('.gjs' === extension || (includeGtsExtension && '.gts' === extension)) {
    return analyzeGJSFile(content, options);
  } else if (['.js', ...options.userExtensions].includes(extension)) {
    return analyzeJsFile(content, options.userPlugins);
  } else if (extension === '.hbs') {
    return analyzeHbsFile(content, options);
  } else if (extension === '.emblem') {
    let hbs = Emblem.compile(content, { quiet: true });
    return analyzeHbsFile(hbs, options);
  } else {
    throw new Error(`Unknown extension: ${extension} (${file})`);
  }
}

function analyzeGJSFile(gjsGtsContent, options) {
  const jsTsContent = contentTag.process(gjsGtsContent);

  const ast = BabelParser.parse(jsTsContent, {
    sourceType: 'module',
    plugins: [
      'decorators-legacy',
      'dynamicImport',
      'classProperties',
      'classStaticBlock',
      ...options.userPlugins,
    ],
  });

  let templates = [];
  traverse(ast, {
    CallExpression(path) {
      const { node } = path;
      let { callee } = node;
      if (callee.name !== 'template') {
        return;
      }

      const callScopeBinding = path.scope.getBinding('template');

      if (
        callScopeBinding.kind === 'module' &&
        callScopeBinding.path.parent.source.value === '@ember/template-compiler'
      ) {
        const { start, end } = node.arguments[0];
        const templateContent = jsTsContent.substring(start + 1, end - 1);
        templates.push(templateContent);
      }
    },
  });

  const keysFromJs = [...analyzeJsFile(jsTsContent, options.userPlugins)];

  const keysFromHbs = templates.reduce((keys, template) => {
    return [...keys, ...analyzeHbsFile(template, options)];
  }, []);

  return new Set([...keysFromJs, ...keysFromHbs]);
}

function analyzeJsFile(content, userPlugins) {
  let translationKeys = new Set();

  // parse the JS file
  let ast = BabelParser.parse(content, {
    sourceType: 'module',
    plugins: ['decorators-legacy', 'dynamicImport', 'classProperties', ...userPlugins],
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

function analyzeHbsFile(content, { analyzeConcatExpression = false }) {
  let translationKeys = new Set();

  // parse the HBS file
  let ast = Glimmer.preprocess(content);

  function findKeysInIfExpression(node) {
    let keysInFirstParam = findKeysInNode(node.params[1]);
    let keysInSecondParam = node.params.length > 2 ? findKeysInNode(node.params[2]) : [''];

    return [...keysInFirstParam, ...keysInSecondParam];
  }

  function findKeysInConcatExpression(node) {
    let potentialKeys = [''];

    for (let param of node.params) {
      let keysInParam = findKeysInNode(param);

      if (keysInParam.length === 0) return [];

      potentialKeys = potentialKeys.reduce((newPotentialKeys, potentialKey) => {
        for (let key of keysInParam) {
          newPotentialKeys.push(potentialKey + key);
        }

        return newPotentialKeys;
      }, []);
    }

    return potentialKeys;
  }

  function findKeysInNode(node) {
    if (!node) return [];

    if (node.type === 'StringLiteral') {
      return [node.value];
    } else if (node.type === 'SubExpression' && node.path.original === 'if') {
      return findKeysInIfExpression(node);
    } else if (
      analyzeConcatExpression &&
      node.type === 'SubExpression' &&
      node.path.original === 'concat'
    ) {
      return findKeysInConcatExpression(node);
    }

    return [];
  }

  function processNode(node) {
    if (node.path.type !== 'PathExpression') return;
    if (node.path.original !== 't') return;
    if (node.params.length === 0) return;

    for (let key of findKeysInNode(node.params[0])) {
      translationKeys.add(key);
    }
  }

  // find translation keys in the syntax tree
  Glimmer.traverse(ast, {
    // handle {{t "foo"}} case
    MustacheStatement(node) {
      processNode(node);
    },

    // handle {{some-component foo=(t "bar")}} case
    SubExpression(node) {
      processNode(node);
    },
  });

  return translationKeys;
}

function analyzeTranslationFiles(cwd, files) {
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

function mergeMaps(mapA, mapB) {
  let resultMap = new Map([...mapA]);

  for (let [key, bFiles] of mapB) {
    if (!resultMap.has(key)) {
      resultMap.set(key, bFiles);
    } else {
      let aFiles = resultMap.get(key);
      resultMap.set(key, new Set([...aFiles, ...bFiles]));
    }
  }

  return resultMap;
}

module.exports = { run, generateFileList };
