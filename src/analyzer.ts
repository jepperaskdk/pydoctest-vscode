import * as vscode from 'vscode';
import { CancellationToken, DocumentHighlight, Hover, HoverProvider, ProviderResult, TextDocument } from 'vscode';

export function analyze(filePath: string | null = null) {
    vscode.window.showInformationMessage('pydoctest!');

    vscode.languages.registerDocumentHighlightProvider('python', {
        provideDocumentHighlights(document: TextDocument, position: vscode.Position, token: CancellationToken): ProviderResult<DocumentHighlight[]> {
            return new Promise(resolve => {
                resolve([new DocumentHighlight(new vscode.Range(
                    5, 0, 5, 10
                ))]);
            });
        }
    });

    let b: HoverProvider = {
        provideHover(doc, pos, token): ProviderResult<Hover> {
            return new Promise(resolve => {
                resolve(new Hover('Hello World'));
             });
        }
    }
}