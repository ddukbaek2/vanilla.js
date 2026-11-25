//==============================================================================
// 포함 모듈 목록.
//==============================================================================
const System = globalThis;
import { Object } from "../base/object.js";
import { Rect } from "../base/rect.js";
import { Frame } from "../core/frame.js";
import { Sprite } from "../core/component/sprite.js";
import { ImageAsset } from "./imageasset.js";
import { JsonAsset } from "./jsonasset.js";


//==============================================================================
// 찾을 아틀라스 목록. (SpriteAtlas.findFrame 이 앞에서부터 찾는다)
//==============================================================================
const searchAtlasList = [];


//==============================================================================
// 확장자를 뗀 이름. ("icon-close.png" → "icon-close", 확장자가 없으면 그대로)
//==============================================================================
/**
 * @param { string } fileName
 * @returns { string }
 */
function removeExtension(fileName) {
	const dotIndex = fileName.lastIndexOf(".");
	const slashIndex = fileName.lastIndexOf("/");
	if (dotIndex <= 0 || dotIndex < slashIndex) {
		return fileName;
	}
	return fileName.substring(0, dotIndex);
}


//==============================================================================
// 스프라이트 아틀라스. (쪽 그림 몇 장에 모은 그림을 이름으로 꺼낸다)
// - 같은 쪽 그림을 쓰는 스프라이트는 엔진이 묶어 한 번에 그린다. (Graphic.setSpriteBatchingEnabled)
// - 읽는 JSON 꼴 둘:
//   1. tools/atlas.cjs 가 만든 것. { images: { "이름.png": { x, y, width, height, page } }, meta: { imageFileName, pages: [{ imageFileName }] } }
//      page 가 없으면 0 쪽, meta.pages 가 없으면 meta.imageFileName 한 장이다.
//   2. 쪽 경로와 [쪽, x, y, 가로, 세로] 표. { pagePaths: ["경로"], frames: { "이름": [쪽, x, y, 가로, 세로] } }
// - 그림 이름은 확장자를 뗀 이름으로 찾는다. ("icon-close.png" 는 "icon-close" 로도 "icon-close.png" 로도 찾는다)
// - 쪽 경로에 빗금(/)이 없으면 JSON 이 있는 폴더를 기준으로, 있으면 적힌 그대로 읽는다.
// - 여러 아틀라스를 addSearchAtlas 로 넣어 두면 findFrame, applyFrame(정적) 이 넣은 차례로 찾는다. (앞의 것이 이긴다)
//==============================================================================
export class SpriteAtlas extends Object {
	//==============================================================================
	// 멤버 변수 목록.
	//==============================================================================
	/** @private @type { HTMLImageElement[] } */ #pageImages; // 쪽 그림.
	/** @private @type { Map<string, Frame> } */ #frames; // 이름 → 조각.
	/** @private @type { boolean } */ #isLoaded;

	//==============================================================================
	// 생성.
	//==============================================================================
	constructor() {
		super();
		this.#pageImages = [];
		this.#frames = new System.Map();
		this.#isLoaded = false;
	}

	//==============================================================================
	// 아틀라스 JSON 과 쪽 그림 불러오기. (쪽 그림은 한꺼번에 받는다)
	//==============================================================================
	/**
	 * @param { string } jsonPath
	 * @returns { Promise<void> }
	 */
	async load(jsonPath) {
		const jsonAsset = new JsonAsset();
		await jsonAsset.load(jsonPath);
		const slashIndex = jsonPath.lastIndexOf("/");
		const baseDirectory = slashIndex >= 0 ? jsonPath.substring(0, slashIndex + 1) : "";
		await this.loadData(jsonAsset.data, baseDirectory);
	}

	//==============================================================================
	// 아틀라스 자료로 불러오기. (JSON 을 읽은 객체나 코드에 둔 같은 꼴의 객체, 쪽 경로에 빗금이 없으면 baseDirectory 를 앞에 붙인다)
	//==============================================================================
	/**
	 * @param { object } atlasData
	 * @param { string } baseDirectory
	 * @returns { Promise<void> }
	 */
	async loadData(atlasData, baseDirectory = "") {
		const pagePaths = [];
		const frameValues = [];
		if (atlasData !== null && typeof atlasData === "object" && atlasData.images !== undefined) {
			const meta = atlasData.meta !== undefined ? atlasData.meta : {};
			if (System.Array.isArray(meta.pages)) {
				for (const page of meta.pages) {
					pagePaths.push(page.imageFileName);
				}
			}
			else if (typeof meta.imageFileName === "string") {
				pagePaths.push(meta.imageFileName);
			}
			for (const fileName of System.Object.keys(atlasData.images)) {
				const imageData = atlasData.images[fileName];
				const pageIndex = typeof imageData.page === "number" ? imageData.page : 0;
				frameValues.push([fileName, pageIndex, imageData.x, imageData.y, imageData.width, imageData.height]);
			}
		}
		else if (atlasData !== null && typeof atlasData === "object" && atlasData.frames !== undefined) {
			for (const pagePath of atlasData.pagePaths) {
				pagePaths.push(pagePath);
			}
			for (const frameName of System.Object.keys(atlasData.frames)) {
				const values = atlasData.frames[frameName];
				frameValues.push([frameName, values[0], values[1], values[2], values[3], values[4]]);
			}
		}
		else {
			console.warn("[SpriteAtlas] 아틀라스 꼴을 읽지 못했다.");
			return;
		}

		// 쪽 그림을 한꺼번에 받는다.
		const pageImages = [];
		const loadPromises = [];
		for (let pageIndex = 0; pageIndex < pagePaths.length; ++pageIndex) {
			const pagePath = pagePaths[pageIndex];
			const resolvedPath = pagePath.indexOf("/") >= 0 ? pagePath : baseDirectory + pagePath;
			const imageAsset = new ImageAsset();
			const loadPromise = imageAsset.load(resolvedPath).then(() => {
				pageImages[pageIndex] = imageAsset.image;
			});
			loadPromises.push(loadPromise);
		}
		await System.Promise.all(loadPromises);

		this.#pageImages = pageImages;
		this.#frames.clear();
		for (const values of frameValues) {
			const pageImage = pageImages[values[1]];
			if (pageImage === undefined) {
				continue;
			}
			const frame = new Frame(pageImage, Rect.create(values[2], values[3], values[4], values[5]));
			const frameName = values[0];
			this.#frames.set(frameName, frame);
			const baseName = removeExtension(frameName);
			if (baseName !== frameName && !this.#frames.has(baseName)) {
				this.#frames.set(baseName, frame);
			}
		}
		this.#isLoaded = true;
	}

	//==============================================================================
	// 조각 읽기. (없으면 null)
	//==============================================================================
	/**
	 * @param { string } frameName
	 * @returns { Frame | null }
	 */
	readFrame(frameName) {
		const frame = this.#frames.get(frameName);
		if (frame === undefined) {
			return null;
		}
		return frame;
	}

	//==============================================================================
	// 조각이 있는지.
	//==============================================================================
	/**
	 * @param { string } frameName
	 * @returns { boolean }
	 */
	hasFrame(frameName) {
		return this.#frames.has(frameName);
	}

	//==============================================================================
	// 스프라이트에 조각 걸기. (없는 이름이면 그림을 비우고 false)
	//==============================================================================
	/**
	 * @param { Sprite } sprite
	 * @param { string } frameName
	 * @returns { boolean }
	 */
	applyFrame(sprite, frameName) {
		const frame = this.readFrame(frameName);
		sprite.setFrame(frame);
		return frame !== null;
	}

	//==============================================================================
	// 쪽 그림 목록 반환.
	//==============================================================================
	/**
	 * @returns { HTMLImageElement[] }
	 */
	getPageImages() {
		return this.#pageImages;
	}

	//==============================================================================
	// 이름 목록 반환. (확장자를 뗀 이름과 파일 이름이 함께 든다)
	//==============================================================================
	/**
	 * @returns { string[] }
	 */
	getFrameNames() {
		return System.Array.from(this.#frames.keys());
	}

	//==============================================================================
	// 불러왔는지.
	//==============================================================================
	/**
	 * @returns { boolean }
	 */
	isLoaded() {
		return this.#isLoaded;
	}

	//==============================================================================
	// 찾을 아틀라스 넣기. (정적, 맨 뒤에 넣는다, 이미 들었으면 그대로)
	//==============================================================================
	/**
	 * @param { SpriteAtlas } spriteAtlas
	 */
	static addSearchAtlas(spriteAtlas) {
		if (searchAtlasList.indexOf(spriteAtlas) >= 0) {
			return;
		}
		searchAtlasList.push(spriteAtlas);
	}

	//==============================================================================
	// 찾을 아틀라스 빼기. (정적)
	//==============================================================================
	/**
	 * @param { SpriteAtlas } spriteAtlas
	 */
	static removeSearchAtlas(spriteAtlas) {
		const atlasIndex = searchAtlasList.indexOf(spriteAtlas);
		if (atlasIndex >= 0) {
			searchAtlasList.splice(atlasIndex, 1);
		}
	}

	//==============================================================================
	// 찾을 아틀라스 모두 빼기. (정적)
	//==============================================================================
	static clearSearchAtlases() {
		searchAtlasList.length = 0;
	}

	//==============================================================================
	// 찾을 아틀라스들에서 조각 찾기. (정적, 넣은 차례로, 없으면 null)
	//==============================================================================
	/**
	 * @param { string } frameName
	 * @returns { Frame | null }
	 */
	static findFrame(frameName) {
		for (const spriteAtlas of searchAtlasList) {
			const frame = spriteAtlas.readFrame(frameName);
			if (frame !== null) {
				return frame;
			}
		}
		return null;
	}

	//==============================================================================
	// 찾을 아틀라스들에서 찾은 조각을 스프라이트에 걸기. (정적, 없으면 그림을 비우고 false)
	//==============================================================================
	/**
	 * @param { Sprite } sprite
	 * @param { string } frameName
	 * @returns { boolean }
	 */
	static applySearchFrame(sprite, frameName) {
		const frame = SpriteAtlas.findFrame(frameName);
		sprite.setFrame(frame);
		return frame !== null;
	}
}
