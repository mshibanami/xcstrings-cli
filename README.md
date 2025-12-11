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
xcs add --key greeting --comment "A greeting message." --text "Hello, World."

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

# Start interactive mode to add translations using `$EDITOR` environment variable (e.g. `vim`)
xcs add -i

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
        ja:
            state: needs_review
            value: こんにちは、世界。
        zh-Hans: 你好，世界。
    comment: A greeting message.
farewell:
    translations:
        en: Goodbye, World.
        ja:
            state: needs_review
            value: さよなら、世界。
        zh-Hans:
            state: stale
            value: さようなら、世界。
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
xcs strings
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
xcs strings --key good*
# goodbyeWorld:
#   ...
# goodMorning:
#   ...

# List strings filtered by language
xcs strings --languages en
# helloWorld:
#   en: "Hello, World."
# goodbyeWorld:
#   en: "Goodbye, World."
# goodMorning:
#   en: "Good morning."
# ... etc.

# List strings with custom format
xcs strings --format "[{{language}}] {{key}} => {{text}}"
# [en] helloWorld => "Hello, World."
# [ja] helloWorld => "こんにちは、世界。"
# [en] goodbyeWorld => "Goodbye, World."
# [ja] goodbyeWorld => "さようなら、世界。"
# ... etc.
```

You can use `xcs --help` or `xcs <sub-command> --help` to see the list of commands and options.

## Commands

**Global options:**

* `--config`: `string` (Optional)
    * The custom config file path. If not specified, `xcs` will look for `xcstrings-cli.json` or `xcstrings-cli.json5` in the current folder or its parent folders until the root.
* `--help, -h`: `boolean` (Optional)
    * Show help.
* `--path`: `string` (Optional)
    * The xcstrings file path. Defaults to `Localizable.xcstrings` in the current directory, or to the first `xcstringsPaths` entry in the config when present.
    * You can also specify the alias you set in the config file. (`xcstringsPaths` entry with `alias` field)
* `--version, -v`: `boolean` (Optional)
    * Show version.

### `add` command

Adds/updates one or more strings to the xcstrings file.

**`add` command options:**

* `--comment`: `string` (Optional)
    * The comment for the string to add, intended for translators.
* `--interactive, -i`: `boolean` (Optional)
    * Start interactive mode to add strings.
    * This is useful when you don't want to record a huge command to your terminal history.
* `--key, -k`: `string` (Required unless `--strings` contains one or more keys)
    * The key of the string to add.
* `--language, -l`: `string` (Optional)
    * The language of the string provided with `--text`.
    * Ignored if `--text` is not provided.
    * If not specified, it uses the source language defined as `sourceLanguage` in the xcstrings file.
    * Validation follows `missingLanguagePolicy`: `skip` requires the language to be supported; `include` allows any language.
* `--state`: `string` (Optional, default: `translated`)
    * Values applied to single-key and multi-key adds: `translated`, `needs_review`, `new`, `stale`. If omitted, strings default to `translated`.
    * Multi-key payloads can also set per-language states with `{ state, value }`; string shorthand is treated as `translated`.
    * State meanings:
        * `translated`: The string is translated and ready to use.
        * `needs_review`: The string needs review by a translator.
        * `new`: The string is newly added and not yet translated.
        * `stale`: The string is outdated and may need re-translation.
* `--strings`: `string` (Optional)
    * Translation-including JSON or YAML for the key. Pass inline JSON, or provide the flag without a value to read it from stdin (heredoc/pipe).
    * The format is determined by `--strings-format`.
* `--strings-format`: `string` (Optional, default: `auto`)
    * The format of the data provided with `--strings`. Options are:
        * `auto`: Auto-detect format based on content.
        * `yaml`: YAML format. (It uses `js-yaml` internally.)
        * `json`: JSON format. (It uses `json5` internally.)
* `--text`: `string` (Optional)
    * The string value for the language. If omitted, the key is created without a localization for the default language.

### `remove` command

Removes strings from the xcstrings file based on the specified filter options.

**`remove` command options:**

* `--dry-run, -n`: `boolean` (Optional, default: `false`)
    * If set to `true`, `xcs` will only show what would be removed without actually removing anything.
* `--key, -k`: `string` (Optional if `languages` is specified)
    * The key of the string to remove. If not specified, xcstrings-cli will remove all strings for the specified languages.
* `--languages, -l`: `string[]` (Optional if `key` is specified)
    * The languages to remove. If not specified, `xcs` will remove the string for all languages.

### `strings` command

Lists strings in the xcstrings file, with optional filtering and formatting.

**`strings` commands options:**

* `--format`: `string` (Optional)
    * Mustache template for per-localization output. Available variables: `{{language}}`, `{{key}}`, `{{text}}`.
* `--key`, `--key-glob`: `string` (Optional)
    * Filter keys by glob pattern. This is the default key filter mode.
* `--key-regex`: `string` (Optional)
    * Filter keys by regular expression.
* `--key-substring`: `string` (Optional)
    * Filter keys by substring match.
* `--languages, -l`: `string[]` (Optional)
    * Include only the specified languages.
* `--text`, `--text-glob`: `string` (Optional)
    * Filter translations by glob pattern. This is the default text filter mode.
* `--text-regex`: `string` (Optional)
    * Filter translations by regular expression.
* `--text-substring`: `string` (Optional)
    * Filter translations by substring match.

## Config file

Put an `xcstrings-cli.json5` or `xcstrings-cli.json` file in the project root, and xcs will use it as the config file.

Here is an example config file in JSON format:

```json
{
    "missingLanguagePolicy": "include",
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

These are the settings you can specify in the config file:

* **missingLanguagePolicy**: `string` (Optional, default: `skip`)
    * How to handle translations for languages that are not included in the `xcs languages` output when adding strings. Options are:
    * `skip`: Only add translations for languages included in the `xcs languages` output. (Default)
    * `include`: Add translations even when they are not recognized by the Xcode project or xcs language list.
* **xcodeprojPaths**: `string[]` (Optional)
    * Paths to Xcode project files (`.xcodeproj`) used to detect supported languages.
    * If not specified, `xcs` will only check the xcstrings file to detect supported languages.
* **xcstringsPaths**: `string[] | { alias: string, path: string }[]` (Optional)
    * Paths to xcstrings files used by `xcs`.
    * If only one path is provided, `xcs` will use it as the default xcstrings file.
    * If multiple paths are provided, `xcs` will ask you to select an xcstrings file.
    * You can also specify an alias, and use it with the `--path` option.

## Practical use cases

### Case 1: Translate all missing strings using LLM

Suppose you have a xcstrings file and want to add Japanese and Simplified Chinese translations generated by LLM.

Firstly, list the strings missing those languages:

```bash
xcs strings --languages en --missing-languages ja zh-Hans
# closeAction:
#   en: "Close"
# detailsAction:
#   en: "Details"
```

Then, copy the output and use it as a prompt for the LLM to generate translations. We offer [xcstrings-cli Helper](https://chatgpt.com/g/g-69365945f8bc8191be3146f880238957-xcstrings-cli-helper), a Custom GPT that can help you generate translations in the form of an `xcs add` command. The prompt could be like this:

```
closeAction:
  en: "Close"
detailsAction:
  en: "Details"

Languages: ja, zh-Hans
No comments needed.
```

Then the Custom GPT will generate an `xcs add` command like this:

```bash
xcs add --strings << EOF
closeAction:
    translations:
        en: Close
        ja: 閉じる
        zh-Hans: 关闭
detailsAction:
    translations:
        en: Details
        ja: 詳細
        zh-Hans: 详情
EOF
```

Finally, copy the generated command and run it in your terminal to add the translations to your xcstrings file.

## Q&A

**Q: Strings are not being added for some languages. Why?**

A: By default, `xcs` only adds translations for languages that are recognized in your Xcode project (knownRegions) or the xcstrings file. You can check which languages are recognized by running `xcs languages`.

If you want to add translations for languages not included in your Xcode project, you can change the `missingLanguagePolicy` in your config file to `include`.

## LICENSE

MIT
