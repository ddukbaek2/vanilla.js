//==============================================================================
// 포함 모듈 목록.
//==============================================================================
const System = globalThis;
import { Color } from "../base/color.js";
import { Rect } from "../base/rect.js";
import { ComponentNode } from "../core/node/componentnode.js";
import { Sprite, SpriteDrawMode, SpriteBlendMode } from "../core/component/sprite.js";
import { ImageAsset } from "../resource/imageasset.js";
import { UIView } from "./uiview.js";


//==============================================================================
// UI 이미지 뷰.
// - 표시 전용. 입력을 받지 않으므로 UIView 를 상속한다.
// - 노드에 부착되면 내부적으로 Sprite 컴포넌트를 자동 생성/관리한다.
// - Sprite 의 이미지/색/플립/드로우모드/블렌드 등 자주 쓰는 속성을 노출한다.
//==============================================================================
export class UIImageView extends UIView {
	//==============================================================================
	// 멤버 변수 목록.
	//==============================================================================
	/** @private @type { Sprite | null } */ #sprite;

	//==============================================================================
	// 생성.
	//==============================================================================
	constructor() {
		super();
		this.setComponentType("UIImageView");
		this.#sprite = null;
	}

	//==============================================================================
	// 노드에 붙음. (내부 Sprite 컴포넌트 부착)
	//==============================================================================
	/**
	 * @override
	 * @param { ComponentNode } node
	 */
	attach(node) {
		super.attach(node);
		this.#sprite = node.getOraddComponent(Sprite);
	}

	//==============================================================================
	// 노드에서 떨어짐. (내부 Sprite 컴포넌트 제거)
	//==============================================================================
	/**
	 * @override
	 * @param { ComponentNode } node
	 */
	detach(node) {
		if (this.#sprite) {
			// node.removeComponent(this.#sprite);
			this.#sprite = null;
		}
		super.detach(node);
	}

	//==============================================================================
	// 내부 Sprite 컴포넌트 반환. (디테일 제어가 필요할 때 직접 접근)
	//==============================================================================
	/**
	 * @returns { Sprite | null }
	 */
	getSprite() {
		return this.#sprite;
	}

	//==============================================================================
	// 이미지 설정. (HTMLImageElement / OffscreenCanvas / ImageAsset 모두 허용)
	//==============================================================================
	/**
	 * @param { HTMLImageElement | OffscreenCanvas | ImageAsset | null } image
	 */
	setImage(image) {
		if (!this.#sprite) {
			return;
		}
		if (image instanceof ImageAsset) {
			this.#sprite.setImage(image.image);
		}
		else {
			this.#sprite.setImage(image);
		}
	}

	//==============================================================================
	// 이미지 반환.
	//==============================================================================
	/**
	 * @returns { HTMLImageElement | OffscreenCanvas | null }
	 */
	getImage() {
		return this.#sprite ? this.#sprite.getImage() : null;
	}

	//==============================================================================
	// 이미지 부분 영역(소스 사각형) 설정.
	//==============================================================================
	/**
	 * @param { Rect } imageRect
	 */
	setImageRect(imageRect) {
		if (this.#sprite) {
			this.#sprite.setImageRect(imageRect);
		}
	}

	//==============================================================================
	// 색상 설정. (스프라이트 틴트)
	//==============================================================================
	/**
	 * @param { Color | string } color
	 */
	setColor(color) {
		if (this.#sprite) {
			this.#sprite.setColor(color);
		}
	}

	//==============================================================================
	// 가로 플립 설정.
	//==============================================================================
	/**
	 * @param { boolean } isHorizontalFlip
	 */
	setHorizontalFlip(isHorizontalFlip) {
		if (this.#sprite && typeof this.#sprite.setHorizontalFlip === "function") {
			this.#sprite.setHorizontalFlip(isHorizontalFlip);
		}
	}

	//==============================================================================
	// 세로 플립 설정.
	//==============================================================================
	/**
	 * @param { boolean } isVerticalFlip
	 */
	setVerticalFlip(isVerticalFlip) {
		if (this.#sprite && typeof this.#sprite.setVerticalFlip === "function") {
			this.#sprite.setVerticalFlip(isVerticalFlip);
		}
	}

	//==============================================================================
	// 드로우 모드 설정. (simple / sliced / tiled)
	//==============================================================================
	/**
	 * @param { string } mode
	 */
	setDrawMode(mode) {
		if (this.#sprite && typeof this.#sprite.setSpriteDrawMode === "function") {
			this.#sprite.setSpriteDrawMode(mode);
		}
	}

	//==============================================================================
	// 블렌드 모드 설정.
	//==============================================================================
	/**
	 * @param { string } mode
	 */
	setBlendMode(mode) {
		if (this.#sprite && typeof this.#sprite.setSpriteBlendMode === "function") {
			this.#sprite.setSpriteBlendMode(mode);
		}
	}

	//==============================================================================
	// 나인패치 영역 설정.
	//==============================================================================
	/**
	 * @param { Rect } nineSlice
	 */
	setNineSlice(nineSlice) {
		if (this.#sprite && typeof this.#sprite.setNineSlice === "function") {
			this.#sprite.setNineSlice(nineSlice);
		}
	}
}


//==============================================================================
// SpriteDrawMode / SpriteBlendMode 재노출 (UIImageView 사용자가 한 번에 import).
//==============================================================================
export { SpriteDrawMode, SpriteBlendMode };
