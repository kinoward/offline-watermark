# Matching browser languages and translating worker messages

**Summary date** 2026-11-19

[Engineering notes](../../../../README.md#engineering-notes) · [简体中文](../../../zh-CN/technical-notes/worker-localization/README.md)

## Project problem

The page needs to choose a supported translation from the browser’s ordered preferences, including Simplified and Traditional Chinese. Processing errors originate in a worker, but the page should show them in its current language even if the language changes while a task is running.

## Implementation decisions

- **Follow preference order.** Parse tags with `Intl.Locale` and continue past malformed or unsupported preferences. For Chinese, use `maximize().script` to infer the script. `Hant` maps to Traditional Chinese and the remaining Chinese tags map to Simplified Chinese. For example, `zh-Hant-CN` selects Traditional Chinese and `zh-SG` selects Simplified Chinese. If none of the preferences match, use English. [Language matching](../../../../src/i18n.ts)
- **Send a message descriptor from the worker.** The processing worker converts errors into a message key, interpolation values and optional diagnostic detail. The page selects its current dictionary and substitutes template placeholders once. Parameter values are treated as literal text, so a filename containing `{name}` or `$&` survives interpolation. [Processing worker](../../../../src/processor.ts) · [Message format](../../../../src/messages.ts)
- **Use the same keys for static UI.** The HTML declares text and attribute bindings with `data-i18n` attributes. Changing the language applies the dictionary and updates the document’s `lang`. [Static bindings and language switching](../../../../src/i18n.ts)

## Verification and limits

Unit tests cover Chinese region and script, preference order and English fallback. They compare each dictionary’s key set, check for nonempty translations and matching placeholders, and scan the HTML for static binding keys. A separate test uses `structuredClone` to simulate transfer, then renders a filename with literal placeholder text in the receiving language. Diagnostic details from unknown errors can retain their original text. [Language and message tests](../../../../tests/unit/i18n.test.mjs)
