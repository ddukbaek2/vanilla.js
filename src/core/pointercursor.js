//==============================================================================
// 포함 모듈 목록.
//==============================================================================
const System = globalThis;
import { Singleton } from "../base/singleton.js";


//==============================================================================
// 전역 상수 목록.
//==============================================================================
// 캔버스에 써도 되는 CSS 커서 이름. (그 밖의 이름은 비워 브라우저의 기본 화살표에 맡긴다)
const SHOWN_CURSOR_NAMES = ["pointer", "crosshair", "not-allowed", "grab", "grabbing", "text", "move", "help", "wait", "progress", "none"];


//==============================================================================
// 마우스 커서.
// - 켜면(setEnabled(true)) 엔진이 프레임 끝마다 캔버스의 커서를 정한다. 꺼져 있으면(기본) 아무것도 하지 않아 지금까지와 같다.
// - UIButton 위에 마우스가 있으면 단추의 커서(처음은 손가락 pointer), 아니면 화면이 setScreenCursor 로 정한 커서다.
// - 값은 CSS cursor 의 이름이거나 registerImageCursor 로 더한 그림 커서의 이름이다. 바뀔 때만 캔버스에 쓴다.
// - default 는 기본 커서(처음은 브라우저의 기본 화살표)이고, 모르는 이름은 캔버스의 커서 값을 비워 브라우저의 기본 화살표가 보이게 한다.
// - 그림 커서는 1 배와 2 배 그림을 같이 주고(-webkit-image-set), 그것을 못 읽는 브라우저는 1 배 그림, 그림을 못 받으면 함께 준 CSS 커서다.
// - 손가락 기기(pointer: coarse)에서는 캔버스를 건드리지 않는다.
//==============================================================================
/**
 * @example <caption>화면 커서와 단추 위 그림 커서 정하기</caption>
 * import { Engine, EngineConfiguration, Scene, PointerCursor } from "./build/vanilla.js";
 *
 * const engineConfiguration = new EngineConfiguration();
 * const engine = new Engine(engineConfiguration);
 * const pointerCursor = PointerCursor.getInstance();
 * pointerCursor.registerImageCursor("hand", "assets/icons/icon.png", "", 4, 4, "pointer");
 * pointerCursor.setCursorNames("hand", "default");
 * pointerCursor.setScreenCursor("crosshair");
 * pointerCursor.setEnabled(true);
 * engine.run(new Scene());
 * const cursorValue = pointerCursor.readCursorValue("crosshair");
 * console.log(cursorValue);
 */
export class PointerCursor extends Singleton {
	//==============================================================================
	// 멤버 변수 목록.
	//==============================================================================
	/** @private @type { boolean } */ #isEnabled; // 켜져 있는지.
	/** @private @type { Map<string, string> } */ #imageCursorValues; // 더한 그림 커서. (이름 → 캔버스에 쓸 CSS cursor 값)
	/** @private @type { string } */ #buttonCursorName; // 단추 위의 커서.
	/** @private @type { string } */ #defaultCursorName; // default 일 때의 커서.
	/** @private @type { string } */ #screenCursorName; // 화면이 정한 커서.
	/** @private @type { boolean } */ #isOverButton; // 이번 프레임에 단추 위에 있었는지.
	/** @private @type { string | null } */ #appliedCursorValue; // 마지막으로 쓴 값. (아직 쓰지 않았으면 null)

	//==============================================================================
	// 생성.
	//==============================================================================
	/**
	 * @constructor
	 */
	constructor() {
		super();
		this.#isEnabled = false;
		this.#imageCursorValues = new System.Map();
		this.#buttonCursorName = "pointer";
		this.#defaultCursorName = "default";
		this.#screenCursorName = "default";
		this.#isOverButton = false;
		this.#appliedCursorValue = null;
	}

	//==============================================================================
	// 켜기 설정. (끄면 캔버스의 커서를 비운다)
	//==============================================================================
	/**
	 * @param { boolean } isEnabled 참이면 켠다.
	 */
	setEnabled(isEnabled) {
		this.#isEnabled = isEnabled;
		if (!isEnabled) {
			this.#isOverButton = false;
			this.#appliedCursorValue = null;
			const canvas = PointerCursor.readEngineCanvas();
			if (canvas) {
				canvas.style.cursor = "";
			}
		}
	}

	//==============================================================================
	// 켜져 있는지 반환.
	//==============================================================================
	/**
	 * @returns { boolean } 켜져 있으면 참.
	 */
	isEnabled() {
		return this.#isEnabled;
	}

	//==============================================================================
	// 마우스가 단추 위에 있다고 알리기. (올려 둔 단추가 매 프레임 부른다)
	//==============================================================================
	markOverButton() {
		this.#isOverButton = true;
	}

	//==============================================================================
	// 화면의 커서 설정. (단추 위가 아닐 때 보일 커서)
	//==============================================================================
	/**
	 * @param { string } cursorName - CSS cursor 이름이나 더한 그림 커서의 이름.
	 */
	setScreenCursor(cursorName) {
		this.#screenCursorName = cursorName;
	}

	//==============================================================================
	// 화면의 커서 반환.
	//==============================================================================
	/**
	 * @returns { string } 화면의 커서 이름.
	 */
	getScreenCursor() {
		return this.#screenCursorName;
	}

	//==============================================================================
	// 단추 위와 기본의 커서 설정. (CSS cursor 의 이름이나 더한 그림 커서의 이름)
	//==============================================================================
	/**
	 * @param { string } buttonCursorName - 단추 위의 커서.
	 * @param { string } defaultCursorName - 화면의 커서가 default 일 때의 커서.
	 */
	setCursorNames(buttonCursorName, defaultCursorName) {
		this.#buttonCursorName = buttonCursorName;
		this.#defaultCursorName = defaultCursorName;
	}

	//==============================================================================
	// 단추 위의 커서 반환.
	//==============================================================================
	/**
	 * @returns { string } 단추 위의 커서 이름.
	 */
	getButtonCursorName() {
		return this.#buttonCursorName;
	}

	//==============================================================================
	// 기본의 커서 반환.
	//==============================================================================
	/**
	 * @returns { string } 화면의 커서가 default 일 때의 커서 이름.
	 */
	getDefaultCursorName() {
		return this.#defaultCursorName;
	}

	//==============================================================================
	// 그림 커서 더하기. (1 배와 2 배 그림, 1 배 그림 기준의 핫스팟, 그림을 못 쓸 때의 CSS 커서)
	// - 마우스가 있는 기기면 처음 올렸을 때 깜빡이지 않게 그림을 미리 받는다.
	//==============================================================================
	/**
	 * @param { string } name - 커서 이름.
	 * @param { string } url - 1 배 그림의 주소.
	 * @param { string } url2x - 2 배 그림의 주소. (없으면 "")
	 * @param { number } hotspotX - 1 배 그림의 핫스팟. (픽셀)
	 * @param { number } hotspotY 핫스팟의 Y. (픽셀, 1 배 그림 기준, 반올림)
	 * @param { string } fallbackCursorName - 그림을 못 쓸 때의 CSS cursor 이름.
	 */
	registerImageCursor(name, url, url2x, hotspotX, hotspotY, fallbackCursorName) {
		const roundedHotspotX = System.Math.round(hotspotX);
		const roundedHotspotY = System.Math.round(hotspotY);
		const hotspotText = ` ${roundedHotspotX} ${roundedHotspotY}, ${fallbackCursorName}`;
		let cursorValue = `url("${url}")${hotspotText}`;
		const css = System.CSS;
		if (url2x !== "" && css !== undefined && typeof css.supports === "function") {
			const imageSetValue = `-webkit-image-set(url("${url}") 1x, url("${url2x}") 2x)${hotspotText}`;
			if (css.supports("cursor", imageSetValue)) {
				cursorValue = imageSetValue;
			}
		}
		this.#imageCursorValues.set(name, cursorValue);
		if (!PointerCursor.isCoarsePointer()) {
			const devicePixelRatio = System.devicePixelRatio || 1;
			const preloadUrl = url2x !== "" && devicePixelRatio > 1 ? url2x : url;
			const image = new System.Image();
			image.src = preloadUrl;
		}
	}

	//==============================================================================
	// 커서 이름을 캔버스에 쓸 값으로. (그림 커서면 그 CSS 값, 쓸 수 있는 CSS 이름이면 그대로, 아니면 "")
	//==============================================================================
	/**
	 * @param { string } cursorName 커서 이름.
	 * @returns { string } 캔버스의 style.cursor 에 쓸 값. (모르는 이름이면 "")
	 */
	readCursorValue(cursorName) {
		const imageCursorValue = this.#imageCursorValues.get(cursorName);
		if (imageCursorValue !== undefined) {
			return imageCursorValue;
		}
		return SHOWN_CURSOR_NAMES.includes(cursorName) ? cursorName : "";
	}

	//==============================================================================
	// 커서 정하기. (엔진이 프레임 끝마다 부른다, 단추 표시를 비운다)
	//==============================================================================
	apply() {
		if (!this.isEnabled()) {
			return;
		}
		const buttonCursorName = this.getButtonCursorName();
		const screenCursorName = this.getScreenCursor();
		let wantedCursorName = this.#isOverButton ? buttonCursorName : screenCursorName;
		if (wantedCursorName === "default") {
			wantedCursorName = this.getDefaultCursorName();
		}
		const cursorValue = this.readCursorValue(wantedCursorName);
		this.#isOverButton = false;
		if (cursorValue === this.#appliedCursorValue || PointerCursor.isCoarsePointer()) {
			return;
		}
		const canvas = PointerCursor.readEngineCanvas();
		if (!canvas) {
			return;
		}
		canvas.style.cursor = cursorValue;
		this.#appliedCursorValue = cursorValue;
	}

	//==============================================================================
	// 주된 손이 손가락인지 반환.
	//==============================================================================
	/**
	 * @static
	 * @returns { boolean } 주된 손이 손가락이면 참.
	 */
	static isCoarsePointer() {
		if (typeof System.matchMedia !== "function") {
			return false;
		}
		const mediaQueryList = System.matchMedia("(pointer: coarse)");
		return mediaQueryList.matches;
	}

	//==============================================================================
	// 엔진의 캔버스 읽기. (엔진은 전역 접근자로 얻어 순환 참조를 만들지 않는다, 없으면 null)
	//==============================================================================
	/**
	 * @static
	 * @returns { HTMLCanvasElement | null } 엔진의 캔버스. (엔진이 없으면 null)
	 */
	static readEngineCanvas() {
		const engine = System.vanillaEngine;
		if (!engine) {
			return null;
		}
		const canvas = engine.getCanvas();
		return canvas || null;
	}
}
