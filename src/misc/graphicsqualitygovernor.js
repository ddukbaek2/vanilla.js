//==============================================================================
// 포함 모듈 목록.
//==============================================================================
const System = globalThis;
import { FrameProbe } from "./frameprobe.js";


//==============================================================================
// 그래픽 품질 설정 값.
//==============================================================================
export const GraphicsQuality = System.Object.freeze({
	auto: "auto", // 자동. (프레임 재기로 정한다)
	high: "high", // 높음. (늘 가벼운 길이 아니다)
	low: "low", // 낮음. (늘 가벼운 길)
});


//==============================================================================
// 그래픽 품질 정하기. (설정과 프레임 재기로 가벼운 길을 쓸지 정하고, 렌더 배율 상한을 고른다)
// - 가벼운 길(isLite)을 정하는 차례: 덮어쓰기(주소의 ?light 같은 것) → 설정 낮음(늘 가벼움), 높음(늘 아님) → 자동.
//   자동이면 처음부터 가벼운 길(setAutoLiteDefault, 손가락 기기 같은 것)이거나 FrameProbe 가 처지는 기기로 잰 때 가벼운 길이다.
// - 매 프레임 update(프레임 초, 최대 프레임) 를 부르면 자동일 때만 FrameProbe 로 잰다. 가벼운 길이 바뀐 프레임에 true 를 돌려준다.
//   한 번 처지는 기기로 재면 다시 재지 않는다. (FrameProbe 와 같다)
// - 렌더 배율 상한: setRenderPixelRatioLimits(보통, 가벼운 길) 로 주고 applyRenderPixelRatio(viewManager) 가 바뀔 때만 건다. (0 이면 제한 없음)
// - 가벼운 길에서 무엇을 줄일지(그림자, 바깥선, 효과, 그리는 수)는 게임이 isLite 를 읽어 정한다.
// - 엔진과 브라우저를 들여오지 않는다. 주소 글은 부르는 쪽이 applySearchText(location.search) 로 넘긴다.
//==============================================================================
/**
 * @example <caption>설정과 프레임 재기로 가벼운 길 정하기</caption>
 * import { GraphicsQualityGovernor, GraphicsQuality } from "./build/vanilla.js";
 *
 * const governor = new GraphicsQualityGovernor();
 * governor.setQuality(GraphicsQuality.auto);
 * governor.applySearchText("?mode=demo");
 * governor.setRenderPixelRatioLimits(2, 1);
 * const frameProbe = governor.getFrameProbe();
 * frameProbe.setSeconds(0.5, 1);
 * for (let frame = 0; frame < 120; ++frame) {
 * 	const isChanged = governor.update(1 / 20, 60);
 * 	if (isChanged) {
 * 		console.log("lite", governor.isLite(), frame);
 * 	}
 * }
 * console.log(governor.isLite(), governor.readMaxRenderPixelRatio());
 */
export class GraphicsQualityGovernor {
	//==============================================================================
	// 멤버 변수 목록.
	//==============================================================================
	/** @private @type { string } */ #quality; // GraphicsQuality.
	/** @private @type { boolean | null } */ #liteOverride; // 덮어쓰기. (null 이면 없음)
	/** @private @type { boolean } */ #isAutoLiteDefault; // 자동일 때 처음부터 가벼운 길인지.
	/** @private @type { FrameProbe } */ #frameProbe;
	/** @private @type { number } */ #normalMaxRenderPixelRatio; // 보통 길의 렌더 배율 상한. (0 이면 제한 없음)
	/** @private @type { number } */ #liteMaxRenderPixelRatio; // 가벼운 길의 렌더 배율 상한.
	/** @private @type { boolean } */ #wasLite; // 지난 update 때의 가벼운 길.

	//==============================================================================
	// 생성. (자동, 덮어쓰기 없음, 렌더 배율 제한 없음)
	//==============================================================================
	constructor() {
		this.#quality = GraphicsQuality.auto;
		this.#liteOverride = null;
		this.#isAutoLiteDefault = false;
		this.#frameProbe = new FrameProbe();
		this.#normalMaxRenderPixelRatio = 0;
		this.#liteMaxRenderPixelRatio = 0;
		this.#wasLite = false;
	}

	//==============================================================================
	// 품질 설정. (GraphicsQuality, 모르는 값이면 자동)
	//==============================================================================
	/**
	 * @param { string } quality GraphicsQuality 값.
	 */
	setQuality(quality) {
		const isKnown = quality === GraphicsQuality.high || quality === GraphicsQuality.low;
		this.#quality = isKnown ? quality : GraphicsQuality.auto;
	}

	//==============================================================================
	// 품질 설정 반환.
	//==============================================================================
	/**
	 * @returns { string } GraphicsQuality 값.
	 */
	getQuality() {
		return this.#quality;
	}

	//==============================================================================
	// 덮어쓰기 설정. (true 면 늘 가벼운 길, false 면 늘 아님, null 이면 풀기)
	//==============================================================================
	/**
	 * @param { boolean | null } liteOverride 늘 가벼운 길이면 true, 늘 아니면 false, 풀면 null.
	 */
	setLiteOverride(liteOverride) {
		this.#liteOverride = liteOverride;
	}

	//==============================================================================
	// 덮어쓰기 반환.
	//==============================================================================
	/**
	 * @returns { boolean | null } 덮어쓰기. 없으면 null.
	 */
	getLiteOverride() {
		return this.#liteOverride;
	}

	//==============================================================================
	// 주소의 쿼리 글로 덮어쓰기. (liteKey 가 있으면 가벼운 길, 값이 "0" 이나 "false" 면 늘 아님, 없으면 그대로)
	//==============================================================================
	/**
	 * @param { string } searchText - location.search 꼴. ("?light", "?a=1&light=0")
	 * @param { string } [liteKey] 볼 쿼리 이름. (처음은 "light")
	 * @example <caption>주소의 쿼리로 가벼운 길 덮어쓰기</caption>
	 * import { GraphicsQualityGovernor } from "./build/vanilla.js";
	 *
	 * const governor = new GraphicsQualityGovernor();
	 * governor.applySearchText("?light");
	 * console.log(governor.getLiteOverride(), governor.isLite());
	 * governor.applySearchText("?a=1&light=0");
	 * console.log(governor.getLiteOverride(), governor.isLite());
	 */
	applySearchText(searchText, liteKey = "light") {
		const searchParameters = new System.URLSearchParams(searchText);
		if (!searchParameters.has(liteKey)) {
			return;
		}
		const value = searchParameters.get(liteKey);
		this.#liteOverride = value !== "0" && value !== "false";
	}

	//==============================================================================
	// 자동일 때 처음부터 가벼운 길인지 설정. (손가락 기기처럼 재기 전부터 가볍게 갈 때)
	//==============================================================================
	/**
	 * @param { boolean } isAutoLiteDefault 자동일 때 재지 않고 처음부터 가벼운 길이면 참.
	 */
	setAutoLiteDefault(isAutoLiteDefault) {
		this.#isAutoLiteDefault = isAutoLiteDefault;
	}

	//==============================================================================
	// 자동일 때 처음부터 가벼운 길인지 반환.
	//==============================================================================
	/**
	 * @returns { boolean } 자동일 때 처음부터 가벼운 길이면 참.
	 */
	isAutoLiteDefault() {
		return this.#isAutoLiteDefault;
	}

	//==============================================================================
	// 프레임 재기 반환. (기다리는 초, 판정 문턱을 바꾸거나 무거운 장면에서 measureAgain 할 때)
	//==============================================================================
	/**
	 * @returns { FrameProbe } 이 품질 정하기가 쓰는 FrameProbe.
	 */
	getFrameProbe() {
		return this.#frameProbe;
	}

	//==============================================================================
	// 가벼운 길로 그리는지.
	//==============================================================================
	/**
	 * @returns { boolean } 가벼운 길이면 참.
	 */
	isLite() {
		const liteOverride = this.#liteOverride;
		if (liteOverride !== null) {
			return liteOverride;
		}
		const quality = this.#quality;
		if (quality === GraphicsQuality.low) {
			return true;
		}
		if (quality === GraphicsQuality.high) {
			return false;
		}
		const frameProbe = this.#frameProbe;
		return this.#isAutoLiteDefault || frameProbe.isSlow();
	}

	//==============================================================================
	// 한 프레임. (자동이고 아직 가벼운 길이 아니면 프레임을 잰다, 가벼운 길이 바뀐 프레임에 true)
	//==============================================================================
	/**
	 * @param { number } frameSeconds 지난 프레임과의 간격. (초)
	 * @param { number } maximumFramePerSecond - 엔진 설정의 최대 프레임. (0 이면 무제한)
	 * @returns { boolean } 지난 update 때와 가벼운 길이 달라졌으면 참.
	 */
	update(frameSeconds, maximumFramePerSecond) {
		const isMeasured = this.#liteOverride === null && this.#quality === GraphicsQuality.auto && !this.#isAutoLiteDefault;
		if (isMeasured) {
			const frameProbe = this.#frameProbe;
			frameProbe.measureFrame(frameSeconds, maximumFramePerSecond);
		}
		const isLite = this.isLite();
		const isChanged = isLite !== this.#wasLite;
		this.#wasLite = isLite;
		return isChanged;
	}

	//==============================================================================
	// 렌더 배율 상한 설정. (보통 길과 가벼운 길, 0 이면 제한 없음)
	//==============================================================================
	/**
	 * @param { number } normalMaxRenderPixelRatio 보통 길의 렌더 배율 상한. (0 이면 제한 없음, 음수면 0)
	 * @param { number } liteMaxRenderPixelRatio 가벼운 길의 렌더 배율 상한. (0 이면 제한 없음, 음수면 0)
	 */
	setRenderPixelRatioLimits(normalMaxRenderPixelRatio, liteMaxRenderPixelRatio) {
		this.#normalMaxRenderPixelRatio = System.Math.max(0, normalMaxRenderPixelRatio);
		this.#liteMaxRenderPixelRatio = System.Math.max(0, liteMaxRenderPixelRatio);
	}

	//==============================================================================
	// 지금 길의 렌더 배율 상한.
	//==============================================================================
	/**
	 * @returns { number } 지금 길의 렌더 배율 상한. (0 이면 제한 없음)
	 */
	readMaxRenderPixelRatio() {
		return this.isLite() ? this.#liteMaxRenderPixelRatio : this.#normalMaxRenderPixelRatio;
	}

	//==============================================================================
	// 렌더 배율 상한 걸기. (ViewManager 의 값과 다를 때만, 걸었으면 true)
	//==============================================================================
	/**
	 * @param { object } viewManager - ViewManager
	 * @returns { boolean } 새 상한을 걸었으면 참. (같아서 그대로 두었으면 거짓)
	 * @example <caption>씬에서 매 프레임 렌더 배율 상한 맞추기</caption>
	 * import { Engine, EngineConfiguration, Scene, GraphicsQualityGovernor } from "./build/vanilla.js";
	 *
	 * const governor = new GraphicsQualityGovernor();
	 * governor.setRenderPixelRatioLimits(2, 1);
	 *
	 * class QualityScene extends Scene {
	 * 	tick(timeDelta) {
	 * 		super.tick(timeDelta);
	 * 		const isChanged = governor.update(timeDelta, 60);
	 * 		if (isChanged) {
	 * 			console.log("lite", governor.isLite());
	 * 		}
	 * 		const engine = this.getEngine();
	 * 		const viewManager = engine.getViewManager();
	 * 		governor.applyRenderPixelRatio(viewManager);
	 * 	}
	 * }
	 *
	 * const engineConfiguration = new EngineConfiguration();
	 * const engine = new Engine(engineConfiguration);
	 * engine.run(new QualityScene());
	 */
	applyRenderPixelRatio(viewManager) {
		const maxRenderPixelRatio = this.readMaxRenderPixelRatio();
		const currentMaxRenderPixelRatio = viewManager.getMaxRenderPixelRatio();
		if (currentMaxRenderPixelRatio === maxRenderPixelRatio) {
			return false;
		}
		viewManager.setMaxRenderPixelRatio(maxRenderPixelRatio);
		return true;
	}
}
