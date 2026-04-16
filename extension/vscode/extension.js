const vscode = require('vscode');
const path = require('path');
const fs = require('fs');

function activate(context) {
	function updateAvailability() {
		const workspaceFolder = vscode.workspace.workspaceFolders?.[0];
		if (!workspaceFolder) {
			vscode.commands.executeCommand('setContext', 'atlasPacker.available', false);
			return;
		}
		const scriptPath = path.join(workspaceFolder.uri.fsPath, 'tools', 'atlaspacker.cjs');
		vscode.commands.executeCommand('setContext', 'atlasPacker.available', fs.existsSync(scriptPath));
	}

	updateAvailability();

	const watcher = vscode.workspace.onDidChangeWorkspaceFolders(() => updateAvailability());
	context.subscriptions.push(watcher);

	const disposable = vscode.commands.registerCommand('atlasPacker.packFolder', (uri) => {
		if (!uri || !uri.fsPath) {
			vscode.window.showErrorMessage('[Atlas Packer] 폴더를 선택해주세요.');
			return;
		}

		const workspaceFolder = vscode.workspace.workspaceFolders?.[0];
		if (!workspaceFolder) {
			vscode.window.showErrorMessage('[Atlas Packer] 워크스페이스가 열려있지 않습니다.');
			return;
		}

		const scriptPath = path.join(workspaceFolder.uri.fsPath, 'tools', 'atlaspacker.cjs');
		const targetPath = uri.fsPath;

		const terminal = vscode.window.createTerminal('Atlas Packer');
		terminal.show();
		terminal.sendText(`node "${scriptPath}" "${targetPath}"`);
	});

	context.subscriptions.push(disposable);
}

function deactivate() {}

module.exports = { activate, deactivate };
