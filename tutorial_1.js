//==============================================================================
// 포함 모듈 목록.
//==============================================================================
const System = globalThis;
import { Vector2 as Vec2 } from "./src/base/vector2.js";
import { Rect } from "./src/base/rect.js";
import { Colors } from "./src/base/colors.js";
import { Engine, EngineConfiguration } from "./src/core/engine.js";
import { Graphic } from "./src/core/graphic.js";
import { Scene } from "./src/core/scene.js";
import { ViewScaleMode } from "./src/core/viewmanager.js";
import { Animation } from "./src/rendering/animation.js";
import { ImageAsset } from "./src/resource/imageasset.js";
import { Frame } from "./src/core/frame.js";


//==============================================================================
// 한장의 이미지를 통해 애니메이션 프레임 목록을 만들어 반환.
//==============================================================================
/**
 * 
 * @param { HTMLImageElement } image
 * @param { number } columns
 * @param { number } rows
 * @param { number } count
 * @returns { Frame[] }
 */
export function createFramesFromRects(image, columns, rows, count) {
	const frameWidth = image.width / columns;
	const frameHeight = image.height / rows;

	// 모든 프레임 좌표 생성.
	const frames = [];
	for (let y = 0; y < rows; ++y) {
		for (let x = 0; x < columns; ++x) {
			const rect = Rect.create(x * frameWidth, y * frameHeight, frameWidth, frameHeight);
			// console.table(rect);

			const frame = new Frame(image, rect);
			frames.push(frame);
			if (frames.length === count) {
				return frames;
			}
		}
	}	

	return frames;
}


//==============================================================================
// 튜토리얼2 : 뷰스케일 모드 및 애니메이션 처리.
//==============================================================================
class Tutorial_1 extends Scene {
	//==============================================================================
	// 멤버 변수 목록.
	//==============================================================================
	/** @private @type { Animation } */ #animation;

	//==============================================================================
	// 불러오기.
	//==============================================================================
	/**
	 * @param { Engine } engine 
	 */
	async load(engine) {
		await super.load(engine);

		// 이미지 불러오기.
		const imageAsset = new ImageAsset();
		await imageAsset.load("./assets/images/spritesheet.png");

		// 모든 프레임 좌표 생성.
		const frames = createFramesFromRects(imageAsset.image, 3, 3, 8);
		this.#animation = new Animation();
		this.#animation.setFrames(frames);
		this.#animation.setAnimationSpeed(8);
		this.#animation.setLoop(false);
	}

	//==============================================================================
	// 초기화.
	//==============================================================================
	/**
	 * @param { Engine } engine 
	 */
	initialize(engine) {
		super.initialize(engine);

		const viewManager = engine.getViewManager();
		viewManager.setViewScaleMode(ViewScaleMode.none); // 화면 전체 해상도.
		// viewManager.setViewScaleMode(ViewScaleMode.referenceResolution); // 기준 해상도.
		// viewManager.setViewScaleMode(ViewScaleMode.matchWidthToScreen); // 기준해상도 + 가로축 맞춤.
		viewManager.setViewScaleMode(ViewScaleMode.matchHeightToScreen); // 기준해상도 + 세로축 맞춤.
		// viewManager.setViewScaleMode(ViewScaleMode.matchInsideToScreen); // 기준해상도 + 둘중에 긴축에 맞춤.
	}

	//==============================================================================
	// 갱신.
	//==============================================================================
	/**
	 * @param { number } timeDelta 
	 */
	tick(timeDelta) {
		super.tick(timeDelta);
		this.#animation.tick(timeDelta);
		const currentFrameIndex = this.#animation.getCurrentFrameIndex();
		// console.log(`currentFrameIndex: ${currentFrameIndex}`);
	}

	//==============================================================================
	// 출력.
	//==============================================================================
	/**
	 * @param { Graphic } graphic 
	 */
	draw(graphic) {
		// 출력.
		super.draw(graphic);

		const engine = super.getEngine();
		const canvasContext = graphic.getCanvasContext();
		const viewManager = engine.getViewManager();
		const canvasNativeSize = viewManager.getCanvasNativeSize();
		const referenceResolutionSize = viewManager.getReferenceResolutionSize();

		// 전체 화면 칠하기.
		viewManager.applyCanvasNativeRect(canvasContext);
		canvasContext.fillStyle = Colors.darkVanilla;
		graphic.drawRect(Rect.create(0, 0, canvasNativeSize.x, canvasNativeSize.y));

		// 게임 영역 칠하기.
		viewManager.applyViewRect(canvasContext);
		canvasContext.fillStyle = Colors.lightVanilla;
		graphic.drawRect(Rect.create(0, 0, referenceResolutionSize.x, referenceResolutionSize.y));

		// 사각형 그리기.
		let boxPosition = Vec2.create(0, 0);
		let boxSize = Vec2.create(100, 100);
		boxPosition = boxPosition.add(referenceResolutionSize.divide(2)).subtract(boxSize.divide(2));
		graphic.drawRect(Rect.create(boxPosition.x, boxPosition.y, boxSize.x, boxSize.y), "#ffff00");

		// 애니메이션 그리기.
		const frame = this.#animation.getCurrentFrame();
		if (frame) {
			const image = frame.getImage();
			const rect = frame.getRect();
			const position = referenceResolutionSize.divide(2).subtract(rect.size.divide(2));
			graphic.drawImage(image, position, rect.size, rect);
		}
	}

	//==============================================================================
	// 터치 누름.
	//==============================================================================
	/**
	 * @param { Vector2 } viewInputPosition
	 */
	touchPress(viewInputPosition) {
		super.touchPress(viewInputPosition);

		// 애니메이션 실행.
		this.#animation.gotoAndPlay(0);
	}
}


// 캔버스 생성.
let canvas = document.getElementById("tutorial");
if (canvas === null) {
	canvas = document.createElement("canvas");
	canvas.id = "tutorial";
	document.body.appendChild(canvas);
}

// 엔진 실행.
const engineConfiguration = new EngineConfiguration();
engineConfiguration.referenceResolutionSize = Vec2.create(800, 1280);
engineConfiguration.canvasId = "tutorial";
engineConfiguration.isDevelopment = true;
const engine = new Engine(engineConfiguration);
document.title = "vanilla.js - Tutorial";
const tutorial = new Tutorial_1();
engine.run(tutorial);