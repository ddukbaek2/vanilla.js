//==============================================================================
// 포함 모듈 목록.
//==============================================================================
const System = globalThis;


//==============================================================================
// 인스턴스 얕은 복제.
//==============================================================================
/**
 * @template T
 * @param { T } target
 * @returns { T }
 */
export function clone(target) {
	// 오류 방어.
	if (target === null || target === undefined || typeof target !== "object") {
		return target;
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
	let currentProto = System.Object.getPrototypeOf(target);
	while (currentProto && currentProto !== System.Object.prototype) {
		const props = System.Object.getOwnPropertyNames(currentProto);
		for (const prop of props) {
			if (prop !== "constructor") {
				const descriptor = System.Object.getOwnPropertyDescriptor(currentProto, prop);
				if (descriptor && descriptor.get && descriptor.set) {
					obj[prop] = target[prop];
				}
			}
		}
		currentProto = System.Object.getPrototypeOf(currentProto);
	}

	return obj;
}


//==============================================================================
// 인스턴스 깊은 복제.
//==============================================================================
/**
 * @template T
 * @param { T } target
 * @returns { T }
 */
export function structuredClone(target) {

	// 오류.
	if (target === null || target === undefined || typeof target !== "object")
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
 * @returns { string }
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