# Source Control on Open

Opens a VS Code / VSCodium window in the Source Control view when the repository has
something to show, and leaves a clean repository in the Explorer.

The point is to skip a step. `codium .` in a repository you were working in yesterday
lands where you were going anyway: the changed files on the left, all changes as one
multi-file diff in the editor.

## What it does

On startup the extension asks the built-in git extension for the repositories open in the
window and runs `status()` on each, which resolves only once that status pass has updated
the model. If the working tree, the index, the untracked files or a merge hold anything at
all, it focuses the Source Control view. Otherwise it does nothing.

A multi-root window looks at every repository, not only the first folder, so a window whose
first folder is clean still opens when a later one has changes. The diff editors are opened
for the first repository that has something in it.

Each diff editor is then opened only for the group that has something in it: changed
files open `git.viewChanges`, staged files open `git.viewStagedChanges`, untracked files
open `git.viewUntrackedChanges`. The commands each look at one group and show a "does not
have any changes" notification when that group is empty, which is why they are gated
separately. A merge on its own has no view command, so it only focuses the view.

Settings are read from the first workspace folder, because that is where `.vscode/` is
looked for.

## Settings

| Setting | Default | Meaning |
| --- | --- | --- |
| `scmOnOpen.enabled` | `true` | Open Source Control when the repository has changes |
| `scmOnOpen.viewChanges` | `true` | Also open all changes as one multi-file diff editor |

Both are `resource` scoped, so a single repository can opt out in its own
`.vscode/settings.json`:

```json
{
  "scmOnOpen.enabled": false
}
```

A repository that does not have the extension installed ignores the key.

There is also a command, **Source Control on Open: Show Source Control and Changes**, which
does the same thing on demand. It ignores `scmOnOpen.enabled` and focuses the view even in
a clean repository. It still respects `scmOnOpen.viewChanges`, and it still opens a diff
editor only for a group that has something in it.

## Build and install

```sh
mise run check     # tsc --noEmit and the unit tests
mise run install   # build, package and install into VSCodium
```

`src/git.d.ts` is vendored from `microsoft/vscode`, branch `release/1.135`, under the MIT
licence. It is the public API surface of the built-in git extension, which ships no types
of its own.
