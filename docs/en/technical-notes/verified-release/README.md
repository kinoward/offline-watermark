# Single-artifact release and public byte checks

**Summary date** 2026-11-19

[Engineering notes](../../../../README.md#engineering-notes) · [简体中文](../../../zh-CN/technical-notes/verified-release/README.md)

## Project problem

GitHub Releases and Pages distribute the same app through two entry points. Both need to serve the exact HTML that passed testing, which calls for checking the public responses after deployment. The HTML header also points to the release that hosts its corresponding source archive, so the versioned release needs to be publicly available before Pages serves the new file.

## Implementation decisions

1. **Build once.** The workflow checks the annotated stable version tag, npm version and ancestry on `main`. It builds and tests `Watermark.html`, creates the source archive and `SHA256SUMS`, copies the HTML as the Pages `index.html` and checks the copy with `cmp`. Downstream jobs get artifact names and digests from the build job’s outputs. [Release workflow](../../../../.github/workflows/release.yml)
2. **Publish the versioned release first.** Create or resume a draft and fill in missing assets. Check the three expected assets by upload state, size and SHA-256. A mismatching asset stops publication. Publishing the draft keeps the previous Latest designation in place, then Pages deploys the verified artifact. [Release script](../../../../scripts/release.sh) · [Release assets API](https://docs.github.com/en/rest/releases/assets#list-release-assets)
3. **Check the public bytes, then promote Latest.** Download the versioned assets without credentials and compare the manifest and HTML hashes with the build outputs. Use `curl --compressed` to decode HTTP content encoding before checking the Pages body with SHA-256 and `cmp`. Promote the release after those checks and verify the Latest download response. Bounded polling allows for CDN propagation on both public HTML URLs. [Public verification and promotion](../../../../scripts/release.sh)

## Verification and limits

The first v1.0.3 attempt built successfully and created a draft that was not yet visible in the release list. Re-running failed jobs reused the successful build outputs and completed publication and verification. Commit `c091345` added bounded polling after draft creation on `main` after the v1.0.3 tag. [First attempt](https://github.com/kinoward/offline-watermark/actions/runs/44477208386/attempts/1) · [Successful rerun](https://github.com/kinoward/offline-watermark/actions/runs/44477208386/attempts/2) · [Draft polling fix](https://github.com/kinoward/offline-watermark/commit/c091345)

The build outputs include artifact names with the build attempt number. GitHub reruns use the original commit and preserve outputs from jobs that did not rerun, so downstream jobs can reuse that build. After the seven-day retention window, rerun the whole workflow to restore and verify the original files if the versioned release is already public. If the Latest download check fails after promotion, the designation has already changed. Re-running failed jobs repeats promotion and the download check. Publishing, deploying and promoting check for a newer public stable version so rerunning an old tag cannot roll the live version back. [GitHub rerun semantics](https://docs.github.com/en/actions/how-tos/manage-workflow-runs/re-run-workflows-and-jobs) · [Build and recovery instructions](../../verification.md#check-the-public-release)
