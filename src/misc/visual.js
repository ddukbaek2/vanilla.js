//==============================================================================
// 포함 모듈 목록.
//==============================================================================
const System = globalThis;
import { Object } from "../base/object.js";
import { Vector2 } from "../base/vector2.js";
import { Component } from "../core/component.js";
import { UIDocument } from "../ui/uidocument.js";


//==============================================================================
// 비주얼 객체. (비주얼 에디터 문서를 정한 자리에 노드 트리로 짓는 컴포넌트)
// - 문서는 비주얼 에디터(tools/visualeditor)가 저장하는 UIDocument JSON 글이다. ({ version, root, frameSize? }, 씬과 프리팹 모두)
//   VisualAsset 이 파일을 읽어 문서를 든 Visual 을 만든다.
// - createNode 가 문서의 노드 트리를 새로 지어 뿌리의 로컬 위치를 location 으로 둔다. (부르는 쪽이 원하는 부모에 붙인다, 부를 때마다 새 트리)
// - 스스로 그리거나 갱신하지 않는다.
//==============================================================================
/**
 * @example <caption>문서를 든 비주얼로 노드 트리 짓기</caption>
 * import { Visual, WorldNode, Vector2 } from "./build/vanilla.js";
 *
 * const documentData = {
 * 	version: 1,
 * 	root: { type: "WorldNode", name: "Badge", position: [300, 200], contentSize: [64, 64], components: [], children: [] },
 * };
 * const visual = new Visual();
 * visual.setDocumentText(JSON.stringify(documentData));
 * visual.setLocation(Vector2.create(40, 20));
 * const parentNode = new WorldNode();
 * const badgeNode = visual.createNode();
 * parentNode.addChild(badgeNode);
 * const localPosition = badgeNode.getLocalPosition();
 * console.log(badgeNode.getName(), localPosition.x, localPosition.y, visual.getComponentType());
 */
export class Visual extends Component {
	//==============================================================================
	// 멤버 변수 목록.
	//==============================================================================
	/** @private @type { Vector2 } */ #location; // 지은 뿌리 노드의 로컬 위치.
	/** @private @type { string | null } */ #documentText; // 비주얼 에디터 문서 글.

	//==============================================================================
	// 생성.
	//==============================================================================
	/**
	 * @constructor
	 */
	constructor() {
		super();
		this.setComponentType("Visual");
		this.#location = Vector2.zero();
		this.#documentText = null;
	}

	//==============================================================================
	// 위치 설정.
	//==============================================================================
	/**
	 * @param { Vector2 } location createNode 가 지은 뿌리 노드에 줄 로컬 위치. (부모 기준, 기본 0)
	 * @example <caption>위치를 정하고 읽기</caption>
	 * import { Visual, Vector2 } from "./build/vanilla.js";
	 *
	 * const visual = new Visual();
	 * visual.setLocation(Vector2.create(120, 80));
	 * const location = visual.getLocation();
	 * console.log(location.x, location.y);
	 */
	setLocation(location) {
		this.#location = location;
	}

	//==============================================================================
	// 위치 반환.
	//==============================================================================
	/**
	 * @returns { Vector2 } 지은 뿌리 노드에 줄 로컬 위치. (복사본이 아니다)
	 */
	getLocation() {
		return this.#location;
	}

	//==============================================================================
	// 문서 글 설정.
	//==============================================================================
	/**
	 * @param { string | null } documentText 비주얼 에디터가 저장한 UIDocument JSON 글. (null 이면 비운다, 읽는 것은 createNode 때)
	 */
	setDocumentText(documentText) {
		this.#documentText = documentText;
	}

	//==============================================================================
	// 문서 글 반환.
	//==============================================================================
	/**
	 * @returns { string | null } 든 문서 글. (없으면 null)
	 */
	getDocumentText() {
		return this.#documentText;
	}

	//==============================================================================
	// 문서로 노드 트리 짓기.
	//==============================================================================
	/**
	 * @returns { WorldNode | null } 새로 지은 뿌리 노드. (어느 부모에도 붙지 않았고 로컬 위치가 location 이다, 문서가 없으면 null, 문서 꼴이 틀리면 예외를 던진다)
	 * @example <caption>같은 문서로 두 벌 짓기</caption>
	 * import { Visual, Vector2 } from "./build/vanilla.js";
	 *
	 * const documentData = {
	 * 	version: 1,
	 * 	root: { type: "WorldNode", name: "Coin", contentSize: [32, 32], components: [], children: [] },
	 * };
	 * const visual = new Visual();
	 * console.log(visual.createNode());
	 * visual.setDocumentText(JSON.stringify(documentData));
	 * const firstNode = visual.createNode();
	 * visual.setLocation(Vector2.create(48, 0));
	 * const secondNode = visual.createNode();
	 * const secondPosition = secondNode.getLocalPosition();
	 * console.log(firstNode !== secondNode, secondNode.getName(), secondPosition.x);
	 */
	createNode() {
		const documentText = this.getDocumentText();
		if (documentText === null) {
			return null;
		}
		const rootNode = UIDocument.fromJsonText(documentText);
		const location = this.getLocation();
		rootNode.setLocalPosition(location.clone());
		return rootNode;
	}
}
