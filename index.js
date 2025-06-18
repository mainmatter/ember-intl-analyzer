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
  let customHelpers = config.helpers || [];
  let includeGtsExtension = userExtensions.includes('.gts');

  userExtensions = userExtensions.map(extension =>
    extension.startsWith('.') ? extension : `.${extension}`
  );
  let analyzeOptions = {
    analyzeConcatExpression,
    userPlugins,
    userExtensions,
    includeGtsExtension,
    helpers: customHelpers,
  };

  log(`${step(1)} 🔍  Finding JS and HBS files...`);
  let appFiles = await findAppFiles(rootDir, userExtensions);
  let inRepoFiles = await findInRepoFiles(rootDir, userExtensions);
  let files = [...appFiles, ...inRepoFiles];

  log(`${step(2)} 🔍  Searching for translations keys in JS and HBS files...`);
  let usedTranslationKeys = await analyzeFiles(rootDir, files, analyzeOptions);

  log(`${step(3)} ⚙️   Checking for unused translations...`);

  let ownTranslationFiles = await findOwnTranslationFiles(rootDir, config);
  let externalTranslationFiles = await findExternalTranslationFiles(rootDir, config);
  let existingOwnTranslationKeys = await analyzeTranslationFiles(rootDir, ownTranslationFiles);
  let existingExternalTranslationKeys = await analyzeTranslationFiles(
    rootDir,
    externalTranslationFiles
  );
  let existingTranslationKeys = mergeMaps(
    existingOwnTranslationKeys,
    existingExternalTranslationKeys
  );
  let whitelist = config.whitelist || [];
  let usedWhitelistEntries = new Set();
  let errorOnUnusedWhitelistEntries = config.errorOnUnusedWhitelistEntries || false;

  let unusedTranslations = findDifferenceInTranslations(
    existingOwnTranslationKeys,
    usedTranslationKeys,
    whitelist,
    usedWhitelistEntries
  );

  log(`${step(4)} ⚙️   Checking for missing translations...`);
  log();
  let missingTranslations = findDifferenceInTranslations(
    usedTranslationKeys,
    existingTranslationKeys,
    whitelist,
    usedWhitelistEntries
  );

  let unusedWhitelistEntries = new Set(whitelist);
  for (let entry of usedWhitelistEntries) {
    unusedWhitelistEntries.delete(entry);
  }

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

  if (unusedWhitelistEntries.size > 0) {
    log();
    log(
      ` ⚠️   Found ${chalk.bold.yellow(unusedWhitelistEntries.size)} unused whitelist ${
        unusedWhitelistEntries.size === 1 ? 'entry' : 'entries'
      }! Please remove ${unusedWhitelistEntries.size === 1 ? 'it' : 'them'} from the whitelist:`
    );
    log();
    for (let entry of unusedWhitelistEntries) {
      log(`   - ${entry}`);
    }
  }

  let totalErrors =
    missingTranslations.size +
    unusedTranslations.size +
    (errorOnUnusedWhitelistEntries ? unusedWhitelistEntries.size : 0);

  if (shouldFix) {
    removeUnusedTranslations(writeToFile, rootDir, ownTranslationFiles, unusedTranslations);
    log();
    log(' 👏 All unused translations were removed');
  }

  return totalErrors > 0 && !shouldFix ? 1 : 0;
}

function readConfig(cwd) {
  let extensions = ['.js', '.cjs'];

  let config = {};
  extensions.forEach(extension => {
    const configPath = `${cwd}/config/ember-intl-analyzer${extension}`;
    if (fs.existsSync(configPath)) {
      let requireESM = require('esm')(module, { cjs: { dedefault: true } });
      config = requireESM(configPath);
    }
  });

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

async function findOwnTranslationFiles(cwd, config) {
  return findTranslationFiles(cwd, ['', ...findInRepoPaths(cwd)], config);
}

async function findExternalTranslationFiles(cwd, config) {
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

async function analyzeFiles(cwd, files, options) {
  let allTranslationKeys = new Map();

  for (let file of files) {
    let translationKeys = await analyzeFile(cwd, file, options);

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

async function analyzeFile(cwd, file, options) {
  let content = fs.readFileSync(`${cwd}/${file}`, 'utf8');
  let extension = path.extname(file).toLowerCase();
  let { includeGtsExtension } = options;

  if ('.gjs' === extension || (includeGtsExtension && '.gts' === extension)) {
    return analyzeGJSFile(content, options);
  } else if (['.tsx', '.jsx'].includes(extension)) {
    return analyzeJsxFile(content, options.userPlugins);
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

async function analyzeGJSFile(gjsGtsContent, options) {
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

  const keysFromJs = await analyzeJsFile(jsTsContent, options.userPlugins);

  let keysFromHbs = [];
  for (let template of templates) {
    let keys = await analyzeHbsFile(template, options);
    keysFromHbs = [...keysFromHbs, ...keys];
  }

  return new Set([...keysFromJs, ...keysFromHbs]);
}

async function analyzeJsxFile(content, userPlugins) {
  let translationKeys = new Set();

  let ast = BabelParser.parse(content, {
    sourceType: 'module',
    plugins: ['jsx', 'typescript', 'dynamicImport', ...userPlugins],
  });

  // store ids passed to the <FormattedMessage> component in the translationKeys set
  traverse(ast, {
    JSXOpeningElement({ node }) {
      if (node.name.type === 'JSXIdentifier' && node.name.name === 'FormattedMessage') {
        for (let attribute of node.attributes) {
          if (
            attribute.type === 'JSXAttribute' &&
            attribute.name.name === 'id' &&
            attribute.value
          ) {
            if (attribute.value.type === 'StringLiteral') {
              translationKeys.add(attribute.value.value);
            } else if (attribute.value.type === 'JSXExpressionContainer') {
              if (attribute.value.expression.type === 'ConditionalExpression') {
                if (attribute.value.expression.alternate.type === 'StringLiteral') {
                  translationKeys.add(attribute.value.expression.alternate.value);
                }
                if (attribute.value.expression.consequent.type === 'StringLiteral') {
                  translationKeys.add(attribute.value.expression.consequent.value);
                }
              }
            }
          }
        }
      }
    },
    CallExpression({ node }) {
      if (node.arguments.length === 0) return;

      if (isIntlFormatMessageCall(node)) {
        let firstParam = node.arguments[0];
        if (firstParam.type === 'ObjectExpression') {
          for (let property of firstParam.properties) {
            if (
              property.type === 'ObjectProperty' &&
              property.key.type === 'Identifier' &&
              property.key.name === 'id'
            ) {
              // if it's a string literal, add it to the translationKeys set
              if (property.value.type === 'StringLiteral') {
                translationKeys.add(property.value.value);
              }
              // else, if it's a ternary operator, add the consequent and alternate to the translationKeys set
              else if (property.value.type === 'ConditionalExpression') {
                if (property.value.alternate.type === 'StringLiteral') {
                  translationKeys.add(property.value.alternate.value);
                }
                if (property.value.consequent.type === 'StringLiteral') {
                  translationKeys.add(property.value.consequent.value);
                }
              }
            }
          }
        }
      }
    },
  });

  return translationKeys;
}

function isIntlFormatMessageCall(node) {
  return (
    (node.callee.type === 'Identifier' && node.callee.name === 'formatMessage') ||
    (node.callee.type === 'MemberExpression' &&
      node.callee.object.type === 'Identifier' &&
      node.callee.object.name === 'intl' &&
      node.callee.property.type === 'Identifier' &&
      node.callee.property.name === 'formatMessage')
  );
}

function isTFunctionCall(node) {
  return (
    (node.callee.type === 'Identifier' && node.callee.name === 't') ||
    (node.callee.type === 'MemberExpression' &&
      node.callee.property.type === 'Identifier' &&
      node.callee.property.name === 't')
  );
}

async function analyzeJsFile(content, userPlugins) {
  let translationKeys = new Set();

  // parse the JS file
  let ast = BabelParser.parse(content, {
    sourceType: 'module',
    plugins: ['decorators-legacy', 'dynamicImport', 'classProperties', ...userPlugins],
  });

  // find translation keys in the syntax tree
  traverse(ast, {
    CallExpression({ node }) {
      if (node.arguments.length === 0) return;

      if (isTFunctionCall(node)) {
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
      } else if (isIntlFormatMessageCall(node)) {
        let firstParam = node.arguments[0];
        if (firstParam.type === 'ObjectExpression') {
          for (let property of firstParam.properties) {
            if (
              property.type === 'ObjectProperty' &&
              property.key.type === 'Identifier' &&
              property.key.name === 'id'
            ) {
              // if it's a string literal, add it to the translationKeys set
              if (property.value.type === 'StringLiteral') {
                translationKeys.add(property.value.value);
              }
              // else, if it's a ternary operator, add the consequent and alternate to the translationKeys set
              else if (property.value.type === 'ConditionalExpression') {
                if (property.value.alternate.type === 'StringLiteral') {
                  translationKeys.add(property.value.alternate.value);
                }
                if (property.value.consequent.type === 'StringLiteral') {
                  translationKeys.add(property.value.consequent.value);
                }
              }
            }
          }
        }
      }
    },
  });

  return translationKeys;
}

async function analyzeHbsFile(content, { analyzeConcatExpression = false, helpers = [] }) {
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

  function processNode(node, helpers) {
    let pathNames = ['t', ...helpers];
    if (node.path.type !== 'PathExpression') return;
    if (!pathNames.includes(node.path.original)) return;
    if (node.params.length === 0) return;

    for (let key of findKeysInNode(node.params[0])) {
      translationKeys.add(key);
    }
  }

  // find translation keys in the syntax tree
  Glimmer.traverse(ast, {
    // handle {{t "foo"}} case
    MustacheStatement(node) {
      processNode(node, helpers);
    },

    // handle {{some-component foo=(t "bar")}} case
    SubExpression(node) {
      processNode(node, helpers);
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
function findDifferenceInTranslations(mapA, mapB, whitelist, usedWhitelistEntries) {
  let missingTranslations = new Map();

  for (let [key, files] of mapA) {
    const keyTrimmed = key.trim();
    const isKeyMissing = !mapB.has(keyTrimmed);

    if (!isKeyMissing) continue;

    const whitelistKey = whitelist.find(regex => regex.test(keyTrimmed));
    const isKeyWhitelisted = whitelistKey != null;

    if (isKeyWhitelisted) {
      usedWhitelistEntries.add(whitelistKey);
    } else {
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
