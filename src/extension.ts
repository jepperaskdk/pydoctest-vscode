import * as vscode from 'vscode';
import PydoctestLoader from './loader';

export function activate(context: vscode.ExtensionContext) {
    let loader = new PydoctestLoader();
    loader.activate(context.subscriptions);
}

// this method is called when your extension is deactivated
export function deactivate() {}
