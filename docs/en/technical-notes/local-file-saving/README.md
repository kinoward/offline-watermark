# Saving local files and handling name collisions

**Summary date** 2026-11-19

[Engineering notes](../../../../README.md#engineering-notes) · [简体中文](../../../zh-CN/technical-notes/local-file-saving/README.md)

## Project problem

An export may belong next to its source, where the original and earlier exports already exist. The browser chooses the destination for a regular download. The app can only check for existing names after the user grants access to a directory.

## Implementation decisions

1. **Ask the user to select a directory.** Check for the directory picker in a secure context. If the source was opened with a native picker, use its file handle as the save picker’s `startIn` hint. The user can still choose another directory. A regular download uses a Blob URL and a download link, then lets the browser handle it. [Picker detection and downloads](../../../../src/file-io.ts) · [Save entry point](../../../../src/main.ts)
2. **Allocate a name in that directory.** A custom name changes only the stem, keeps the source extension and is checked for path characters and reserved names. Both files and directories can occupy a candidate name. The default naming path increments a sequence number until it finds an available name. A custom-name collision asks for a different name. [Name and collision logic](../../../../src/file-io.ts)
3. **Limit cleanup after a failed write.** After creating the file handle, check that the file is empty before opening a writer. On failure, look up the name again and attempt removal only if it still points to the same empty file. Report the write error. [Writing and cleanup](../../../../src/file-io.ts)

## Verification and limits

Unit tests use a directory-handle substitute to check the `startIn` hint, extension retention, collisions with files and directories, the normal path that prevents overwriting the source, and cleanup after a failed write. Directory lookup, creation and writing are separate operations, so another process can change the directory between them. For a regular download, the browser manages the final path and collision policy. [File saving unit tests](../../../../tests/unit/file-io.test.mjs)
