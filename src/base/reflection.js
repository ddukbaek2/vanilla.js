//==============================================================================
// 포함 모듈 목록.
//==============================================================================


//==============================================================================
// 인스턴스 얕은 복제.
//==============================================================================
/**
 * @template T
 * @param { T } target
 * @returns { T }
 */
export function clone(target) {
	// 생성자로 신규 객체 생성 후, 보유한 멤버를 원시 타입은 덮어씌우고 참조 타입은 얕은 복사.
	// const obj = new this.constructor();
	// Object.assign(new this.constructor(), target);
	// return obj;

	// 생성자 호출을 우회하여 신규 객체 생성 후, 보유한 멤버를 원시 타입은 덮어씌우고 참조 타입은 얕은 복사.
	const obj = Object.create(Object.getPrototypeOf(target));
	Object.assign(obj, target);
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
	if (target === null || typeof target !== "object")
		throw new Error();

	const obj = Object.create(Object.getPrototypeOf(target));

	// 깊은 복사 함수는 직렬화 불가능 객체를 만나면 예외 발생됨.
	//Object.assign(obj, window.structuredClone(this));

	// 값 복사 재귀 함수.
	const deepCopy = (destination, source) => {
		for (const name in source) {

			// 멤버 실제 존재 여부.
			if (!Object.prototype.hasOwnProperty.call(source, name))
				continue;

			// 멤버 값.
			const value = source[name];

			// 배열.
			if (Array.isArray(value)) {
				target[name] = [];
				deepCopy(target[name], value);
			}
			// 객체.
			else if (value !== null && typeof value === "object" && value.constructor === Object) {
				destination[name] = {};
				deepCopy(destination[name], value);
			}
			// 그 외.
			else {
				destination[name] = value;
			}
		}
	};

	deepCopy(obj, target);
	return obj;
}