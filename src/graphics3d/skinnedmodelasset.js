//==============================================================================
// 포함 모듈 목록.
//==============================================================================
const System = globalThis;
import { Object } from "../base/object.js";


//==============================================================================
// 전역 변수 목록.
//==============================================================================
// 자산 캐시. (셰이더 프로그램 → 자산 키 → 자산, 버텍스 어레이의 어트리뷰트 자리가 셰이더마다 달라 셰이더별로 따로 든다)
const assetCacheTable = new System.Map();


//==============================================================================
// 스킨드 모델 자산. (같은 파일에서 지은 모델 인스턴스들이 나눠 쓰는 풀린 자료와 GPU 자원)
// - 메시 버퍼와 버텍스 어레이, 머티리얼 원형과 그 텍스처, 모프 텍스처, 노드와 스킨 원형, 애니메이션 클립을 한 벌만 든다.
//   (유니티의 메시와 sharedMaterial, three.js 의 BufferGeometry 와 Material 을 복제본들이 나눠 쓰는 것과 같다)
// - 인스턴스(SkinnedModel)는 이것을 참조 수로 나눠 쓴다. 인스턴스마다 따로 갖는 것은 포즈, 애니메이션 재생 상태, 모프 가중치,
//   갈라진 머티리얼(getMaterial), 와이어프레임 버퍼, addMorphTarget 으로 갈라진 모프 텍스처다.
// - 마지막 인스턴스가 destroy 하면(참조 수 0) GPU 자원을 지우고 캐시에서 빠진다.
// - 캐시는 셰이더 프로그램과 자산 키(normalizeKey 로 정규화한 주소나 자산 이름)로 찾는다. SkinnedModel.loadFromUrl 같은 받기가 이것을 쓴다.
//==============================================================================
/**
 * @example <caption>같은 GLB 를 두 번 받으면 자산 하나를 나눠 쓴다</caption>
 * import { SkinnedModel, SkinnedModelAsset, SkinnedModelRenderer } from "./build/vanilla.js";
 *
 * const canvas = document.createElement("canvas");
 * const webGL2RenderingContext = canvas.getContext("webgl2");
 * const skinnedModelRenderer = new SkinnedModelRenderer(webGL2RenderingContext);
 * const firstModel = await SkinnedModel.loadFromUrl(webGL2RenderingContext, "examples/ancientmountain/assets/fox.glb", skinnedModelRenderer);
 * const secondModel = await SkinnedModel.loadFromUrl(webGL2RenderingContext, "./examples/ancientmountain/assets/fox.glb", skinnedModelRenderer);
 * const skinnedModelAsset = firstModel.getAsset();
 * console.log(skinnedModelAsset === secondModel.getAsset(), skinnedModelAsset.getReferenceCount(), skinnedModelAsset.getKey());
 * firstModel.destroy();
 * secondModel.destroy();
 * console.log(skinnedModelAsset.getReferenceCount(), skinnedModelAsset.isDestroyed(), SkinnedModelAsset.getCachedCount());
 */
export class SkinnedModelAsset extends Object {
	//==============================================================================
	// 멤버 변수 목록.
	//==============================================================================
	/** @private @type { WebGL2RenderingContext } */ #webGL2RenderingContext;
	/** @private @type { ShaderProgram } */ #shaderProgram;
	/** @private @type { string | null } */ #key;
	/** @private @type { number } */ #referenceCount;
	/** @private @type { boolean } */ #isDestroyed;
	/** @private @type { object[] } */ #drawableList;
	/** @private @type { Material[] } */ #materialList;
	/** @private @type { object[] } */ #nodeList;
	/** @private @type { number[] } */ #rootNodeIndices;
	/** @private @type { object[] } */ #skinList;
	/** @private @type { object[] } */ #animationList;
	/** @private @type { number } */ #bufferByteCount;

	//==============================================================================
	// 생성. (SkinnedModel.uploadMeshesAndMaterials 가 올린 뒤 짓는다, 참조 수 1)
	//==============================================================================
	/**
	 * @constructor
	 * @param { WebGL2RenderingContext } webGL2RenderingContext 자원을 지은 렌더링 컨텍스트.
	 * @param { ShaderProgram } shaderProgram 버텍스 어레이와 머티리얼이 쓰는 셰이더 프로그램.
	 * @param { object } content 나눠 쓸 자료. ({ drawableList, materialList, nodeList, rootNodeIndices, skinList, animationList, bufferByteCount }, 드로어블은 원형으로 두고 인스턴스가 베낀다)
	 */
	constructor(webGL2RenderingContext, shaderProgram, content) {
		super();

		this.#webGL2RenderingContext = webGL2RenderingContext;
		this.#shaderProgram = shaderProgram;
		this.#key = null;
		this.#referenceCount = 1;
		this.#isDestroyed = false;
		this.#drawableList = content.drawableList;
		this.#materialList = content.materialList;
		this.#nodeList = content.nodeList;
		this.#rootNodeIndices = content.rootNodeIndices;
		this.#skinList = content.skinList;
		this.#animationList = content.animationList;
		this.#bufferByteCount = content.bufferByteCount;
	}

	//==============================================================================
	// 자산 키 정규화. (정적, 역슬래시를 / 로, "." 과 ".." 마디를 풀고 빈 마디를 줄인다, 앞의 "주소틀://" 과 뒤의 ?, # 은 그대로)
	// - 같은 파일을 "./a/b.glb", "a/c/../b.glb" 처럼 다르게 적어도 같은 키가 되게 한다. 기준 주소로 절대 주소를 만들지는 않는다.
	//==============================================================================
	/**
	 * @param { string } path 자산 주소나 이름.
	 * @returns { string } 정규화한 키.
	 * @example <caption>다르게 적은 같은 경로</caption>
	 * import { SkinnedModelAsset } from "./build/vanilla.js";
	 *
	 * console.log(SkinnedModelAsset.normalizeKey("./assets/models/../fox.glb"));
	 * console.log(SkinnedModelAsset.normalizeKey("assets\\fox.glb"));
	 * console.log(SkinnedModelAsset.normalizeKey("https://example.com/a/./b/../fox.glb?v=2"));
	 */
	static normalizeKey(path) {
		let text = path.replace(/\\/g, "/");
		let suffix = "";
		const suffixIndex = text.search(/[?#]/);
		if (suffixIndex >= 0) {
			suffix = text.substring(suffixIndex);
			text = text.substring(0, suffixIndex);
		}
		let prefix = "";
		const schemeMatch = /^[A-Za-z][A-Za-z0-9+.-]*:\/\/[^/]*/.exec(text);
		if (schemeMatch) {
			prefix = schemeMatch[0];
			text = text.substring(prefix.length);
		}
		else if (text.startsWith("/")) {
			prefix = "/";
		}
		const segmentList = [];
		for (const segment of text.split("/")) {
			if (segment === "" || segment === ".") {
				continue;
			}
			if (segment === ".." && segmentList.length > 0 && segmentList[segmentList.length - 1] !== "..") {
				segmentList.pop();
				continue;
			}
			segmentList.push(segment);
		}
		const joinedPath = segmentList.join("/");
		if (prefix !== "" && prefix !== "/" && joinedPath !== "") {
			return prefix + "/" + joinedPath + suffix;
		}
		return prefix + joinedPath + suffix;
	}

	//==============================================================================
	// 캐시에서 찾기. (정적, 셰이더 프로그램과 키가 같고 살아 있는 자산)
	//==============================================================================
	/**
	 * @param { string } assetKey 자산 키. (normalizeKey 로 정규화한다)
	 * @param { ShaderProgram } shaderProgram 모델을 그릴 셰이더 프로그램. (렌더러의 getShaderProgram)
	 * @returns { SkinnedModelAsset | null } 찾은 자산. (없으면 null)
	 */
	static find(assetKey, shaderProgram) {
		const assetTable = assetCacheTable.get(shaderProgram);
		if (!assetTable) {
			return null;
		}
		const asset = assetTable.get(SkinnedModelAsset.normalizeKey(assetKey));
		return asset ? asset : null;
	}

	//==============================================================================
	// 캐시에 넣기. (정적, 자산에 키를 붙인다. 같은 자리에 있던 자산은 캐시에서만 빠지고 쓰던 인스턴스는 그대로 쓴다)
	//==============================================================================
	/**
	 * @param { string } assetKey 자산 키. (normalizeKey 로 정규화한다)
	 * @param { SkinnedModelAsset } asset 넣을 자산. (지워진 자산이면 오류를 던진다)
	 * @example <caption>번들에서 꺼낸 바이트로 지은 모델을 이름으로 나눠 쓰기</caption>
	 * import { SkinnedModel, SkinnedModelAsset, SkinnedModelRenderer } from "./build/vanilla.js";
	 *
	 * const canvas = document.createElement("canvas");
	 * const webGL2RenderingContext = canvas.getContext("webgl2");
	 * const skinnedModelRenderer = new SkinnedModelRenderer(webGL2RenderingContext);
	 * const response = await fetch("examples/ancientmountain/assets/fox.glb");
	 * const arrayBuffer = await response.arrayBuffer();
	 * const skinnedModel = await SkinnedModel.loadFromBytes(webGL2RenderingContext, arrayBuffer, skinnedModelRenderer);
	 * SkinnedModelAsset.register("fox", skinnedModel.getAsset());
	 * const shaderProgram = skinnedModelRenderer.getShaderProgram();
	 * const foundAsset = SkinnedModelAsset.find("fox", shaderProgram);
	 * const otherModel = SkinnedModel.createFromAsset(foundAsset);
	 * console.log(foundAsset.getReferenceCount(), otherModel.getDrawableList().length);
	 * otherModel.destroy();
	 * skinnedModel.destroy();
	 */
	static register(assetKey, asset) {
		if (asset.isDestroyed()) {
			throw new Error("SkinnedModelAsset: destroyed asset cannot be registered.");
		}
		const normalizedKey = SkinnedModelAsset.normalizeKey(assetKey);
		const shaderProgram = asset.getShaderProgram();
		let assetTable = assetCacheTable.get(shaderProgram);
		if (!assetTable) {
			assetTable = new System.Map();
			assetCacheTable.set(shaderProgram, assetTable);
		}
		const previousAsset = assetTable.get(normalizedKey);
		if (previousAsset && previousAsset !== asset) {
			previousAsset.#key = null;
		}
		if (asset.#key !== null && asset.#key !== normalizedKey) {
			asset.#removeFromCache();
		}
		asset.#key = normalizedKey;
		assetTable.set(normalizedKey, asset);
	}

	//==============================================================================
	// 캐시 비우기. (정적, 모든 자산을 캐시에서 뺀다. 쓰던 인스턴스는 그대로 그리고, 마지막 인스턴스가 destroy 할 때 GPU 자원이 지워진다)
	// - 다음 받기는 파일을 새로 풀어 새 자산을 짓는다.
	//==============================================================================
	/**
	 * @example <caption>판을 바꿀 때 캐시를 비우기</caption>
	 * import { SkinnedModelAsset } from "./build/vanilla.js";
	 *
	 * SkinnedModelAsset.clearCache();
	 * console.log(SkinnedModelAsset.getCachedCount());
	 */
	static clearCache() {
		for (const assetTable of assetCacheTable.values()) {
			for (const asset of assetTable.values()) {
				asset.#key = null;
			}
		}
		assetCacheTable.clear();
	}

	//==============================================================================
	// 캐시에 든 자산 수. (정적, 모든 셰이더 프로그램 합)
	//==============================================================================
	/**
	 * @returns { number } 캐시에 든 자산 수.
	 */
	static getCachedCount() {
		let cachedCount = 0;
		for (const assetTable of assetCacheTable.values()) {
			cachedCount += assetTable.size;
		}
		return cachedCount;
	}

	//==============================================================================
	// 참조 늘리기. (인스턴스가 자산을 나눠 쓰기 시작할 때, SkinnedModel.createFromAsset 이 부른다)
	//==============================================================================
	/**
	 * @returns { void } (지워진 자산이면 오류를 던진다)
	 */
	retain() {
		if (this.#isDestroyed) {
			throw new Error("SkinnedModelAsset: asset already destroyed.");
		}
		this.#referenceCount += 1;
	}

	//==============================================================================
	// 참조 줄이기. (인스턴스가 destroy 할 때, 0 이 되면 GPU 자원을 지우고 캐시에서 빠진다)
	//==============================================================================
	/**
	 * @returns { boolean } 이번에 자원을 지웠으면 참.
	 */
	release() {
		if (this.#isDestroyed) {
			return false;
		}
		this.#referenceCount -= 1;
		if (this.#referenceCount > 0) {
			return false;
		}
		this.#referenceCount = 0;
		this.#removeFromCache();
		this.#destroyResources();
		return true;
	}

	//==============================================================================
	// 캐시에서 이 자산 빼기. (같은 자리에 다른 자산이 들어 있으면 건드리지 않는다)
	//==============================================================================
	#removeFromCache() {
		if (this.#key === null) {
			return;
		}
		const assetTable = assetCacheTable.get(this.#shaderProgram);
		if (assetTable && assetTable.get(this.#key) === this) {
			assetTable.delete(this.#key);
			if (assetTable.size === 0) {
				assetCacheTable.delete(this.#shaderProgram);
			}
		}
		this.#key = null;
	}

	//==============================================================================
	// GPU 자원 지우기. (원형 드로어블의 버텍스 어레이, 버퍼, 모프 텍스처와 머티리얼 원형의 텍스처)
	//==============================================================================
	#destroyResources() {
		const webGL2RenderingContext = this.#webGL2RenderingContext;
		for (const drawable of this.#drawableList) {
			webGL2RenderingContext.deleteVertexArray(drawable.vertexArray);
			for (const vertexBuffer of drawable.vertexBufferList) {
				webGL2RenderingContext.deleteBuffer(vertexBuffer);
			}
			if (drawable.indexBuffer) {
				webGL2RenderingContext.deleteBuffer(drawable.indexBuffer);
			}
			if (drawable.morphTexture) {
				webGL2RenderingContext.deleteTexture(drawable.morphTexture);
			}
		}
		for (const material of this.#materialList) {
			material.destroy();
		}
		this.#drawableList = [];
		this.#materialList = [];
		this.#isDestroyed = true;
	}

	//==============================================================================
	// 자산 키 반환.
	//==============================================================================
	/**
	 * @returns { string | null } 캐시에 넣은 키. (넣지 않았거나 캐시에서 빠졌으면 null)
	 */
	getKey() {
		return this.#key;
	}

	//==============================================================================
	// 참조 수 반환. (이 자산을 나눠 쓰는 살아 있는 인스턴스 수)
	//==============================================================================
	/**
	 * @returns { number } 참조 수. (지워졌으면 0)
	 */
	getReferenceCount() {
		return this.#referenceCount;
	}

	//==============================================================================
	// 지워졌는지.
	//==============================================================================
	/**
	 * @returns { boolean } 마지막 인스턴스가 destroy 해 GPU 자원을 지웠으면 참.
	 */
	isDestroyed() {
		return this.#isDestroyed;
	}

	//==============================================================================
	// GPU 바이트 수. (정점, 인덱스 버퍼와 모프 텍스처와 머티리얼 원형 텍스처, 밉맵 포함, 인스턴스 수와 상관없이 한 벌)
	//==============================================================================
	/**
	 * @returns { number } 이 자산이 GPU 에 올린 바이트 수. (지워졌으면 0)
	 */
	getGpuByteCount() {
		if (this.#isDestroyed) {
			return 0;
		}
		let gpuByteCount = this.#bufferByteCount;
		for (const material of this.#materialList) {
			gpuByteCount += material.getTextureByteCount();
		}
		return gpuByteCount;
	}

	//==============================================================================
	// 렌더링 컨텍스트 반환.
	//==============================================================================
	/**
	 * @returns { WebGL2RenderingContext } 자원을 지은 렌더링 컨텍스트.
	 */
	getWebGL2RenderingContext() {
		return this.#webGL2RenderingContext;
	}

	//==============================================================================
	// 셰이더 프로그램 반환.
	//==============================================================================
	/**
	 * @returns { ShaderProgram } 버텍스 어레이와 머티리얼이 쓰는 셰이더 프로그램.
	 */
	getShaderProgram() {
		return this.#shaderProgram;
	}

	//==============================================================================
	// 원형 드로어블 목록 반환. (인스턴스는 이것을 베껴 버퍼와 머티리얼 원형을 나눠 쓴다, 바꾸지 않는다)
	//==============================================================================
	/**
	 * @returns { object[] } 원형 드로어블 목록.
	 */
	getDrawableList() {
		return this.#drawableList;
	}

	//==============================================================================
	// 머티리얼 원형 목록 반환. (기본 머티리얼이 마지막, 이 자산이 지었고 마지막 인스턴스가 destroy 할 때 지운다)
	//==============================================================================
	/**
	 * @returns { Material[] } 머티리얼 원형 목록. (sharedMaterial, 값을 바꾸면 이 자산을 쓰는 모든 인스턴스가 바뀐다)
	 */
	getMaterialList() {
		return this.#materialList;
	}

	//==============================================================================
	// 노드 원형 목록 반환. (올릴 때의 노드, 인스턴스는 이것을 베껴 포즈를 따로 든다)
	//==============================================================================
	/**
	 * @returns { object[] } 노드 원형 목록.
	 */
	getNodeList() {
		return this.#nodeList;
	}

	//==============================================================================
	// 루트 노드 목록 반환.
	//==============================================================================
	/**
	 * @returns { number[] } 루트 노드 번호 목록.
	 */
	getRootNodeIndices() {
		return this.#rootNodeIndices;
	}

	//==============================================================================
	// 스킨 원형 목록 반환. (조인트와 역바인드 행렬은 나눠 쓰고, 조인트 행렬 배열은 인스턴스마다 따로)
	//==============================================================================
	/**
	 * @returns { object[] } 스킨 원형 목록.
	 */
	getSkinList() {
		return this.#skinList;
	}

	//==============================================================================
	// 애니메이션 클립 목록 반환. (인스턴스가 모두 같은 목록을 나눠 쓴다, addAnimationsFromFbx* 로 더한 클립도 모두에게 보인다)
	//==============================================================================
	/**
	 * @returns { object[] } 애니메이션 클립 목록.
	 */
	getAnimationList() {
		return this.#animationList;
	}
}
