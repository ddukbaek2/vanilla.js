//==============================================================================
// 포함 모듈 목록.
//==============================================================================
const System = globalThis;
import { Object } from "../base/object.js";
import { Version } from "../base/version.js";
import { Colors } from "../base/colors.js";
import { Vector2 } from "../base/vector2.js";
import { TimeManager } from "./timemanager.js";
import { ViewManager } from "./viewmanager.js";
import { InputManager } from "./inputmanager.js";
import { Platform, PlatformType, BrowserType, SYSTEM_FONT_STRING } from "../base/platform.js";
import { Graphic } from "./graphic.js";
import { Scene } from "./scene.js";
import { Rect } from "../base/rect.js";
import { SceneManager } from "./scenemanager.js";
import { FontAsset } from "../resource/fontasset.js"; 



//==============================================================================
// 엔진 설정.
//==============================================================================
export class EngineConfiguration extends Object {
	// /** @type { Scene } */ scene;
	/** @type { Vector2 } */ referenceResolutionSize;
	/** @type { string } */ canvasId;
	/** @type { boolean } */ isDevelopment;
	constructor() {
		super();
		// this.scene = null;
		this.referenceResolutionSize = Vector2.zero();
		this.canvasId = "";
		this.isDevelopment = false;
	}
}


//==============================================================================
// 엔진.
//==============================================================================
export class Engine extends Object {
	//==============================================================================
	// 멤버 변수 목록.
	//==============================================================================
	/** @private @type { EngineConfiguration } */ #engineConfiguration;
	/** @private @type { Platform } */ #platform;
	/** @private @type { SceneManager } */ #sceneManager;
	/** @private @type { TimeManager } */ #timeManager;
	/** @private @type { ViewManager } */ #viewManager;
	/** @private @type { InputManager } */ #inputManager;
	/** @private @type { Graphic } */ #graphic;
	/** @private @type { () => void  } */ #resizeCallback;
	/** @private @type { FrameRequestCallback } */ #updateEngineCallback;
	/** @private @type { Version } */ #version;

	//==============================================================================
	// 생성.
	//==============================================================================
	/**
	 * @constructor
	 * @param { EngineConfiguration } engineConfiguration
	 */
	constructor(engineConfiguration) {
		super();
		if (engineConfiguration === null || engineConfiguration instanceof EngineConfiguration === false) {
			throw new System.Error(`engineConfiguration is invalid.`);
		}
		this.#engineConfiguration = engineConfiguration;
		const canvas = this.getOrAddCanvas(engineConfiguration.canvasId);
		const canvasContext = canvas.getContext("2d", { alpha: false });

		this.#platform = new Platform();
		this.#sceneManager = new SceneManager(this);
		this.#timeManager = new TimeManager(this);
		this.#viewManager = new ViewManager(this, engineConfiguration.referenceResolutionSize);
		this.#viewManager.setCanvas(canvas);
		this.#inputManager = new InputManager(this);
		this.#graphic = new Graphic(this, canvasContext);

		this.#resizeCallback = this.resize.bind(this);
		this.#updateEngineCallback = this.updateEngine.bind(this);
		this.#version = Version.create(0, 0, 9);

		// 이벤트 설정.
		this.setupAllDocumentEvents();
		this.resize();
	}

	//==============================================================================
	// 시작.
	//==============================================================================
	/**
	 * @param { Scene } scene
	 */
	run(scene) {
		if (scene === null || scene instanceof Scene === false) {
			throw new System.Error(`scene is invalid.`);
		}
		
		// 기본 폰트 불러오기.
		const internalFontFace = new FontFace(`DOSGothic`, `url('https://cdn.jsdelivr.net/gh/projectnoonnu/noonfonts_eight@1.0/DOSGothic.woff')`);
		internalFontFace.load().then((loadedFont) => {
			document.fonts.add(loadedFont);
			// 씬 불러오기.
			const sceneManager = this.getSceneManager();
			return sceneManager.loadScene(scene);
		}).then(() => {
			// 엔진 실행.
			System.window.addEventListener("resize", this.#resizeCallback);
			System.window.requestAnimationFrame(this.#updateEngineCallback);
		}).catch((error) => {
			console.error(error);
		});
	}

	//==============================================================================
	// 해상도 변경됨.
	//==============================================================================
	resize() {
		const viewManager = this.getViewManager();
		const beforeCanvasNativeSize = viewManager.getCanvasNativeSize();
		const beforeViewRect = viewManager.getViewRect();
		viewManager.calculateViewRect();
		const afterCanvasNativeSize = viewManager.getCanvasNativeSize();
		const afterViewRect = viewManager.getViewRect();

		// 씬 리사이즈.
		const sceneManager = this.getSceneManager();
		const loadedScenes = sceneManager.getAllLoadedScenes();
		for (const loadedScene of loadedScenes) {
			try {
				// console.log(`[SceneManager] resize: (${afterCanvasNativeSize.x}, ${afterCanvasNativeSize.y})`);
				loadedScene.resize(afterCanvasNativeSize);
			}
			catch (error) {
				console.error(error);
			}
		}
	}

	//==============================================================================
	// 웹페이지에 기반하는 이벤트 설정.
	//==============================================================================
	/**
	 * @private
	 * @method
	 */
	setupAllDocumentEvents() {
		const viewManager = this.getViewManager();
		const inputManager = this.getInputManager();
		const canvas = viewManager.getCanvas();

		// 키보드 누름.
		System.document.addEventListener("keydown", (keyboardEvent) => {
			const key = keyboardEvent.code;
			inputManager.pushKey(key);
			// console.log(`keydown: ${key}`);
		});

		// 키보드 뗌.
		System.document.addEventListener("keyup", (keyboardEvent) => {
			const key = keyboardEvent.code;
			inputManager.popKey(key);
			// console.log(`keyup: ${key}`);
		});

		// 마우스 우클릭시 컨텍스트 메뉴 출력 될 때.
		canvas.addEventListener("contextmenu", (touchEvent) => {
			touchEvent.preventDefault();
		});

		// 마우스 누를 때.
		canvas.addEventListener("mousedown", (touchEvent) => {
				const inputManager = this.getInputManager();
				inputManager.setTouchPressed(true);
				inputManager.setTouchMoved(true);
				this.updateCanvasNativeInputPosition(touchEvent.clientX, touchEvent.clientY);
			});

		// 마우스 움직일 때.
		canvas.addEventListener("mousemove", (touchEvent) => {
				this.updateCanvasNativeInputPosition(touchEvent.clientX, touchEvent.clientY);
			});

		// 마우스 뗄 때.
		canvas.addEventListener("mouseup", (touchEvent) => {
				const inputManager = this.getInputManager();
				inputManager.setTouchMoved(false);
				inputManager.setTouchReleased(true);
				this.updateCanvasNativeInputPosition(touchEvent.clientX, touchEvent.clientY);
			});

		// 터치 누를 때.
		canvas.addEventListener("touchstart", (touchEvent) => {
				const touch = touchEvent.changedTouches[0];
				if (!touch) {
					return;
				}

				const inputManager = this.getInputManager();
				inputManager.setTouchMoved(true);
				inputManager.setTouchPressed(true);
				this.updateCanvasNativeInputPosition(touch.clientX, touch.clientY);
				touchEvent.preventDefault();
			}, { passive: false });

		// 터치 움직일 때.
		canvas.addEventListener("touchmove", (touchEvent) => {
				const touch = touchEvent.changedTouches[0];
				if (!touch) {
					return;
				}

				this.updateCanvasNativeInputPosition(touch.clientX, touch.clientY);
				touchEvent.preventDefault();
			}, { passive: false });

		// 터치 뗄 때.
		canvas.addEventListener("touchend", (touchEvent) => {
				const touch = touchEvent.changedTouches[0];
				if (touch) {
					this.updateCanvasNativeInputPosition(touch.clientX, touch.clientY);
				}

				const inputManager = this.getInputManager();
				inputManager.setTouchMoved(false);
				inputManager.setTouchReleased(true);
				touchEvent.preventDefault();
			}, { passive: false });

		// 커서가 보이거나 감춰질 때.
		System.document.addEventListener("pointerlockchange", () => {
			if (document.pointerLockElement === canvas) {
				// console.log('커서가 숨겨졌습니다.');
			} else {
				// console.log('커서가 다시 나타났습니다.');
			}
		});

		// 게임패드 연결됨.
		System.window.addEventListener("gamepadconnected", (gamepadEvent) => {
			const gamepad = gamepadEvent.gamepad;
			const inputManager = this.getInputManager();
			inputManager.connectGamepad(gamepad);
			console.log(`gamepadconnected: ${gamepad.id}`);
		});

		// 게임패드 연결해제됨.
		System.window.addEventListener("gamepaddisconnected", (gamepadEvent) => {
			const gamepad = gamepadEvent.gamepad;
			const inputManager = this.getInputManager();
			inputManager.disconnectGamepad(gamepad);
			console.log(`gamepaddisconnected: ${gamepad.id}`);
		});
	}

	//==============================================================================
	// 입력 좌표 갱신.
	//==============================================================================
	/**
	 * @private
	 * @method
	 * @param { number } x
	 * @param { number } y
	 */
	updateCanvasNativeInputPosition(x, y) {
		const inputManager = this.getInputManager();

		// 캔버스 위치 가져오기.
		const viewManager = this.getViewManager();
		const canvas = viewManager.getCanvas();
		const rect = canvas.getBoundingClientRect();

		// 캔버스 기준 기본 입력 위치 설정.
		const canvasNativeInputPosition = Vector2.create(x - rect.left, y - rect.top);
		inputManager.setCanvasNativeInputPosition(canvasNativeInputPosition);

		// 뷰 기준 입력 위치 설정.
		const viewInputPosition = viewManager.calculateViewPosition(canvasNativeInputPosition);
		inputManager.setViewInputPosition(viewInputPosition);
	}
	
	//==============================================================================
	// 개발 관련 정보 출력.
	//==============================================================================
	/**
	 * @param { Graphic } graphic 
	 */
	drawStatistics(graphic) {
		// const isDevelopment = this.isDevelopment();
		// if (!isDevelopment) {
		// 	return;
		// }
	
		const canvasContext = graphic.getCanvasContext();
		const timeManager = this.getTimeManager();
		const viewManager = this.getViewManager();
		const inputManager = this.getInputManager();

		const textPosition = Vector2.create(16, 16);
		const drawOutlineText = (text) => {
			if (text) {
				// 출력.
				canvasContext.fillText(text, textPosition.x, textPosition.y);
				
				// 자동 외곽선 출력.
				// canvasContext.strokeText(text, textPosition.x, textPosition.y);
				// canvasContext.fillText(text, textPosition.x, textPosition.y);

				// 수동 외곽선 두께 출력.
				// const offsets = [
				// 	[-2, -2], [2, -2], [-2, 2], [2, 2], 
				// 	[-2, 0], [2, 0], [0, -2], [0, 2]
				// ];
				// canvasContext.fillStyle = Colors.black;
				// for (let i = 0; i < offsets.length; ++i) {
				// 	canvasContext.fillText(text, textPosition.x + offsets[i][0], textPosition.y + offsets[i][1]);
				// }

				// 수동 외곽선 안쪽 출력.
				// canvasContext.fillStyle = Colors.white;
				// canvasContext.fillText(text, textPosition.x, textPosition.y);
			}

			// 위치 증가.
			textPosition.y += 16;

			// 영역 출력.
			const metrics = canvasContext.measureText(text);
			const width = metrics.width; // metrics.actualBoundingBoxLeft + metrics.actualBoundingBoxRight)
			const height = metrics.actualBoundingBoxAscent + metrics.actualBoundingBoxDescent;
			return Rect.create(textPosition.x, textPosition.y, width, height);
		};

		const formatSizeString = (bytes) => {
			let killo = bytes / 1024;
			let mega = killo / 1024;
			let value =  mega.toFixed(2);
			return `${value} MB`;

			// if (mega < 1) {
			// 	let value = killo.toFixed(2);
			// 	return `${value} KB`;
			// }
			// else {
			// 	let value =  mega.toFixed(2);
			// 	return `${value} MB`;
			// }
		};


		// 배경 출력.
		// 기본 위치인 화면 좌상단으로 이동.
		canvasContext.setTransform(1, 0, 0, 1, 0, 0);
		canvasContext.fillStyle = "rgba(0, 0, 0, 0.6)";
		graphic.drawRect(Rect.create(10, 10, 480, 320));

		// canvasContext.letterSpacing = "-1px";
		canvasContext.font = `16px DOSGothic`;
		canvasContext.textAlign = "left";
		canvasContext.textBaseline = "top";
		canvasContext.fillStyle = Colors.white;
		// canvasContext.fillStyle = Colors.white; // Colors.lightVanilla;
		// canvasContext.lineWidth = 4;
		// canvasContext.strokeStyle = Colors.black; // Colors.darkVanilla;
		// canvasContext.textRendering = "auto"; //optimizeLegibility"; //"geometricPrecision";
		// canvasContext.shadowColor = Colors.white;
		// canvasContext.shadowOffsetX = 0.5;
		// canvasContext.shadowOffsetY = 0.5;
		
		// canvasContext.imageSmoothingEnabled = false;
		canvasContext.scale(1.4, 1.4);

		// 플랫폼 정보 출력.
		this.#platform.getPlatformInfo();
		const versionString = this.getVersionString();
		drawOutlineText(`engineVersion: ${versionString}`);
		drawOutlineText(`platformName: ${this.#platform.platformName}`);
		drawOutlineText(`browserName: ${this.#platform.browserName}`);
		drawOutlineText(``);

		// 화면 정보 출력.
		// const clientNativeSize = viewManager.getClientNativeSize();
		const canvasNativeSize = viewManager.getCanvasNativeSize();
		// const canvasPixelSize = viewManager.getCanvasPixelSize();
		const viewScaleMode = viewManager.getViewScaleMode();
		const referenceResolutionSize = viewManager.getReferenceResolutionSize();
		// const viewRect = viewManager.getViewRect();
		const canvasNativeInputPosition = inputManager.getCanvasNativeInputPosition();
		const viewInputPosition = inputManager.getViewInputPosition();
		// drawOutlineText(`clientNativeSize: (${clientNativeSize.x}, ${clientNativeSize.y})`);
		drawOutlineText(`canvasNativeSize: (${canvasNativeSize.x}, ${canvasNativeSize.y})`);
		// drawOutlineText(`canvasPixelSize: (${canvasPixelSize.x}, ${canvasPixelSize.y})`);
		drawOutlineText(`referenceResolutionSize: (${referenceResolutionSize.x}, ${referenceResolutionSize.y})`);
		drawOutlineText(`viewScaleMode: ${viewScaleMode}`);
		// drawOutlineText(`viewRect: (${viewRect.position.x}, ${viewRect.position.y}) - (${viewRect.size.x}, ${viewRect.size.y})`);
		drawOutlineText(`canvasNativeInputPosition: (${canvasNativeInputPosition.x}, ${canvasNativeInputPosition.y})`);
		drawOutlineText(`viewInputPosition: (${viewInputPosition.x}, ${viewInputPosition.y})`);
		drawOutlineText(``);

		// 초당 프레임 정보 출력.
		// const realtimeScinceStartup = timeManager.getRealtimeSinceStartup().toFixed(2);
		const time = timeManager.getTime().toFixed(2);
		const framePerSecond = timeManager.getFramePerSecond();
		const timeDelta = timeManager.getTimeDelta().toFixed(3);
		// drawOutlineText(`realtimeScinceStartup: ${realtimeScinceStartup}`);
		drawOutlineText(`time: ${time}s`);
		drawOutlineText(`framePerSecond: ${framePerSecond}`);
		drawOutlineText(`timeDelta: ${timeDelta}s`);
		drawOutlineText(``);

		// // 메모리 사용 정보 출력.
		// // 크로미움 기반 API. (비표준)
		// const memory = performance.memory;
		// if (memory)
		// {
		// 	const usedJSHeapSize = formatSizeString(memory.usedJSHeapSize);
		// 	const totalJSHeapSize = formatSizeString(memory.totalJSHeapSize);
		// 	const jsHeapSizeLimit = formatSizeString(memory.jsHeapSizeLimit);
		// 	drawOutlineText(`usedJSHeapSize: ${usedJSHeapSize}`);
		// 	drawOutlineText(`totalJSHeapSize: ${totalJSHeapSize}`);
		// 	drawOutlineText(`jsHeapSizeLimit: ${jsHeapSizeLimit}`);
		// }

		// var resourceUsage = this.#platform.getResouceUsage();
		// const totalTransferSize = formatSizeString(resourceUsage.totalTransferSize);
		// const totalDecodedSize = formatSizeString(resourceUsage.totalDecodedSize);
		// const loadedFiles = resourceUsage.loadedFiles;

		// // 다운 로드된 리소스 목록.
		// y += 26; drawOutlineText(`totalTransferSize: ${totalTransferSize}`, x, y);
		// for (let i = 0; i < loadedFiles.length; ++i)
		// {
		// 	const loadedFile = loadedFiles[i];
		// 	const name = loadedFile.name;
		// 	if (loadedFile.transferSize < 1024)
		// 		continue;

		// 	const transferSizeString = formatSizeString(loadedFile.transferSize);
		// 	y += 26; drawOutlineText(` - ${name} (${transferSizeString})`, x, y);
		// }

		// // 로드된 리소스 목록.
		// drawOutlineText(`totalDecodedSize: ${totalDecodedSize}`);
		// for (let i = 0; i < loadedFiles.length; ++i)
		// {
		// 	const loadedFile = loadedFiles[i];
		// 	const name = loadedFile.name;
		// 	if (loadedFile.decodedSize < 1024)
		// 		continue;

		// 	const decodedSizeString = formatSizeString(loadedFile.decodedSize);
		// 	y += 26; drawOutlineText(` - ${name} (${decodedSizeString})`, x, y);
		// }
	}

	//==============================================================================
	// 엔진 갱신.
	//==============================================================================
	/**
	 * @param { number } timestamp
	 */
	updateEngine(timestamp) {

		// 렌더러 처리.
		const graphic = this.getGraphic();
		graphic.applySettings(this);

		// 시간 처리.
		const timeManager = this.getTimeManager();
		timeManager.calculateTime(timestamp);
		const timeDelta = timeManager.getTimeDelta();

		// 입력 처리.
		const inputManager = this.getInputManager();
		inputManager.tick(timeDelta);

		// // 화면 더 부드럽게.
		// this.CanvasContext.scale(this.#view.devicePixelRatio, this.#view.devicePixelRatio);
		// this.CanvasContext.imageSmoothingEnabled = true;
    	// this.CanvasContext.imageSmoothingQuality = 'high';
		// this.canvasContext.canvas.style.textRendering = 'optimizeLegibility';

		// 씬 처리.
		const sceneManager = this.getSceneManager();
		const loadedScenes = sceneManager.getAllLoadedScenes();
		for (const loadedScene of loadedScenes) {
			try {
				// 갱신.
				loadedScene.tick(timeDelta);

				// 출력.
				loadedScene.preDraw(graphic);
				loadedScene.draw(graphic);
				loadedScene.postDraw(graphic);
				loadedScene.drawGizmo(graphic);
			}
			catch (error) {
				console.error(error);
			}
		}

		// 개발 정보 출력.
		const isDevelopment = this.isDevelopment();
		if (isDevelopment) {
			this.drawStatistics(graphic);
		}
		
		// 입력 관련해서 상태 유지가 아닌, 현재 프레임이 끝난 후에는 다음 프레임에서는 상태를 유지하지 않음. (1회성)
		inputManager.setTouchPressed(false);
		inputManager.setTouchReleased(false);

		// 다음 프레임 호출 요청.
		System.window.requestAnimationFrame(this.#updateEngineCallback);
	}

	//==============================================================================
	// 커서 보이기 설정.
	//==============================================================================
	/**
	 * @public
	 * @method
	 * @param { boolean } visibled 
	 */
	setVisibleCursor(visibled) {
		if (visibled) {
			document.body.style.cursor = 'default';
		}
		else {
			document.body.style.cursor = 'none';
		}
	}

	//==============================================================================
	// 캔버스 정보 반환.
	//==============================================================================
	/**
	 * @public
	 * @method
	 * @returns { HTMLCanvasElement }
	 */
	getCanvas() {
		const viewManager = this.getViewManager();
		return viewManager.getCanvas();
	}

	//==============================================================================
	// 플랫폼 정보 반환.
	//==============================================================================
	/**
	 * @public
	 * @method
	 * @returns { Platform }
	 */
	getPlatform() {
		return this.#platform;
	}

	//==============================================================================
	// 씬 매니저 반환.
	//==============================================================================
	/**
	 * @public
	 * @method
	 * @returns { SceneManager }
	 */
	getSceneManager() {
		return this.#sceneManager;
	}
	
	//==============================================================================
	// 시간 매니저 반환.
	//==============================================================================
	/**
	 * @public
	 * @method
	 * @returns { TimeManager }
	 */
	getTimeManager() {
		return this.#timeManager;
	}
	
	//==============================================================================
	// 뷰 매니저 반환.
	//==============================================================================
	/**
	 * @public
	 * @method
	 * @returns { ViewManager }
	 */
	getViewManager() {
		return this.#viewManager;
	}

	//==============================================================================
	// 입력 매니저 반환.
	//==============================================================================
	/**
	 * @returns { InputManager }
	 */
	getInputManager() {
		return this.#inputManager;
	}

	//==============================================================================
	// 렌더러 반환.
	//==============================================================================
	/**
	 * @returns { Graphic }
	 */
	getGraphic() {
		return this.#graphic;
	}

	//==============================================================================
	// 버전 반환.
	//==============================================================================
	/**
	 * @returns { string }
	 */
	getVersionString() {
		return this.#version.getVersionString();
	}
	
	//==============================================================================
	// 개발 모드 여부 반환.
	//==============================================================================
	/**
	 * @returns { boolean }
	 */
	isDevelopment() {
		return this.#engineConfiguration.isDevelopment;
	}

	//==============================================================================
	// 캔버스 생성 or 반환.
	//==============================================================================
	/**
	 * @param { string } canvasId
	 * @returns { HTMLCanvasElement }
	 */
	getOrAddCanvas(canvasId) {
		let canvas = document.getElementById(canvasId);
		if (canvas === null) {
			canvas = document.createElement("canvas");
			canvas.id = canvasId;
			document.body.appendChild(canvas);
		}

		return canvas;
	}
}
