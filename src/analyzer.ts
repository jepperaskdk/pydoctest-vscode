import * as path from 'path';
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
    if (result.result !== ResultType.FAILED) {
        return [];
    }

    result.module_results.forEach(mr => {
        const moduleResult: PydoctestDiagnosticItem = {
            uri: vscode.Uri.file(mr.module_path),
            diagnosticItems: []
        };

        if (mr.result === ResultType.FAILED) {
            mr.function_results.forEach(fnr => {
                if (fnr.result === ResultType.FAILED && fnr.range) {
                    const range = new vscode.Range(fnr.range.start_line - 1, fnr.range.start_character, fnr.range.end_line - 1, 80);
                    const item = new vscode.Diagnostic(range, fnr.fail_reason, vscode.DiagnosticSeverity.Error);
                    moduleResult.diagnosticItems.push(item);
                }
            });

            mr.class_results.forEach(clr => {
                if (clr.result === ResultType.FAILED) {
                    clr.function_results.forEach(fnr => {
                        if (fnr.result === ResultType.FAILED && fnr.range) {
                            const range = new vscode.Range(fnr.range.start_line - 1, fnr.range.start_character, fnr.range.end_line - 1, 80);
                            const item = new vscode.Diagnostic(range, fnr.fail_reason, vscode.DiagnosticSeverity.Error);
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
    workingDirectory: string;
    module?: string | null;
}

export default class PydoctestAnalyzer {
    constructor(public outputChannel: vscode.OutputChannel, public diagnosticsCollection: vscode.DiagnosticCollection, public configuration: PydoctestConfiguration) {}

    private decorate(result: ValidationResult, clearExisting: boolean): void {
        if (clearExisting) {
            // Clear all existing results
            this.diagnosticsCollection.clear();
        } else {
            // Clear existing results for modules analyzed in this result
            result.module_results.forEach(mr => {
                this.diagnosticsCollection.delete(vscode.Uri.file(mr.module_path));
            });
        }

        // Get new results
        const diagnosticItems = getDiagnosticsItems(result);
        diagnosticItems.forEach(i => {
            this.diagnosticsCollection.set(i.uri, i.diagnosticItems);
        });
    }

    public async analyzeEditor(editor: vscode.TextEditor): Promise<void> {
        const modulePath = editor.document.fileName;
        if (!modulePath.endsWith('.py')) {
            return;
        }

        const workspaceRoots: readonly vscode.WorkspaceFolder[] | undefined = vscode.workspace.workspaceFolders;
        const workspaceRoot = workspaceRoots ? workspaceRoots[0].uri.fsPath : '.';
        const workingDirectoryPath = path.resolve(workspaceRoot, this.configuration.workingDirectory ?? '.');

        this.outputChannel.append(`Analyzing ${modulePath}\n`);
        const result = await this.executeGetResult({ workingDirectory: workingDirectoryPath, module: modulePath });
        if (result) {
            this.outputChannel.append("Finished\n");
            // if (result.result == ResultType.FAILED) {
            //     this.outputChannel.append(`Result (failed) was: ${JSON.stringify(result)}\n`)
            // } else {
            //     this.outputChannel.append(`Result was: ${ResultType[result?.result]} (${modulePath})\n`)
            // }
            this.decorate(result, false);
        }
    }

    public async analyzeWorkspace(): Promise<void> {
        const workspaceRoots: readonly vscode.WorkspaceFolder[] | undefined = vscode.workspace.workspaceFolders;
        const workspaceRoot = workspaceRoots ? workspaceRoots[0].uri.fsPath : '.';
        const workingDirectoryPath = path.resolve(workspaceRoot, this.configuration.workingDirectory ?? '.');

        this.outputChannel.append(`Analyzing workspace: ${workspaceRoot}\n`);
        const result = await this.executeGetResult({ workingDirectory: workingDirectoryPath });
        if (result) {
            this.outputChannel.append(`Result was: ${ResultType[result?.result]}\n`);
            this.decorate(result, true);
        }
    }

    public async executeGetResult(config: ExecutionConfiguration): Promise<ValidationResult | null> {
        // Assume we're using the system-wide pydoctest (or otherhow on path)
        let command = 'pydoctest';

        // Optionally invoke the python executable specified in config
        if (this.configuration.pythonInterpreterPath) {
            command = `${this.configuration.pythonInterpreterPath} -m pydoctest.main`;
        }

        command += ' --reporter json';

        if (config.module) {
            command += ` --file ${config.module}`;
        }

        const result = await this.executeAsync(command, config.workingDirectory);
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

    public async pythonInterpreterExists(): Promise<boolean> {
        this.outputChannel.append('Testing if selected interpreter exists..');
        const result = await this.executeAsync(`${this.configuration.pythonInterpreterPath} -h`, '.');
        // TODO: Would be good to check return code also. We can't check for 'usage: python' below, since it may include full path to python
        return result.includes('usage: ');
    }
}