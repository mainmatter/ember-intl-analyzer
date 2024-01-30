ember-intl-analyzer
==============================================================================

Find unused translations in your Ember.js projects

> [!NOTE]
> ember-intl-analyzer was written and is maintained by
> [Mainmatter](https://mainmatter.com) and contributors.
> We offer consulting, training, and team augmentation for Ember.js – check out
> our [website](https://mainmatter.com/ember-consulting/) to learn more!

Usage
------------------------------------------------------------------------------

```bash
npx ember-intl-analyzer
```


Configuration
------------------------------------------------------------------------------

ember-intl-analyzer can be configured by creating a `config/ember-intl-analyzer.js`
file in your app:

```js
export default {
  whitelist: [
    /^countries\./,
    /^currency\./,
    /^validations\.errors\./,
    /^[^.]+\.warnings\.[^.]+$/,
  ],
};
```

### `whitelist`

If you use dynamic translations keys like this:
```js
this.intl.t(`countries.${code}`)
```
then ember-intl-analyzer can not easily understand what translation keys are
being used here. In that case it will ignore the dynamic translation key and
show the corresponding translations as unused.

To prevent that from happening you can configure a `whitelist`, which accepts an
array of regular expressions that will be checked when looking for unused
translations.

### `analyzeConcatExpression`

If your template contains translations like this:
```hbs
{{t (concat "actions." (if @isEditing "save" "publish"))}}
```
then ember-intl-analyzer does not detect that `actions.save` and `actions.publish`
are in fact used translations, so they can be incorrectly flagged as missing or
unused. As the `concat` helper can make it harder to read, it's encouraged to
rewrite it to for example:
```hbs
{{if @isEditing (t "actions.save") (t "actions.publish")}}
```

However, if your application relies heavily on this `concat` helper, then rewriting
may not be the best option for you. In that case, you can opt-in to analyze `concat`
expressions too by setting the `analyzeConcatExpression` flag in the configuration file:

```js
export default {
  analyzeConcatExpression: true,
};
```

### `externalPaths`

If your application uses translations provided by (external) addons, then those
translations will show up as missing by default. In order to include such translations,
you can define `externalPaths` in the configuration file as follows:

```js
export default {
  externalPaths: ['my-addon'],
};
```

This example will try to find translation files in `node_modules/my-addon/translations`.
Patterns supported by [`globby`](https://www.npmjs.com/package/globby) are also
possible here, e.g. this:
```js
externalPaths: ['@*/*']
```
will look up translations in scoped addons like `node_modules/@company/scoped-addon/translations`.

### `translationFiles`

By default, this addon will try to find missing and unused translations in any YAML or
JSON file within the `translations` folders of your application (`['**/*.json', '**/*.yaml', '**/*.yml']`).
However, if you would like to only analyze a subset of translation files, you can override
`translationFiles` in the configuration file as follows:

```js
export default {
  translationFiles: ['**/en.yaml'],
};
```

This example will try to find all `en.yaml` files in the different `translations`
folders, but any patterns supported by [`globby`](https://www.npmjs.com/package/globby) are also
possible here.

### `babelParserPlugins` `extensions`

If your application uses doesn't parse correctly because it requires a specific babel plugin you can specifiy them in the config file under the key `babelParserPlugins` a list on plugins can be found [here](https://babeljs.io/docs/en/babel-parser#plugins).

For example if you would like typescript support you can specify the `typescript` plugin, although please note if the plugin introduces a new file extension you will also need to specifiy that in the `extensions` property. See the examples below.

Typescript example
```js
export default {
  babelParserPlugins: ['typescript'],
  extensions: ['.ts'],
};
```

Jsx example
```js
export default {
  babelParserPlugins: ['jsx'],
  extensions: ['.jsx'],
};

Gts example
```js
export default {
  babelParserPlugins: ['typescript'],
  extensions: ['.gts'],
};
```

### `--fix`
If your application has a lot of unused translations you can run the command with
the `--fix` to remove them. Remember to double check your translations as dynamic
translations need to be whitelisted or they will be removed!

Caveats
------------------------------------------------------------------------------

There are a number of things that we do not support yet. Have a look at the
[Issues](https://github.com/Mainmatter/ember-intl-analyzer/issues) before using
this project.


Related
------------------------------------------------------------------------------

- [ember-intl](https://github.com/ember-intl/ember-intl) – Internationalization
  addon for Ember.js


License
------------------------------------------------------------------------------

This projects is developed by and &copy; [Mainmatter GmbH](http://mainmatter.com)
and contributors. It is released under the [MIT License](LICENSE.md).
