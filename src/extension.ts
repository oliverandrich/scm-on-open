import * as vscode from 'vscode';

import { commandsToRun, hasChanges, shouldOpen, type ChangeCounts } from './decide.ts';
import type { API, GitExtension, Repository } from './git.js';

/** How long to wait for the git extension to find a repository on startup. */
const READY_TIMEOUT_MS = 15_000;
/** The manual command has someone watching it, so it gives up quickly and shows the view anyway. */
const FORCE_TIMEOUT_MS = 2_000;

const NO_CHANGES: ChangeCounts = { workingTree: 0, index: 0, untracked: 0, merge: 0 };

interface Candidate {
	repository: Repository;
	counts: ChangeCounts;
}

/** Resolves with the first event value, or with undefined once the timeout is up. */
function firstEvent<T>(event: vscode.Event<T>, ms: number): Promise<T | undefined> {
	return new Promise((resolve) => {
		let subscription: vscode.Disposable | undefined;
		const timer = setTimeout(() => {
			subscription?.dispose();
			resolve(undefined);
		}, ms);
		subscription = event((value) => {
			clearTimeout(timer);
			subscription?.dispose();
			resolve(value);
		});
	});
}

/** Waits for `isReady`, re-checking on every event, until the budget is spent. */
async function waitFor<T>(
	isReady: () => boolean,
	event: vscode.Event<T>,
	ms: number,
): Promise<void> {
	const deadline = Date.now() + ms;
	while (!isReady()) {
		const remaining = deadline - Date.now();
		if (remaining <= 0) {
			return;
		}
		await firstEvent(event, remaining);
	}
}

async function gitApi(budgetMs: number): Promise<API | undefined> {
	const extension = vscode.extensions.getExtension<GitExtension>('vscode.git');
	if (!extension) {
		return undefined;
	}
	const git = extension.isActive ? extension.exports : await extension.activate();
	if (!git.enabled) {
		return undefined;
	}
	const api = git.getAPI(1);
	await waitFor(() => api.state === 'initialized', api.onDidChangeState, budgetMs);
	return api.state === 'initialized' ? api : undefined;
}

function countsOf(repository: Repository): ChangeCounts {
	const state = repository.state;
	return {
		workingTree: state.workingTreeChanges.length,
		index: state.indexChanges.length,
		untracked: state.untrackedChanges.length,
		merge: state.mergeChanges.length,
	};
}

/**
 * `status()` resolves only after the git extension has updated its model, so it is the
 * direct answer to "do these numbers reflect a finished status run". Reading the state
 * without it cannot tell an empty repository from one whose first run is still in flight.
 */
async function refreshedCounts(repository: Repository): Promise<ChangeCounts> {
	try {
		await repository.status();
	} catch {
		// A repository the git extension considers uninitialised keeps its last known state.
	}
	return countsOf(repository);
}

/**
 * The first repository with something to show. A multi-root window opens editors for one
 * of its repositories, but the decision to open at all looks at every one of them.
 */
async function pickRepository(api: API, budgetMs: number): Promise<Candidate | undefined> {
	await waitFor(() => api.repositories.length > 0, api.onDidOpenRepository, budgetMs);

	let fallback: Candidate | undefined;
	for (const repository of api.repositories) {
		const counts = await refreshedCounts(repository);
		if (hasChanges(counts)) {
			return { repository, counts };
		}
		fallback ??= { repository, counts };
	}
	return fallback;
}

async function run(folder: vscode.Uri, force: boolean): Promise<void> {
	const config = vscode.workspace.getConfiguration('scmOnOpen', folder);
	const enabled = config.get<boolean>('enabled', true);
	const viewChanges = config.get<boolean>('viewChanges', true);
	// Cheap and synchronous, so a switched-off window never pays for the wait below.
	if (!enabled && !force) {
		return;
	}

	const budgetMs = force ? FORCE_TIMEOUT_MS : READY_TIMEOUT_MS;
	const api = await gitApi(budgetMs);
	const candidate = api ? await pickRepository(api, budgetMs) : undefined;
	const counts = candidate?.counts ?? NO_CHANGES;
	if (!force && !shouldOpen(counts, enabled)) {
		return;
	}

	for (const { command, needsRepository } of commandsToRun(counts, viewChanges)) {
		// Without the repository the git commands fall back to a quick pick, which would
		// ask the user to choose in a window that holds more than one.
		if (needsRepository && candidate) {
			await vscode.commands.executeCommand(command, candidate.repository.rootUri);
		} else {
			await vscode.commands.executeCommand(command);
		}
	}
}

/** Settings are read from the first workspace folder, which is where `.vscode/` is looked for. */
function runForWindow(force: boolean): Promise<void> {
	const folder = vscode.workspace.workspaceFolders?.[0];
	return folder ? run(folder.uri, force) : Promise.resolve();
}

export function activate(context: vscode.ExtensionContext): void {
	context.subscriptions.push(
		vscode.commands.registerCommand('scmOnOpen.show', () => runForWindow(true)),
	);
	runForWindow(false).catch((error: unknown) => {
		console.error('scm-on-open: could not open the Source Control view', error);
	});
}
