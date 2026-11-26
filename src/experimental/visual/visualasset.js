//==============================================================================
// 포함 모듈 목록.
//==============================================================================
const System = globalThis;
import { Asset, AssetType } from "../../core/asset.js";
import { Visual } from "./visual.js";


//==============================================================================
// 비주얼 애셋. (비주얼 에디터가 저장한 문서 파일을 읽어 Visual 을 만든다)
// - 파일은 비주얼 에디터(tools/visualeditor)가 저장하는 UIDocument JSON 이다. (씬 *.scene.json, 프리팹 *.prefab.json, { version, root, frameSize? })
// - load 가 fetch 로 글을 받아 JSON 객체이고 root 객체가 있는지 보고, 그 글을 든 Visual 을 만들어 담은 뒤 읽힌 것으로 친다.
//   실패 응답(404 등)이나 문서 꼴이 아니면 읽히지 않은 채로 거부된다.
// - 노드 트리는 Visual.createNode 가 짓는다. (부를 때마다 새 트리)
//==============================================================================
/**
 * @example <caption>비주얼 에디터 프리팹 읽어 노드 짓기</caption>
 * import { VisualAsset } from "./build/vanilla.js";
 *
 * const documentData = {
 * 	version: 1,
 * 	root: { type: "WorldNode", name: "Panel", contentSize: [200, 120], components: [], children: [] },
 * };
 * const documentUrl = "data:application/json," + encodeURIComponent(JSON.stringify(documentData));
 * const visualAsset = new VisualAsset();
 * await visualAsset.load(documentUrl);
 * const visual = visualAsset.getVisual();
 * const panelNode = visual.createNode();
 * console.log(visualAsset.getAssetType(), visualAsset.isLoaded(), panelNode.getName());
 */
export class VisualAsset extends Asset {
	//==============================================================================
	// 멤버 변수 목록.
	//==============================================================================
	/** @private @type { Visual } */ #visual;

	//==============================================================================
	// 생성.
	//==============================================================================
	constructor() {
		super();
		this.setAssetType(AssetType.visual);
		this.#visual = null;
	}

	//==============================================================================
	// 비동기 애셋 로드.
	//==============================================================================
	/**
	 * @override
	 * @param { string } assetPath 비주얼 에디터가 저장한 문서 파일 경로. (이미 읽혔으면 아무것도 하지 않는다)
	 * @returns { Promise<void> } 읽어 Visual 을 담으면 풀리는 약속. (실패 응답(404 등)이나 문서 꼴이 아니면 거부된다)
	 */
	async load(assetPath) {

		// 이미 로드 된 상태라면.
		const isLoaded = this.isLoaded();
		if (isLoaded) {
			return System.Promise.resolve();
		}

		try {
			// 로드.
			await super.load(assetPath);
			const response = await System.fetch(assetPath);
			// 실패 응답(404 등)은 받지 못한 것으로 친다.
			if (!response.ok) {
				throw new System.Error(`HTTP ${response.status}`);
			}
			const documentText = await response.text();
			const visual = VisualAsset.createVisualFromText(documentText);
			this.setVisual(visual);
			this.setLoaded(true);
		}
		catch (error) {
			// 예외.
			console.error(`Error loading visual: ${assetPath}`, error);
			throw error;
		}
	}

	//==============================================================================
	// 애셋 언로드. (담은 Visual 도 비운다)
	//==============================================================================
	/**
	 * @override
	 * @returns { Promise<void> | undefined } 로드되지 않았으면 이미 풀린 프로미스, 로드되어 있었으면 undefined.
	 */
	unload() {
		this.setVisual(null);
		return super.unload();
	}

	//==============================================================================
	// 문서 글로 Visual 만들기. (정적)
	//==============================================================================
	/**
	 * @param { string } documentText 비주얼 에디터가 저장한 UIDocument JSON 글.
	 * @returns { Visual } 그 글을 든 Visual. (JSON 객체가 아니거나 root 객체가 없으면 예외를 던진다)
	 * @example <caption>문서 글에서 바로 만들기</caption>
	 * import { VisualAsset } from "./build/vanilla.js";
	 *
	 * const documentText = JSON.stringify({ version: 1, root: { type: "WorldNode", name: "Icon", components: [], children: [] } });
	 * const visual = VisualAsset.createVisualFromText(documentText);
	 * const iconNode = visual.createNode();
	 * console.log(iconNode.getName());
	 */
	static createVisualFromText(documentText) {
		const documentData = System.JSON.parse(documentText);
		const isDocumentObject = documentData !== null && typeof documentData === "object" && !System.Array.isArray(documentData);
		if (!isDocumentObject || documentData.root === null || typeof documentData.root !== "object" || System.Array.isArray(documentData.root)) {
			throw new System.Error("VisualAsset: invalid document.");
		}
		const visual = new Visual();
		visual.setDocumentText(documentText);
		return visual;
	}

	//==============================================================================
	// 비주얼 설정.
	//==============================================================================
	/**
	 * @param { Visual | null } visual 담을 비주얼. (null 이면 비운다, 읽힌 상태는 바꾸지 않는다)
	 */
	setVisual(visual) {
		this.#visual = visual;
	}

	//==============================================================================
	// 비주얼 반환. (없으면 null)
	//==============================================================================
	/**
	 * @returns { Visual | null } 담긴 비주얼. (load 가 읽은 문서를 든 것이거나 setVisual 로 넣은 것)
	 */
	getVisual() {
		return this.#visual;
	}
}
