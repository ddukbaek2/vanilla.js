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
/**
 * @example <caption>그림의 한 조각을 틴트해 그리기</caption>
 * import { Engine, EngineConfiguration, UIScene, UIImageView, ImageAsset, WorldNode, Pivot, Vector2, Rect, Color } from "./build/vanilla.js";
 *
 * class MainScene extends UIScene {
 * 	constructor() {
 * 		super();
 * 		this.setLoadingMinDurationMs(0);
 * 		this.imageAsset = null;
 * 	}
 *
 * 	async loadAssets() {
 * 		await super.loadAssets();
 * 		const imageAsset = new ImageAsset();
 * 		await imageAsset.load("examples/assets/spritesheet.png");
 * 		this.imageAsset = imageAsset;
 * 	}
 *
 * 	initialize(engine) {
 * 		super.initialize(engine);
 * 		const iconNode = new WorldNode();
 * 		iconNode.setPivot(Pivot.topLeft);
 * 		iconNode.setAnchor(Pivot.topLeft);
 * 		iconNode.setLocalPosition(Vector2.create(40, 40));
 * 		iconNode.setContentSize(Vector2.create(120, 120));
 * 		const imageView = iconNode.addComponent(UIImageView);
 * 		imageView.setImage(this.imageAsset);
 * 		imageView.setImageRect(Rect.create(0, 0, 200, 200));
 * 		imageView.setColor(new Color(1, 0.5, 0, 0.4));
 * 		const root = this.getRoot();
 * 		root.addChild(iconNode);
 * 	}
 * }
 *
 * const engineConfiguration = new EngineConfiguration();
 * engineConfiguration.canvasId = "mainCanvas";
 * engineConfiguration.referenceResolutionSize = Vector2.create(640, 360);
 * engineConfiguration.autoResizeOnWindowResize = true;
 * const engine = new Engine(engineConfiguration);
 * engine.run(new MainScene());
 */
export class UIImageView extends UIView {
	//==============================================================================
	// 멤버 변수 목록.
	//==============================================================================
	/** @private @type { Sprite | null } */ #sprite;
	/** @private @type { string } */ #imagePath; // 그림 경로. (UIDocument 가 그림 대신 적고 읽는다, 그리기에는 쓰지 않는다)

	//==============================================================================
	// 생성.
	//==============================================================================
	constructor() {
		super();
		this.setComponentType("UIImageView");
		this.#imagePath = "";
		this.#sprite = null;
	}

	//==============================================================================
	// 노드에 붙음. (내부 Sprite 컴포넌트 부착)
	//==============================================================================
	/**
	 * @override
	 * @param { ComponentNode } node 붙을 노드.
	 */
	attach(node) {
		super.attach(node);
		this.#sprite = node.getOrAddComponent(Sprite);
	}

	//==============================================================================
	// 노드에서 떨어짐. (내부 Sprite 컴포넌트 제거)
	//==============================================================================
	/**
	 * @override
	 * @param { ComponentNode } node 떨어질 노드.
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
	 * @returns { Sprite | null } 내부 Sprite. (노드에 붙기 전이나 떨어진 뒤면 null)
	 */
	getSprite() {
		return this.#sprite;
	}

	//==============================================================================
	// 이미지 설정. (HTMLImageElement / OffscreenCanvas / ImageAsset 모두 허용)
	//==============================================================================
	/**
	 * @param { HTMLImageElement | OffscreenCanvas | ImageAsset | null } image 그릴 그림. (ImageAsset 이면 그 image, null 이면 비운다, 노드에 붙기 전이면 무시한다)
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
	 * @returns { HTMLImageElement | OffscreenCanvas | null } 지금 그림. (없거나 노드에 붙기 전이면 null)
	 */
	getImage() {
		return this.#sprite ? this.#sprite.getImage() : null;
	}

	//==============================================================================
	// 그림 경로 설정. (적어 두기만 하고 그림을 읽지 않는다, UIDocument 가 그림 대신 이 경로를 적고 읽는다)
	//==============================================================================
	/**
	 * @param { string } imagePath 그림 경로.
	 */
	setImagePath(imagePath) {
		this.#imagePath = imagePath ?? "";
	}

	//==============================================================================
	// 그림 경로 반환. (정하지 않았으면 빈 글)
	//==============================================================================
	/**
	 * @returns { string } 그림 경로. (정하지 않았으면 빈 글)
	 */
	getImagePath() {
		return this.#imagePath;
	}

	//==============================================================================
	// 이미지 부분 영역(소스 사각형) 설정.
	//==============================================================================
	/**
	 * @param { Rect } imageRect 그림에서 잘라 그릴 영역. (그림의 픽셀, 빈 사각형이면 그림 전체, simple 과 tiled 모드에서 쓴다)
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
	 * @param { Color | string } color 틴트 색. (알파가 0 보다 크면 그림의 실루엣 안을 이 색으로 덮는다, 그림이 없으면 내용 영역을 이 색으로 칠한다, 기본 투명)
	 */
	setColor(color) {
		color = Color.from(color);
		if (this.#sprite) {
			this.#sprite.setColor(color);
		}
	}

	//==============================================================================
	// 색상 반환. (스프라이트 틴트, 스프라이트가 없으면 null)
	//==============================================================================
	/**
	 * @returns { Color | null } 틴트 색. (노드에 붙기 전이면 null)
	 */
	getColor() {
		if (this.#sprite) {
			return this.#sprite.getColor();
		}
		return null;
	}

	//==============================================================================
	// 가로 플립 설정.
	//==============================================================================
	/**
	 * @param { boolean } isHorizontalFlip 참이면 좌우로 뒤집어 그린다.
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
	 * @param { boolean } isVerticalFlip 참이면 위아래로 뒤집어 그린다.
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
	 * @param { string } mode 그리기 모드. (simple, sliced, tiled 가운데 하나, 기본 simple)
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
	 * @param { string } mode 블렌드 모드. (Canvas2D globalCompositeOperation 이름, 기본 source-over)
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
	 * @param { Rect } nineSlice 나인 슬라이스 테두리 두께. (position.x 왼쪽, position.y 위, size.x 오른쪽, size.y 아래, 그림의 픽셀, sliced 모드에서 그림 전체를 나눈다)
	 * @example <caption>늘려도 귀퉁이가 그대로인 판 그리기</caption>
	 * import { Engine, EngineConfiguration, UIScene, UIImageView, ImageAsset, WorldNode, Pivot, Vector2, Rect } from "./build/vanilla.js";
	 *
	 * class MainScene extends UIScene {
	 * 	constructor() {
	 * 		super();
	 * 		this.setLoadingMinDurationMs(0);
	 * 		this.imageAsset = null;
	 * 	}
	 *
	 * 	async loadAssets() {
	 * 		await super.loadAssets();
	 * 		const imageAsset = new ImageAsset();
	 * 		await imageAsset.load("assets/icons/icon.png");
	 * 		this.imageAsset = imageAsset;
	 * 	}
	 *
	 * 	initialize(engine) {
	 * 		super.initialize(engine);
	 * 		const panelNode = new WorldNode();
	 * 		panelNode.setPivot(Pivot.topLeft);
	 * 		panelNode.setAnchor(Pivot.topLeft);
	 * 		panelNode.setLocalPosition(Vector2.create(40, 40));
	 * 		panelNode.setContentSize(Vector2.create(400, 160));
	 * 		const imageView = panelNode.addComponent(UIImageView);
	 * 		imageView.setImage(this.imageAsset);
	 * 		imageView.setDrawMode("sliced");
	 * 		imageView.setNineSlice(Rect.create(64, 64, 64, 64));
	 * 		const root = this.getRoot();
	 * 		root.addChild(panelNode);
	 * 	}
	 * }
	 *
	 * const engineConfiguration = new EngineConfiguration();
	 * engineConfiguration.canvasId = "mainCanvas";
	 * engineConfiguration.referenceResolutionSize = Vector2.create(640, 360);
	 * engineConfiguration.autoResizeOnWindowResize = true;
	 * const engine = new Engine(engineConfiguration);
	 * engine.run(new MainScene());
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
