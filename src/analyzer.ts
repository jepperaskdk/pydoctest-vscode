import { exec } from 'child_process';
import { Readable, pipeline } from 'stream';
import * as vscode from 'vscode';
import { CancellationToken, DocumentHighlight, Hover, HoverProvider, ProviderResult, TextDocument } from 'vscode';
import { ResultType, ValidationResult } from './results';


const errorDecorationType = vscode.window.createTextEditorDecorationType({
    borderRadius: "3px",
    borderWidth: "1px",
    borderStyle: "solid",
    backgroundColor: "rgba(255,0,0,0.3)",
    borderColor: "rgba(255,100,100,0.15)"
});

const diagnosticsCollection = vscode.languages.createDiagnosticCollection('pydoctest');


function getRanges(result: ValidationResult): vscode.Range[] {
    const ranges: vscode.Range[] = [];
    if (result.result != ResultType.FAILED) return [];

    result.module_results.forEach(m_r => {
        if (m_r.result == ResultType.FAILED) {
            m_r.function_results.forEach(fn_r => {
                if (fn_r.result == ResultType.FAILED && fn_r.range) {
                    ranges.push(new vscode.Range(fn_r.range.start_line - 1, fn_r.range.start_character, fn_r.range.end_line - 1, 80));
                }
            });

            m_r.class_results.forEach(cl_r => { 
                if (cl_r.result == ResultType.FAILED) {
                    cl_r.function_results.forEach(fn_r => {
                        if (fn_r.result == ResultType.FAILED && fn_r.range) {
                            ranges.push(new vscode.Range(fn_r.range.start_line - 1, fn_r.range.start_character, fn_r.range.end_line - 1, 80));
                        }
                    });
                }
            });
        }
    });
    return ranges;
}

interface ExecutionConfiguration {
    workingDirectory?: string | null;
    module?: string | null;
}

export default class PydoctestAnalyzer {
    constructor() {

    }

    private decorate(result: ValidationResult, editor: vscode.TextEditor | null): void {
        if (editor) {
            editor.setDecorations(errorDecorationType, getRanges(result));
        }
    }

    public async analyzeEditor(editor: vscode.TextEditor): Promise<void> {
        const modulePath = editor.document.uri.path
        if (!modulePath.endsWith('.py')) return;

        console.log(`Analyzing ${modulePath}`);
        const result = await this.executeGetResult({ module: modulePath });
        if (result == null) return;
        this.decorate(result, editor);
    }

    public async analyzeWorkspace(): Promise<void> {
        console.log(`Analyzing workspace`);

        const workspaceRoots: readonly vscode.WorkspaceFolder[] | undefined = vscode.workspace.workspaceFolders;
        const workspaceRoot = workspaceRoots ? workspaceRoots[0].uri.fsPath : '.'

        const result = await this.executeGetResult({ workingDirectory: workspaceRoot });
        if (result == null) return;
        this.decorate(result, null);
    }

    public async executeGetResult(config: ExecutionConfiguration): Promise<ValidationResult | null> {
        let command = 'pydoctest --reporter json';
        if (config.module) {
            command += ` --file ${config.module}`;
        }
        const result = await this.executeAsync(command, config.workingDirectory ?? '.');
        const obj: ValidationResult = JSON.parse(result);
        console.log(obj);
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
        const result = await this.executeAsync('pydoctest -h', '.');
        return result.includes('usage: pydoctest');
    }
}