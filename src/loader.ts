'use strict';

import * as vscode from 'vscode';
import { TaskDefinition } from 'vscode';
import PydoctestAnalyzer from './analyzer';
import { PydoctestTaskProvider } from './pydoctestProvider';

interface PydoctestTaskDefinition extends TaskDefinition {
    module: string;
}

export default class PydoctestLoader {

    private pydoctestAnalyzer: PydoctestAnalyzer;
    private listenerDisposables: vscode.Disposable[] | undefined;
    private pydoctestTasks: vscode.Task[] | undefined;
    private pydoctestTaskProvider: vscode.Disposable | undefined;


    constructor(private workspaceRoot: string) {
        this.pydoctestAnalyzer = new PydoctestAnalyzer();
    }

    public activate(subscriptions: vscode.Disposable[]): void {
        subscriptions.push(this);
        this.initialize(subscriptions);
    }

    private initialize(subscriptions: vscode.Disposable[]): void {
        vscode.workspace.onDidChangeConfiguration(this.reinitialize, this, subscriptions);
        this.registerEventListeners();
        this.analyzeActiveEditors();

        this.pydoctestAnalyzer.analyzeWorkspace();
    }

    private reinitialize(): void {
        this.dispose();
        this.registerEventListeners();
        this.analyzeActiveEditors();
        this.registerTasks();
    }

    private registerTasks(): void {
        this.pydoctestTaskProvider = vscode.tasks.registerTaskProvider(PydoctestTaskProvider.PydoctestType, new PydoctestTaskProvider("."));

        vscode.tasks.registerTaskProvider('pydoctest.analyze.workspace', {
            provideTasks: () => {
              if (!this.pydoctestTasks) {
                this.pydoctestTasks = [
                    new vscode.Task({ type: "pydoctest" }, vscode.TaskScope.Workspace, "",
                        "", new vscode.CustomExecution(async (): Promise<vscode.Pseudoterminal> => {
                            // When the task is executed, this callback will run. Here, we setup for running the task.
                            return new PydoctestBuildTaskTerminal(this.workspaceRoot);
                        }))
                ];
              }
              return this.pydoctestTasks;
            },
            resolveTask(_task: vscode.Task): vscode.Task | undefined {
              const task = _task.definition.task;
              if (task) {
                // resolveTask requires that the same definition object be used.
                const definition: PydoctestTaskDefinition = <any>_task.definition;
                return new vscode.Task(
                  definition,
                  _task.scope ?? vscode.TaskScope.Workspace,
                  definition.task,
                  'pydoctest',
                  new vscode.ShellExecution(`pydoctest`)
                );
              }
              return undefined;
            }
          });
    }

    private registerEventListeners(): void {
        let disposables: vscode.Disposable[] = []
        disposables.push(
            vscode.window.onDidChangeActiveTextEditor((editor: vscode.TextEditor | undefined) => {
                if (editor !== undefined) {
                    this.pydoctestAnalyzer.analyze(editor);
                }
            }),
            vscode.workspace.onDidChangeTextDocument((event: vscode.TextDocumentChangeEvent) => {
                if (vscode.window.activeTextEditor !== undefined && vscode.window.activeTextEditor.document == event.document) {
                    this.pydoctestAnalyzer.analyze(vscode.window.activeTextEditor);
                }
            }),
            vscode.workspace.onDidOpenTextDocument((document: vscode.TextDocument) => {
                if (vscode.window.activeTextEditor !== undefined && vscode.window.activeTextEditor.document == document) {
                    this.pydoctestAnalyzer.analyze(vscode.window.activeTextEditor);
                }
            })
        );
        this.listenerDisposables = disposables;
    }

    private analyzeActiveEditors(): void {
        vscode.window.visibleTextEditors.forEach((editor: vscode.TextEditor) => {
            this.pydoctestAnalyzer.analyze(editor);
        });
    }

    public dispose(): void {
        if (this.listenerDisposables !== undefined) {
            this.listenerDisposables.forEach(disposable => {
                disposable.dispose();
            })
        }
    }
}

class PydoctestBuildTaskTerminal implements vscode.Pseudoterminal {
	private writeEmitter = new vscode.EventEmitter<string>();
	onDidWrite: vscode.Event<string> = this.writeEmitter.event;
	private closeEmitter = new vscode.EventEmitter<number>();
	onDidClose?: vscode.Event<number> = this.closeEmitter.event;

	private fileWatcher: vscode.FileSystemWatcher | undefined;

	constructor(private workspaceRoot: string) {
	}

	open(initialDimensions: vscode.TerminalDimensions | undefined): void {
		this.doAnalyze();
	}

	close(): void {
		// The terminal has been closed. Shutdown the build.
		if (this.fileWatcher) {
			this.fileWatcher.dispose();
		}
	}

	private async doAnalyze(): Promise<void> {
		return new Promise<void>((resolve) => {
			this.writeEmitter.fire('Starting build...\r\n');

            // this.setSharedState(date.toTimeString() + ' ' + date.toDateString());
            this.writeEmitter.fire('Build complete.\r\n\r\n');
            this.closeEmitter.fire(0);
            resolve();
		});
	}
}