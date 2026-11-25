//==============================================================================
// 포함 모듈 목록.
//==============================================================================
const System = globalThis;
import { Vector2 } from "../base/vector2.js";
import { Asset, AssetType } from "../core/asset.js";


//==============================================================================
// 이미지 애셋.
//==============================================================================
/**
 * @example <caption>그림 파일 읽고 크기 보기</caption>
 * import { ImageAsset } from "./build/vanilla.js";
 *
 * const imageAsset = new ImageAsset();
 * await imageAsset.load("examples/assets/spritesheet.png");
 * const imageSize = imageAsset.getImageSize();
 * console.log(imageSize.x, imageSize.y, imageAsset.isLoaded());
 */
export class ImageAsset extends Asset {
	//==============================================================================
	// 멤버 변수 목록.
	//==============================================================================
	/** @type { HTMLImageElement } */ image = null; // 이미지 요소. (생성할 때 빈 요소를 만들고, 읽을 때마다 새 요소로 바꾼다)


	//==============================================================================
	// 생성.
	//==============================================================================
	constructor() {
		super();
		this.setAssetType(AssetType.image);
		this.image = new System.window.Image();
	}

	//==============================================================================
	// 비동기 애셋 로드.
	//==============================================================================
	/**
	 * @override
	 * @param { string } assetPath 그림 파일 경로. (이미 읽혔으면 아무것도 하지 않는다)
	 * @returns { Promise<void> } 그림이 다 읽히면 풀리는 프로미스. (읽지 못하면 거부된다)
	 */
	async load(assetPath) {

		// 이미 로드 된 상태라면.
		const isLoaded = this.isLoaded();
		if (isLoaded) {
			return Promise.resolve();
		}

		await super.load(assetPath);
		this.image = new System.window.Image();
		this.image.src = assetPath;

		// 불러오기.
		await new Promise((resolve, reject) => {
			this.image.onload = () => {
				this.setLoaded(true);
				resolve();
			};
			this.image.onerror = () => {
				reject(new Error(`Load fail: ${assetPath}`));
			}
		});
	}

	//==============================================================================
	// 이미 가진 바이트로 읽기. (png, jpeg, webp 처럼 브라우저가 푸는 그림, 이미 읽혔어도 새 바이트로 바꾼다)
	// - 풀지 못하면 예외를 낸다. (load 와 같다)
	//==============================================================================
	/**
	 * @param { string } assetPath 실패 알림과 getAssetPath 에 쓸 이름.
	 * @param { ArrayBuffer | ArrayBufferView | Blob } bytes 그림 파일의 바이트. (Blob 이면 그대로 쓰고, 아니면 Blob 으로 감싼다)
	 * @returns { Promise<void> } 그림이 다 풀리면 풀리는 프로미스. (풀지 못하면 거부된다)
	 * @example <caption>받아 둔 바이트로 그림 읽기</caption>
	 * import { ImageAsset } from "./build/vanilla.js";
	 *
	 * const response = await fetch("assets/icons/icon.png");
	 * const bytes = await response.arrayBuffer();
	 * const imageAsset = new ImageAsset();
	 * await imageAsset.loadFromBytes("icon.png", bytes);
	 * const imageSize = imageAsset.getImageSize();
	 * console.log(imageAsset.getAssetPath(), imageSize.x, imageSize.y);
	 */
	async loadFromBytes(assetPath, bytes) {
		this.setLoaded(false);
		this.setAssetPath(assetPath);
		const blob = bytes instanceof System.Blob ? bytes : new System.Blob([bytes]);
		const objectUrl = System.URL.createObjectURL(blob);
		const image = new System.window.Image();
		this.image = image;
		try {
			await new Promise((resolve, reject) => {
				image.onload = () => {
					resolve();
				};
				image.onerror = () => {
					reject(new Error(`Load fail: ${assetPath}`));
				};
				image.src = objectUrl;
			});
			this.setLoaded(true);
		}
		finally {
			System.URL.revokeObjectURL(objectUrl);
		}
	}

	//==============================================================================
	// 이미지 반환.
	//==============================================================================
	/**
	 * @returns { HTMLImageElement } 이미지 요소.
	 */
	getImage() {
		return this.image;
	}

	//==============================================================================
	// 이미지 크기 반환.
	//==============================================================================
	/**
	 * @returns { Vector2 } 이미지 크기. (픽셀, 읽기 전이면 0, 0)
	 */
	getImageSize() {
		return Vector2.create(this.image.width, this.image.height);
	}
}