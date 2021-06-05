import * as vscode from 'vscode';

export default class PydoctestCLI {

    pydoctestPromise: Thenable<vscode.Task[]> | undefined = undefined;

    constructor() {

    }

    // if pythonModule == null, analyze entire workspace
    executeJson(pythonModule: string | null) {
        // const terminal = vscode.window.createTerminal(`pydoctest.terminal`);
        // terminal.sendText("echo 'Sent text immediately after creating'");
        // terminal.

        // const e = new vscode.ShellExecution("echo 'hello world';");
        // vscode.tasks.registerTaskProvider('rake', {

        // });
    }

}