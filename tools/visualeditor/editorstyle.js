//==============================================================================
// 에디터의 화면 꼴. (유니티처럼 위 메뉴와 도구 막대, 왼쪽 하이어라키, 가운데 씬 뷰, 오른쪽 인스펙터, 아래 프로젝트와 콘솔)
//==============================================================================
export const EDITOR_STYLE_TEXT = `
:root {
	--editor-background: #1e1f22;
	--editor-panel: #26272b;
	--editor-panel-raised: #2e3035;
	--editor-border: #3a3c42;
	--editor-text: #d8dae0;
	--editor-text-dim: #8e929c;
	--editor-accent: #4c8dff;
	--editor-accent-dim: #2d4f8a;
	--editor-danger: #e0605a;
	--editor-success: #45b585;
	--editor-warning: #e8b04c;
	--editor-font: -apple-system, "Segoe UI", "Apple SD Gothic Neo", "Malgun Gothic", sans-serif;
}
* {
	box-sizing: border-box;
}
html, body {
	margin: 0;
	height: 100%;
	overflow: hidden;
	background: var(--editor-background);
	color: var(--editor-text);
	font-family: var(--editor-font);
	font-size: 12px;
	user-select: none;
}
.editorRoot {
	display: grid;
	grid-template-rows: 26px 34px 1fr 6px 230px 22px;
	grid-template-columns: 250px 6px 1fr 6px 300px;
	grid-template-areas:
		"menu menu menu menu menu"
		"toolbar toolbar toolbar toolbar toolbar"
		"hierarchy splitLeft scene splitRight inspector"
		"splitBottom splitBottom splitBottom splitRight inspector"
		"bottom bottom bottom splitRight inspector"
		"status status status status status";
	height: 100vh;
}
.menuBar {
	grid-area: menu;
	display: flex;
	align-items: center;
	background: var(--editor-panel);
	border-bottom: 1px solid var(--editor-border);
	padding: 0 6px;
}
.menuItem {
	position: relative;
	padding: 4px 10px;
	cursor: default;
	border-radius: 3px;
}
.menuItem:hover, .menuItem.isOpen {
	background: var(--editor-panel-raised);
}
.menuPopup {
	position: absolute;
	top: 24px;
	left: 0;
	min-width: 220px;
	background: var(--editor-panel-raised);
	border: 1px solid var(--editor-border);
	border-radius: 4px;
	padding: 4px 0;
	z-index: 100;
	box-shadow: 0 6px 18px rgba(0, 0, 0, 0.45);
	display: none;
}
.menuItem.isOpen .menuPopup {
	display: block;
}
.menuCommand {
	display: flex;
	justify-content: space-between;
	padding: 5px 14px;
	white-space: nowrap;
}
.menuCommand:hover {
	background: var(--editor-accent-dim);
}
.menuShortcut {
	color: var(--editor-text-dim);
	margin-left: 24px;
}
.menuSeparator {
	height: 1px;
	background: var(--editor-border);
	margin: 4px 0;
}
.toolBar {
	grid-area: toolbar;
	display: flex;
	align-items: center;
	gap: 4px;
	background: var(--editor-panel);
	border-bottom: 1px solid var(--editor-border);
	padding: 0 8px;
}
.toolGroup {
	display: flex;
	gap: 2px;
	margin-right: 12px;
}
.toolButton {
	min-width: 28px;
	height: 24px;
	padding: 0 8px;
	border: 1px solid var(--editor-border);
	background: var(--editor-panel-raised);
	color: var(--editor-text);
	border-radius: 3px;
	font-size: 12px;
	cursor: pointer;
}
.toolButton:hover {
	border-color: var(--editor-accent);
}
.toolButton.isActive {
	background: var(--editor-accent-dim);
	border-color: var(--editor-accent);
}
.toolButton.isPlaying {
	background: var(--editor-success);
	color: #10251a;
}
.toolSpacer {
	flex: 1;
}
.panel {
	display: flex;
	flex-direction: column;
	background: var(--editor-panel);
	min-width: 0;
	min-height: 0;
	overflow: hidden;
}
.panelHeader {
	display: flex;
	align-items: center;
	gap: 6px;
	height: 26px;
	padding: 0 8px;
	border-bottom: 1px solid var(--editor-border);
	color: var(--editor-text-dim);
	font-weight: 600;
	letter-spacing: 0.04em;
	text-transform: uppercase;
	font-size: 11px;
	flex-shrink: 0;
}
.panelTab {
	padding: 4px 8px;
	cursor: pointer;
	border-radius: 3px;
}
.panelTab.isActive {
	color: var(--editor-text);
	background: var(--editor-panel-raised);
}
.panelBody {
	flex: 1;
	overflow: auto;
	min-height: 0;
}
.hierarchyPanel {
	grid-area: hierarchy;
}
.scenePanel {
	grid-area: scene;
	position: relative;
}
.inspectorPanel {
	grid-area: inspector;
}
.bottomPanel {
	grid-area: bottom;
}
.splitter {
	background: var(--editor-background);
}
.splitter:hover {
	background: var(--editor-accent-dim);
}
.splitLeft {
	grid-area: splitLeft;
	cursor: col-resize;
}
.splitRight {
	grid-area: splitRight;
	cursor: col-resize;
}
.splitBottom {
	grid-area: splitBottom;
	cursor: row-resize;
}
.statusBar {
	grid-area: status;
	display: flex;
	align-items: center;
	gap: 16px;
	padding: 0 10px;
	background: var(--editor-panel);
	border-top: 1px solid var(--editor-border);
	color: var(--editor-text-dim);
	font-size: 11px;
}
.sceneCanvasHolder {
	position: absolute;
	top: 26px;
	left: 0;
	right: 0;
	bottom: 0;
}
.sceneCanvasHolder canvas {
	width: 100%;
	height: 100%;
	display: block;
	outline: none;
}
.sceneOverlay {
	position: absolute;
	top: 32px;
	right: 10px;
	color: var(--editor-text-dim);
	font-size: 11px;
	pointer-events: none;
	text-align: right;
}
.hierarchySearch {
	flex: 0 0 auto !important;
	margin: 6px 8px;
	width: calc(100% - 16px);
}
.treeItem {
	display: flex;
	align-items: center;
	height: 22px;
	padding-right: 6px;
	cursor: default;
	white-space: nowrap;
}
.treeItem:hover {
	background: var(--editor-panel-raised);
}
.treeItem.isSelected {
	background: var(--editor-accent-dim);
}
.treeItem.isDropTarget {
	outline: 1px solid var(--editor-accent);
	outline-offset: -1px;
}
.treeItem.isInactive .treeLabel {
	color: var(--editor-text-dim);
}
.treeToggle {
	width: 14px;
	text-align: center;
	color: var(--editor-text-dim);
	flex-shrink: 0;
}
.treeIcon {
	width: 16px;
	text-align: center;
	color: var(--editor-text-dim);
	flex-shrink: 0;
}
.treeLabel {
	overflow: hidden;
	text-overflow: ellipsis;
}
.treeRename {
	background: var(--editor-background);
	color: var(--editor-text);
	border: 1px solid var(--editor-accent);
	font: inherit;
	padding: 1px 4px;
	width: 140px;
}
.inspectorSection {
	border-bottom: 1px solid var(--editor-border);
}
.inspectorSectionHeader {
	display: flex;
	align-items: center;
	gap: 6px;
	padding: 6px 8px;
	background: var(--editor-panel-raised);
	font-weight: 600;
}
.inspectorSectionHeader .sectionTitle {
	flex: 1;
}
.inspectorSectionBody {
	padding: 4px 8px 8px;
}
.fieldRow {
	display: grid;
	grid-template-columns: 96px 1fr;
	align-items: center;
	gap: 6px;
	min-height: 24px;
}
.fieldLabel {
	color: var(--editor-text-dim);
	overflow: hidden;
	text-overflow: ellipsis;
	white-space: nowrap;
}
.fieldInputs {
	display: flex;
	gap: 4px;
	min-width: 0;
}
.fieldInputs input[type="number"], .fieldInputs input[type="text"], .fieldInputs select, .inspectorNameInput {
	flex: 1;
	min-width: 0;
	background: var(--editor-background);
	color: var(--editor-text);
	border: 1px solid var(--editor-border);
	border-radius: 3px;
	padding: 2px 5px;
	font: inherit;
	height: 22px;
}
.fieldInputs input:focus, .inspectorNameInput:focus {
	border-color: var(--editor-accent);
	outline: none;
}
.fieldInputs input[type="color"] {
	width: 32px;
	height: 22px;
	padding: 0;
	border: 1px solid var(--editor-border);
	background: none;
}
.fieldAxis {
	color: var(--editor-text-dim);
	width: 10px;
	align-self: center;
}
.dropField {
	flex: 1;
	min-height: 22px;
	padding: 3px 6px;
	border: 1px dashed var(--editor-border);
	border-radius: 3px;
	color: var(--editor-text-dim);
	overflow: hidden;
	text-overflow: ellipsis;
	white-space: nowrap;
}
.dropField.isDropTarget {
	border-color: var(--editor-accent);
	color: var(--editor-text);
}
.smallButton {
	background: var(--editor-panel-raised);
	color: var(--editor-text);
	border: 1px solid var(--editor-border);
	border-radius: 3px;
	padding: 2px 8px;
	font: inherit;
	cursor: pointer;
}
.smallButton:hover {
	border-color: var(--editor-accent);
}
.wideButton {
	width: calc(100% - 16px);
	margin: 10px 8px;
	padding: 6px;
}
.emptyNotice {
	color: var(--editor-text-dim);
	padding: 16px;
	line-height: 1.6;
}
.projectBody {
	display: grid;
	grid-template-columns: 180px 1fr;
	height: 100%;
}
.projectFolders {
	border-right: 1px solid var(--editor-border);
	overflow: auto;
	padding: 4px 0;
}
.projectAssets {
	overflow: auto;
	padding: 8px;
	display: flex;
	flex-wrap: wrap;
	align-content: flex-start;
	gap: 8px;
}
.projectAssets.isDropTarget {
	outline: 2px dashed var(--editor-accent);
	outline-offset: -6px;
}
.assetTile {
	width: 84px;
	padding: 4px;
	border-radius: 4px;
	text-align: center;
	cursor: default;
}
.assetTile:hover {
	background: var(--editor-panel-raised);
}
.assetTile.isSelected {
	background: var(--editor-accent-dim);
}
.assetThumbnail {
	width: 64px;
	height: 64px;
	margin: 0 auto 4px;
	display: flex;
	align-items: center;
	justify-content: center;
	background: var(--editor-background);
	border-radius: 3px;
	overflow: hidden;
	font-size: 18px;
	color: var(--editor-text-dim);
}
.assetThumbnail img {
	max-width: 100%;
	max-height: 100%;
	image-rendering: auto;
}
.assetName {
	font-size: 11px;
	overflow: hidden;
	text-overflow: ellipsis;
	white-space: nowrap;
}
.assetKind {
	font-size: 9px;
	color: var(--editor-text-dim);
	text-transform: uppercase;
}
.consoleBody {
	font-family: ui-monospace, Menlo, Consolas, monospace;
	font-size: 11px;
	padding: 4px 8px;
}
.consoleLine {
	padding: 2px 0;
	border-bottom: 1px solid rgba(255, 255, 255, 0.03);
	white-space: pre-wrap;
	user-select: text;
}
.consoleLine.isWarning {
	color: var(--editor-warning);
}
.consoleLine.isError {
	color: var(--editor-danger);
}
.assetPreview {
	padding: 8px;
}
.assetPreview img {
	max-width: 100%;
	background: repeating-conic-gradient(#3a3c42 0% 25%, #2e3035 0% 50%) 50% / 16px 16px;
	display: block;
	margin: 6px 0;
}
.assetPreview pre {
	background: var(--editor-background);
	padding: 8px;
	max-height: 360px;
	overflow: auto;
	white-space: pre-wrap;
	user-select: text;
	font-size: 11px;
}
.modelPreviewCanvas {
	width: 100%;
	height: 260px;
	display: block;
	margin: 6px 0;
	border-radius: 4px;
	cursor: grab;
}
.contextMenu {
	position: fixed;
	min-width: 180px;
	background: var(--editor-panel-raised);
	border: 1px solid var(--editor-border);
	border-radius: 4px;
	padding: 4px 0;
	z-index: 200;
	box-shadow: 0 6px 18px rgba(0, 0, 0, 0.45);
}
`;
