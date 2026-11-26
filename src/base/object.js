//==============================================================================
// 포함 모듈 목록.
//==============================================================================
const System = globalThis;
import * as Reflection from "./reflection.js";


//==============================================================================
// 전역 상수 목록.
//==============================================================================
// 오브젝트마다의 고유식별자. (처음 getInstanceId() 를 부를 때 만들어 넣는다)
// 기반 오브젝트에 비공개 필드를 두면 Vector2, Rect, Color, TransformMatrix 처럼 프레임마다 많이 만드는 값 객체가 만들 때마다 그 칸을 채우므로 밖에 둔다.
const instanceIdTable = new System.WeakMap();


//==============================================================================
// 기반 오브젝트.
//==============================================================================
/**
 * @class
 * @example <caption>상속해서 복제하고 비교하기</caption>
 * import { Object } from "./build/vanilla.js";
 *
 * class Inventory extends Object {
 * 	constructor() {
 * 		super();
 * 		this.itemNameList = [];
 * 	}
 * }
 *
 * const inventory = new Inventory();
 * inventory.itemNameList.push("sword");
 * const shallowCopy = inventory.clone();
 * const deepCopy = inventory.structuredClone();
 * inventory.itemNameList.push("shield");
 * console.log(shallowCopy.itemNameList.length, deepCopy.itemNameList.length);
 * console.log(inventory.equals(inventory), inventory.equals(deepCopy), Object.isValidate(null));
 * console.log(inventory.getInstanceId() === inventory.getInstanceId());
 */
export class Object {
	//==============================================================================
	// 생성.
	//==============================================================================
	/**
	 * @constant
	 */
	constructor() {
		// 고유식별자는 처음 부를 때 만든다. (Vector2, Rect, Color 처럼 많이 만드는 값 객체가 만들 때마다 GUID 를 짓지 않게)
	}

	//==============================================================================
	// 파괴. (현재 객체의 멤버 변수 목록을 무효화)
	//==============================================================================
	/**
	 * @virtual
	 */
	destroy() {
		// 처리. (기반 오브젝트는 풀 것이 없다. 파괴 여부는 엔진이 들지 않는다, 노드는 부모에서 떼어지고 그 밖은 쓰는 쪽이 놓는다)
	}

	//==============================================================================
	// 동등성 비교.
	//==============================================================================
	/**
	 * @virtual
	 * @param { any } other 비교할 값.
	 * @returns { boolean } 자신과 같은 참조이면 참. (null 이면 거짓)
	 */
	equals(other) {
		if (other === null) {
			return false;
		}
		else if (this === other) {
			return true;
		}

		return false;
	}

	//==============================================================================
	// 인스턴스 고유식별자 반환.
	//==============================================================================
	/**
	 * @virtual
	 * @returns { string } GUID 꼴 고유식별자. (처음 부를 때 만들고 그 뒤로는 같은 글을 돌려준다)
	 */
	getInstanceId() {
		let instanceId = instanceIdTable.get(this);
		if (instanceId === undefined) {
			instanceId = Reflection.createGUID();
			instanceIdTable.set(this, instanceId);
		}
		return instanceId;
	}

	//==============================================================================
	// 인스턴스 얕은 복제.
	//==============================================================================
	/**
	 * @returns { this } 인자 없이 같은 생성자로 만든 새 객체. (열거되는 자기 필드와 게터, 세터를 함께 가진 프로퍼티를 얕게 옮긴다)
	 */
	clone() {
		const obj = Reflection.clone(this);
		return obj;
	}

	//==============================================================================
	// 인스턴스 깊은 복제.
	//==============================================================================
	/**
	 * @returns { this } 인자 없이 같은 생성자로 만든 새 객체. (배열과 평범한 객체는 새로 만들어 옮기고 클래스 객체는 참조를 옮긴다)
	 */
	structuredClone() {
		const obj = Reflection.structuredClone(this);
		return obj;	
	}

	// //==============================================================================
	// // 새 인스턴스 생성.
	// //==============================================================================
	// /**
	//  * @static
	//  * @returns { this }
	//  */
	// static create() {
	// 	return new this();
	// }


	//==============================================================================
	// 유효한 객체인지 여부 반환.
	//==============================================================================
	/**
	 * @static
	 * @param { any } target 검사할 값.
	 * @returns { boolean } undefined 도 null 도 아니면 참.
	 */
	static isValidate(target) {
		return Reflection.isValidate(target);
	}
}