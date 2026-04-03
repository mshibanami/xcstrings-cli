---
'xcstrings-cli': minor
---

Add `import` subcommand and other improvements

* Added a new `import` subcommand to import strings from `.xcstrings` or `.strings` files.
* Renamed the `mergePolicy` parameter of the `export` subcommand to `exportMergePolicy` for clarity. The original name remains supported for backward compatibility.
* Updated newline handling for `.xcstrings` files. The tool no longer appends a terminating newline character when creating or updating files, ensuring consistency with Xcode's default behavior.
    > [!NOTE]
    > While this is against the POSIX standard, it prevents unnecessary diffs and aligns with how Xcode generates these files.
* Fixed a minor issue with console logging.
