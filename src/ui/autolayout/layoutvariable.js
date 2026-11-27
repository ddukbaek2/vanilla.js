//==============================================================================
// 포함 모듈 목록.
//==============================================================================
const System = globalThis;


//==============================================================================
// 레이아웃 솔버 미지수.
// - 외부 (사용자 코드) 가 식에 사용하는 변수.
// - 솔버가 풀고 나면 updateVariables() 호출 시 setValue 로 결과가 반영된다.
//==============================================================================
/**
 * @example <caption>제약을 풀어 변수 값 읽기</caption>
 * import { LayoutSolver, LayoutVariable, LayoutExpression } from "./build/vanilla.js";
 *
 * const solver = new LayoutSolver();
 * const left = new LayoutVariable("left");
 * const leftExpression = LayoutExpression.fromVariable(left);
 * const leftConstraint = leftExpression.equalTo(24);
 * solver.addConstraint(leftConstraint);
 * const name = left.getName();
 * const valueBeforeUpdate = left.getValue();
 * solver.updateVariables();
 * const valueAfterUpdate = left.getValue();
 * console.log(name, valueBeforeUpdate, valueAfterUpdate);
 */
export class LayoutVariable {
	//==============================================================================
	// 멤버 변수 목록.
	//==============================================================================
	/** @private @type { string } */ #name;
	/** @private @type { number } */ #value;
	/** @private @type { ((variable: LayoutVariable) => void) | null } */ #valueChangedEvent; // 값이 바뀔 때 부를 함수.

	//==============================================================================
	// 생성.
	//==============================================================================
	/**
	 * @constructor
	 * @param { string } [name] 변수 이름. (문자열이 아니면 빈 글)
	 */
	constructor(name) {
		this.#name = (typeof name === "string") ? name : "";
		this.#value = 0.0;
		this.#valueChangedEvent = null;
	}

	//==============================================================================
	// 이름 설정.
	//==============================================================================
	/**
	 * @param { string } name 변수 이름.
	 */
	setName(name) {
		this.#name = name;
	}

	//==============================================================================
	// 이름 반환.
	//==============================================================================
	/**
	 * @returns { string } 변수 이름.
	 */
	getName() {
		return this.#name;
	}

	//==============================================================================
	// 값 설정. (솔버 내부에서 호출되며 외부 직접 호출은 권장하지 않는다.)
	//==============================================================================
	/**
	 * @param { number } value 새 값.
	 */
	setValue(value) {
		if (this.#value === value) {
			return;
		}
		this.#value = value;
		if (this.#valueChangedEvent !== null) {
			this.#valueChangedEvent(this);
		}
	}

	//==============================================================================
	// 값이 바뀔 때 부를 함수 설정. (솔버가 푼 값이 달라질 때만 부른다, 변수를 가진 쪽이 바뀐 것을 알아챈다. null 이면 부르지 않는다)
	// - UINode 는 자기 자리와 크기 변수에 걸어 하위 트리 그리기 경계를 다시 셈하게 한다.
	//==============================================================================
	/**
	 * @param { ((variable: LayoutVariable) => void) | null } valueChangedEvent 바뀐 변수를 받는 함수.
	 * @example <caption>값이 바뀔 때 알기</caption>
	 * import { LayoutVariable } from "./build/vanilla.js";
	 *
	 * const width = new LayoutVariable("width");
	 * width.setValueChangedEvent((variable) => console.log(variable.getName(), variable.getValue()));
	 * width.setValue(120);
	 * width.setValue(120);
	 */
	setValueChangedEvent(valueChangedEvent) {
		this.#valueChangedEvent = valueChangedEvent;
	}

	//==============================================================================
	// 값이 바뀔 때 부를 함수 반환.
	//==============================================================================
	/**
	 * @returns { ((variable: LayoutVariable) => void) | null } 건 함수. (없으면 null)
	 */
	getValueChangedEvent() {
		return this.#valueChangedEvent;
	}

	//==============================================================================
	// 현재 값 반환. (updateVariables 후 유효)
	//==============================================================================
	/**
	 * @returns { number } 마지막 updateVariables 가 넣은 값. (처음은 0)
	 */
	getValue() {
		return this.#value;
	}
}
