'use strict';

import * as vscode from 'vscode';
import { TaskDefinition } from 'vscode';
import PydoctestAnalyzer from './analyzer';
import { IProposedExtensionAPI } from './dependencies/vscode-python';

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
            workingDirectory: config.get<string>('workingDirectory', ".")
        };
        return configuration;
    }

    public activate(subscriptions: vscode.Disposable[]): void {
        subscriptions.push(this);
        this.initialize(subscriptions);
    }

    private async initialize(subscriptions: vscode.Disposable[]): Promise<void> {
        const extension = vscode.extensions.getExtension('ms-python.python');
        // Check if python-extension is active and if we have a path from there
        if (extension) {
            if (!extension.isActive) {
                await extension.activate();
            }
            const api: IProposedExtensionAPI = extension.exports as IProposedExtensionAPI;
            if (api.environment) {
                const path = await api.environment.getActiveEnvironmentPath();
                if (path) {
                    this.pydoctestAnalyzer.configuration.pythonInterpreterPath = path.path;
                }
            }

            if (api.environment.onDidActiveEnvironmentChanged) {
                api.environment.onDidActiveEnvironmentChanged((listener) => {
                    this.pydoctestAnalyzer.configuration.pythonInterpreterPath = listener.path;
                });
            } else if (api.environment.onDidChangeActiveEnvironmentPath) {
                api.environment.onDidChangeActiveEnvironmentPath((listener) => {
                    this.pydoctestAnalyzer.configuration.pythonInterpreterPath = listener.path;
                });
            }
        }

        const pydoctestExists = await this.pydoctestAnalyzer.pydoctestExists();
        if (!pydoctestExists) {
            vscode.window.showErrorMessage('pydoctest was not found.');
            outputChannel.appendLine("Pydoctest not found");
            return;
        }

        this.registerCommands(subscriptions);
        this.registerEventListeners();
        this.analyzeActiveEditors();

        this.pydoctestAnalyzer.analyzeWorkspace();
    }

    private registerCommands(subscriptions: vscode.Disposable[]): void {
        subscriptions.push(
            vscode.commands.registerCommand('pydoctest.analyzeWorkspace', this.pydoctestAnalyzer.analyzeWorkspace, this.pydoctestAnalyzer),
        );
    }

    private registerEventListeners(): void {
        let disposables: vscode.Disposable[] = [];
        disposables.push(
            vscode.window.onDidChangeActiveTextEditor((editor: vscode.TextEditor | undefined) => {
                if (editor !== undefined) {
                    this.pydoctestAnalyzer.analyzeEditor(editor);
                }
            }),
            vscode.workspace.onDidSaveTextDocument((document: vscode.TextDocument) => {
                if (vscode.window.activeTextEditor !== undefined && vscode.window.activeTextEditor.document === document) {
                    this.pydoctestAnalyzer.analyzeEditor(vscode.window.activeTextEditor);
                }
            }),
            vscode.workspace.onDidChangeConfiguration((event: vscode.ConfigurationChangeEvent) => {
                this.configuration = this.getConfiguration();
                this.initialize(disposables);
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
            });
        }
    }
}
