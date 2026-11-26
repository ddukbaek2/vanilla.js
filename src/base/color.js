//==============================================================================
// 포함 모듈 목록.
//==============================================================================
const System = globalThis;
import { Object } from "./object.js";
import * as Math from "../base/math.js";


//==============================================================================
// 전역 함수 목록.
//==============================================================================
//==============================================================================
// 성분을 0 ~ 255 정수로. (반올림해 0 ~ 255 로 자른다)
//==============================================================================
/**
 * @param { number } component 성분. (보통 0 ~ 1)
 * @returns { number }
 */
function toByteComponent(component) {
	const byteValue = Math.clamp(Math.round(component * 255), 0, 255);
	return byteValue;
}


//==============================================================================
// 색상.
// - 성분은 0 ~ 1 이 보통이지만 밖의 값도 자르지 않고 그대로 담는다. (빛나는 색처럼 1 을 넘는 HDR 색, 유니티 Color 와 같다)
// - 0 ~ 255 의 글로 낼 때(toRGBAString, toHEXString)만 0 ~ 255 와 알파 0 ~ 1 로 자른다. (유니티 Color32 로 바꿀 때와 같다)
//==============================================================================
/**
 * @example <caption>문자열로 만들고 섞어 문자열로 내기</caption>
 * import { Color } from "./build/vanilla.js";
 *
 * const red = Color.createFromHEX("#ff0000");
 * const blue = Color.createFromRGBA("rgba(0, 0, 255, 0.5)");
 * const purple = Color.lerp(red, blue, 0.5);
 * console.log(purple.toHEXString(), purple.toRGBAString());
 * const faded = red.withAlpha(0.25);
 * console.log(faded.toRGBAString());
 */
export class Color extends Object {
	//==============================================================================
	// 멤버 변수 목록.
	//==============================================================================
	/** @private @type { number } */ #red;
	/** @private @type { number } */ #green;
	/** @private @type { number } */ #blue;
	/** @private @type { number } */ #alpha;

	//==============================================================================
	// 생성.
	//==============================================================================
	/**
	 * @constructor
	 * @param { number } red 빨강. (보통 0 ~ 1, 기본 1, 밖의 값도 그대로 담는다)
	 * @param { number } green 초록. (보통 0 ~ 1, 기본 1, 밖의 값도 그대로 담는다)
	 * @param { number } blue 파랑. (보통 0 ~ 1, 기본 1, 밖의 값도 그대로 담는다)
	 * @param { number } alpha 알파. (보통 0 ~ 1, 기본 1, 밖의 값도 그대로 담는다)
	 */
	constructor(red = 1.0, green = 1.0, blue = 1.0, alpha = 1.0) {
		super();
		this.red = red;
		this.green = green;
		this.blue = blue;
		this.alpha = alpha;
	}

	//==============================================================================
	// 적색 설정 프로퍼티.
	//==============================================================================
	/**
	 * @property
	 * @param { number } value
	 */
	set red(value) {
		this.#red = value;
	}

	//==============================================================================
	// 적색 반환 프로퍼티.
	//==============================================================================
	/**
	 * @property
	 * @returns { number } 빨강. (보통 0 ~ 1, HDR 색이면 1 을 넘을 수 있다)
	 */
	get red() {
		return this.#red;
	}

	//==============================================================================
	// 청색 설정 프로퍼티.
	//==============================================================================
	/**
	 * @property
	 * @param { number } value
	 */
	set blue(value) {
		this.#blue = value;
	}

	//==============================================================================
	// 청색 반환 프로퍼티.
	//==============================================================================
	/**
	 * @property
	 * @returns { number } 파랑. (보통 0 ~ 1, HDR 색이면 1 을 넘을 수 있다)
	 */
	get blue() {
		return this.#blue;
	}

	//==============================================================================
	// 녹색 설정 프로퍼티.
	//==============================================================================
	/**
	 * @property
	 * @param { number } value
	 */
	set green(value) {
		this.#green = value;
	}

	//==============================================================================
	// 녹색 반환 프로퍼티.
	//==============================================================================
	/**
	 * @property
	 * @returns { number } 초록. (보통 0 ~ 1, HDR 색이면 1 을 넘을 수 있다)
	 */
	get green() {
		return this.#green;
	}

	//==============================================================================
	// 투명색 설정 프로퍼티.
	//==============================================================================
	/**
	 * @property
	 * @param { number } value
	 */
	set alpha(value) {
		this.#alpha = value;
	}

	//==============================================================================
	// 투명색 반환 프로퍼티.
	//==============================================================================
	/**
	 * @property
	 * @returns { number } 알파. (보통 0 ~ 1, 담은 값 그대로)
	 */
	get alpha() {
		return this.#alpha;
	}

	//==============================================================================
	// RGBA 문자열 반환 프로퍼티.
	// - rgba(255, 255, 255, 1.0)
	//==============================================================================
	/**
	 * @returns { string } "rgb(r, g, b)", 알파가 1 보다 작으면 "rgba(r, g, b, a)". (r, g, b 는 0 ~ 255 로 자른 정수, a 는 0 ~ 1 로 자른다)
	 */
	toRGBAString() {
		const red = toByteComponent(this.red);
		const green = toByteComponent(this.green);
		const blue = toByteComponent(this.blue);
		if (this.alpha < 1.0) {
			const alpha = Math.clamp(this.alpha, 0.0, 1.0);
			return `rgba(${red}, ${green}, ${blue}, ${alpha})`;
		}
		else {
			return `rgb(${red}, ${green}, ${blue})`;
		}
	}

	//==============================================================================
	// HEX 문자열 반환 프로퍼티.
	// - #ffffff
	// - #ffffffff
	//==============================================================================
	/**
	 * @returns { string } "#rrggbb", 알파가 1 보다 작으면 "#rrggbbaa". (성분마다 0 ~ 255 로 자른 두 자리)
	 */
	toHEXString() {
		const red = toByteComponent(this.red).toString(16).padStart(2, "0");
		const green = toByteComponent(this.green).toString(16).padStart(2, "0");
		const blue = toByteComponent(this.blue).toString(16).padStart(2, "0");
		if (this.alpha < 1.0) {
			const alpha = toByteComponent(this.alpha).toString(16).padStart(2, "0");
			return `#${red}${green}${blue}${alpha}`;
		}
		else {
			return `#${red}${green}${blue}`;
		}
	}
	//==============================================================================
	// 복제.
	//==============================================================================
	/**
	 * @override
	 * @returns { this } 성분이 같은 새 색.
	 */
	clone() {
		// 프로토타입을 훑는 Reflection.clone 을 거치지 않고 rgba 를 바로 옮긴다. (setFillColor 처럼 그릴 때마다 부르는 곳이 있다)
		const red = this.red;
		const green = this.green;
		const blue = this.blue;
		const alpha = this.alpha;
		const obj = /** @type { this } */ (new Color(red, green, blue, alpha));
		return obj;
	}

	//==============================================================================
	// 하얀색 생성.
	//==============================================================================
	/**
	 * @returns { Color } (1, 1, 1, 1) 새 색.
	 */
	static white() {
		const color = new Color(1, 1, 1, 1);
		return color;
	}

	//==============================================================================
	// 검은색 생성.
	//==============================================================================
	/**
	 * @returns { Color } (0, 0, 0, 1) 새 색.
	 */
	static black() {
		const color = new Color(0, 0, 0, 1);
		return color;
	}

	//==============================================================================
	// 투명색 생성.
	//==============================================================================
	/**
	 * @returns { Color } (0, 0, 0, 0) 새 색.
	 */
	static transparent() {
		const color = new Color(0, 0, 0, 0);
		return color;
	}

	//==============================================================================
	// 캐시를 거치는 HEX 색 생성. (정적)
	// - 매 프레임 같은 문자열로 Color 를 새로 만들며 생기는 GC 압박을 줄인다.
	// - 반환된 인스턴스는 공유되므로 절대 고쳐 쓰지 않는다. 고칠 거면 clone() 한다.
	// - 알파는 0.01 단위로 양자화해 캐시가 불어나는 것을 막는다.
	// - fromCache 처럼 오래 안 쓴 것부터 버린다. (1024 개까지)
	//==============================================================================
	/**
	 * @param { string } colorString HEX 색 문자열. (createFromHEX 와 같은 꼴)
	 * @param { number } alpha 알파. (0 ~ 1, 기본 1, 문자열에 든 알파 대신 쓴다)
	 * @returns { Color } 캐시에 든 공유 색. (고쳐 쓰지 않는다)
	 * @example <caption>그릴 때마다 같은 색을 캐시에서 받기</caption>
	 * import { Color } from "./build/vanilla.js";
	 *
	 * const first = Color.fromHEXCached("#336699", 0.5);
	 * const second = Color.fromHEXCached("#336699", 0.5);
	 * console.log(first === second);
	 * const editable = first.clone();
	 * editable.red = 1;
	 * console.log(first.toHEXString(), editable.toHEXString());
	 */
	static fromHEXCached(colorString, alpha = 1) {
		const quantizedAlpha = System.Math.round(alpha * 100) / 100;
		const cacheKey = colorString + "@" + quantizedAlpha;
		const colorCache = Color.#hexCache;
		let cachedColor = colorCache.get(cacheKey);
		if (cachedColor !== undefined) {
			colorCache.delete(cacheKey);
			colorCache.set(cacheKey, cachedColor);
			return cachedColor;
		}
		cachedColor = Color.createFromHEX(colorString);
		cachedColor.alpha = quantizedAlpha;
		colorCache.set(cacheKey, cachedColor);
		while (colorCache.size > 1024) {
			const oldestCacheKey = colorCache.keys().next().value;
			colorCache.delete(oldestCacheKey);
		}
		return cachedColor;
	}

	/** @private @type { Map } */ static #hexCache = new System.Map();

	//==============================================================================
	// 색 인자 읽기. (정적, 러스트 판 From<&str> for Color 의 짝)
	// - 색을 받는 설정 함수들이 이것으로 Color 와 색 글("#rrggbb", "#rgb", "rgba(...)" 같은)을 함께 받는다.
	// - Color 를 주면 그 인스턴스를 그대로 돌려준다. (복사할지는 부른 쪽이 정한다) 색 글이면 fromCache 로 읽은 새 복사본을 준다.
	//==============================================================================
	/**
	 * @param { Color | string } value 색이나 색 글. (fromCache 가 읽는 꼴, 그 밖의 글은 흰색)
	 * @returns { Color } Color 면 그것, 색 글이면 새 Color.
	 * @example <caption>색 글과 Color 를 같은 자리에 주기</caption>
	 * import { Color, Paint } from "./build/vanilla.js";
	 *
	 * const fromText = Color.from("#ff8000");
	 * console.log(fromText.toHEXString());
	 * const red = new Color(1, 0, 0, 1);
	 * console.log(Color.from(red) === red);
	 * const paint = new Paint();
	 * paint.setColor("#336699");
	 * console.log(paint.getColor().toHEXString());
	 */
	static from(value) {
		if (typeof value === "string") {
			return Color.fromCache(value).clone();
		}
		return value;
	}

	//==============================================================================
	// 색 문자열로 캐시한 색 반환. (정적, "#rgb", "#rgba", "#rrggbb", "#rrggbbaa", "rgb(...)", "rgba(...)", 그 밖은 흰색)
	// - 같은 문자열이면 같은 인스턴스를 준다. 매 프레임 같은 문자열로 색을 정할 때 문자열을 다시 풀지 않는다.
	// - 반환된 인스턴스는 공유되므로 절대 고쳐 쓰지 않는다. 고칠 거면 clone() 한다.
	// - 오래 안 쓴 것부터 버린다. (1024 개까지)
	//==============================================================================
	/**
	 * @param { string } colorString 색 문자열.
	 * @returns { Color } 캐시에 든 공유 색. (고쳐 쓰지 않는다)
	 */
	static fromCache(colorString) {
		const colorCache = Color.#stringCache;
		let cachedColor = colorCache.get(colorString);
		if (cachedColor !== undefined) {
			colorCache.delete(colorString);
			colorCache.set(colorString, cachedColor);
			return cachedColor;
		}
		const trimmedColorString = colorString.trim().toLowerCase();
		if (trimmedColorString.startsWith("#")) {
			cachedColor = Color.createFromHEX(trimmedColorString);
		}
		else if (trimmedColorString.startsWith("rgb")) {
			cachedColor = Color.createFromRGBA(trimmedColorString);
		}
		else {
			cachedColor = Color.white();
		}
		colorCache.set(colorString, cachedColor);
		while (colorCache.size > 1024) {
			const oldestColorString = colorCache.keys().next().value;
			colorCache.delete(oldestColorString);
		}
		return cachedColor;
	}

	//==============================================================================
	// 색 문자열 캐시(fromCache)에 든 수. (정적, 시험과 통계용)
	//==============================================================================
	/**
	 * @returns { number } fromCache 캐시에 든 색 수. (1024 개까지)
	 */
	static getCachedColorCount() {
		return Color.#stringCache.size;
	}

	/** @private @type { Map<string, Color> } */ static #stringCache = new System.Map();

	//==============================================================================
	// HEX 문자열로 생성. (정적, "#rgb", "#rgba", "#rrggbb", "#rrggbbaa", "#" 로 시작하지 않으면 흰색)
	//==============================================================================
	/**
	 * @param { string } colorString HEX 색 문자열. (앞뒤 공백과 대소문자는 가리지 않는다)
	 * @returns { Color } 새 색. (알파가 없는 꼴이면 알파 1)
	 */
	static createFromHEX(colorString) {
		const color = new Color(1.0, 1.0, 1.0, 1.0);
		colorString = colorString.trim().toLowerCase();
		if (colorString.startsWith("#")) {
			let hex = colorString.substring(1);

			// 3자리나 4자리의 축약형 색상 코드 일 경우.
			if (hex.length === 3 || hex.length === 4) {
				hex = System.Array.from(hex).map(char => char + char).join("");
			}

			color.red = System.Number.parseInt(hex.substring(0, 2), 16) / 255.0;
			color.green = System.Number.parseInt(hex.substring(2, 4), 16) / 255.0;
			color.blue = System.Number.parseInt(hex.substring(4, 6), 16) / 255.0;
			if (hex.length === 8) {
				color.alpha = System.Number.parseInt(hex.substring(6, 8), 16) / 255.0;
			}
		}

		return color;
	}

	//==============================================================================
	// 0 ~ 255 정수 성분으로 생성.
	//==============================================================================
	/**
	 * @param { number } red 빨강. (0 ~ 255)
	 * @param { number } green 초록. (0 ~ 255)
	 * @param { number } blue 파랑. (0 ~ 255)
	 * @param { number } alpha 알파. (0 ~ 255)
	 * @returns { Color } 새 색.
	 */
	static createFromBytes(red, green, blue, alpha) {
		const color = new Color(red / 255, green / 255, blue / 255, alpha / 255);
		return color;
	}

	//==============================================================================
	// 알파만 바꾼 색. (새 색을 돌려주고 이 색은 그대로 둔다)
	//==============================================================================
	/**
	 * @param { number } alpha 새 알파. (0 ~ 1)
	 * @returns { Color } 빨강, 초록, 파랑은 같고 알파만 바꾼 새 색.
	 */
	withAlpha(alpha) {
		const red = this.red;
		const green = this.green;
		const blue = this.blue;
		const color = new Color(red, green, blue, alpha);
		return color;
	}

	//==============================================================================
	// 선형 보간. (정적, 성분마다)
	//==============================================================================
	/**
	 * @param { Color } from 시작 색.
	 * @param { Color } to 끝 색.
	 * @param { number } time 0 이면 from, 1 이면 to.
	 * @returns { Color } 성분마다 보간한 새 색. (성분은 0 ~ 1 로 자른다)
	 */
	static lerp(from, to, time) {
		const red = Math.lerp(from.red, to.red, time);
		const green = Math.lerp(from.green, to.green, time);
		const blue = Math.lerp(from.blue, to.blue, time);
		const alpha = Math.lerp(from.alpha, to.alpha, time);
		const color = new Color(red, green, blue, alpha);
		return color;
	}

	//==============================================================================
	// 랜덤 색상 생성. (알파값은 1)
	//==============================================================================
	/**
	 * @returns { Color } 빨강, 초록, 파랑이 0 ~ 1 난수이고 알파가 1 인 새 색.
	 */
	static random() {
		const color = new Color(Math.random(), Math.random(), Math.random(), 1);
		return color;
	}

    //==============================================================================
    // 생성.
    // - rgb(255, 255, 255)
    // - rgba(255, 255, 255, 1.0)
    //==============================================================================
    /**
     * @param { string } colorString "rgb(r, g, b)" 나 "rgba(r, g, b, a)" 문자열. (r, g, b 는 0 ~ 255 정수, a 는 0 ~ 1)
     * @returns { Color } 새 색. (꼴이 맞지 않으면 흰색)
     */
    static createFromRGBA(colorString) {
        const color = new Color(1.0, 1.0, 1.0, 1.0);
        colorString = colorString.trim().toLowerCase();
        if (colorString.startsWith("rgb")) {
            const match = colorString.match(/rgba?\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)(?:\s*,\s*([\d.]+))?\s*\)/);
            if (match) {
                color.red = System.Number.parseInt(match[1], 10) / 255.0;
                color.green = System.Number.parseInt(match[2], 10) / 255.0;
                color.blue = System.Number.parseInt(match[3], 10) / 255.0;
                if (match[4] !== undefined) {
                    color.alpha = System.Number.parseFloat(match[4]);
                }
            }
        }

        return color;
    }
}