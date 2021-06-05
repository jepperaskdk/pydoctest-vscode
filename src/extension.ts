import * as vscode from 'vscode';
import PydoctestLoader from './loader';

export function activate(context: vscode.ExtensionContext) {
    console.log("Activating");
    let loader = new PydoctestLoader(".");
    loader.activate(context.subscriptions);
    console.log("Activated");
}

// this method is called when your extension is deactivated
export function deactivate() {}
