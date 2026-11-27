//==============================================================================
// 포함 모듈 목록.
//==============================================================================
const System = globalThis;
import { Vector2 } from "../base/vector2.js";
import { Asset, AssetType } from "../core/asset.js";
import { DecodedImageStore } from "../core/graphic/decodedimagestore.js";


//==============================================================================
// 이미지 애셋.
// - 읽을 때 파일 바이트를 받아 그림 요소와, 주 스레드 밖에서 푼 ImageBitmap 을 함께 짓는다. (createImageBitmap)
//   그래서 처음 그릴 때 texImage2D 가 주 스레드에서 그림을 다시 풀지 않는다. (풀린 그림은 처음 올린 뒤 닫는다)
//   ImageBitmap 결과가 그림 요소를 올린 결과와 화소까지 같은 꼴만 미리 푼다. (DecodedImageStore)
// - 읽은 그림은 씬을 불러오는 동안(로딩 화면) SceneManager 가 GPU 에 올린다. (Graphic.prepareLoadedImages)
// - 바이트를 받지 못하면(file:// 주소, CORS 없는 다른 출처) 예전처럼 그림 요소에 주소를 바로 넣는다.
//   그때 getImage().src 는 그 주소이고, 바이트를 받았으면 blob: 주소다. (애셋 경로는 getAssetPath)
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

		// 바이트를 받아 그림 요소와 미리 푼 그림을 함께 짓는다.
		let response = null;
		try {
			response = await System.fetch(assetPath);
		}
		catch (error) {
			response = null;
		}
		if (response !== null) {
			if (!response.ok) {
				throw new Error(`Load fail: ${assetPath}`);
			}
			const blob = await response.blob();
			await this.loadFromBlob(assetPath, blob);
			this.setLoaded(true);
			return;
		}

		// 받지 못하면(fetch 가 던지면) 그림 요소에 주소를 바로 넣는다. (실패 알림은 그림 요소가 낸다)
		DecodedImageStore.release(this.image);
		this.image = new System.window.Image();
		this.image.src = assetPath;

		// 불러오기.
		await new Promise((resolve, reject) => {
			this.image.onload = () => {
				DecodedImageStore.register(this.image, null);
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
		await this.loadFromBlob(assetPath, blob);
		this.setLoaded(true);
	}

	//==============================================================================
	// Blob 으로 그림 요소와 미리 푼 그림 짓기. (load, loadFromBytes 가 같이 쓴다, 읽힘 표시는 부른 쪽이 한다)
	// - 그림 요소는 blob: 주소로 읽고, 같은 바이트를 createImageBitmap 으로 함께 푼다.
	// - 다 되면 그림 요소를 아직 올리지 않은 그림으로 맡긴다. (미리 풀지 않은 꼴이면 미리 푼 그림 없이)
	//==============================================================================
	/**
	 * @private
	 * @param { string } assetPath 실패 알림에 쓸 이름.
	 * @param { Blob } blob 그림 파일의 바이트.
	 * @returns { Promise<void> } 그림이 다 풀리면 풀리는 프로미스. (그림 요소가 풀지 못하면 거부된다)
	 */
	async loadFromBlob(assetPath, blob) {
		DecodedImageStore.release(this.image);
		const objectUrl = System.URL.createObjectURL(blob);
		const image = new System.window.Image();
		this.image = image;
		const decodePromise = DecodedImageStore.decode(blob);
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
		}
		catch (error) {
			const imageBitmap = await decodePromise;
			if (imageBitmap !== null) {
				imageBitmap.close();
			}
			throw error;
		}
		finally {
			System.URL.revokeObjectURL(objectUrl);
		}
		let imageBitmap = await decodePromise;
		// 그림 요소와 크기가 다르면(EXIF 방향 같은 것을 달리 읽었으면) 쓰지 않는다.
		if (imageBitmap !== null && (imageBitmap.width !== image.width || imageBitmap.height !== image.height)) {
			imageBitmap.close();
			imageBitmap = null;
		}
		// 읽는 동안 다른 그림으로 바뀌었으면 맡기지 않는다.
		if (this.image !== image) {
			if (imageBitmap !== null) {
				imageBitmap.close();
			}
			return;
		}
		DecodedImageStore.register(image, imageBitmap);
	}

	//==============================================================================
	// 애셋 언로드. (아직 올리지 않은 미리 푼 그림이 있으면 닫는다)
	//==============================================================================
	/**
	 * @override
	 */
	unload() {
		DecodedImageStore.release(this.image);
		super.unload();
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