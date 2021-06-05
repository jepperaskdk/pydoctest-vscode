import * as vscode from 'vscode';
import { CancellationToken, DocumentHighlight, Hover, HoverProvider, ProviderResult, TextDocument } from 'vscode';

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

export default class PydoctestAnalyzer {

    constructor() {}

    public analyze(editor: vscode.TextEditor): void {
        console.log(`Analyzing ${editor.document.uri.path}`);
        vscode.window.showInformationMessage('pydoctest!');
        editor.setDecorations(getTextEditorDecorationType("rgba(255,0,0,0.3)", "rgba(255,100,100,0.15)"), getRanges(editor.document));
    }

    public analyzeWorkspace(): void {
        console.log(`Analyzing workspace`);

        console.log(`Done analyzing workspace.`);
    }
}