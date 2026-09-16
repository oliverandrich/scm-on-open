import { test } from 'node:test';
import assert from 'node:assert/strict';

import { commandsToRun, shouldOpen, type ChangeCounts } from './decide.ts';

const nothing: ChangeCounts = { workingTree: 0, index: 0, untracked: 0, merge: 0 };

test('a switched-off repository is left alone even when it has changes', () => {
	assert.equal(shouldOpen({ ...nothing, workingTree: 3 }, false), false);
});

test('a clean repository is left alone', () => {
	assert.equal(shouldOpen(nothing, true), false);
});

test('any of the four groups is reason enough to open', () => {
	for (const group of ['workingTree', 'index', 'untracked', 'merge'] as const) {
		assert.equal(shouldOpen({ ...nothing, [group]: 1 }, true), true, `${group} alone`);
	}
});

test('the view itself never needs a repository argument', () => {
	assert.deepEqual(commandsToRun(nothing, true), [
		{ command: 'workbench.view.scm', needsRepository: false },
	]);
});

test('working tree changes open the changes editor', () => {
	assert.deepEqual(commandsToRun({ ...nothing, workingTree: 1 }, true), [
		{ command: 'workbench.view.scm', needsRepository: false },
		{ command: 'git.viewChanges', needsRepository: true },
	]);
});

test('staged changes open the staged editor, not the changes editor', () => {
	assert.deepEqual(commandsToRun({ ...nothing, index: 1 }, true), [
		{ command: 'workbench.view.scm', needsRepository: false },
		{ command: 'git.viewStagedChanges', needsRepository: true },
	]);
});

test('untracked changes open the untracked editor', () => {
	assert.deepEqual(commandsToRun({ ...nothing, untracked: 1 }, true), [
		{ command: 'workbench.view.scm', needsRepository: false },
		{ command: 'git.viewUntrackedChanges', needsRepository: true },
	]);
});

// The git extension has no view command for the merge group, so there is nothing to open.
test('a merge alone only focuses the view', () => {
	assert.deepEqual(commandsToRun({ ...nothing, merge: 1 }, true), [
		{ command: 'workbench.view.scm', needsRepository: false },
	]);
});

test('each non-empty group contributes its own editor, in group order', () => {
	assert.deepEqual(commandsToRun({ workingTree: 2, index: 1, untracked: 4, merge: 0 }, true), [
		{ command: 'workbench.view.scm', needsRepository: false },
		{ command: 'git.viewChanges', needsRepository: true },
		{ command: 'git.viewStagedChanges', needsRepository: true },
		{ command: 'git.viewUntrackedChanges', needsRepository: true },
	]);
});

test('viewChanges off leaves every diff editor closed', () => {
	assert.deepEqual(commandsToRun({ workingTree: 1, index: 1, untracked: 1, merge: 0 }, false), [
		{ command: 'workbench.view.scm', needsRepository: false },
	]);
});
