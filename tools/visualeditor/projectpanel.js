//==============================================================================
// 포함 모듈 목록.
//==============================================================================
const System = globalThis;


//==============================================================================
// 전역 상수 목록.
//==============================================================================
// 끌어서 놓을 때 애셋 경로를 담는 형식.
export const ASSET_DRAG_TYPE = "application/x-vanilla-asset";

// 확장자로 애셋 종류 가르기.
const ASSET_KIND_BY_EXTENSION = System.Object.freeze({
	png: "image", jpg: "image", jpeg: "image", gif: "image", webp: "image", svg: "image", bmp: "image",
	mp3: "audio", ogg: "audio", wav: "audio", m4a: "audio", webm: "audio",
	json: "json",
	glb: "model", gltf: "model", fbx: "model",
	ttf: "font", otf: "font", woff: "font", woff2: "font",
	txt: "text", md: "text", csv: "text", js: "text", glsl: "text",
});

// 종류마다 썸네일 자리의 표시.
const ASSET_KIND_ICON = System.Object.freeze({
	image: "▣", audio: "♪", json: "{ }", scene: "◈", prefab: "❖", model: "◆", font: "Aa", text: "≡", other: "·",
});

// 폴더를 훑을 때 건너뛰는 이름.
const SKIPPED_FOLDER_NAMES = new System.Set([".git", "node_modules", ".DS_Store", "target", "build"]);


//==============================================================================
// 확장자로 애셋 종류. (".scene.json" 은 씬)
//==============================================================================
/**
 * @param { string } fileName
 * @returns { string }
 */
export function readAssetKind(fileName) {
	const lowerName = fileName.toLowerCase();
	if (lowerName.endsWith(".scene.json")) {
		return "scene";
	}
	if (lowerName.endsWith(".prefab.json")) {
		return "prefab";
	}
	const dotIndex = lowerName.lastIndexOf(".");
	const extension = dotIndex >= 0 ? lowerName.substring(dotIndex + 1) : "";
	return ASSET_KIND_BY_EXTENSION[extension] || "other";
}


//==============================================================================
// 프로젝트 패널. (애셋 폴더를 열어 폴더 나무와 애셋 격자로 보이고, 고르고, 끌어서 놓고, 파일을 쓴다)
// - 크롬 계열은 폴더 열기(showDirectoryPicker)로 실제 폴더를 읽고 씬 파일을 그 폴더에 바로 쓴다.
//   그 밖의 브라우저는 파일이나 폴더를 끌어다 놓아 가져오고, 저장은 내려받기로 한다.
// - 그림은 미리 읽어 둬 씬의 Sprite 가 경로로 찾는다. (readImage)
//==============================================================================
export class ProjectPanel {
	//==============================================================================
	// 멤버 변수 목록.
	//==============================================================================
	/** @private @type { HTMLElement } */ #folderElement;
	/** @private @type { HTMLElement } */ #assetElement;
	/** @private @type { Array<object> } */ #assetList; // { path, name, folder, kind, file, url }
	/** @private @type { Map<string, HTMLImageElement> } */ #imageByPath;
	/** @private @type { object | null } */ #directoryHandle; // 연 폴더. (FileSystemDirectoryHandle)
	/** @private @type { string } */ #projectName;
	/** @private @type { string } */ #currentFolder;
	/** @private @type { string } */ #selectedPath;
	/** @private @type { object } */ #eventHandlers; // { selectAsset, openAsset, changed }

	//==============================================================================
	// 생성.
	//==============================================================================
	/**
	 * @constructor
	 * @param { HTMLElement } folderElement
	 * @param { HTMLElement } assetElement
	 * @param { object } eventHandlers - { selectAsset(asset), openAsset(asset), changed() }
	 */
	constructor(folderElement, assetElement, eventHandlers) {
		this.#folderElement = folderElement;
		this.#assetElement = assetElement;
		this.#assetList = [];
		this.#imageByPath = new System.Map();
		this.#directoryHandle = null;
		this.#projectName = "";
		this.#currentFolder = "";
		this.#selectedPath = "";
		this.#eventHandlers = eventHandlers;
		this.setupDropTarget();
		this.render();
	}

	//==============================================================================
	// 폴더 열기. (실제 폴더를 읽고 쓸 수 있게, 안 되는 브라우저면 false)
	//==============================================================================
	/**
	 * @returns { Promise<boolean> }
	 */
	async openFolder() {
		if (typeof System.showDirectoryPicker !== "function") {
			return false;
		}
		const directoryHandle = await System.showDirectoryPicker({ mode: "readwrite" });
		this.#directoryHandle = directoryHandle;
		this.#projectName = directoryHandle.name;
		await this.rescan();
		return true;
	}

	//==============================================================================
	// 연 폴더 다시 훑기.
	//==============================================================================
	async rescan() {
		const directoryHandle = this.#directoryHandle;
		if (directoryHandle === null) {
			return;
		}
		const fileEntryList = [];
		await this.collectDirectory(directoryHandle, "", fileEntryList);
		await this.replaceAssets(fileEntryList);
	}

	//==============================================================================
	// 폴더 핸들 안의 파일 모으기. (재귀, 건너뛰는 이름은 빼고)
	//==============================================================================
	/**
	 * @param { object } directoryHandle
	 * @param { string } folderPath
	 * @param { Array<object> } fileEntryList - { path, file }
	 */
	async collectDirectory(directoryHandle, folderPath, fileEntryList) {
		for await (const entryHandle of directoryHandle.values()) {
			if (SKIPPED_FOLDER_NAMES.has(entryHandle.name)) {
				continue;
			}
			const entryPath = folderPath === "" ? entryHandle.name : `${folderPath}/${entryHandle.name}`;
			if (entryHandle.kind === "directory") {
				await this.collectDirectory(entryHandle, entryPath, fileEntryList);
				continue;
			}
			const file = await entryHandle.getFile();
			fileEntryList.push({ path: entryPath, file: file });
		}
	}

	//==============================================================================
	// 끌어다 놓은 파일과 폴더 가져오기. (webkitGetAsEntry 로 폴더 안까지)
	//==============================================================================
	/**
	 * @param { DataTransfer } dataTransfer
	 */
	async importDataTransfer(dataTransfer) {
		const fileEntryList = this.#assetList.map((asset) => {
			return { path: asset.path, file: asset.file };
		});
		const readEntry = async (entry, folderPath) => {
			const entryPath = folderPath === "" ? entry.name : `${folderPath}/${entry.name}`;
			if (entry.isDirectory) {
				const reader = entry.createReader();
				let childEntryList = [];
				do {
					childEntryList = await new System.Promise((resolve, reject) => {
						reader.readEntries(resolve, reject);
					});
					for (const childEntry of childEntryList) {
						if (!SKIPPED_FOLDER_NAMES.has(childEntry.name)) {
							await readEntry(childEntry, entryPath);
						}
					}
				}
				while (childEntryList.length > 0);
				return;
			}
			const file = await new System.Promise((resolve, reject) => {
				entry.file(resolve, reject);
			});
			fileEntryList.push({ path: entryPath, file: file });
		};
		const entryList = [];
		for (const item of dataTransfer.items) {
			const entry = typeof item.webkitGetAsEntry === "function" ? item.webkitGetAsEntry() : null;
			if (entry !== null) {
				entryList.push(entry);
			}
		}
		for (const entry of entryList) {
			await readEntry(entry, this.#currentFolder);
		}
		if (this.#projectName === "") {
			this.#projectName = "가져온 애셋";
		}
		await this.replaceAssets(fileEntryList);
	}

	//==============================================================================
	// 애셋 목록 바꾸기. (그림은 미리 읽는다)
	//==============================================================================
	/**
	 * @param { Array<object> } fileEntryList - { path, file }
	 */
	async replaceAssets(fileEntryList) {
		for (const asset of this.#assetList) {
			System.URL.revokeObjectURL(asset.url);
		}
		this.#imageByPath.clear();
		const assetList = [];
		const imageLoadList = [];
		for (const fileEntry of fileEntryList) {
			const path = fileEntry.path;
			const slashIndex = path.lastIndexOf("/");
			const name = slashIndex >= 0 ? path.substring(slashIndex + 1) : path;
			const folder = slashIndex >= 0 ? path.substring(0, slashIndex) : "";
			const url = System.URL.createObjectURL(fileEntry.file);
			const asset = { path: path, name: name, folder: folder, kind: readAssetKind(name), file: fileEntry.file, url: url };
			assetList.push(asset);
			if (asset.kind === "image") {
				imageLoadList.push(this.loadImage(asset));
			}
		}
		assetList.sort((first, second) => {
			return first.path.localeCompare(second.path);
		});
		this.#assetList = assetList;
		await System.Promise.all(imageLoadList);
		this.render();
		const changedEvent = this.#eventHandlers.changed;
		if (changedEvent) {
			changedEvent();
		}
	}

	//==============================================================================
	// 그림 미리 읽기.
	//==============================================================================
	/**
	 * @param { object } asset
	 * @returns { Promise<void> }
	 */
	loadImage(asset) {
		return new System.Promise((resolve) => {
			const image = new System.Image();
			image.onload = () => {
				this.#imageByPath.set(asset.path, image);
				resolve();
			};
			image.onerror = () => {
				resolve();
			};
			image.src = asset.url;
		});
	}

	//==============================================================================
	// 파일 가져오기. (지금 폴더로, 연 폴더가 있으면 실제로 복사해 넣는다)
	//==============================================================================
	/**
	 * @param { FileList | Array<File> } fileList
	 */
	async importFiles(fileList) {
		const currentFolder = this.#currentFolder;
		const directoryHandle = this.#directoryHandle;
		if (directoryHandle !== null) {
			for (const file of fileList) {
				const path = currentFolder === "" ? file.name : `${currentFolder}/${file.name}`;
				await this.writeFileData(path, file);
			}
			await this.rescan();
			return;
		}
		const fileEntryList = this.#assetList.map((asset) => {
			return { path: asset.path, file: asset.file };
		});
		for (const file of fileList) {
			const path = currentFolder === "" ? file.name : `${currentFolder}/${file.name}`;
			const existingIndex = fileEntryList.findIndex((fileEntry) => fileEntry.path === path);
			if (existingIndex >= 0) {
				fileEntryList.splice(existingIndex, 1);
			}
			fileEntryList.push({ path: path, file: file });
		}
		if (this.#projectName === "") {
			this.#projectName = "가져온 애셋";
		}
		await this.replaceAssets(fileEntryList);
	}

	//==============================================================================
	// 연 폴더 안에 파일 쓰기. (중간 폴더는 만든다)
	//==============================================================================
	/**
	 * @param { string } path
	 * @param { Blob | string } data
	 */
	async writeFileData(path, data) {
		const partList = path.split("/");
		let folderHandle = this.#directoryHandle;
		for (let partIndex = 0; partIndex < partList.length - 1; ++partIndex) {
			folderHandle = await folderHandle.getDirectoryHandle(partList[partIndex], { create: true });
		}
		const fileHandle = await folderHandle.getFileHandle(partList[partList.length - 1], { create: true });
		const writable = await fileHandle.createWritable();
		await writable.write(data);
		await writable.close();
	}

	//==============================================================================
	// 파일 쓰기. (연 폴더가 있으면 그 안에, 없으면 내려받기, 쓴 뒤 다시 훑는다)
	//==============================================================================
	/**
	 * @param { string } path - 프로젝트 기준 경로.
	 * @param { string } text
	 * @returns { Promise<string> } "folder" 또는 "download"
	 */
	async writeTextFile(path, text) {
		const directoryHandle = this.#directoryHandle;
		if (directoryHandle === null) {
			const blob = new System.Blob([text], { type: "application/json" });
			const anchor = System.document.createElement("a");
			anchor.href = System.URL.createObjectURL(blob);
			anchor.download = path.substring(path.lastIndexOf("/") + 1);
			anchor.click();
			System.setTimeout(() => {
				System.URL.revokeObjectURL(anchor.href);
			}, 1000);
			return "download";
		}
		await this.writeFileData(path, text);
		await this.rescan();
		return "folder";
	}

	//==============================================================================
	// 끌어다 놓기 받기. (애셋 격자 위)
	//==============================================================================
	setupDropTarget() {
		const assetElement = this.#assetElement;
		assetElement.addEventListener("dragover", (dragEvent) => {
			if (dragEvent.dataTransfer.types.includes("Files")) {
				dragEvent.preventDefault();
				assetElement.classList.add("isDropTarget");
			}
		});
		assetElement.addEventListener("dragleave", () => {
			assetElement.classList.remove("isDropTarget");
		});
		assetElement.addEventListener("drop", (dragEvent) => {
			assetElement.classList.remove("isDropTarget");
			if (!dragEvent.dataTransfer.types.includes("Files")) {
				return;
			}
			dragEvent.preventDefault();
			this.importDataTransfer(dragEvent.dataTransfer);
		});
	}

	//==============================================================================
	// 그리기. (폴더 나무와 지금 폴더의 애셋 격자)
	//==============================================================================
	render() {
		this.renderFolders();
		this.renderAssets();
	}

	//==============================================================================
	// 폴더 나무 그리기.
	//==============================================================================
	renderFolders() {
		const folderElement = this.#folderElement;
		folderElement.textContent = "";
		const folderSet = new System.Set([""]);
		for (const asset of this.#assetList) {
			const partList = asset.folder === "" ? [] : asset.folder.split("/");
			for (let partIndex = 1; partIndex <= partList.length; ++partIndex) {
				folderSet.add(partList.slice(0, partIndex).join("/"));
			}
		}
		const folderList = System.Array.from(folderSet).sort();
		for (const folder of folderList) {
			const depth = folder === "" ? 0 : folder.split("/").length;
			const itemElement = System.document.createElement("div");
			itemElement.className = "treeItem" + (folder === this.#currentFolder ? " isSelected" : "");
			itemElement.style.paddingLeft = `${6 + depth * 12}px`;
			const iconElement = System.document.createElement("span");
			iconElement.className = "treeIcon";
			iconElement.textContent = "▸";
			const labelElement = System.document.createElement("span");
			labelElement.className = "treeLabel";
			labelElement.textContent = folder === "" ? (this.#projectName || "Assets") : folder.substring(folder.lastIndexOf("/") + 1);
			itemElement.append(iconElement, labelElement);
			itemElement.addEventListener("click", () => {
				this.#currentFolder = folder;
				this.render();
			});
			folderElement.append(itemElement);
		}
	}

	//==============================================================================
	// 애셋 격자 그리기.
	//==============================================================================
	renderAssets() {
		const assetElement = this.#assetElement;
		assetElement.textContent = "";
		const visibleAssetList = this.#assetList.filter((asset) => {
			return asset.folder === this.#currentFolder;
		});
		if (this.#assetList.length === 0) {
			const noticeElement = System.document.createElement("div");
			noticeElement.className = "emptyNotice";
			noticeElement.textContent = "File > 프로젝트 폴더 열기로 애셋 폴더를 열거나, 파일과 폴더를 여기에 끌어다 놓으세요.";
			assetElement.append(noticeElement);
			return;
		}
		for (const asset of visibleAssetList) {
			const tileElement = System.document.createElement("div");
			tileElement.className = "assetTile" + (asset.path === this.#selectedPath ? " isSelected" : "");
			tileElement.draggable = true;
			tileElement.title = asset.path;
			const thumbnailElement = System.document.createElement("div");
			thumbnailElement.className = "assetThumbnail";
			if (asset.kind === "image") {
				const imageElement = System.document.createElement("img");
				imageElement.src = asset.url;
				imageElement.draggable = false;
				thumbnailElement.append(imageElement);
			}
			else {
				thumbnailElement.textContent = ASSET_KIND_ICON[asset.kind] || ASSET_KIND_ICON.other;
			}
			const nameElement = System.document.createElement("div");
			nameElement.className = "assetName";
			nameElement.textContent = asset.name;
			const kindElement = System.document.createElement("div");
			kindElement.className = "assetKind";
			kindElement.textContent = asset.kind;
			tileElement.append(thumbnailElement, nameElement, kindElement);
			tileElement.addEventListener("click", () => {
				this.#selectedPath = asset.path;
				this.renderAssets();
				const selectAssetEvent = this.#eventHandlers.selectAsset;
				if (selectAssetEvent) {
					selectAssetEvent(asset);
				}
			});
			tileElement.addEventListener("dblclick", () => {
				const openAssetEvent = this.#eventHandlers.openAsset;
				if (openAssetEvent) {
					openAssetEvent(asset);
				}
			});
			tileElement.addEventListener("dragstart", (dragEvent) => {
				dragEvent.dataTransfer.setData(ASSET_DRAG_TYPE, asset.path);
				dragEvent.dataTransfer.effectAllowed = "copy";
			});
			assetElement.append(tileElement);
		}
	}

	//==============================================================================
	// 경로의 애셋. (없으면 null)
	//==============================================================================
	/**
	 * @param { string } path
	 * @returns { object | null }
	 */
	findAsset(path) {
		return this.#assetList.find((asset) => {
			return asset.path === path;
		}) || null;
	}

	//==============================================================================
	// 경로의 그림. (미리 읽은 것, 없으면 null)
	//==============================================================================
	/**
	 * @param { string } path
	 * @returns { HTMLImageElement | null }
	 */
	readImage(path) {
		return this.#imageByPath.get(path) || null;
	}

	//==============================================================================
	// 종류의 애셋 목록.
	//==============================================================================
	/**
	 * @param { string } kind
	 * @returns { Array<object> }
	 */
	readAssetsOfKind(kind) {
		return this.#assetList.filter((asset) => {
			return asset.kind === kind;
		});
	}

	//==============================================================================
	// 지금 보는 폴더. (프로젝트 기준 경로, 맨 위는 "")
	//==============================================================================
	/**
	 * @returns { string }
	 */
	getCurrentFolder() {
		return this.#currentFolder;
	}

	//==============================================================================
	// 폴더가 열려 있는지. (씬을 폴더에 바로 쓸 수 있는지)
	//==============================================================================
	/**
	 * @returns { boolean }
	 */
	hasDirectory() {
		return this.#directoryHandle !== null;
	}

	//==============================================================================
	// 프로젝트 이름.
	//==============================================================================
	/**
	 * @returns { string }
	 */
	getProjectName() {
		return this.#projectName;
	}

	//==============================================================================
	// 애셋 수.
	//==============================================================================
	/**
	 * @returns { number }
	 */
	getAssetCount() {
		return this.#assetList.length;
	}
}
