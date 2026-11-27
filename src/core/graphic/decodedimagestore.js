//==============================================================================
// 포함 모듈 목록.
//==============================================================================
const System = globalThis;


//==============================================================================
// 상수 목록.
//==============================================================================
// 그림 머리를 볼 때 읽는 바이트 수. (PNG 는 이 안에서 IDAT 를 못 만나면 미리 풀지 않는다)
const HEADER_BYTE_COUNT = 262144;
// 미리 푼 그림을 ImageBitmap 으로 지을 때의 옵션. (ImageTextureCache 가 그림 요소를 올릴 때와 같은 설정)
// - 알파는 미리 곱한다. (UNPACK_PREMULTIPLY_ALPHA_WEBGL 참과 같다)
// - 색 프로필은 브라우저 기본대로 sRGB 로 바꾼다. (UNPACK_COLORSPACE_CONVERSION_WEBGL 기본 BROWSER_DEFAULT_WEBGL 과 같다)
// - 위아래는 뒤집지 않고 EXIF 방향은 따른다. (UNPACK_FLIP_Y_WEBGL 거짓, 그림 요소의 image-orientation 기본 from-image 와 같다)
const IMAGE_BITMAP_OPTIONS = { premultiplyAlpha: "premultiply", colorSpaceConversion: "default", imageOrientation: "from-image" };


//==============================================================================
// 미리 푼 그림 보관소.
// - ImageAsset 이 그림을 읽을 때 createImageBitmap 으로 주 스레드 밖에서 풀어 둔 것을 그림 요소에 맞춰 맡는다.
//   (크롬은 Blob 을 일꾼 스레드에서 푼다. 그림 요소를 texImage2D 로 올리면 그 자리에서 주 스레드가 다시 푼다)
// - ImageTextureCache 가 그 그림을 처음 올릴 때 꺼내 올리고 닫는다. (CPU 쪽 사본은 올린 뒤 버린다, 유니티의 읽지 않는 텍스처와 같다)
// - 읽었지만 아직 어느 Graphic 도 올리지 않은 그림을 모아 둔다. (씬 로딩 화면 동안 Graphic.prepareLoadedImages 가 올린다)
// - 맡길 때 주인(그림을 쓸 Graphic 의 WebGL 컨텍스트)을 적는다. 주인은 그림을 읽기 시작할 때 씬을 불러오던 Graphic 이다. (SceneManager 가 beginLoading, endLoading 으로 알린다)
//   Graphic 은 제 것만 미리 올리고, 남의 것은 꺼내지 않는다. (엔진이 둘이면 남의 그림을 제 컨텍스트에 올리고 비트맵을 닫아 버리던 것)
//   주인을 모르면(씬 불러오기 밖에서 읽었거나 두 엔진이 같이 불러오던 때) Graphic 이 하나뿐일 때만 미리 올리고, 그릴 때는 먼저 그린 쪽이 꺼낸다.
// - ImageBitmap 결과가 그림 요소를 올린 결과와 화소까지 같은 그림만 미리 푼다. (크롬 158 원문과 실험)
//   크롬은 ImageBitmap 을 미리 곱한 알파로 푼 뒤 색을 바꾸고, texImage2D 는 곱하지 않은 채 풀어 색을 바꾼 뒤 곱한다.
//   그래서 알파가 있으면서 sRGB 가 아닌 색 조각(iCCP, gAMA, cHRM, cICP)이 있는 PNG, 16 비트 PNG,
//   알파나 움직임이 있는 WebP(libwebp 의 곱하기 반올림이 다르다), 그 밖의 꼴(GIF, AVIF, SVG 같은)은 풀지 않고 그림 요소를 그대로 올린다.
//   (그래도 로딩 화면 동안 올리므로 첫 그리기 프레임에 몰리지 않는다)
//==============================================================================
export class DecodedImageStore {
	//==============================================================================
	// 멤버 변수 목록.
	//==============================================================================
	/** @private @type { WeakMap<object, ImageBitmap | null> } */ static #decodedImageMap = new WeakMap(); // 그림 요소 → 미리 푼 그림. (null 이면 미리 풀지 않은 그림, 둘 다 아직 올리지 않은 것)
	/** @private @type { Array<WeakRef<object>> } */ static #pendingImageReferenceList = []; // 아직 올리지 않은 그림 요소. (약한 참조라 버린 그림은 함께 수거된다)
	/** @private @type { number } */ static #compactionLength = 64; // 이만큼 쌓이면 수거된 참조와 올린 그림을 걸러 낸다.
	/** @private @type { WeakMap<object, object | null> } */ static #ownerMap = new WeakMap(); // 그림 요소 → 주인 WebGL 컨텍스트. (null 이면 주인을 모른다)
	/** @private @type { Array<object> } */ static #loadingOwnerList = []; // 지금 씬을 불러오는 주인. (불러오기마다 하나, 같은 주인이 겹칠 수 있다)
	/** @private @type { Array<WeakRef<object>> } */ static #ownerReferenceList = []; // 그림을 올릴 수 있는 주인. (Graphic 이 지어질 때 알린다)

	//==============================================================================
	// 그림 바이트를 ImageBitmap 으로 풀기. (그림 요소를 올린 결과와 같게 풀 수 있는 꼴만, 아니면 null)
	// - createImageBitmap 이 없거나 풀지 못하면 null 이다. (그러면 그림 요소를 그대로 올린다)
	//==============================================================================
	/**
	 * @param { Blob } blob 그림 파일의 바이트.
	 * @returns { Promise<ImageBitmap | null> } 미리 곱한 알파, sRGB 로 푼 그림. (같게 풀 수 없는 꼴이거나 풀지 못하면 null)
	 */
	static async decode(blob) {
		if (typeof System.createImageBitmap !== "function" || !(blob instanceof System.Blob)) {
			return null;
		}
		try {
			const headerBuffer = await blob.slice(0, HEADER_BYTE_COUNT).arrayBuffer();
			const isExactlyDecodable = DecodedImageStore.isExactlyDecodable(new System.Uint8Array(headerBuffer));
			if (!isExactlyDecodable) {
				return null;
			}
			return await System.createImageBitmap(blob, IMAGE_BITMAP_OPTIONS);
		}
		catch (error) {
			return null;
		}
	}

	//==============================================================================
	// ImageBitmap 으로 풀어도 그림 요소를 올린 결과와 화소까지 같은 꼴인지 보기. (파일 머리만 본다)
	// - JPEG 는 알파가 없어 곱하는 차례가 결과를 바꾸지 않는다.
	// - PNG 는 8 비트 이하이고, 알파가 없거나 색 조각이 없거나 sRGB 조각만 있을 때. (iCCP 는 sRGB 프로필이어도 보지 않고 뺀다)
	// - WebP 는 알파와 움직임이 없을 때. (VP8 은 늘, VP8L 은 알파 표시가 0 일 때, VP8X 는 알파와 움직임 표시가 없을 때)
	//==============================================================================
	/**
	 * @param { Uint8Array } bytes 그림 파일의 앞 바이트.
	 * @returns { boolean } 같게 풀 수 있으면 true.
	 */
	static isExactlyDecodable(bytes) {
		const byteCount = bytes.length;
		if (byteCount >= 3 && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) {
			return true;
		}
		const pngSignature = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a];
		if (byteCount >= 8 && pngSignature.every((value, index) => bytes[index] === value)) {
			return DecodedImageStore.isExactlyDecodablePng(bytes);
		}
		const readText = (offset) => {
			return System.String.fromCharCode(bytes[offset], bytes[offset + 1], bytes[offset + 2], bytes[offset + 3]);
		};
		if (byteCount >= 30 && readText(0) === "RIFF" && readText(8) === "WEBP") {
			const chunkType = readText(12);
			if (chunkType === "VP8 ") {
				return true;
			}
			if (chunkType === "VP8L") {
				// 서명 0x2f 뒤 32 비트(작은 끝): 너비 14, 높이 14, 알파 표시 1, 판 3.
				const isAlphaUsed = (bytes[24] & 0x10) !== 0;
				return bytes[20] === 0x2f && !isAlphaUsed;
			}
			if (chunkType === "VP8X") {
				const flags = bytes[20];
				const isAlphaUsed = (flags & 0x10) !== 0;
				const isAnimated = (flags & 0x02) !== 0;
				return !isAlphaUsed && !isAnimated;
			}
		}
		return false;
	}

	//==============================================================================
	// PNG 머리 보기. (IHDR 부터 IDAT 까지의 조각)
	//==============================================================================
	/**
	 * @param { Uint8Array } bytes PNG 파일의 앞 바이트.
	 * @returns { boolean } 같게 풀 수 있으면 true.
	 */
	static isExactlyDecodablePng(bytes) {
		const byteCount = bytes.length;
		const readUint32 = (offset) => {
			return ((bytes[offset] << 24) >>> 0) + (bytes[offset + 1] << 16) + (bytes[offset + 2] << 8) + bytes[offset + 3];
		};
		const readText = (offset) => {
			return System.String.fromCharCode(bytes[offset], bytes[offset + 1], bytes[offset + 2], bytes[offset + 3]);
		};
		let bitDepth = 0;
		let colorType = 0;
		let hasTransparencyChunk = false;
		let hasSrgbChunk = false;
		let hasIccChunk = false;
		let hasColorChunk = false;
		let offset = 8;
		while (offset + 8 <= byteCount) {
			const chunkLength = readUint32(offset);
			const chunkType = readText(offset + 4);
			const dataOffset = offset + 8;
			if (chunkType === "IHDR") {
				if (dataOffset + 10 > byteCount) {
					return false;
				}
				bitDepth = bytes[dataOffset + 8];
				colorType = bytes[dataOffset + 9];
			}
			else if (chunkType === "IDAT") {
				if (bitDepth === 0 || bitDepth > 8) {
					return false;
				}
				const hasAlpha = colorType === 4 || colorType === 6 || hasTransparencyChunk;
				if (!hasAlpha) {
					return true;
				}
				if (hasIccChunk) {
					return false;
				}
				return hasSrgbChunk || !hasColorChunk;
			}
			else if (chunkType === "tRNS") {
				hasTransparencyChunk = true;
			}
			else if (chunkType === "sRGB") {
				hasSrgbChunk = true;
			}
			else if (chunkType === "iCCP") {
				hasIccChunk = true;
			}
			else if (chunkType === "gAMA" || chunkType === "cHRM" || chunkType === "cICP") {
				hasColorChunk = true;
			}
			offset = dataOffset + chunkLength + 4;
		}
		return false;
	}

	//==============================================================================
	// 읽은 그림 맡기기. (아직 올리지 않은 그림으로 모은다, 미리 푼 그림이 없으면 null)
	//==============================================================================
	/**
	 * @param { object } image 그림 요소. (ImageAsset 의 HTMLImageElement)
	 * @param { ImageBitmap | null } imageBitmap 미리 푼 그림. (없으면 null)
	 * @param { object | null } owner 주인 WebGL 컨텍스트. (getLoadingOwner 로 읽기 시작할 때 받아 둔 것, 모르면 null)
	 */
	static register(image, imageBitmap, owner = null) {
		DecodedImageStore.release(image);
		DecodedImageStore.#decodedImageMap.set(image, imageBitmap);
		DecodedImageStore.#ownerMap.set(image, owner);
		const pendingImageReferenceList = DecodedImageStore.#pendingImageReferenceList;
		pendingImageReferenceList.push(new System.WeakRef(image));
		if (pendingImageReferenceList.length >= DecodedImageStore.#compactionLength) {
			DecodedImageStore.compact();
			DecodedImageStore.#compactionLength = System.Math.max(64, pendingImageReferenceList.length * 2);
		}
	}

	//==============================================================================
	// 그림이 아직 올리지 않은 것인지.
	//==============================================================================
	/**
	 * @param { object } image 그림 요소.
	 * @returns { boolean } 맡겨 두고 아직 꺼내지 않았으면 true.
	 */
	static isPending(image) {
		return DecodedImageStore.#decodedImageMap.has(image);
	}

	//==============================================================================
	// 미리 푼 그림 꺼내기. (꺼내면 보관소에서 빠진다, 받은 쪽이 올린 뒤 닫는다)
	//==============================================================================
	/**
	 * @param { object } image 그림 요소.
	 * @param { object | null } owner 꺼내는 쪽의 WebGL 컨텍스트. (주인이 적힌 그림은 주인만 꺼낸다, null 이면 가리지 않는다)
	 * @returns { ImageBitmap | null } 미리 푼 그림. (없거나 이미 꺼냈거나 남의 것이면 null)
	 */
	static take(image, owner = null) {
		const decodedImageMap = DecodedImageStore.#decodedImageMap;
		if (!decodedImageMap.has(image)) {
			return null;
		}
		const imageOwner = DecodedImageStore.#ownerMap.get(image) ?? null;
		if (owner !== null && imageOwner !== null && imageOwner !== owner) {
			return null;
		}
		const imageBitmap = decodedImageMap.get(image);
		decodedImageMap.delete(image);
		return imageBitmap;
	}

	//==============================================================================
	// 맡긴 그림 놓기. (미리 푼 그림이 있으면 닫는다, ImageAsset 을 내리거나 다른 그림으로 바꿀 때)
	//==============================================================================
	/**
	 * @param { object } image 그림 요소.
	 */
	static release(image) {
		const imageBitmap = DecodedImageStore.take(image);
		if (imageBitmap !== null) {
			imageBitmap.close();
		}
	}

	//==============================================================================
	// 아직 올리지 않은 그림 목록. (맡긴 차례)
	// - 주인을 주면 그 주인의 것만 준다. 주인을 모르는 그림은 알려진 주인이 하나뿐일 때만 넣는다.
	//==============================================================================
	/**
	 * @param { object | null } owner 올릴 쪽의 WebGL 컨텍스트. (null 이면 모두)
	 * @returns { Array<object> } 그림 요소 목록.
	 */
	static getPendingImageList(owner = null) {
		DecodedImageStore.compact();
		const ownerMap = DecodedImageStore.#ownerMap;
		const isUnknownOwnerIncluded = owner === null || DecodedImageStore.getOwnerCount() <= 1;
		const pendingImageList = [];
		for (const imageReference of DecodedImageStore.#pendingImageReferenceList) {
			const image = imageReference.deref();
			const imageOwner = ownerMap.get(image) ?? null;
			if (owner === null || imageOwner === owner || (imageOwner === null && isUnknownOwnerIncluded)) {
				pendingImageList.push(image);
			}
		}
		return pendingImageList;
	}

	//==============================================================================
	// 그림을 올릴 수 있는 주인 알리기. (Graphic 이 지어질 때 제 WebGL 컨텍스트로 부른다)
	//==============================================================================
	/**
	 * @param { object } owner WebGL 컨텍스트.
	 */
	static addOwner(owner) {
		const ownerReferenceList = DecodedImageStore.#ownerReferenceList.filter((ownerReference) => ownerReference.deref() !== undefined);
		if (!ownerReferenceList.some((ownerReference) => ownerReference.deref() === owner)) {
			ownerReferenceList.push(new System.WeakRef(owner));
		}
		DecodedImageStore.#ownerReferenceList = ownerReferenceList;
	}

	//==============================================================================
	// 알려진 주인 수. (수거된 것은 세지 않는다)
	//==============================================================================
	/**
	 * @returns { number }
	 */
	static getOwnerCount() {
		let ownerCount = 0;
		for (const ownerReference of DecodedImageStore.#ownerReferenceList) {
			if (ownerReference.deref() !== undefined) {
				ownerCount += 1;
			}
		}
		return ownerCount;
	}

	//==============================================================================
	// 씬 불러오기 시작과 끝 알리기. (SceneManager 가 씬의 load 앞뒤로 부른다, 그 사이에 읽기 시작한 그림의 주인이 된다)
	//==============================================================================
	/**
	 * @param { object } owner 불러오는 Graphic 의 WebGL 컨텍스트.
	 */
	static beginLoading(owner) {
		DecodedImageStore.#loadingOwnerList.push(owner);
	}

	/**
	 * @param { object } owner beginLoading 에 준 것.
	 */
	static endLoading(owner) {
		const loadingOwnerList = DecodedImageStore.#loadingOwnerList;
		const ownerIndex = loadingOwnerList.indexOf(owner);
		if (ownerIndex >= 0) {
			loadingOwnerList.splice(ownerIndex, 1);
		}
	}

	//==============================================================================
	// 지금 읽기 시작하는 그림의 주인. (씬을 불러오는 주인이 하나면 그 주인, 없거나 둘 이상이면 모른다)
	//==============================================================================
	/**
	 * @returns { object | null } WebGL 컨텍스트. (모르면 null)
	 */
	static getLoadingOwner() {
		const loadingOwnerList = DecodedImageStore.#loadingOwnerList;
		if (loadingOwnerList.length === 0) {
			return null;
		}
		const owner = loadingOwnerList[0];
		return loadingOwnerList.every((loadingOwner) => loadingOwner === owner) ? owner : null;
	}

	//==============================================================================
	// 수거된 참조와 이미 꺼낸 그림, 겹친 참조 걸러 내기. (같은 그림을 다시 맡기면 참조가 겹칠 수 있다)
	//==============================================================================
	static compact() {
		const decodedImageMap = DecodedImageStore.#decodedImageMap;
		const seenImageSet = new System.Set();
		DecodedImageStore.#pendingImageReferenceList = DecodedImageStore.#pendingImageReferenceList.filter((imageReference) => {
			const image = imageReference.deref();
			if (image === undefined || !decodedImageMap.has(image) || seenImageSet.has(image)) {
				return false;
			}
			seenImageSet.add(image);
			return true;
		});
	}
}
