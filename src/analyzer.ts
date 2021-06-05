import { exec } from 'child_process';
import { Readable, pipeline } from 'stream';
import * as vscode from 'vscode';
import { CancellationToken, DocumentHighlight, Hover, HoverProvider, ProviderResult, TextDocument } from 'vscode';
import { ValidationResult } from './results';

function getTextEditorDecorationType(backgroundColor: string, borderColor: string): vscode.TextEditorDecorationType {
    return vscode.window.createTextEditorDecorationType({
        borderRadius: "3px",
        borderWidth: "1px",
        borderStyle: "solid",
        backgroundColor: backgroundColor,
        borderColor: borderColor
    });
}

function getRanges(document: vscode.TextDocument): vscode.Range[] {
    return [
        new vscode.Range(
            5, 0, 5, 10
        )
    ]
}

interface ExecutionConfiguration {
    workingDirectory?: string | null;
}

export default class PydoctestAnalyzer {
    constructor() {

    }

    private decorate(result: ValidationResult, editor: vscode.TextEditor | null): void {
        vscode.window.showInformationMessage('pydoctest!');
        if (editor) {
            editor.setDecorations(getTextEditorDecorationType("rgba(255,0,0,0.3)", "rgba(255,100,100,0.15)"), getRanges(editor.document));
        }
    }

    public async analyzeEditor(editor: vscode.TextEditor): Promise<void> {
        const modulePath = editor.document.uri.path
        if (!modulePath.endsWith('.py')) return;

        console.log(`Analyzing ${modulePath}`);
        // const result = await this.executeGetResult({});
        // if (result == null) return;
        // this.decorate(result, editor);
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
        const result = await this.executeAsync('pydoctest --reporter json', config.workingDirectory ?? '.');
        const obj = JSON.parse(result);
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