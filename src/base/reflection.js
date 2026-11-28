//==============================================================================
// 포함 모듈 목록.
//==============================================================================
const System = globalThis;


//==============================================================================
// 전역 상수 목록.
//==============================================================================
// 프로토타입마다 getter 와 setter 를 함께 가진 프로퍼티 이름 목록. (clone() 이 그 프로토타입을 처음 만날 때 한 번만 훑는다)
const accessorNameListTable = new System.WeakMap();


//==============================================================================
// 리플렉션 함수 모음. (값이 있는지, 꼴 검사, 클래스 상속 검사, 복제, 고유식별자)
//==============================================================================

/**
 * @example <caption>꼴 검사하고 복제하기</caption>
 * import { Reflection, Vector2 } from "./build/vanilla.js";
 *
 * const position = Vector2.create(3, 4);
 * const copied = Reflection.clone(position);
 * console.log(Reflection.isClassInstance(copied, Vector2), copied.x, copied.y);
 * console.log(Reflection.isPrimitiveType(123), Reflection.isArrayType([1, 2]));
 * console.log(Reflection.isValidate(null), Reflection.createGUID());
 */


//==============================================================================
// 유효한 객체인지 여부 반환.
//==============================================================================
/**
 * @template T
 * @param { T } target 검사할 값.
 * @returns { boolean } undefined 나 null 이 아니면 참.
 */
export function isValidate(target) {
	if (target === undefined || target === null) {
		return false;
	}

	return true;
};


//==============================================================================
// 인스턴스 얕은 복제.
//==============================================================================
/**
 * @template T
 * @param { T } target 복제할 객체. (객체가 아니거나 없으면 오류를 던진다)
 * @returns { T } 같은 생성자를 인자 없이 불러 만든 새 객체. (자기 속성과 getter, setter 짝 속성을 얕게 옮긴다)
 */
export function clone(target) {
	// 오류 방어.
	if (!isValidate(target) || typeof target !== "object") {
		throw new System.Error();
	}

	// 생성자로 신규 객체 생성 후, 보유한 멤버를 원시 타입은 덮어씌우고 참조 타입은 얕은 복사.
	// const obj = new this.constructor();
	// System.Object.assign(new this.constructor(), target);
	// return obj;

	// // 생성자 호출을 우회하여 신규 객체 생성 후, 보유한 멤버를 원시 타입은 덮어씌우고 참조 타입은 얕은 복사.
	// const obj = System.Object.create(System.Object.getPrototypeOf(target));

	// 생성자 호출을 통해 신규 객체 생성 (프라이빗 멤버 정상 할당).
	const obj = new target.constructor();

	// 1. 객체 자신의 열거 가능한 속성 얕은 복사.
	System.Object.assign(obj, target);

	// 2. 클래스 프로토타입에 정의된 getter/setter를 통한 프로퍼티 복사 (프라이빗 변수 접근).
	const accessorNameList = getAccessorNameList(target);
	for (const prop of accessorNameList) {
		obj[prop] = target[prop];
	}

	return obj;
}


//==============================================================================
// getter 와 setter 를 함께 가진 프로퍼티 이름 목록 반환.
// - 프로토타입 사슬을 아래에서 위로 훑은 차례다. (덮어쓴 이름은 층마다 한 번씩 든다)
// - 프로토타입마다 처음 한 번만 훑어 두고 같은 목록을 돌려준다.
//==============================================================================
/**
 * @param { object } target
 * @returns { string[] }
 */
function getAccessorNameList(target) {
	const targetProto = System.Object.getPrototypeOf(target);
	let accessorNameList = accessorNameListTable.get(targetProto);
	if (accessorNameList !== undefined) {
		return accessorNameList;
	}

	accessorNameList = [];
	let currentProto = targetProto;
	while (currentProto && currentProto !== System.Object.prototype) {
		const props = System.Object.getOwnPropertyNames(currentProto);
		for (const prop of props) {
			if (prop !== "constructor") {
				const descriptor = System.Object.getOwnPropertyDescriptor(currentProto, prop);
				if (descriptor && descriptor.get && descriptor.set) {
					accessorNameList.push(prop);
				}
			}
		}
		currentProto = System.Object.getPrototypeOf(currentProto);
	}
	accessorNameListTable.set(targetProto, accessorNameList);
	return accessorNameList;
}


//==============================================================================
// 인스턴스 깊은 복제.
//==============================================================================
/**
 * @template T
 * @param { T } target 복제할 객체. (객체가 아니거나 없으면 오류를 던진다)
 * @returns { T } 같은 생성자를 인자 없이 불러 만든 새 객체. (배열과 일반 객체는 깊게, 클래스 인스턴스 값은 참조 그대로 옮긴다)
  * @example <caption>얕은 복제와 깊은 복제의 차이</caption>
  * import { Reflection } from "./build/vanilla.js";
  *
  * class Inventory {
  * 	constructor() {
  * 		this.itemList = ["sword"];
  * 	}
  * }
  *
  * const original = new Inventory();
  * const shallowCopy = Reflection.clone(original);
  * const deepCopy = Reflection.structuredClone(original);
  * original.itemList.push("shield");
  * console.log(shallowCopy.itemList.length, deepCopy.itemList.length);
 */
export function structuredClone(target) {

	// 오류.
	if (!isValidate(target) || typeof target !== "object")
		throw new System.Error();

	// 생성자 호출을 통해 신규 객체 생성 (프라이빗 멤버 정상 할당).
	// const obj = System.Object.create(System.Object.getPrototypeOf(target));
	const obj = new target.constructor();

	// 깊은 복사 함수는 직렬화 불가능 객체를 만나면 예외 발생됨.
	//System.Object.assign(obj, System.window.structuredClone(this));

	// 값 복사 재귀 함수.
	const deepCopy = (destination, source) => {
		// 1. 객체 자신의 열거 가능한 속성 깊은 복사.
		for (const name in source) {

			// 멤버 실제 존재 여부.
			if (!System.Object.prototype.hasOwnProperty.call(source, name))
				continue;

			// 멤버 값.
			const value = source[name];

			// 배열.
			if (System.Array.isArray(value)) {
				destination[name] = [];
				deepCopy(destination[name], value);
			}
			// 객체.
			else if (value !== null && typeof value === "object" && value.constructor === System.Object) {
				destination[name] = {};
				deepCopy(destination[name], value);
			}
			// 그 외.
			else {
				destination[name] = value;
			}
		}

		// 2. 클래스 프로토타입에 정의된 getter/setter를 통한 프로퍼티 복사 (프라이빗 변수 접근).
		let currentProto = System.Object.getPrototypeOf(source);
		while (currentProto && currentProto !== System.Object.prototype) {
			const props = System.Object.getOwnPropertyNames(currentProto);
			for (const prop of props) {
				if (prop !== "constructor") {
					const descriptor = System.Object.getOwnPropertyDescriptor(currentProto, prop);
					if (descriptor && descriptor.get && descriptor.set) {
						const value = source[prop];
						if (System.Array.isArray(value)) {
							destination[prop] = [];
							deepCopy(destination[prop], value);
						}
						else if (value !== null && typeof value === "object" && value.constructor === System.Object) {
							destination[prop] = {};
							deepCopy(destination[prop], value);
						}
						else {
							destination[prop] = value;
						}
					}
				}
			}
			currentProto = System.Object.getPrototypeOf(currentProto);
		}
	};

	deepCopy(obj, target);
	return obj;
}


//==============================================================================
// 고유식별자 생성.
// - "0192a3f2-b1c4-4d8e-8f1a-0e5d4c3b2a19"
//==============================================================================
/**
 * @returns { string } "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx" 꼴의 36 글자 문자열. (앞 12 자리는 밀리초 시각)
 */
export function createGUID() {

	// 높은 고유성과 빠른 속도를 지녔지만 HTTPS 접속시만 유효한 함수.
	// return System.crypto.randomUUID();

	// 48비트 타임스탬프 (ms) - 약 8900년치
	const ts = Date.now().toString(16).padStart(12, "0");

	const r = () => (Math.random() * 16 | 0).toString(16);
	const y = () => (Math.random() * 4 | 8).toString(16);

	// 앞 12자리는 타임스탬프, 나머지는 랜덤 (74비트 엔트로피)
	return `${ts.slice(0,8)}-${ts.slice(8,12)}-4${r()}${r()}${r()}-${y()}${r()}${r()}${r()}-${r()}${r()}${r()}${r()}${r()}${r()}${r()}${r()}${r()}${r()}${r()}${r()}`;
};


//==============================================================================
// 원시 타입 여부 반환.
// - undefined / null / boolean / number / bigint / string / symbol 이면 true.
// - 예) isPrimitiveType(123) → true, isPrimitiveType({}) → false
//==============================================================================
/**
 * @template T
 * @param { T } target 검사할 값.
 * @returns { boolean } 원시 타입이면 참.
 */
export function isPrimitiveType(target) {
	if (target === null) {
		return true;
	}
	const typeText = typeof target;
	if (typeText === "object" || typeText === "function") {
		return false;
	}
	return true;
}


//==============================================================================
// 참조 타입 여부 반환.
// - object / array / function 등 (null 제외).
// - 예) isReferenceType({}) → true, isReferenceType(null) → false
//==============================================================================
/**
 * @template T
 * @param { T } target 검사할 값.
 * @returns { boolean } 객체나 함수면 참. (null 은 거짓)
 */
export function isReferenceType(target) {
	if (target === null) {
		return false;
	}
	const typeText = typeof target;
	if (typeText === "object" || typeText === "function") {
		return true;
	}
	return false;
}


//==============================================================================
// 배열 타입 여부 반환.
// - 예) isArrayType([1, 2, 3]) → true, isArrayType("abc") → false
//==============================================================================
/**
 * @template T
 * @param { T } target 검사할 값.
 * @returns { boolean } 배열이면 참.
 */
export function isArrayType(target) {
	return System.Array.isArray(target);
}


//==============================================================================
// 함수 타입 여부 반환.
// - 일반 함수 / 화살표 함수 / 클래스 모두 typeof 가 "function" 이므로 true.
// - 예) isFunctionType(() => {}) → true, isFunctionType(123) → false
//==============================================================================
/**
 * @template T
 * @param { T } target 검사할 값.
 * @returns { boolean } 함수면 참. (클래스 포함)
 */
export function isFunctionType(target) {
	return typeof target === "function";
}


//==============================================================================
// 클래스/생성자 함수 여부 반환.
// - typeof 가 "function" 이고 prototype 을 가진 경우 true (화살표 함수 제외).
// - 예) isType(WorldNode) → true, isType(() => {}) → false
//==============================================================================
/**
 * @template T
 * @param { T } target 검사할 값.
 * @returns { boolean } prototype 을 가진 함수면 참.
 */
export function isType(target) {
	if (typeof target !== "function") {
		return false;
	}
	if (target.prototype === undefined || target.prototype === null) {
		return false;
	}
	return true;
}


//==============================================================================
// 특정 클래스의 인스턴스 여부 반환.
// - target 이 type 또는 그 하위 타입의 인스턴스이면 true.
// - 예) isClassInstance(new Vector2(), Vector2) → true
//==============================================================================
/**
 * @template T
 * @param { T } target 검사할 값.
 * @param { Function } type 클래스.
 * @returns { boolean } target 이 type 이나 그 하위 클래스의 인스턴스면 참.
 */
export function isClassInstance(target, type) {
	if (!isReferenceType(target)) {
		return false;
	}
	if (!isType(type)) {
		return false;
	}
	return target instanceof type;
}


//==============================================================================
// target 클래스가 type 클래스의 부모(상위) 클래스인지 여부 반환.
// - type 이 target 을 (직간접적으로) 상속하면 true.
// - target === type 인 경우는 false.
// - 예) isParent(TransformNode, WorldNode) → true
//==============================================================================
/**
 * @param { Function } parentType 부모인지 볼 클래스.
 * @param { Function } targetType 자식 쪽 클래스.
 * @returns { boolean } targetType 이 parentType 을 직간접으로 상속하면 참. (같은 클래스면 거짓)
 */
export function isParent(parentType, targetType) {
	if (!isType(parentType) || !isType(targetType)) {
		return false;
	}
	if (parentType === targetType) {
		return false;
	}
	return targetType.prototype instanceof parentType;
}


//==============================================================================
// target 클래스가 type 클래스의 자식(하위) 클래스인지 여부 반환.
// - target 이 type 을 (직간접적으로) 상속하면 true.
// - target === type 인 경우는 false.
// - 예) isChildren(WorldNode, TransformNode) → true
//==============================================================================
/**
 * @param { Function } targetType 자식인지 볼 클래스.
 * @param { Function } parentType 부모 쪽 클래스.
 * @returns { boolean } targetType 이 parentType 을 직간접으로 상속하면 참. (같은 클래스면 거짓)
 */
export function isChildren(targetType, parentType) {
	if (!isType(targetType) || !isType(parentType)) {
		return false;
	}
	if (targetType === parentType) {
		return false;
	}
	return targetType.prototype instanceof parentType;
}