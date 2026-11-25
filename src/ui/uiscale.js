//==============================================================================
// 포함 모듈 목록.
//==============================================================================
const System = globalThis;
import { Engine } from "../core/engine.js";


// 기본값. (한 단위가 이 CSS 픽셀보다 작으면 키운다, 키우는 상한, 낮은 화면의 가장 낮은 UI 층 높이(0 이면 보지 않음), 세로 화면의 가름)
const DEFAULT_MINIMUM_CSS_SCALE = 0.8;
const DEFAULT_MAXIMUM_SCALE = 1.8;
const DEFAULT_MINIMUM_LAYER_HEIGHT = 0;
const DEFAULT_PORTRAIT_RATIO = 1.1;


//==============================================================================
// UI 배율.
// - 뷰의 고정된 쪽(세로형은 세로, 가로형은 가로)은 늘 같은 길이라, 작은 화면(포털의 PC iframe 등)에서는
//   뷰 한 단위가 화면에서 1 CSS 픽셀보다 한참 작아져 글자가 읽히지 않는다. 그때 화면 위의 UI 층만 키울 배율을 셈한다. (게임의 그림은 그대로)
// - 한 단위가 minimumCssScale CSS 픽셀보다 작으면 그만큼 키운다. (1 ~ maximumScale)
//   - 낮은 화면은 키운 UI 층의 높이가 minimumLayerHeight 보다 낮아지게는 키우지 않는다. (폰 가로에서 위아래 UI 가 화면을 덮지 않게, 0 이면 보지 않음)
//   - 세로 화면(가로가 세로의 portraitRatio 배 이하)은 상한 없이 한 단위가 minimumCssScale CSS 픽셀이 되게 키운다.
// - 사용: const uiScale = UIScale.read(viewWidth, viewHeight); layerNode.setLocalScale(Vector2.create(uiScale, uiScale));
//   UIWindowLayer 가 이 배율로 창을 키운다.
//==============================================================================
export class UIScale {
	//==============================================================================
	// UI 배율 읽기.
	//==============================================================================
	/**
	 * @param { number } viewWidth UI 층이 덮는 영역의 너비. (뷰 단위)
	 * @param { number } viewHeight UI 층이 덮는 영역의 높이. (뷰 단위)
	 * @param { object } options { minimumCssScale = 0.8, maximumScale = 1.8, minimumLayerHeight = 0, portraitRatio = 1.1, cssPixelScale? (없으면 엔진의 ViewManager.getCssPixelScale) }
	 * @returns { number }
	 */
	static read(viewWidth, viewHeight, options = {}) {
		const minimumCssScale = (options.minimumCssScale !== undefined) ? options.minimumCssScale : DEFAULT_MINIMUM_CSS_SCALE;
		const maximumScale = (options.maximumScale !== undefined) ? options.maximumScale : DEFAULT_MAXIMUM_SCALE;
		const minimumLayerHeight = (options.minimumLayerHeight !== undefined) ? options.minimumLayerHeight : DEFAULT_MINIMUM_LAYER_HEIGHT;
		const portraitRatio = (options.portraitRatio !== undefined) ? options.portraitRatio : DEFAULT_PORTRAIT_RATIO;
		const cssPixelScale = (options.cssPixelScale !== undefined) ? options.cssPixelScale : UIScale.readCssPixelScale();
		if (!(cssPixelScale > 0)) {
			return 1;
		}
		const desiredScale = minimumCssScale / cssPixelScale;
		const isPortrait = UIScale.isPortrait(viewWidth, viewHeight, portraitRatio);
		if (isPortrait) {
			return System.Math.max(1, desiredScale);
		}
		let uiScale = System.Math.min(maximumScale, desiredScale);
		if (minimumLayerHeight > 0 && viewHeight > 0) {
			uiScale = System.Math.min(uiScale, viewHeight / minimumLayerHeight);
		}
		return System.Math.max(1, uiScale);
	}

	//==============================================================================
	// 세로 화면인지. (가로가 세로의 portraitRatio 배 이하)
	//==============================================================================
	/**
	 * @param { number } viewWidth
	 * @param { number } viewHeight
	 * @param { number } portraitRatio
	 * @returns { boolean }
	 */
	static isPortrait(viewWidth, viewHeight, portraitRatio = DEFAULT_PORTRAIT_RATIO) {
		return viewWidth <= viewHeight * portraitRatio;
	}

	//==============================================================================
	// 뷰 한 단위가 화면에서 몇 CSS 픽셀인지. (엔진이 없으면 1)
	//==============================================================================
	/**
	 * @returns { number }
	 */
	static readCssPixelScale() {
		const engine = Engine.getEngine();
		if (!engine) {
			return 1;
		}
		const viewManager = engine.getViewManager();
		return viewManager.getCssPixelScale();
	}
}
