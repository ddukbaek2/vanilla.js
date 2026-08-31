//==============================================================================
// 포함 모듈 목록.
//==============================================================================
const System = globalThis;
import { Object } from "./object.js";
import * as Math from "../base/math.js";


//==============================================================================
// 색상.
//==============================================================================
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
	 * @param { number } red
	 * @param { number } green
	 * @param { number } blue
	 * @param { number } alpha
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
		this.#red = Math.clamp(value, 0.0, 1.0);
	}

	//==============================================================================
	// 적색 반환 프로퍼티.
	//==============================================================================
	/**
	 * @property
	 * @returns { number }
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
		this.#blue = Math.clamp(value, 0.0, 1.0);
	}

	//==============================================================================
	// 청색 반환 프로퍼티.
	//==============================================================================
	/**
	 * @property
	 * @returns { number }
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
		this.#green = Math.clamp(value, 0.0, 1.0);
	}

	//==============================================================================
	// 녹색 반환 프로퍼티.
	//==============================================================================
	/**
	 * @property
	 * @returns { number }
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
		this.#alpha = Math.clamp(value, 0.0, 1.0);
	}

	//==============================================================================
	// 투명색 반환 프로퍼티.
	//==============================================================================
	/**
	 * @property
	 * @returns { number }
	 */
	get alpha() {
		return this.#alpha;
	}

	//==============================================================================
	// RGBA 문자열 반환 프로퍼티.
	// - rgba(255, 255, 255, 1.0)
	//==============================================================================
	/**
	 * @returns { string }
	 */
	toRGBAString() {
		const red = Math.round(this.red * 255);
		const green = Math.round(this.green * 255);
		const blue = Math.round(this.blue * 255);
		if (this.alpha < 1.0) {
			const alpha = this.alpha;
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
	 * @returns { string }
	 */
	toHEXString() {
		const red = Math.round(this.red * 255).toString(16).padStart(2, "0");
		const green = Math.round(this.green * 255).toString(16).padStart(2, "0");
		const blue = Math.round(this.blue * 255).toString(16).padStart(2, "0");
		if (this.alpha < 1.0) {
			const alpha = Math.round(this.alpha * 255).toString(16).padStart(2, "0");
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
	 * @returns { this }
	 */
	clone() {
		const obj = super.clone();
		return obj;
	}

	//==============================================================================
	// 하얀색 생성.
	//==============================================================================
	/**
	 * @returns { Color }
	 */
	static white() {
		const color = new Color(1, 1, 1, 1);
		return color;
	}

	//==============================================================================
	// 검은색 생성.
	//==============================================================================
	/**
	 * @returns { Color }
	 */
	static black() {
		const color = new Color(0, 0, 0, 1);
		return color;
	}

	//==============================================================================
	// 투명색 생성.
	//==============================================================================
	/**
	 * @returns { Color }
	 */
	static transparent() {
		const color = new Color(0, 0, 0, 0);
		return color;
	}

	//==============================================================================
	// 생성.
	// - #fff
	// - #ffff
	// - #ffffff
	// - #ffffffff
	//==============================================================================
	/**
	 * @param { string } colorString 
	 * @returns { Color }
	 */
	//==============================================================================
	// 캐시를 거치는 HEX 색 생성. (정적)
	// - 매 프레임 같은 문자열로 Color 를 새로 만들며 생기는 GC 압박을 줄인다.
	// - 반환된 인스턴스는 공유되므로 절대 고쳐 쓰지 않는다. 고칠 거면 clone() 한다.
	// - 알파는 0.01 단위로 양자화해 캐시가 불어나는 것을 막는다.
	//==============================================================================
	/**
	 * @param { string } colorString
	 * @param { number } alpha
	 * @returns { Color }
	 */
	static fromHEXCached(colorString, alpha = 1) {
		const quantizedAlpha = System.Math.round(alpha * 100) / 100;
		const cacheKey = colorString + "@" + quantizedAlpha;
		let cachedColor = Color.#hexCache.get(cacheKey);
		if (!cachedColor) {
			cachedColor = Color.createFromHEX(colorString);
			cachedColor.alpha = quantizedAlpha;
			Color.#hexCache.set(cacheKey, cachedColor);
		}
		return cachedColor;
	}

	/** @private @type { Map } */ static #hexCache = new System.Map();

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
	// 랜덤 색상 생성. (알파값은 1)
	//==============================================================================
	/**
	 * @returns { Color }
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
     * @param { string } colorString 
     * @returns { Color }
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