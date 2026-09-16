/**
 * The decision, kept free of the VS Code API so it can be tested with plain node.
 * `extension.ts` gathers the numbers and runs whatever comes back.
 */

export interface ChangeCounts {
	workingTree: number;
	index: number;
	untracked: number;
	merge: number;
}

export interface CommandToRun {
	command: string;
	/** Whether the command takes the repository as its first argument. */
	needsRepository: boolean;
}

export function hasChanges(counts: ChangeCounts): boolean {
	return counts.workingTree + counts.index + counts.untracked + counts.merge > 0;
}

/** Whether opening on window start is wanted. The manual command does not ask. */
export function shouldOpen(counts: ChangeCounts, enabled: boolean): boolean {
	return enabled && hasChanges(counts);
}

/**
 * Each of the git extension's view commands looks at one resource group and shows a
 * notification when that group is empty, so every command is gated on its own count.
 * The merge group has no view command, which is why it only reaches `hasChanges`.
 */
const EDITORS: ReadonlyArray<[keyof ChangeCounts, string]> = [
	['workingTree', 'git.viewChanges'],
	['index', 'git.viewStagedChanges'],
	['untracked', 'git.viewUntrackedChanges'],
];

/** The commands to execute, in order, once it has been decided that something happens. */
export function commandsToRun(counts: ChangeCounts, viewChanges: boolean): CommandToRun[] {
	const commands: CommandToRun[] = [{ command: 'workbench.view.scm', needsRepository: false }];
	if (viewChanges) {
		for (const [group, command] of EDITORS) {
			if (counts[group] > 0) {
				commands.push({ command, needsRepository: true });
			}
		}
	}
	return commands;
}
