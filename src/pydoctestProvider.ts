import * as path from 'path';
import * as fs from 'fs';
import * as cp from 'child_process';
import * as vscode from 'vscode';

export class PydoctestTaskProvider implements vscode.TaskProvider {
    static PydoctestType = 'pydoctest';

	private pydoctestPromise: Thenable<vscode.Task[]> | undefined = undefined;

	constructor(workspaceRoot: string) {}

	public provideTasks(): Thenable<vscode.Task[]> | undefined {
		if (!this.pydoctestPromise) {
			this.pydoctestPromise = getPydoctestTasks();
		}
		return this.pydoctestPromise;
	}

	public resolveTask(_task: vscode.Task): vscode.Task | undefined {
		const task = _task.definition.task;
		if (task) {
			// resolveTask requires that the same definition object be used.
			const definition: PydoctestTaskDefinition = <any>_task.definition;
			return new vscode.Task(definition, _task.scope ?? vscode.TaskScope.Workspace, definition.task, 'pydoctest', new vscode.ShellExecution(`pydoctest`));
		}
		return undefined;
	}
}

function exists(file: string): Promise<boolean> {
	return new Promise<boolean>((resolve, _reject) => {
		fs.exists(file, (value) => {
			resolve(value);
		});
	});
}

function exec(command: string, options: cp.ExecOptions): Promise<{ stdout: string; stderr: string }> {
	return new Promise<{ stdout: string; stderr: string }>((resolve, reject) => {
		cp.exec(command, options, (error, stdout, stderr) => {
			if (error) {
				reject({ error, stdout, stderr });
			}
			resolve({ stdout, stderr });
		});
	});
}

let _channel: vscode.OutputChannel;
function getOutputChannel(): vscode.OutputChannel {
	if (!_channel) {
		_channel = vscode.window.createOutputChannel('Pydoctest');
	}
	return _channel;
}

interface PydoctestTaskDefinition extends vscode.TaskDefinition {
	module?: string;
}

const buildNames: string[] = ['build', 'compile', 'watch'];
function isBuildTask(name: string): boolean {
	for (const buildName of buildNames) {
		if (name.indexOf(buildName) !== -1) {
			return true;
		}
	}
	return false;
}

const testNames: string[] = ['test'];
function isTestTask(name: string): boolean {
	for (const testName of testNames) {
		if (name.indexOf(testName) !== -1) {
			return true;
		}
	}
	return false;
}

async function getPydoctestTasks(): Promise<vscode.Task[]> {
	const workspaceFolders = vscode.workspace.workspaceFolders;
	const result: vscode.Task[] = [];
	if (!workspaceFolders || workspaceFolders.length === 0) {
		return result;
	}
	for (const workspaceFolder of workspaceFolders) {
		const folderString = workspaceFolder.uri.fsPath;
		if (!folderString) {
			continue;
		}

		const commandLine = 'pydoctest';
		try {
			const { stdout, stderr } = await exec(commandLine, { cwd: folderString });
			if (stderr && stderr.length > 0) {
				getOutputChannel().appendLine(stderr);
				getOutputChannel().show(true);
			}
			if (stdout) {
				const lines = stdout.split(/\r{0,1}\n/);
                console.log(lines);
				for (const line of lines) {
					if (line.length === 0) {
						continue;
					}
                    const kind: PydoctestTaskDefinition = {
                        type: 'pydoctest'
                    };
                    const task = new vscode.Task(kind, workspaceFolder, "pydoctest", 'rake', new vscode.ShellExecution(`pydoctest`));
                    result.push(task);
                    task.group = vscode.TaskGroup.Build;
				}
			}
		} catch (err) {
			const channel = getOutputChannel();
			if (err.stderr) {
				channel.appendLine(err.stderr);
			}
			if (err.stdout) {
				channel.appendLine(err.stdout);
			}
			channel.appendLine('Auto detecting rake tasks failed.');
			channel.show(true);
		}
	}
	return result;
}