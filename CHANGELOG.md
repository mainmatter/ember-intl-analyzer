# Changelog

## v5.0.0 (2025-02-07)

#### :boom: Breaking Change

- [#695](https://github.com/mainmatter/ember-intl-analyzer/pull/695) Remove node < 18 & add PR workflow to test the changes ([@beerinho](https://github.com/beerinho))

#### :house: Internal

- [#695](https://github.com/mainmatter/ember-intl-analyzer/pull/695) Add PR workflow to test the changes ([@beerinho](https://github.com/beerinho))

#### Committers: 2

- Daniel Beer ([@beerinho](https://github.com/beerinho))
- Jason Mitchell ([@jasonmit](https://github.com/jasonmit))

## v4.6.0 (2024-02-22)

#### :rocket: Enhancement

- [#656](https://github.com/mainmatter/ember-intl-analyzer/pull/656) handles `t('my-key')` in JS files ([@poulet42](https://github.com/poulet42))
- [#655](https://github.com/mainmatter/ember-intl-analyzer/pull/655) Add custom t helper support ([@Mikek2252](https://github.com/Mikek2252))
- [#649](https://github.com/mainmatter/ember-intl-analyzer/pull/649) Add support for listing redundant whitelist entries ([@robinborst95](https://github.com/robinborst95))
- [#648](https://github.com/mainmatter/ember-intl-analyzer/pull/648) Add support for gjs/gts files ([@vstefanovic97](https://github.com/vstefanovic97))

#### :house: Internal

- [#652](https://github.com/mainmatter/ember-intl-analyzer/pull/652) Update dependency eslint-config-prettier to v9.1.0 ([@renovate[bot]](https://github.com/apps/renovate))
- [#651](https://github.com/mainmatter/ember-intl-analyzer/pull/651) Update dependency eslint to v8.56.0 ([@renovate[bot]](https://github.com/apps/renovate))

#### Committers: 5

- Bartlomiej Dudzik ([@BobrImperator](https://github.com/BobrImperator))
- Corentin ([@poulet42](https://github.com/poulet42))
- Michael Kerr ([@Mikek2252](https://github.com/Mikek2252))
- Robin Borst ([@robinborst95](https://github.com/robinborst95))
- Vuk ([@vstefanovic97](https://github.com/vstefanovic97))

## v4.5.0 (2024-01-30)

#### :rocket: Enhancement

- [#648](https://github.com/mainmatter/ember-intl-analyzer/pull/648) Add support for gjs/gts files ([@vstefanovic97](https://github.com/vstefanovic97))

#### Committers: 3

- Bartlomiej Dudzik ([@BobrImperator](https://github.com/BobrImperator))
- Michael Kerr ([@Mikek2252](https://github.com/Mikek2252))
- Vuk ([@vstefanovic97](https://github.com/vstefanovic97))

## v4.4.0 (2022-08-26)

#### :rocket: Enhancement

- [#528](https://github.com/Mainmatter/ember-intl-analyzer/pull/528) Add custom plugin/extension support ([@Mikek2252](https://github.com/Mikek2252))

#### Committers: 1

- Michael Kerr ([@Mikek2252](https://github.com/Mikek2252))

## v4.3.0 (2022-08-10)

#### :rocket: Enhancement

- [#538](https://github.com/Mainmatter/ember-intl-analyzer/pull/538) Add support to specify which translation files are analyzed ([@robinborst95](https://github.com/robinborst95))

#### Committers: 1

- Robin Borst ([@robinborst95](https://github.com/robinborst95))

## v4.2.0 (2022-06-17)

#### :rocket: Enhancement

- [#483](https://github.com/Mainmatter/ember-intl-analyzer/pull/483) Add support for concat expressions in HBS files ([@robinborst95](https://github.com/robinborst95))

#### Committers: 1

- Robin Borst ([@robinborst95](https://github.com/robinborst95))

## v4.1.0 (2022-04-22)

#### :rocket: Enhancement

- [#481](https://github.com/Mainmatter/ember-intl-analyzer/pull/481) Add support for translations in actual addons ([@robinborst95](https://github.com/robinborst95))
- [#480](https://github.com/Mainmatter/ember-intl-analyzer/pull/480) Add support for translations in in-repo addons ([@robinborst95](https://github.com/robinborst95))

#### Committers: 1

- Robin Borst ([@robinborst95](https://github.com/robinborst95))

## v4.0.0 (2022-04-14)

#### :boom: Breaking Change

- [#489](https://github.com/Mainmatter/ember-intl-analyzer/pull/489) Update Node test scenarios in ci ([@Mikek2252](https://github.com/Mikek2252))

#### :house: Internal

- [#491](https://github.com/Mainmatter/ember-intl-analyzer/pull/491) Add release-it configuration to simplify releases ([@Mikek2252](https://github.com/Mikek2252))

#### Committers: 1

- Michael Kerr ([@Mikek2252](https://github.com/Mikek2252))

## v3.1.1 (2022-03-11)

#### :bug: Bug Fix

- [#447](https://github.com/Mainmatter/ember-intl-analyzer/pull/447) Add additional guard to check if at the top of the parent tree and tests ([@Mikek2252](https://github.com/Mikek2252))

#### Committers: 1

- Michael Kerr ([@Mikek2252](https://github.com/Mikek2252))

## v3.1.0 (2021-06-28)

#### :rocket: Enhancement

- [#367](https://github.com/Mainmatter/ember-intl-analyzer/pull/367) Add `--fix` CLI option ([@Mikek2252](https://github.com/Mikek2252))
- [#320](https://github.com/Mainmatter/ember-intl-analyzer/pull/320) Add support for basic conditionals in the t helper ([@Mikek2252](https://github.com/Mikek2252))

#### :house: Internal

- [#369](https://github.com/Mainmatter/ember-intl-analyzer/pull/369) Replace TravisCI with GitHub Actions ([@Turbo87](https://github.com/Turbo87))

#### Committers: 3

- Michael Kerr ([@Mikek2252](https://github.com/Mikek2252))
- Tobias Bieniek ([@Turbo87](https://github.com/Turbo87))
- [@dependabot-preview[bot]](https://github.com/apps/dependabot-preview)

## v3.0.0 (2020-10-14)

#### :boom: Breaking Change

- [#135](https://github.com/Mainmatter/ember-intl-analyzer/pull/135) Drop support for Node 8 ([@Turbo87](https://github.com/Turbo87))

#### :rocket: Enhancement

- [#257](https://github.com/Mainmatter/ember-intl-analyzer/pull/257) Fix importing config file as CJS module ([@bertdeblock](https://github.com/bertdeblock))

#### Committers: 3

- Bert De Block ([@bertdeblock](https://github.com/bertdeblock))
- Patsy Issa ([@patsy-issa](https://github.com/patsy-issa))
- Tobias Bieniek ([@Turbo87](https://github.com/Turbo87))

## v2.1.0 (2019-11-27)

#### :rocket: Enhancement

- [#94](https://github.com/Mainmatter/ember-intl-analyzer/pull/94) Add support for files with class properties ([@jmonster](https://github.com/jmonster))

#### Committers: 1

- Johnny Domino ([@jmonster](https://github.com/jmonster))

## v2.0.1 (2019-08-29)

#### :bug: Bug Fix

- [#59](https://github.com/Mainmatter/ember-intl-analyzer/pull/59) Fix process exit code assignment ([@Turbo87](https://github.com/Turbo87))

#### Committers: 1

- Tobias Bieniek ([@Turbo87](https://github.com/Turbo87))

## v2.0.0 (2019-08-27)

#### :boom: Breaking Change

- [#51](https://github.com/Mainmatter/ember-intl-analyzer/pull/51) Use non-zero exit code when problems are found ([@jfelchner](https://github.com/jfelchner))

#### :rocket: Enhancement

- [#58](https://github.com/Mainmatter/ember-intl-analyzer/pull/58) Adds YAML support ([@Duder-onomy](https://github.com/Duder-onomy))

#### Committers: 2

- Greg Larrenaga ([@Duder-onomy](https://github.com/Duder-onomy))
- Jeff Felchner ([@jfelchner](https://github.com/jfelchner))

## v1.1.0 (2019-06-27)

#### :rocket: Enhancement

- [#40](https://github.com/Mainmatter/ember-intl-analyzer/pull/40) Add support for decorators ([@Turbo87](https://github.com/Turbo87))
- [#39](https://github.com/Mainmatter/ember-intl-analyzer/pull/39) Improve `generateFileList()` implementation ([@Turbo87](https://github.com/Turbo87))
- [#11](https://github.com/Mainmatter/ember-intl-analyzer/pull/11) Refactored code and added ability to find missing translations ([@ijlee2](https://github.com/ijlee2))

#### :memo: Documentation

- [#10](https://github.com/Mainmatter/ember-intl-analyzer/pull/10) package.json: Fix `homepage` URL ([@Turbo87](https://github.com/Turbo87))

#### :house: Internal

- [#38](https://github.com/Mainmatter/ember-intl-analyzer/pull/38) Add tests ([@Turbo87](https://github.com/Turbo87))
- [#13](https://github.com/Mainmatter/ember-intl-analyzer/pull/13) Add TravisCI config ([@Turbo87](https://github.com/Turbo87))
- [#12](https://github.com/Mainmatter/ember-intl-analyzer/pull/12) Add ESLint and Prettier ([@Alonski](https://github.com/Alonski))

#### Committers: 4

- Alon Bukai ([@Alonski](https://github.com/Alonski))
- Isaac Lee ([@ijlee2](https://github.com/ijlee2))
- Tobias Bieniek ([@Turbo87](https://github.com/Turbo87))

## v1.0.0 (2019-04-15)

Initial release
