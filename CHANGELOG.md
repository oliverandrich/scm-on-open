# Changelog

## 0.1.0

First release.

Opens the Source Control view when a window is opened on a repository that has something
to show, and opens a multi-file diff editor for each non-empty group: changed, staged and
untracked. A clean repository is left in the Explorer. A single repository can opt out with
`"scmOnOpen.enabled": false` in its own `.vscode/settings.json`.
