import { exec } from 'child_process';
import * as vscode from 'vscode';
import { PydoctestConfiguration } from './loader';
import { Result, ResultType, ValidationResult } from './results';


interface PydoctestDiagnosticItem {
    diagnosticItems: vscode.Diagnostic[];
    uri: vscode.Uri;
}


function getDiagnosticsItems(result: ValidationResult): PydoctestDiagnosticItem[] {
    const items: PydoctestDiagnosticItem[] = [];
    if (result.result != ResultType.FAILED) return [];

    result.module_results.forEach(m_r => {
        const moduleResult: PydoctestDiagnosticItem = {
            uri: vscode.Uri.file(m_r.module_path),
            diagnosticItems: []
        };

        if (m_r.result == ResultType.FAILED) {
            m_r.function_results.forEach(fn_r => {
                if (fn_r.result == ResultType.FAILED && fn_r.range) {
                    const range = new vscode.Range(fn_r.range.start_line - 1, fn_r.range.start_character, fn_r.range.end_line - 1, 80);
                    const item = new vscode.Diagnostic(range, fn_r.fail_reason, vscode.DiagnosticSeverity.Error);
                    moduleResult.diagnosticItems.push(item);
                }
            });

            m_r.class_results.forEach(cl_r => {
                if (cl_r.result == ResultType.FAILED) {
                    cl_r.function_results.forEach(fn_r => {
                        if (fn_r.result == ResultType.FAILED && fn_r.range) {
                            const range = new vscode.Range(fn_r.range.start_line - 1, fn_r.range.start_character, fn_r.range.end_line - 1, 80);
                            const item = new vscode.Diagnostic(range, fn_r.fail_reason, vscode.DiagnosticSeverity.Error);
                            moduleResult.diagnosticItems.push(item);
                        }
                    });
                }
            });

            items.push(moduleResult);
        }
    });
    return items;
}

interface ExecutionConfiguration {
    workingDirectory?: string | null;
    module?: string | null;
}

export default class PydoctestAnalyzer {
    constructor(public outputChannel: vscode.OutputChannel, public diagnosticsCollection: vscode.DiagnosticCollection, public configuration: PydoctestConfiguration) {}

    private decorate(result: ValidationResult, editor: vscode.TextEditor | null): void {
        this.diagnosticsCollection.clear();
        if (editor) {
            const diagnosticItems = getDiagnosticsItems(result);
            diagnosticItems.forEach(i => {
                this.diagnosticsCollection.set(i.uri, i.diagnosticItems);
            });
        }
    }

    public async analyzeEditor(editor: vscode.TextEditor): Promise<void> {
        const modulePath = editor.document.fileName;
        if (!modulePath.endsWith('.py')) return;

        this.outputChannel.append(`Analyzing ${modulePath}\n`);
        const result = await this.executeGetResult({ module: modulePath });
        if (result) {
            this.outputChannel.append(`Result was: ${ResultType[result?.result]} (${modulePath})\n`)
            this.decorate(result, editor);
        }
    }

    public async analyzeWorkspace(): Promise<void> {
        const workspaceRoots: readonly vscode.WorkspaceFolder[] | undefined = vscode.workspace.workspaceFolders;
        const workspaceRoot = workspaceRoots ? workspaceRoots[0].uri.fsPath : '.'

        this.outputChannel.append(`Analyzing workspace: ${workspaceRoot}\n`);
        const result = await this.executeGetResult({ workingDirectory: workspaceRoot });
        if (result) {
            if (result.result == ResultType.FAILED && result.module_results.length > 0) {
                this.outputChannel.append(`Result (failed) was: ${JSON.stringify(result)}\n`)
            } else {
                this.outputChannel.append(`Result was: ${ResultType[result?.result]}\n`)
            }
            this.decorate(result, null);
        }
    }

    public async executeGetResult(config: ExecutionConfiguration): Promise<ValidationResult | null> {
        let command = 'pydoctest --reporter json';
        if (config.module) {
            command += ` --file ${config.module}`;
        }
        const result = await this.executeAsync(command, config.workingDirectory ?? '.');
        const obj: ValidationResult = JSON.parse(result);
        return obj;
    }

    public async executeAsync(command: string, workingDirectory: string): Promise<string> {
        const { stdout, stderr } = await exec(command, {
            encoding: "utf8",
            cwd: workingDirectory
        });

        return new Promise((resolve, reject) => {
            if (stdout) {
                let result = "";
                stdout.on('data',function(data){
                    result += data;
                });

                stdout.on('end', () => resolve(result));
            }
        });
    }

    public async pydoctestExists(): Promise<boolean> {
        this.outputChannel.append('Testing if pydoctest is installed..');
        const result = await this.executeAsync('pydoctest -h', '.');
        return result.includes('usage: pydoctest');
    }
}