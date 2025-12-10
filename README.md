# xcstrings-cli (`xcs`)

[![Test](https://github.com/mshibanami/Docsloth/actions/workflows/test.yml/badge.svg)](https://github.com/mshibanami/Docsloth/actions/workflows/test.yml) [![npm version](https://badge.fury.io/js/xcstrings-cli.svg)](https://badge.fury.io/js/xcstrings-cli) [![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)

This is a command-line tool designed for working with **String Catalog** (`.xcstrings`) files, such as adding and removing localized strings. It supports JSON5 and YAML formats for inputting translations.

We also provide a Custom GPT that can help you generate translations and output them in the form of an `xcs` command. Check it out here: [xcstrings-cli Helper](https://chatgpt.com/g/g-69365945f8bc8191be3146f880238957-xcstrings-cli-helper). (The configuration is in [helpers/helper-config.md](./helpers/helper-config.md).)

## Installation

1. Install xcstrings-cli using npm:
    ```bash
    npm install -g xcstrings-cli
    ```

    This will install the `xcs` command globally.

2. Create a configuration file for your project by running:
    ```bash
    xcs init
    ```

    This will ask you some questions and create an `xcstrings-cli.json` file in the current directory.

## Usage

**Add a string:**

```bash
# Add with key, comment, and default language string
xcs add --key greeting --comment "A greeting message." --string "Hello, World."

# Add with key, comment, and translations YAML via heredoc
xcs add \
    --key greeting \
    --comment "A greeting message." \
    --strings << EOF
en: Hello, World.
ja: こんにちは、世界。
zh-Hans: 你好，世界。
EOF

# Or add translations JSON
xcs add \
    --key greeting \
    --comment "A greeting message." \
    --strings << EOF
{
    "en": "Hello, World.",
    "ja": "こんにちは、世界。",
    "zh-Hans": "你好，世界。"
}
EOF

# Add translations via file
xcs add \
    --key greeting \
    --comment "A greeting message." \
    --strings-format yaml \
    --strings < translations.yaml

# Add multiple strings via heredoc
xcs add --strings << EOF
greeting:
    translations:
        en: Hello, World.
        ja: こんにちは、世界。
        zh-Hans: 你好，世界。
    comment: A greeting message.
farewell:
    en: Goodbye, World.
    ja: さようなら、世界。
    zh-Hans: 再见，世界。
    comment: A farewell message.
EOF

# Add with only key and comment
xcs add --key greeting --comment "A greeting message."
```

**Remove a string:**

```bash
xcs remove --key greeting
```

**Remove all strings of specific languages:**

```bash
xcs remove --languages ja zh-Hans
```

**List supported languages:**

If `xcodeprojPaths` is configured, this command lists languages from your Xcode project (knownRegions) and excludes `Base`. If `xcodeprojPaths` is not configured, it lists languages observed in the xcstrings file.

```bash
xcs languages
# en ja zh-Hans
```

**List strings in the xcstrings file:**

```bash
# List all strings
xcs list
# helloWorld:
#   en: "Hello, World."
#   ja: "こんにちは、世界。"
#   zh-Hans: "你好，世界。"
# goodbyeWorld:
#   en: "Goodbye, World."
#   ja: "さようなら、世界。"
# goodMorning:
#   en: "Good morning."
#   ja: "おはようございます。"
# ... etc.

# List strings filtered by key
xcs list --key good*
# goodbyeWorld:
#   ...
# goodMorning:
#   ...

# List strings filtered by language
xcs list --languages en
# helloWorld:
#   en: "Hello, World."
# goodbyeWorld:
#   en: "Goodbye, World."
# goodMorning:
#   en: "Good morning."
# ... etc.

# List strings with custom format
xcs list --format "[{{language}}] {{key}} => {{text}}"
# [en] helloWorld => "Hello, World."
# [ja] helloWorld => "こんにちは、世界。"
# [en] goodbyeWorld => "Goodbye, World."
# [ja] goodbyeWorld => "さようなら、世界。"
# ... etc.
```

You can use `xcs --help` or `xcs <sub-command> --help` to see the list of commands and options.
## Command options

* `--help, -h`: `boolean` (Optional)
    * Show help.
* `--version, -v`: `boolean` (Optional)
    * Show version.
* `--config`: `string` (Optional)
    * The custom config file path. If not specified, `xcs` will look for `xcstrings-cli.json` or `xcstrings-cli.json5` in the current folder or its parent folders until the root.
* `--path`: `string` (Optional)
    * The xcstrings file path. Defaults to `Localizable.xcstrings` in the current directory, or to the first `xcstringsPaths` entry in the config when present.
    * You can also specify the alias you set in the config file. (`xcstringsPaths` entry with `alias` field)

### `add` command options

* `--key, -k`: `string` (Required)
    * The key of the string to add.
* `--language, -l`: `string` (Optional)
    * The language of the string provided with `--text`.
    * Ignored if `--text` is not provided.
    * If not specified, it uses the source language defined as `sourceLanguage` in the xcstrings file.
    * Validation follows `missingLanguagePolicy`: `skip` requires the language to be supported; `include` allows any language.
* `--text`: `string` (Optional)
    * The string value for the language. If omitted, the key is created without a localization for the default language.
* `--strings`: `string` (Optional)
    * Translation-including JSON or YAML for the key. Pass inline JSON, or provide the flag without a value to read it from stdin (heredoc/pipe).
    * The format is determined by `--strings-format`.
* `--strings-format`: `string` (Optional, default: `auto`)
    * The format of the data provided with `--strings`. Options are:
        * `auto`: Auto-detect format based on content.
        * `yaml`: YAML format. (It uses `js-yaml` internally.)
        * `json`: JSON format. (It uses `json5` internally.)
* `--comment`: `string` (Optional)
    * The comment for the string to add, intended for translators.

### `remove` command options

* `--key, -k`: `string` (Optional if `languages` is specified)
    * The key of the string to remove. If not specified, xcstrings-cli will remove all strings for the specified languages.
* `--languages, -l`: `string[]` (Optional if `key` is specified)
    * The languages to remove. If not specified, `xcs` will remove the string for all languages.
* `--dry-run, -n`: `boolean` (Optional, default: `false`)
    * If set to `true`, `xcs` will only show what would be removed without actually removing anything.

### `list` command options

* `--languages, -l`: `string[]` (Optional)
    * Include only the specified languages.
* `--key`, `--key-glob`: `string` (Optional)
    * Filter keys by glob pattern. This is the default key filter mode.
* `--key-regex`: `string` (Optional)
    * Filter keys by regular expression.
* `--key-substring`: `string` (Optional)
    * Filter keys by substring match.
* `--text`, `--text-glob`: `string` (Optional)
    * Filter translations by glob pattern. This is the default text filter mode.
* `--text-regex`: `string` (Optional)
    * Filter translations by regular expression.
* `--text-substring`: `string` (Optional)
    * Filter translations by substring match.
* `--format`: `string` (Optional)
    * Mustache template for per-localization output. Available variables: `{{language}}`, `{{key}}`, `{{text}}`.

## Config file

Put an `xcstrings-cli.json5` or `xcstrings-cli.json` file in the project root, and xcs will use it as the config file.
```json5
{
    "xcstringsPaths": [
        "Shared/L10n/Localizable.xcstrings",
        {
            "alias": "utils",
            "path": "packages/Utils/Sources/Utils/Resources/Localizable.xcstrings"
        }
    ],
    "xcodeprojPaths": [
        "path/to/your/Project.xcodeproj"
    ]
}
```

These are the options for the config file:

* **xcstringsPaths**: `string[] | { alias: string, path: string }[]` (Optional)
    * Paths to xcstrings files used by `xcs`.
    * If only one path is provided, `xcs` will use it as the default xcstrings file.
    * If multiple paths are provided, `xcs` will ask you to select an xcstrings file.a
* **xcodeprojPaths**: `string[]` (Optional)
    * Paths to Xcode project files used to detect supported languages.
    * If not specified, `xcs` will not check the supported languages in your Xcode project.
* **missingLanguagePolicy**: `string` (Optional, default: `skip`)
    * How to handle translations for languages that are not included in the `xcs languages` output when adding strings. Options are:
    * `skip`: Only add translations for languages included in the `xcs languages` output. (Default)
    * `include`: Add translations even when they are not recognized by the Xcode project or xcs language list.

## Q&A

**Q: Strings are not being added for some languages. Why?**

A: By default, `xcs` only adds translations for languages that are recognized in your Xcode project (knownRegions) or the xcstrings file. You can check which languages are recognized by running `xcs languages`.

If you want to add translations for languages not included in your Xcode project, you can change the `missingLanguagePolicy` in your config file to `include`.

## LICENSE

MIT
