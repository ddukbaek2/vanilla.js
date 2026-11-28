//==============================================================================
// 포함 모듈 목록.
//==============================================================================
// 옮긴 원문: Box2D 3 의 셈에서 옮김, MIT, THIRD_PARTY_LICENSES.md
const System = globalThis;
import { Object } from "../../base/object.js";


//==============================================================================
// 전역 상수 목록.
//==============================================================================
const PI = System.Math.PI;
const TWO_PI = 2 * PI;
const HALF_PI = 0.5 * PI;
const QUARTER_PI = 0.25 * PI;
// tan(파이 / 8). (아크탄젠트를 이 값 위에서는 파이 / 4 쪽으로 옮겨 줄인다)
const TANGENT_EIGHTH_PI = 0.414213562373095;


//==============================================================================
// 2D 물리의 결정론 수학.
// - 초안: 0.4.0 뒤 기능, API 가 바뀔 수 있다.
// - 코사인, 사인, 아크탄젠트를 더하기, 빼기, 곱하기, 나누기, 제곱근만으로 짠다. (모두 IEEE 754 가 정확히 반올림하라고 정한 셈)
//   브라우저의 Math.sin 과 러스트의 f64::sin 은 운영체제와 엔진마다 끝자리가 달라, 같은 입력에 두 엔진의 물리가 갈라진다.
//   Box2D 도 같은 까닭으로 b2ComputeCosSin, b2Atan2 를 직접 짰다. (box2d.org/posts/2024/08/determinism)
// - 러스트 vanilla-engine 의 experimental::physics2d::PhysicsMath2D 와 같은 셈, 같은 차례라 두 엔진의 결과가 비트까지 같다.
//==============================================================================
/**
 * @example <caption>결정론 코사인, 사인, 아크탄젠트</caption>
 * import * as Experimental from "./src/experimental/experimental.js";
 *
 * const rotation = Experimental.PhysicsMath2D.computeRotation(1.0);
 * console.log(rotation.cosine.toFixed(12), rotation.sine.toFixed(12));
 * console.log(Experimental.PhysicsMath2D.computeAtan2(rotation.sine, rotation.cosine).toFixed(12));
 * console.log(Experimental.PhysicsMath2D.unwindAngle(7.0).toFixed(12));
 */
export class PhysicsMath2D extends Object {
	//==============================================================================
	// 각도의 회전 반환. (정적, 결정론 코사인과 사인)
	//==============================================================================
	/**
	 * @param { number } angle 각도. (라디안)
	 * @returns { Rotation2D } 단위 길이로 맞춘 (코사인, 사인).
	 */
	static computeRotation(angle) {
		const turns = System.Math.floor(angle / TWO_PI + 0.5);
		const reduced = angle - turns * TWO_PI;
		const quadrant = System.Math.floor(reduced / HALF_PI + 0.5);
		const remainder = reduced - quadrant * HALF_PI;
		const remainderSquared = remainder * remainder;
		const sineRemainder = remainder * (1 + remainderSquared * (-1 / 6 + remainderSquared * (1 / 120 + remainderSquared * (-1 / 5040 + remainderSquared * (1 / 362880 + remainderSquared * (-1 / 39916800 + remainderSquared * (1 / 6227020800 + remainderSquared * (-1 / 1307674368000))))))));
		const cosineRemainder = 1 + remainderSquared * (-1 / 2 + remainderSquared * (1 / 24 + remainderSquared * (-1 / 720 + remainderSquared * (1 / 40320 + remainderSquared * (-1 / 3628800 + remainderSquared * (1 / 479001600 + remainderSquared * (-1 / 87178291200 + remainderSquared * (1 / 20922789888000))))))));
		const quadrantIndex = ((quadrant % 4) + 4) % 4;
		let cosine = cosineRemainder;
		let sine = sineRemainder;
		if (quadrantIndex === 1) {
			cosine = -sineRemainder;
			sine = cosineRemainder;
		}
		else if (quadrantIndex === 2) {
			cosine = -cosineRemainder;
			sine = -sineRemainder;
		}
		else if (quadrantIndex === 3) {
			cosine = sineRemainder;
			sine = -cosineRemainder;
		}
		const magnitude = System.Math.sqrt(cosine * cosine + sine * sine);
		return Rotation2D.create(cosine / magnitude, sine / magnitude);
	}

	//==============================================================================
	// 결정론 코사인. (정적)
	//==============================================================================
	/**
	 * @param { number } angle 각도. (라디안)
	 * @returns { number } 코사인.
	 */
	static computeCosine(angle) {
		const rotation = PhysicsMath2D.computeRotation(angle);
		return rotation.cosine;
	}

	//==============================================================================
	// 결정론 사인. (정적)
	//==============================================================================
	/**
	 * @param { number } angle 각도. (라디안)
	 * @returns { number } 사인.
	 */
	static computeSine(angle) {
		const rotation = PhysicsMath2D.computeRotation(angle);
		return rotation.sine;
	}

	//==============================================================================
	// 결정론 아크탄젠트. (정적, atan2(y, x), 둘 다 0 이면 0)
	// - 0 ~ 1 로 접은 뒤 파이 / 8 위는 파이 / 4 쪽으로 옮기고, 반각 공식 두 번으로 0.1 아래까지 줄여 급수로 셈한다.
	//==============================================================================
	/**
	 * @param { number } y 세로 값.
	 * @param { number } x 가로 값.
	 * @returns { number } 각도. (라디안, -파이 ~ 파이)
	 */
	static computeAtan2(y, x) {
		if (x === 0 && y === 0) {
			return 0;
		}
		const absoluteX = System.Math.abs(x);
		const absoluteY = System.Math.abs(y);
		const maximum = System.Math.max(absoluteX, absoluteY);
		const minimum = System.Math.min(absoluteX, absoluteY);
		const ratio = minimum / maximum;
		let reduced = ratio;
		let offset = 0;
		if (ratio > TANGENT_EIGHTH_PI) {
			reduced = (ratio - 1) / (ratio + 1);
			offset = QUARTER_PI;
		}
		const half = reduced / (1 + System.Math.sqrt(1 + reduced * reduced));
		const quarter = half / (1 + System.Math.sqrt(1 + half * half));
		const quarterSquared = quarter * quarter;
		const series = quarter * (1 + quarterSquared * (-1 / 3 + quarterSquared * (1 / 5 + quarterSquared * (-1 / 7 + quarterSquared * (1 / 9 + quarterSquared * (-1 / 11 + quarterSquared * (1 / 13 + quarterSquared * (-1 / 15))))))));
		let result = offset + 4 * series;
		if (absoluteY > absoluteX) {
			result = HALF_PI - result;
		}
		if (x < 0) {
			result = PI - result;
		}
		if (y < 0) {
			result = -result;
		}
		return result;
	}

	//==============================================================================
	// 각도를 -파이 ~ 파이 로 접기. (정적)
	//==============================================================================
	/**
	 * @param { number } angle 각도. (라디안)
	 * @returns { number } 같은 방향의 -파이 이상 파이 미만 각도.
	 */
	static unwindAngle(angle) {
		if (angle >= -PI && angle < PI) {
			return angle;
		}
		return angle - TWO_PI * System.Math.floor((angle + PI) / TWO_PI);
	}
}


//==============================================================================
// 2D 회전. (코사인과 사인)
// - 초안: 0.4.0 뒤 기능, API 가 바뀔 수 있다.
// - 물리는 각도 대신 이 쌍을 들고, 걸음마다 각속도로 돌린 뒤 길이를 1 로 맞춘다. (Box2D 3 의 b2Rot 과 같은 꼴, 삼각 함수를 부르지 않는다)
//==============================================================================
/**
 * @example <caption>회전을 만들고 각도로 되돌리기</caption>
 * import * as Experimental from "./src/experimental/experimental.js";
 *
 * const rotation = Experimental.Rotation2D.fromAngle(0.5);
 * console.log(rotation.getAngle().toFixed(12));
 * const doubled = rotation.multiply(rotation);
 * console.log(doubled.getAngle().toFixed(12));
 */
export class Rotation2D extends Object {
	//==============================================================================
	// 멤버 변수 목록.
	//==============================================================================
	/** @type { number } */ cosine; // 코사인.
	/** @type { number } */ sine; // 사인.

	//==============================================================================
	// 생성. (회전 없음)
	//==============================================================================
	/**
	 * @constructor
	 */
	constructor() {
		super();
		this.cosine = 1;
		this.sine = 0;
	}

	//==============================================================================
	// 코사인과 사인으로 만들기. (정적, 길이를 맞추지 않는다)
	//==============================================================================
	/**
	 * @param { number } cosine 코사인.
	 * @param { number } sine 사인.
	 * @returns { Rotation2D } 새 회전.
	 */
	static create(cosine, sine) {
		const rotation = new Rotation2D();
		rotation.cosine = cosine;
		rotation.sine = sine;
		return rotation;
	}

	//==============================================================================
	// 각도로 만들기. (정적, 결정론 코사인과 사인)
	//==============================================================================
	/**
	 * @param { number } angle 각도. (라디안)
	 * @returns { Rotation2D } 새 회전.
	 */
	static fromAngle(angle) {
		return PhysicsMath2D.computeRotation(angle);
	}

	//==============================================================================
	// 각도 반환. (결정론 아크탄젠트)
	//==============================================================================
	/**
	 * @returns { number } 각도. (라디안, -파이 ~ 파이)
	 */
	getAngle() {
		return PhysicsMath2D.computeAtan2(this.sine, this.cosine);
	}

	//==============================================================================
	// 두 회전을 잇기. (이 회전 뒤에 other 가 아니라, other 를 먼저 하고 이 회전을 한 것)
	//==============================================================================
	/**
	 * @param { Rotation2D } other 먼저 할 회전.
	 * @returns { Rotation2D } 합친 회전.
	 */
	multiply(other) {
		return Rotation2D.create(this.cosine * other.cosine - this.sine * other.sine, this.sine * other.cosine + this.cosine * other.sine);
	}
}
