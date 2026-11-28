//==============================================================================
// 포함 모듈 목록.
//==============================================================================
const System = globalThis;
import { Object } from "../../base/object.js";


//==============================================================================
// 축 정렬 경계 상자. (2D, AABB)
// - 초안: 0.4.0 뒤 기능, API 가 바뀔 수 있다.
// - 가장 작은 꼭짓점(minX, minY)과 가장 큰 꼭짓점(maxX, maxY)으로 적는다. 동적 AABB 나무와 2D 물리가 쓴다.
// - 러스트 vanilla-engine 의 experimental::spatial::AABB2D 와 같은 API, 같은 셈이다. (값은 둘 다 f64)
//==============================================================================
/**
 * @example <caption>두 상자의 겹침과 합친 상자</caption>
 * import * as Experimental from "./src/experimental/experimental.js";
 *
 * const first = Experimental.AABB2D.create(0, 0, 10, 10);
 * const second = Experimental.AABB2D.create(5, 5, 20, 12);
 * console.log(first.overlaps(second));
 * const combined = Experimental.AABB2D.combine(first, second);
 * console.log(combined.minX, combined.minY, combined.maxX, combined.maxY, combined.getPerimeter());
 */
export class AABB2D extends Object {
	//==============================================================================
	// 멤버 변수 목록.
	//==============================================================================
	/** @type { number } */ minX; // 가장 작은 x.
	/** @type { number } */ minY; // 가장 작은 y.
	/** @type { number } */ maxX; // 가장 큰 x.
	/** @type { number } */ maxY; // 가장 큰 y.

	//==============================================================================
	// 생성. (모두 0)
	//==============================================================================
	/**
	 * @constructor
	 */
	constructor() {
		super();
		this.minX = 0;
		this.minY = 0;
		this.maxX = 0;
		this.maxY = 0;
	}

	//==============================================================================
	// 네 값으로 만들기. (정적)
	//==============================================================================
	/**
	 * @param { number } minX 가장 작은 x.
	 * @param { number } minY 가장 작은 y.
	 * @param { number } maxX 가장 큰 x.
	 * @param { number } maxY 가장 큰 y.
	 * @returns { AABB2D } 새 상자.
	 */
	static create(minX, minY, maxX, maxY) {
		const aabb = new AABB2D();
		aabb.minX = minX;
		aabb.minY = minY;
		aabb.maxX = maxX;
		aabb.maxY = maxY;
		return aabb;
	}

	//==============================================================================
	// 두 상자를 감싸는 상자. (정적)
	//==============================================================================
	/**
	 * @param { AABB2D } first 첫 상자.
	 * @param { AABB2D } second 둘째 상자.
	 * @returns { AABB2D } 둘을 모두 담는 가장 작은 상자.
	 */
	static combine(first, second) {
		return AABB2D.create(System.Math.min(first.minX, second.minX), System.Math.min(first.minY, second.minY), System.Math.max(first.maxX, second.maxX), System.Math.max(first.maxY, second.maxY));
	}

	//==============================================================================
	// 복사본 반환.
	//==============================================================================
	/**
	 * @returns { AABB2D } 같은 값의 새 상자.
	 */
	clone() {
		return AABB2D.create(this.minX, this.minY, this.maxX, this.maxY);
	}

	//==============================================================================
	// 값 설정.
	//==============================================================================
	/**
	 * @param { number } minX 가장 작은 x.
	 * @param { number } minY 가장 작은 y.
	 * @param { number } maxX 가장 큰 x.
	 * @param { number } maxY 가장 큰 y.
	 */
	set(minX, minY, maxX, maxY) {
		this.minX = minX;
		this.minY = minY;
		this.maxX = maxX;
		this.maxY = maxY;
	}

	//==============================================================================
	// 둘레 반환. (나무가 표면적 휴리스틱의 값으로 쓴다)
	//==============================================================================
	/**
	 * @returns { number } 둘레. (2 x (너비 + 높이))
	 */
	getPerimeter() {
		const width = this.maxX - this.minX;
		const height = this.maxY - this.minY;
		return 2 * (width + height);
	}

	//==============================================================================
	// 다른 상자와 겹치는지. (경계가 닿기만 해도 겹친다)
	//==============================================================================
	/**
	 * @param { AABB2D } other 견줄 상자.
	 * @returns { boolean } 겹치거나 닿으면 참.
	 */
	overlaps(other) {
		if (other.minX > this.maxX || other.minY > this.maxY) {
			return false;
		}
		if (this.minX > other.maxX || this.minY > other.maxY) {
			return false;
		}
		return true;
	}

	//==============================================================================
	// 다른 상자를 통째로 담는지. (경계 위도 담은 것으로 친다)
	//==============================================================================
	/**
	 * @param { AABB2D } other 견줄 상자.
	 * @returns { boolean } other 가 이 상자 안에 있으면 참.
	 */
	contains(other) {
		return this.minX <= other.minX && this.minY <= other.minY && other.maxX <= this.maxX && other.maxY <= this.maxY;
	}

	//==============================================================================
	// 점을 담는지. (경계 위도 담은 것으로 친다)
	//==============================================================================
	/**
	 * @param { number } x 점의 x.
	 * @param { number } y 점의 y.
	 * @returns { boolean } 점이 상자 안이나 경계 위에 있으면 참.
	 */
	containsPoint(x, y) {
		return this.minX <= x && x <= this.maxX && this.minY <= y && y <= this.maxY;
	}
}
