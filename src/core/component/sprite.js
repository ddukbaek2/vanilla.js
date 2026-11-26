//==============================================================================
// 포함 모듈 목록.
//==============================================================================
import { Vector2 } from "../../base/vector2.js";
import { Rect } from "../../base/rect.js";
import * as Math from "../../base/math.js";
import { ImageAsset } from "../../resource/imageasset.js";
import { Graphic } from "../graphic.js";
import { Paint } from "./paint.js";
import { Color } from "../../base/color.js";


//==============================================================================
// 스프라이트 모드.
//==============================================================================
export const SpriteDrawMode = {
	simple: "simple", // 이미지 영역을 그대로 그린다.
	sliced: "sliced", // 아홉 조각으로 잘라 모서리는 늘리지 않고 그린다.
	tiled: "tiled", // 이미지를 타일처럼 반복해 그린다.
}


//==============================================================================
// 스프라이트 블렌드 모드. (Canvas2D globalCompositeOperation 대응)
// - 26 가지 모두 Graphic.setBlendMode 가 그린다. 포터 더프 연산자, lighter, multiply, screen 은 고정 블렌딩,
//   overlay 부터 luminosity 까지 13 가지는 그릴 영역 아래를 떠 와 셰이더로 섞는다. (W3C Compositing and Blending Level 1 공식, 그리기마다 영역 복사가 들고 묶어 그리지 않는다)
// - Canvas2D 는 source-in, source-out, destination-in, destination-atop, copy 가 그린 도형 밖(자르기 안 전체)도 지우지만, Graphic 은 그린 도형 안만 바꾼다.
//==============================================================================
export const SpriteBlendMode = {
	normal:          "source-over",      // 기본 알파 합성.
	sourceIn:        "source-in",        // 교차 영역만 출력 (배경 알파 마스크).
	sourceOut:       "source-out",       // 교차 외 영역만 출력.
	sourceAtop:      "source-atop",      // 배경 위에 교차 영역만 합성.
	destinationOver: "destination-over", // 배경 아래에 합성.
	destinationIn:   "destination-in",   // 배경에서 교차 영역만 유지.
	destinationOut:  "destination-out",  // 배경에서 교차 외 영역만 유지.
	destinationAtop: "destination-atop", // 배경 위에 교차 영역만 유지.
	lighter:         "lighter",          // 색상 덧셈 (Add).
	copy:            "copy",             // 소스만 출력 (배경 무시).
	xor:             "xor",              // 교차 영역 제외.
	multiply:        "multiply",         // 곱셈 합성 (어두워짐).
	screen:          "screen",           // 스크린 합성 (밝아짐).
	overlay:         "overlay",          // 오버레이 (명암 강조).
	darken:          "darken",           // 어두운 픽셀 선택.
	lighten:         "lighten",          // 밝은 픽셀 선택.
	colorDodge:      "color-dodge",      // 컬러 닷지 (밝아짐).
	colorBurn:       "color-burn",       // 컬러 번 (어두워짐).
	hardLight:       "hard-light",       // 하드 라이트.
	softLight:       "soft-light",       // 소프트 라이트.
	difference:      "difference",       // 차이값 합성.
	exclusion:       "exclusion",        // 차이값 합성 (낮은 대비).
	hue:             "hue",              // 색조만 적용.
	saturation:      "saturation",       // 채도만 적용.
	color:           "color",            // 색조+채도 적용.
	luminosity:      "luminosity",       // 밝기만 적용.
}


//==============================================================================
// 그릴 때마다 고쳐 쓰는 벡터. (graphic 의 그리기 함수는 받은 벡터를 그 자리에서 읽기만 하고 들고 있지 않는다)
//==============================================================================
const spritePosition = Vector2.zero(); // 그리는 왼쪽 위. (늘 0, 0)
const spriteContentSize = Vector2.zero(); // 노드의 내용 크기.


//==============================================================================
// 그릴 수 있는 그림 원천인지. (HTMLImageElement, HTMLCanvasElement, OffscreenCanvas, 텍스처 캐시가 올리는 꼴)
//==============================================================================
/**
 * @param { any } image 볼 값.
 * @returns { boolean } 그릴 수 있는 원천이면 참. (이 꼴이 없는 환경이면 그 꼴은 거짓)
 */
function isDrawableImageSource(image) {
	if (typeof HTMLImageElement !== "undefined" && image instanceof HTMLImageElement) {
		return true;
	}
	if (typeof HTMLCanvasElement !== "undefined" && image instanceof HTMLCanvasElement) {
		return true;
	}
	if (typeof OffscreenCanvas !== "undefined" && image instanceof OffscreenCanvas) {
		return true;
	}
	return false;
}


//==============================================================================
// 스프라이트 출력자 컴포넌트.
//==============================================================================
/**
 * @example <caption>스프라이트 시트의 한 칸 그리기</caption>
 * import { Engine, EngineConfiguration, Scene, Vector2, Rect, WorldNode, Sprite, ImageAsset } from "./build/vanilla.js";
 *
 * class MainScene extends Scene {
 * 	async load(engine) {
 * 		await super.load(engine);
 * 		const imageAsset = new ImageAsset();
 * 		await imageAsset.load("examples/assets/spritesheet.png");
 * 		const spriteNode = new WorldNode();
 * 		spriteNode.setContentSize(Vector2.create(200, 200));
 * 		spriteNode.setLocalPosition(Vector2.create(320, 180));
 * 		const sprite = spriteNode.addComponent(Sprite);
 * 		sprite.setImage(imageAsset);
 * 		sprite.setImageRect(Rect.create(0, 0, 200, 200));
 * 		sprite.setHorizontalFlip(true);
 * 		const root = this.getRoot();
 * 		root.addChild(spriteNode);
 * 	}
 * }
 *
 * const engineConfiguration = new EngineConfiguration();
 * engineConfiguration.referenceResolutionSize = Vector2.create(640, 360);
 * const engine = new Engine(engineConfiguration);
 * engine.run(new MainScene());
 */
export class Sprite extends Paint {
	//==============================================================================
	// 멤버 변수 목록.
	//==============================================================================
	/** @private @type { HTMLImageElement } */ #image;
	/** @private @type { Rect } */ #imageRect;
	/** @private @type { boolean } */ #isHorizontalFlip;
	/** @private @type { boolean } */ #isVerticalFlip;
	/** @private @type { string } */ #spriteDrawMode;
	/** @private @type { string } */ #spriteBlendMode;
	/** @private @type { Rect } */ #nineSlice;

	//==============================================================================
	// 생성.
	//==============================================================================
	/**
	 * @construct
	 */
	constructor() {
		super();
		this.setComponentType("Sprite");
		this.#image = null;
		this.#imageRect = Rect.zero();
		this.#isHorizontalFlip = false;
		this.#isVerticalFlip = false;
		this.#spriteDrawMode = SpriteDrawMode.simple;
		this.#spriteBlendMode = SpriteBlendMode.normal;
		this.#nineSlice = Rect.zero();
		super.setColor(Color.transparent());
	}

	//==============================================================================
	// 갱신.
	//==============================================================================
	/**
	 * @param { number } timeDelta 지난 프레임부터의 시간. (초)
	 */
	tick(timeDelta) {
		super.tick(timeDelta);
	}

	//==============================================================================
	// tick 이 할 일이 있는지. (그리기만 하므로 거짓, 하위 클래스가 tick 을 다시 정의하면 참)
	//==============================================================================
	/**
	 * @override
	 * @returns { boolean } tick 이 할 일이 있으면 참.
	 */
	isTickNeeded() {
		return this.tick !== Sprite.prototype.tick;
	}

	//==============================================================================
	// 출력.
	//==============================================================================
	/**
	 * @param { Graphic } graphic 그래픽.
	 */
	draw(graphic) {
		const image = this.getImage();
		const color = super.getColor();

		// 일반 사각형 출력.
		if (image === null || image === undefined) {
			super.draw(graphic);
			return;
		}

		const node = this.getNode();
		if (!node) return;

		// 위치와 내용 크기(그리는 크기)는 복제본 없이 모듈의 벡터에 적는다.
		const position = spritePosition;
		const contentSize = spriteContentSize;
		if (typeof node.copyContentSizeTo === "function") {
			node.copyContentSizeTo(contentSize);
		}
		else {
			const nodeContentSize = node.getContentSize();
			contentSize.set(nodeContentSize.x, nodeContentSize.y);
		}
		const isHorizontalFlip = this.isHorizontalFlip();
		const isVerticalFlip = this.isVerticalFlip();
		const isFlipped = isHorizontalFlip || isVerticalFlip;
		const spriteBlendMode = this.getSpriteBlendMode();
		const spriteDrawMode = this.getSpriteDrawMode();

		// 슬라이스드 모드에서 컨텐츠 크기가 나인슬라이스 경계 합보다 작으면 출력 안 함.
		if (spriteDrawMode === SpriteDrawMode.sliced) {
			const nineSlice = this.getNineSlice();
			const left = nineSlice.position.x;
			const top = nineSlice.position.y;
			const right = nineSlice.size.x;
			const bottom = nineSlice.size.y;
			if (contentSize.x < left + right || contentSize.y < top + bottom) {
				return;
			}
		}

		// 블렌드 모드 설정.
		graphic.setBlendMode(spriteBlendMode);

		// 컬러 틴트 설정. (알파가 0 초과일 때만, 이미지 실루엣 안쪽에만 색을 덮음)
		if (color.alpha > 0) {
			graphic.setImageTintColor(color);
		}

		// 뒤집기는 내용 영역의 가운데를 축으로 거울처럼 뒤집는다. (그림은 내용 영역 안에 남고, 조각, 나인 슬라이스, 타일 모두 같다)
		if (isFlipped) {
			graphic.pushState();
			graphic.translate(isHorizontalFlip ? contentSize.x : 0, isVerticalFlip ? contentSize.y : 0);
			graphic.scale(isHorizontalFlip ? -1 : 1, isVerticalFlip ? -1 : 1);
		}

		// 드로우 모드에 따라 이미지 출력.
		switch (spriteDrawMode) {
			case SpriteDrawMode.simple: {
					// 이미지 소스 조정.
					// 영역이 없으면 사각 영역을 새로 만들지 않고 그림 전체를 바로 그린다.
					const imageRect = this.getImageRect();
					if (imageRect === null || imageRect === undefined || imageRect.isZero()) {
						graphic.drawImageWithSourceAndDestination(image, 0, 0, image.width, image.height, position.x, position.y, contentSize.x, contentSize.y);
					}
					else {
						graphic.drawImageWithImageRect(image, position, contentSize, imageRect);
					}
					break;
				}
			case SpriteDrawMode.sliced: {
					const nineSlice = this.getNineSlice();
					graphic.drawImageWithNineSlice(image, position, contentSize, nineSlice);
					break;
				}
			case SpriteDrawMode.tiled: {
					// 이미지 소스 조정.
					let imageRect = this.getImageRect();
					if (imageRect === null || imageRect === undefined || imageRect.isZero()) {
						imageRect = Rect.create(0, 0, image.width, image.height);
					}

					const tileWidth = Math.ceil(imageRect.width);
					const tileHeight = Math.ceil(imageRect.height);
					const fillWidth = Math.abs(contentSize.x);
					const fillHeight = Math.abs(contentSize.y);

					// 클리핑 후 수동 타일 반복.
					graphic.pushState();
					graphic.translate(position.x, position.y);
					graphic.beginClipRect(Rect.create(0, 0, fillWidth, fillHeight));
					for (let ty = 0; ty < fillHeight; ty += tileHeight) {
						for (let tx = 0; tx < fillWidth; tx += tileWidth) {
							graphic.drawImageWithSourceAndDestination(
								image,
								imageRect.position.x, imageRect.position.y,
								imageRect.width, imageRect.height,
								tx, ty, tileWidth, tileHeight
							);
						}
					}
					graphic.endClipRect();
					graphic.popState();
					break;
				}
		}

		if (isFlipped) {
			graphic.popState();
		}

		// 컬러 틴트 해제.
		if (color.alpha > 0) {
			graphic.setImageTintColor(null);
		}

		// 블렌드 모드 복원.
		graphic.setBlendMode(SpriteBlendMode.normal);
	}

	//==============================================================================
	// 내용 영역 안에서만 그리는지 반환.
	// - 조각, 나인 슬라이스, 타일 모두 내용 영역 안에 그리고, 뒤집어도 영역 안에서 뒤집으므로 true.
	// - draw 를 덮어쓴 하위 클래스는 어디에 그리는지 모르므로 false. (그 클래스가 이 함수도 덮어써 알린다)
	//==============================================================================
	/**
	 * @override
	 * @returns { boolean } 내용 영역 안에서만 그리면 참.
	 */
	isDrawnInsideContent() {
		if (this.draw !== Sprite.prototype.draw) {
			return false;
		}
		return true;
	}

	//==============================================================================
	// 스프라이트 출력 모드 설정.
	//==============================================================================
	/**
	 * @param { string } spriteDrawMode 그리는 방식. ("simple", "sliced", "tiled")
	 */
	setSpriteDrawMode(spriteDrawMode) {
		this.#spriteDrawMode = spriteDrawMode;
	}

	//==============================================================================
	// 스프라이트 출력 모드 반환.
	//==============================================================================
	/**
	 * @returns { string } 그리는 방식. ("simple", "sliced", "tiled")
	 */
	getSpriteDrawMode() {
		return this.#spriteDrawMode;
	}

	//==============================================================================
	// 스프라이트 블렌드 모드 설정.
	//==============================================================================
	/**
	 * @param { string } spriteBlendMode 섞는 방식. (Canvas2D globalCompositeOperation 이름, 처음은 "source-over")
	 */
	setSpriteBlendMode(spriteBlendMode) {
		this.#spriteBlendMode = spriteBlendMode;
	}

	//==============================================================================
	// 스프라이트 블렌드 모드 반환.
	//==============================================================================
	/**
	 * @returns { string } 섞는 방식. (Canvas2D globalCompositeOperation 이름)
	 */
	getSpriteBlendMode() {
		return this.#spriteBlendMode;
	}

	//==============================================================================
	// 나인슬라이스 영역 설정.
	//==============================================================================
	/**
	 * @param { Rect } nineSlice 나인 슬라이스 경계. (position.x 왼쪽, position.y 위, size.x 오른쪽, size.y 아래 두께, 픽셀, "sliced" 에서 쓴다)
	 * @example <caption>나인 슬라이스로 늘려 그리기</caption>
	 * import { Engine, EngineConfiguration, Scene, Vector2, Rect, WorldNode, Sprite, ImageAsset } from "./build/vanilla.js";
	 *
	 * class MainScene extends Scene {
	 * 	async load(engine) {
	 * 		await super.load(engine);
	 * 		const imageAsset = new ImageAsset();
	 * 		await imageAsset.load("assets/icons/icon.png");
	 * 		const panelNode = new WorldNode();
	 * 		panelNode.setContentSize(Vector2.create(300, 120));
	 * 		panelNode.setLocalPosition(Vector2.create(320, 180));
	 * 		const sprite = panelNode.addComponent(Sprite);
	 * 		sprite.setImage(imageAsset);
	 * 		sprite.setSpriteDrawMode("sliced");
	 * 		sprite.setNineSlice(Rect.create(40, 40, 40, 40));
	 * 		const root = this.getRoot();
	 * 		root.addChild(panelNode);
	 * 	}
	 * }
	 *
	 * const engineConfiguration = new EngineConfiguration();
	 * engineConfiguration.referenceResolutionSize = Vector2.create(640, 360);
	 * const engine = new Engine(engineConfiguration);
	 * engine.run(new MainScene());
	 */
	setNineSlice(nineSlice) {
		this.#nineSlice = nineSlice;
	}

	//==============================================================================
	// 나인슬라이스 영역 반환.
	//==============================================================================
	/**
	 * @returns { Rect } 나인 슬라이스 경계.
	 */
	getNineSlice() {
		return this.#nineSlice;
	}

	//==============================================================================
	// 이미지 설정.
	//==============================================================================
	/**
	 * @param { HTMLImageElement | HTMLCanvasElement | OffscreenCanvas | ImageAsset } image 그림. (그릴 수 있는 원천인 HTMLImageElement, HTMLCanvasElement, OffscreenCanvas 나 ImageAsset, null 이나 undefined 면 비운다, 그 밖의 꼴은 무시한다)
	 * @example <caption>캔버스에 그린 것을 스프라이트로</caption>
	 * import { Engine, EngineConfiguration, Scene, Vector2, WorldNode, Sprite } from "./build/vanilla.js";
	 *
	 * class MainScene extends Scene {
	 * 	async load(engine) {
	 * 		await super.load(engine);
	 * 		const canvas = document.createElement("canvas");
	 * 		canvas.width = 64;
	 * 		canvas.height = 64;
	 * 		const canvasRenderingContext = canvas.getContext("2d");
	 * 		canvasRenderingContext.fillStyle = "#ff6600";
	 * 		canvasRenderingContext.fillRect(0, 0, 64, 64);
	 * 		const spriteNode = new WorldNode();
	 * 		spriteNode.setContentSize(Vector2.create(128, 128));
	 * 		spriteNode.setLocalPosition(Vector2.create(320, 180));
	 * 		const sprite = spriteNode.addComponent(Sprite);
	 * 		sprite.setImage(canvas);
	 * 		const root = this.getRoot();
	 * 		root.addChild(spriteNode);
	 * 	}
	 * }
	 *
	 * const engineConfiguration = new EngineConfiguration();
	 * engineConfiguration.referenceResolutionSize = Vector2.create(640, 360);
	 * const engine = new Engine(engineConfiguration);
	 * engine.run(new MainScene());
	 */
	setImage(image) {
		if (image === null || image === undefined) {
			this.#image = null;
		}
		else if (image instanceof ImageAsset) {
			this.#image = image.image;
		}
		else if (isDrawableImageSource(image)) {
			this.#image = image;
		}
	}

	//==============================================================================
	// 이미지 반환.
	//==============================================================================
	/**
	 * @returns { HTMLImageElement | HTMLCanvasElement | OffscreenCanvas } 그림. (없으면 null)
	 */
	getImage() {
		return this.#image;
	}

	//==============================================================================
	// 조각 걸기. (Frame 의 그림과 그 안의 영역을 함께 건다, null 이면 그림을 비운다, SpriteAtlas.readFrame)
	//==============================================================================
	/**
	 * @param { Frame | null } frame 걸 조각. (null 이면 그림을 비운다)
	 * @example <caption>Frame 으로 조각 걸기</caption>
	 * import { Engine, EngineConfiguration, Scene, Vector2, Rect, WorldNode, Sprite, Frame, ImageAsset } from "./build/vanilla.js";
	 *
	 * class MainScene extends Scene {
	 * 	async load(engine) {
	 * 		await super.load(engine);
	 * 		const imageAsset = new ImageAsset();
	 * 		await imageAsset.load("examples/assets/spritesheet.png");
	 * 		const frame = new Frame(imageAsset.image, Rect.create(200, 0, 200, 200));
	 * 		const spriteNode = new WorldNode();
	 * 		spriteNode.setContentSize(Vector2.create(200, 200));
	 * 		spriteNode.setLocalPosition(Vector2.create(320, 180));
	 * 		const sprite = spriteNode.addComponent(Sprite);
	 * 		sprite.setFrame(frame);
	 * 		const root = this.getRoot();
	 * 		root.addChild(spriteNode);
	 * 	}
	 * }
	 *
	 * const engineConfiguration = new EngineConfiguration();
	 * engineConfiguration.referenceResolutionSize = Vector2.create(640, 360);
	 * const engine = new Engine(engineConfiguration);
	 * engine.run(new MainScene());
	 */
	setFrame(frame) {
		if (frame === null || frame === undefined) {
			this.setImage(null);
			return;
		}
		const image = frame.getImage();
		const imageRect = frame.getImageRect();
		this.setImage(image);
		this.setImageRect(imageRect);
	}

	//==============================================================================
	// 이미지 영역 설정.
	//==============================================================================
	/**
	 * @param { Rect } imageRect 그림 안에서 그릴 영역. (픽셀, 비어 있으면 그림 전체)
	 */
	setImageRect(imageRect) {
		this.#imageRect = imageRect;
	}

	//==============================================================================
	// 이미지 영역 반환.
	//==============================================================================
	/**
	 * @returns { Rect } 그림 안에서 그릴 영역.
	 */
	getImageRect() {
		return this.#imageRect;
	}

	//==============================================================================
	// 이미지 뒤집기 여부 설정.
	//==============================================================================
	/**
	 * @param { boolean } flip 참이면 좌우로 뒤집는다.
	 */
	setHorizontalFlip(flip) {
		this.#isHorizontalFlip = flip;
	}

	//==============================================================================
	// 이미지 뒤집기 여부 설정.
	//==============================================================================
	/**
	 * @param { boolean } flip 참이면 위아래로 뒤집는다.
	 */
	setVerticalFlip(flip) {
		this.#isVerticalFlip = flip;
	}

	//==============================================================================
	// 이미지 뒤집기 여부 반환.
	//==============================================================================
	/**
	 * @returns { Vector2 } 좌우로 뒤집었으면 참.
	 */
	isHorizontalFlip() {
		return this.#isHorizontalFlip;
	}

	//==============================================================================
	// 이미지 뒤집기 여부 반환.
	//==============================================================================
	/**
	 * @returns { Vector2 } 위아래로 뒤집었으면 참.
	 */
	isVerticalFlip() {
		return this.#isVerticalFlip;
	}

	//==============================================================================
	// 이미지 뒤집히는 값 반환.
	//==============================================================================
	/**
	 * @returns { Vector2 } 뒤집기 배율. (뒤집은 축은 -1, 아니면 1, 새 벡터)
	 */
	getFlip() {
		const isHorizontalFlip = this.isHorizontalFlip();
		const isVerticalFlip = this.isVerticalFlip();

		if (isHorizontalFlip) {
			if (isVerticalFlip) {
				return Vector2.create(-1, -1);
			}
			else {
				return Vector2.create(-1, 1);
			}
		}
		else {
			if (isVerticalFlip) {
				return Vector2.create(1, -1);
			}
			else {
				return Vector2.create(1, 1);
			}
		}
	}
}
