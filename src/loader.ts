'use strict';

import * as vscode from 'vscode';
import { TaskDefinition } from 'vscode';
import PydoctestAnalyzer from './analyzer';

export interface PydoctestTaskDefinition extends TaskDefinition {
    module: string;
}

export interface PydoctestConfiguration {
    workingDirectory: string;
    pythonInterpreterPath?: string | null;
}

const diagnosticsCollection = vscode.languages.createDiagnosticCollection('pydoctest');
const outputChannel = vscode.window.createOutputChannel('pydoctest');
const config: vscode.WorkspaceConfiguration = vscode.workspace.getConfiguration('pydoctest');

export default class PydoctestLoader {

    private pydoctestAnalyzer: PydoctestAnalyzer;
    private listenerDisposables: vscode.Disposable[] | undefined;
    private configuration: PydoctestConfiguration;

    constructor() {
        this.configuration = this.getConfiguration();
        this.pydoctestAnalyzer = new PydoctestAnalyzer(outputChannel, diagnosticsCollection, this.configuration);
    }

    public getConfiguration(): PydoctestConfiguration {
        const configuration: PydoctestConfiguration = {
            workingDirectory: config.get<string>('workingDirectory', "."),
            pythonInterpreterPath: config.get<string>('pythonInterpreterPath', 'python3')
        };
        return configuration;
    }

    public activate(subscriptions: vscode.Disposable[]): void {
        subscriptions.push(this);
        this.initialize(subscriptions);
    }

    private async initialize(subscriptions: vscode.Disposable[]): Promise<void> {
        if (this.pydoctestAnalyzer.configuration.pythonInterpreterPath) {
            const interpreterExists = await this.pydoctestAnalyzer.pythonInterpreterExists();
            if (!interpreterExists) {
                vscode.window.showErrorMessage(`Selected interpreter does not exist: ${this.pydoctestAnalyzer.configuration.pythonInterpreterPath}`);
                outputChannel.appendLine("Pydoctest: Selected interpreter does not exist")
                return;
            }
        }

        const pydoctestExists = await this.pydoctestAnalyzer.pydoctestExists();
        if (!pydoctestExists) {
            vscode.window.showErrorMessage('pydoctest was not found.');
            outputChannel.appendLine("Pydoctest not found")
            return;
        }

        this.registerEventListeners();
        this.analyzeActiveEditors();

        this.pydoctestAnalyzer.analyzeWorkspace();
    }

    private registerEventListeners(): void {
        let disposables: vscode.Disposable[] = []
        disposables.push(
            vscode.window.onDidChangeActiveTextEditor((editor: vscode.TextEditor | undefined) => {
                if (editor !== undefined) {
                    this.pydoctestAnalyzer.analyzeEditor(editor);
                }
            }),
            vscode.workspace.onDidSaveTextDocument((document: vscode.TextDocument) => {
                if (vscode.window.activeTextEditor !== undefined && vscode.window.activeTextEditor.document == document) {
                    this.pydoctestAnalyzer.analyzeEditor(vscode.window.activeTextEditor);
                }
            }),
            vscode.workspace.onDidChangeConfiguration((event: vscode.ConfigurationChangeEvent) => {
                this.configuration = this.getConfiguration();
            })
        );
        this.listenerDisposables = disposables;
    }

    private analyzeActiveEditors(): void {
        vscode.window.visibleTextEditors.forEach((editor: vscode.TextEditor) => {
            this.pydoctestAnalyzer.analyzeEditor(editor);
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