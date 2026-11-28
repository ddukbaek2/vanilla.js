//==============================================================================
// 포함 모듈 목록.
//==============================================================================
const System = globalThis;
import { Object } from "./object.js";
import * as Math from "./math.js";


//==============================================================================
// 2차원 벡터.
//==============================================================================
/**
 * @example <caption>만들고 더하고 길이 재기</caption>
 * import { Vector2 } from "./build/vanilla.js";
 *
 * const position = Vector2.create(3, 4);
 * const moved = position.add(Vector2.create(1, 0));
 * console.log(moved.x, moved.y, position.length());
 */
export class Vector2 extends Object {
	//==============================================================================
	// 멤버 변수 목록.
	//==============================================================================
	/** @private @type { number } */ #x;
	/** @private @type { number } */ #y;

	//==============================================================================
	// 생성.
	//==============================================================================
	/**
	 * @constructor
	 */
	constructor() {
		super();

		this.x = 0.0;
		this.y = 0.0;
	}

	//==============================================================================
	// 비교.
	//==============================================================================
	/**
	 * @override
	 * @param { any } other 비교할 값.
	 * @returns { boolean } 같은 객체이거나 x, y 가 모두 같은 Vector2 면 참.
	 */
	equals(other) {
		if (super.equals(other)) {
			return true;
		}
		
		if (other) {
			if (other instanceof Vector2) {
				if (this.x === other.x && this.y === other.y) {
					return true;
				}
			}
		}

		return false;
	}

	//==============================================================================
	// 복제.
	//==============================================================================
	/**
	 * @override
	 * @returns { this } x, y 가 같은 새 벡터.
	 */
	clone() {
		// const obj = super.clone();
		const obj = /** @type { this } */ (Vector2.create(this.x, this.y));
		return obj;
	}
	
	//==============================================================================
	// X 좌표 설정 프로퍼티.
	//==============================================================================
	/**
	 * @property
	 * @param { number } value
	 */
	set x(value) {
		this.#x = value;
	}

	//==============================================================================
	// X 좌표 반환 프로퍼티.
	//==============================================================================
	/**
	 * @property
	 * @returns { number } X 좌표.
	 */
	get x() {
		return this.#x;
	}

	//==============================================================================
	// Y 좌표 설정 프로퍼티.
	//==============================================================================
	/**
	 * @property
	 * @param { number } value
	 */
	set y(value) {
		this.#y = value;
	}

	//==============================================================================
	// Y 좌표 반환 프로퍼티.
	//==============================================================================
	/**
	 * @property
	 * @returns { number } Y 좌표.
	 */
	get y() {
		return this.#y;
	}

	//==============================================================================
	// 대입.
	//==============================================================================
	/**
	 * @param { number } x X 좌표.
	 * @param { number } y Y 좌표.
	 */
	set(x, y) {
		this.x = x;
		this.y = y;
	}

	//==============================================================================
	// 가로축 반환.
	//==============================================================================
	/**
	 * @returns { number } X 좌표.
	 */
	getX() {
		return this.x;
	}

	//==============================================================================
	// 세로축 반환.
	//==============================================================================
	/**
	 * @returns { number } Y 좌표.
	 */
	getY() {
		return this.y;
	}

	//==============================================================================
	// 길이.
	//==============================================================================
	/**
	 * @returns { number } 벡터의 길이.
	 */
	length() {
		const length = Math.sqrt(this.x * this.x + this.y * this.y);
		return length;
	}

	//==============================================================================
	// 정규화.
	//==============================================================================
	/**
	 * @returns { Vector2 } 길이를 1 로 맞춘 새 벡터. (길이가 0 이면 그대로 복사한다)
	 */
	normalize() {
		const origin = Vector2.create(this.x, this.y);
		const length = this.length();		
		if (length > 0)
		{
			origin.x /= length;
			origin.y /= length;
		}

		return origin;
	}

	//==============================================================================
	// 더하기.
	//==============================================================================
	/**
	 * @param { Vector2 | number } other 더할 벡터나 수. (수면 두 성분에 같은 수를 더한다, 그 밖의 꼴이면 오류를 던진다)
	 * @returns { Vector2 } 계산한 새 벡터. (자신은 바뀌지 않는다)
	 */
	add(other) {
		const origin = this.clone();
		if (typeof other === "number") {
			origin.x += other;
			origin.y += other;
			return origin;
		}
		else if (other instanceof Vector2) {
			origin.x += other.x;
			origin.y += other.y;
			return origin;
		}
		
		throw new Error("Invalid type: \"other\" must be a number or an instance of Vector2.");
	}

	//==============================================================================
	// 빼기.
	//==============================================================================
	/**
	 * @param { Vector2 | number } other 뺄 벡터나 수. (수면 두 성분에 같은 수를 뺀다, 그 밖의 꼴이면 오류를 던진다)
	 * @returns { Vector2 } 계산한 새 벡터. (자신은 바뀌지 않는다)
	 */
	subtract(other) {
		const origin = this.clone();
		if (typeof other === "number") {
			origin.x -= other;
			origin.y -= other;
			return origin;
		}
		else if (other instanceof Vector2) {
			origin.x -= other.x;
			origin.y -= other.y;
			return origin;
		}
		
		throw new Error("Invalid type: \"other\" must be a number or an instance of Vector2.");
	}

	//==============================================================================
	// 곱하기.
	//==============================================================================
	/**
	 * @param { Vector2 | number } other 곱할 벡터나 수. (수면 두 성분에 같은 수를 곱한다, 그 밖의 꼴이면 오류를 던진다)
	 * @returns { Vector2 } 계산한 새 벡터. (자신은 바뀌지 않는다)
	 */
	multiply(other) {
		const origin = this.clone();
		if (typeof other === "number") {
			origin.x *= other;
			origin.y *= other;
			return origin;
		}
		else if (other instanceof Vector2) {
			origin.x *= other.x;
			origin.y *= other.y;
			return origin;
		}
		
		throw new Error("Invalid type: \"other\" must be a number or an instance of Vector2.");
	}

	//==============================================================================
	// 나누기.
	//==============================================================================
	/**
	 * @param { Vector2 | number } other 나눌 벡터나 수. (수면 두 성분을 같은 수로 나눈다, 그 밖의 꼴이면 오류를 던진다)
	 * @returns { Vector2 } 계산한 새 벡터. (자신은 바뀌지 않는다)
	 */
	divide(other) {
		const origin = this.clone();
		if (typeof other === "number") {
			origin.x /= other;
			origin.y /= other;
			return origin;
		}
		else if (other instanceof Vector2) {
			origin.x /= other.x;
			origin.y /= other.y;
			return origin;
		}
		
		throw new Error("Invalid type: \"other\" must be a number or an instance of Vector2.");
	}

	//==============================================================================
	// 나머지.
	//==============================================================================
	/**
	 * @param { Vector2 | number } other 나눌 벡터나 수. (나머지를 구한다, 수면 두 성분을 같은 수로 나누고, 그 밖의 꼴이면 오류를 던진다)
	 * @returns { Vector2 } 계산한 새 벡터. (자신은 바뀌지 않는다)
	 */
	modulo(other) {
		const origin = this.clone();
		if (typeof other === "number") {
			origin.x %= other;
			origin.y %= other;
			return origin;
		}
		else if (other instanceof Vector2) {
			origin.x %= other.x;
			origin.y %= other.y;
			return origin;
		}
		
		throw new Error("Invalid type: \"other\" must be a number or an instance of Vector2.");
	}

	//==============================================================================
	// 수 더하기. (모든 성분에 같은 수, add(number) 와 같다)
	//==============================================================================
	/**
	 * @param { number } scalar 더할 수.
	 * @returns { Vector2 } 계산한 새 벡터.
	 */
	addScalar(scalar) {
		const result = this.add(scalar);
		return result;
	}

	//==============================================================================
	// 수 빼기. (모든 성분에 같은 수, subtract(number) 와 같다)
	//==============================================================================
	/**
	 * @param { number } scalar 뺄 수.
	 * @returns { Vector2 } 계산한 새 벡터.
	 */
	subtractScalar(scalar) {
		const result = this.subtract(scalar);
		return result;
	}

	//==============================================================================
	// 수 곱하기. (모든 성분에 같은 수, multiply(number) 와 같다)
	//==============================================================================
	/**
	 * @param { number } scalar 곱할 수.
	 * @returns { Vector2 } 계산한 새 벡터.
	 */
	multiplyScalar(scalar) {
		const result = this.multiply(scalar);
		return result;
	}

	//==============================================================================
	// 수 나누기. (모든 성분에 같은 수, divide(number) 와 같다)
	//==============================================================================
	/**
	 * @param { number } scalar 나눌 수.
	 * @returns { Vector2 } 계산한 새 벡터.
	 */
	divideScalar(scalar) {
		const result = this.divide(scalar);
		return result;
	}

	//==============================================================================
	// 수 나머지. (모든 성분에 같은 수, modulo(number) 와 같다)
	//==============================================================================
	/**
	 * @param { number } scalar 나눌 수. (나머지를 구한다)
	 * @returns { Vector2 } 계산한 새 벡터.
	 */
	moduloScalar(scalar) {
		const result = this.modulo(scalar);
		return result;
	}

	//==============================================================================
	// 절반.
	//==============================================================================
	/**
	 * @returns { Vector2 } x, y 를 2 로 나눈 새 벡터.
	 */
	half() {
		const obj = this.divide(2);
		return obj;
	}
	
	//==============================================================================
	// 내적.
	//==============================================================================
	/**
	 * @param { Vector2 } other 내적할 벡터.
	 * @returns { number } 내적 값.
	 */
	dot(other) {
		return this.x * other.x + this.y * other.y;
	}

	//==============================================================================
	// 외적 (2D cross product -> 스칼라 반환).
	//==============================================================================
	/**
	 * @param { Vector2 } other 외적할 벡터.
	 * @returns { number } 외적 값. (this.x * other.y - this.y * other.x)
	 */
	cross(other) {
		return this.x * other.y - this.y * other.x;
	}

	//==============================================================================
	// 두 벡터 사이의 거리.
	//==============================================================================
	/**
	 * @param { Vector2 } other 거리를 잴 벡터.
	 * @returns { number } 두 점 사이의 거리.
	 */
	distance(other) {
		const dx = this.x - other.x;
		const dy = this.y - other.y;
		return Math.sqrt(dx * dx + dy * dy);
	}

	//==============================================================================
	// 길이의 제곱 (루트 연산 최적화).
	//==============================================================================
	/**
	 * @returns { number } 길이의 제곱.
	 */
	lengthSquared() {
		return this.x * this.x + this.y * this.y;
	}

	//==============================================================================
	// 두 벡터 사이의 각도 반환 (라디안).
	//==============================================================================
	/**
	 * @param { Vector2 } other 각도를 잴 벡터.
	 * @returns { number } 두 벡터 사이의 각도. (라디안, 0 ~ π, 어느 한쪽 길이가 0 이면 NaN)
	 * @example <caption>두 벡터 사이의 각도를 도로 보기</caption>
	 * import { Vector2, Math } from "./build/vanilla.js";
	 *
	 * const right = Vector2.create(1, 0);
	 * const up = Vector2.create(0, -1);
	 * const radian = right.angle(up);
	 * console.log(radian, Math.radianToDegree(radian));
	 */
	angle(other) {
		return Math.acos(this.dot(other) / (this.length() * other.length()));
	}
	
	//==============================================================================
	// 새로운 벡터 생성.
	//==============================================================================
	/**
	 * @param { number } x X 좌표.
	 * @param { number } y Y 좌표.
	 * @returns { Vector2 } 새 벡터.
	 */
	static create(x, y) {
		var obj = new Vector2();
		obj.x = x;
		obj.y = y;
		return obj;
	}

	//==============================================================================
	// 0의 값을 가진 벡터 생성.
	//==============================================================================
	/**
	 * @returns { Vector2 } (0, 0) 벡터.
	 */
	static zero() {
		return Vector2.create(0, 0);
	}

	//==============================================================================
	// 1의 값을 가진 벡터 생성.
	//==============================================================================
	/**
	 * @returns { Vector2 } (1, 1) 벡터.
	 */
	static one() {
		return Vector2.create(1, 1);
	}

	//==============================================================================
	// -1의 값을 가진 벡터 생성.
	//==============================================================================
	/**
	 * @returns { Vector2 } (-1, -1) 벡터.
	 */
	static minusOne() {
		return Vector2.create(-1, -1);
	}

	//==============================================================================
	// 최대값 벡터 생성.
	//==============================================================================
	/**
	 * @returns { Vector2 } (Infinity, Infinity) 벡터.
	 */
	static positiveInfinity() {
		return Vector2.create(Infinity, Infinity);
	}

	//==============================================================================
	// 최소값 벡터 생성.
	//==============================================================================
	/**
	 * @returns { Vector2 } (-Infinity, -Infinity) 벡터.
	 */
	static negativeInfinity() {
		return Vector2.create(-Infinity, -Infinity);
	}

	//==============================================================================
	// 선형 보간.
	//==============================================================================
	/**
	 * @param { Vector2 } from 시작 벡터.
	 * @param { Vector2 } to 끝 벡터.
	 * @param { number } normalizedTime 0 이면 from, 1 이면 to. (0 ~ 1 밖이어도 자르지 않고 늘여 보간한다)
	 * @returns { Vector2 } 보간한 새 벡터.
	 * @example <caption>두 점 사이의 가운데 구하기</caption>
	 * import { Vector2 } from "./build/vanilla.js";
	 *
	 * const start = Vector2.create(0, 0);
	 * const end = Vector2.create(100, 50);
	 * const middle = Vector2.lerp(start, end, 0.5);
	 * console.log(middle.x, middle.y);
	 */
	static lerp(from, to, normalizedTime) {		
		const x = Math.lerp(from.x, to.x, normalizedTime);
		const y = Math.lerp(from.y, to.y, normalizedTime);
		return Vector2.create(x, y);
	}

	//==============================================================================
	// 범위 제한.
	//==============================================================================
	/**
	 * @param { Vector2 } value 자를 벡터.
	 * @param { Vector2 } min 성분별 최솟값.
	 * @param { Vector2 } max 성분별 최댓값.
	 * @returns { Vector2 } 성분마다 min ~ max 로 자른 새 벡터.
	 */
	static clamp(value, min, max) {
		const x = Math.clamp(value.x, min.x, max.x);
		const y = Math.clamp(value.y, min.y, max.y);
		return Vector2.create(x, y);
	}
}