# xcstrings-cli

[![Test](https://github.com/mshibanami/Docsloth/actions/workflows/test.yml/badge.svg)](https://github.com/mshibanami/Docsloth/actions/workflows/test.yml) [![npm version](https://badge.fury.io/js/xcstrings-cli.svg)](https://badge.fury.io/js/xcstrings-cli) [![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)

This is a command-line tool designed for working with **xcstrings** files, such as adding and removing localized strings. It supports JSON5 and YAML formats for inputting translations.

We also provide a Custom GPT that can help you generate translations and output them in the form of an `xcstrings` command. Check it out here: [xcstrings-cli Helper](https://chatgpt.com/g/g-69365945f8bc8191be3146f880238957-xcstrings-cli-helper). (The configuration is in [helpers/helper-config.md](./helpers/helper-config.md).)

## Installation

1. Install xcstrings-cli using npm:
    ```bash
    npm install -g xcstrings-cli
    ```

2. Initialize xcstrings-cli:
    ```bash
    xcstrings init
    ```

This will ask you some questions and create an `xcstrings-cli.json` file in the current directory.

## Usage

**Add a string:**

```bash
# Add with key, comment, and default language string
xcstrings add --key greeting --comment "A greeting message." --string "Hello, World."

# Add with key, comment, and translations YAML via heredoc
xcstrings add \
    --key greeting \
    --comment "A greeting message." \
    --strings << EOF
en: Hello, World.
ja: こんにちは、世界。
zh-Hans: 你好，世界。
EOF

# Or add translations JSON
xcstrings add \
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
xcstrings add \
    --key greeting \
    --comment "A greeting message." \
    --strings-format yaml \
    --strings < translations.yaml

# Add with only key and comment
xcstrings add --key greeting --comment "A greeting message."
```

**Remove a string:**

```bash
xcstrings remove --key greeting
```

**Remove all strings of specific languages:**

```bash
xcstrings remove --languages ja zh-Hans
```

**List supported languages:**

If `xcodeprojPaths` is configured, this command lists languages from your Xcode project (knownRegions) and excludes `Base`. If `xcodeprojPaths` is not configured, it lists languages observed in the xcstrings file.

```bash
xcstrings languages
# en ja zh-Hans
```

You can use `xcstrings --help` or `xcstrings <sub-command> --help` to see the list of commands and options.

## Command options

* `--help, -h`: `boolean` (Optional)
    * Show help.
* `--version, -v`: `boolean` (Optional)
    * Show version.
* `--config`: `string` (Optional)
    * The custom config file path. If not specified, xcstrings-cli will look for `xcstrings-cli.json` or `xcstrings-cli.json5` in the current folder or its parent folders until the root.
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
    * The languages to remove. If not specified, xcstrings-cli will remove the string for all languages.
* `--dry-run, -n`: `boolean` (Optional, default: `false`)
    * If set to `true`, xcstrings-cli will only show what would be removed without actually removing anything.

## Config file

Put an `xcstrings-cli.json5` or `xcstrings-cli.json` file in the project root, and xcstrings-cli will use it as the config file.

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

* **xcstringsPaths**: `string[] | { alias: string, path: string }[]`
    * If only one path is provided, xcstrings-cli will use it as the default xcstrings file.
    * If multiple paths are provided, xcstrings-cli will ask you to select an xcstrings file.
* **xcodeprojPaths**: `string[]` (Optional)
    * Paths to Xcode project files used to detect supported languages.
    * If not specified, xcstrings-cli will not check the supported languages in your Xcode project.
* **missingLanguagePolicy**: `string` (Optional, default: `skip`)
    * How to handle translations for languages that are not included in the `xcstrings languages` output when adding strings. Options are:
    * `skip`: Only add translations for languages included in the `xcstrings languages` output. (Default)
    * `include`: Add translations even when they are not recognized by the Xcode project or xcstrings language list.

## LICENSE

MIT
