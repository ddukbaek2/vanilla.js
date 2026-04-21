//==============================================================================
// 포함 모듈 목록.
//==============================================================================
const System = globalThis;
import { Object } from "../base/object.js";
import { Version } from "../base/version.js";
import { Colors } from "../base/colors.js";
import { Vector2 } from "../base/vector2.js";
import { TimeManager } from "./timemanager.js";
import { ViewManager, ViewScaleMode } from "./viewmanager.js";
import { InputManager } from "./inputmanager.js";
import { Platform, PlatformType, BrowserType, SYSTEM_FONT_STRING } from "../base/platform.js";
import { Graphic } from "./graphic.js";
import { Scene } from "./scene.js";
import { Rect } from "../base/rect.js";
import { SceneManager } from "./scenemanager.js";
import { AudioManager } from "./audiomanager.js";
import { FontAsset } from "../resource/fontasset.js";



//==============================================================================
// 엔진 설정.
//==============================================================================
export class EngineConfiguration extends Object {
	//==============================================================================
	// 멤버 변수 목록.
	//==============================================================================
	/** @type { Vector2 } */ referenceResolutionSize; // 기준 해상도.
	// /** @type { ViewScaleMode } */ viewScaleMode; // 뷰 모드.
	/** @type { string } */ canvasId; // 캔버스 식별자.
	/** @type { boolean } */ useStatistics; // 정보창 출력 여부.
	/** @type { boolean } */ autoResizeOnWindowResize; // 윈도우가 리사이즈 될 때 캔버스 사이즈 자동 반영.
	/** @type { string } */ title; // 이름.

	//==============================================================================
	// 생성.
	//==============================================================================
	constructor() {
		super();
		// this.scene = null;
		this.referenceResolutionSize = Vector2.zero();
		// this.viewScaleMode = ViewScaleMode.none;
		this.canvasId = "";
		this.useStatistics = false;
		this.autoResizeOnWindowResize = false;
		this.title = "";
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
	/** @private @type { Graphic } */ #graphic;
	/** @private @type { SceneManager } */ #sceneManager;
	/** @private @type { TimeManager } */ #timeManager;
	/** @private @type { ViewManager } */ #viewManager;
	/** @private @type { InputManager } */ #inputManager;
	/** @private @type { AudioManager } */ #audioManager;
	/** @private @type { () => void  } */ #resizeCallback;
	/** @private @type { () => void  } */ #resumeCallback;
	/** @private @type { FrameRequestCallback } */ #updateEngineCallback;
	/** @private @type { number } */ #frameNumber;
	/** @private @type { Rect } */ #statisticsTextRect;
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
		if (engineConfiguration === null || engineConfiguration === undefined || engineConfiguration instanceof EngineConfiguration === false) {
			throw new System.Error(`engineConfiguration is invalid.`);
		}
		this.#engineConfiguration = engineConfiguration;
		this.#platform = new Platform();

		// 이름 설정.
		if (engineConfiguration.title !== "") {
			System.document.title = engineConfiguration.title;
		}

		// 캔버스 설정.
		const canvasId = this.#engineConfiguration.canvasId;
		const canvas = this.#platform.getOrAddCanvas(canvasId);
		

		this.#graphic = new Graphic(canvas);
		this.#sceneManager = new SceneManager(this);
		this.#timeManager = new TimeManager(this);
		this.#viewManager = new ViewManager(this);
		this.#viewManager.setCanvas(canvas);
		this.#inputManager = new InputManager(this);
		this.#audioManager = new AudioManager(this);

		this.#resizeCallback = this.resize.bind(this);
		this.#resumeCallback = this.resume.bind(this);
		this.#updateEngineCallback = this.updateEngine.bind(this);
		this.#frameNumber = 0;

		this.#statisticsTextRect = Rect.zero();
		this.#version = Version.create(0, 2, 0);

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
		if (scene === null || scene === undefined || scene instanceof Scene === false) {
			throw new System.Error(`scene is invalid.`);
		}
		
		// 기본 폰트 불러오기.
		const internalFontFace = new FontFace(`DOSGothic`, `url('https://cdn.jsdelivr.net/gh/projectnoonnu/noonfonts_eight@1.0/DOSGothic.woff')`);
		// const internalFontFace = new FontFace(`DOSGothic`, `url('./assets/fonts/Consolas.woff2')`);
		internalFontFace.load().then((loadedFont) => {
			document.fonts.add(loadedFont);

			// 씬 로드는 백그라운드로 시작. (렌더 루프가 drawOnLoad로 로딩 화면 출력)
			const sceneManager = this.getSceneManager();
			sceneManager.loadScene(scene).catch((error) => {
				console.error(error);
			});

			// 렌더 루프 즉시 시작.
			System.window.addEventListener("resize", this.#resizeCallback);
			++this.#frameNumber;
			System.window.requestAnimationFrame(this.#updateEngineCallback);
		}).catch((error) => {
			console.error(error);
		});
	}

	//==============================================================================
	// 오디오 컨텍스트 재개.
	//==============================================================================
	resume() {
		const audioManager = this.getAudioManager();
		audioManager.resumeContext();
	}

	//==============================================================================
	// 해상도 변경됨.
	//==============================================================================
	resize() {
		const engineConfiguration = this.getEngineConfiguration();
		const viewManager = this.getViewManager();

		// 설정: 윈도우가 리사이즈 될 때 캔버스 사이즈 자동 반영.
		if (engineConfiguration.autoResizeOnWindowResize) {
			const clientNativeSize = Vector2.create(System.window.innerWidth, System.window.innerHeight);
			const canvas = viewManager.getCanvas();

			// 캔버스 크기 스타일 조정. (사파리에서 필수)
			canvas.style.width = `${clientNativeSize.x}px`;
			canvas.style.height = `${clientNativeSize.y}px`;			
		}

		// 뷰 영역 계산.
		const beforeCanvasNativeSize = viewManager.getCanvasNativeSize();
		const beforeViewRect = viewManager.getViewNativeRect();
		viewManager.calculateViewRect();
		const afterCanvasNativeSize = viewManager.getCanvasNativeSize();
		const afterViewRect = viewManager.getViewNativeRect();

		// 씬: 화면 영역 변경 이벤트.
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
	setupAllDocumentEvents() {
		const viewManager = this.getViewManager();
		const inputManager = this.getInputManager();
		const canvas = viewManager.getCanvas();

		// 엔진 레벨 복구: 페이지가 백그라운드/파기 상태에서 돌아올 때 누적된 stuck 상태 리셋.
		// - 오디오 컨텍스트 suspended 상태면 재개 (액티비티 전환으로 AudioContext 가 자동 suspend 됨).
		// - 입력 상태(눌린 키, 터치)를 초기화하여 stuck 입력 방지.
		const recoverEngineState = () => {

			// 오디오 컨텍스트 복원.
			const audioManager = this.getAudioManager();
			if (audioManager) {
				audioManager.resumeContext();
			}

			// 입력 컨텍스트 초기화.
			const inputManager = this.getInputManager();
			if (inputManager) {
				inputManager.clear();
			}
		};

		// 페이지 프로세스 파기 후 복원 (Chromium freeze/resume, bfcache 등).
		// 엔진 레벨 복구 후 로드된 모든 씬의 onPageProcessRestored 가상 메서드 호출.
		System.document.addEventListener("resume", () => {
			console.log(`[Engine] resume: persisted`);

			recoverEngineState();
			const sceneManager = this.getSceneManager();
			const loadedScenes = sceneManager.getAllLoadedScenes();
			for (const loadedScene of loadedScenes) {
				loadedScene.onPageProcessRestored();
			}
		});
		System.window.addEventListener("pageshow", (pageTransitionEvent) => {
			if (pageTransitionEvent.persisted) {
				console.log(`[Engine] pageshow: persisted`);

				dispatchPageProcessRestored();
			}
		});

		// 페이지 가시성 복원 (백그라운드 → 포어그라운드).
		// 엔진 레벨 복구 후 로드된 모든 씬의 onPageVisibilityRestored 가상 메서드 호출.
		System.document.addEventListener("visibilitychange", () => {
			if (System.document.visibilityState === "visible") {
				console.log(`[Engine] visibilitychange: visible`);

				recoverEngineState();
				const sceneManager = this.getSceneManager();
				const loadedScenes = sceneManager.getAllLoadedScenes();
				for (const loadedScene of loadedScenes) {
					loadedScene.onPageVisibilityRestored();
				}
			}
		});

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

		// 마우스 뗄 때 (캔버스 밖에서 뗄 때 처리).
		System.window.addEventListener("mouseup", (touchEvent) => {
				const inputManager = this.getInputManager();
				if (!inputManager.isTouchMoved()) {
					return;
				}
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

		// 터치 움직일 때.
		System.window.addEventListener("touchmove", (touchEvent) => {
				const touch = touchEvent.changedTouches[0];
				if (!touch) {
					return;
				}
				const x = touch.clientX;
				const y = touch.clientY;
				if (x < 0 || y < 0 || x > window.innerWidth || y > window.innerHeight) {
					inputManager.setTouchMoved(false);
					inputManager.setTouchReleased(true);				
				}
			});

		// 터치 취소 될 때.
		canvas.addEventListener("touchcancel", (touchEvent) => {
				const touch = touchEvent.changedTouches[0];
				if (touch) {
					this.updateCanvasNativeInputPosition(touch.clientX, touch.clientY);
				}

				const inputManager = this.getInputManager();
				inputManager.setTouchMoved(false);
				inputManager.setTouchCancelled(true);
			});

		// 앱이나 창이 전환 될 때.
		System.window.addEventListener("blur", (focusEvent) => {
			const inputManager = this.getInputManager();
			inputManager.setTouchMoved(false);
			inputManager.setTouchReleased(true);
			focusEvent.preventDefault();
		}, { passive: false });

		// 오디오 컨텍스트 재개.
		System.window.addEventListener("click", this.#resumeCallback);
		System.window.addEventListener("touchstart", this.#resumeCallback);
		System.window.addEventListener("keydown", this.#resumeCallback);
		System.window.addEventListener("focus", this.#resumeCallback);
		System.document.addEventListener("visibilitychange", () => {
			if (System.document.visibilityState === "visible") {
				this.resume();
			}
		});

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
		const viewInputPosition = viewManager.canvasPositionToViewPosition(canvasNativeInputPosition);
		inputManager.setViewInputPosition(viewInputPosition);
	}
	
	//==============================================================================
	// 개발 관련 정보 출력.
	//==============================================================================
	/**
	 * @param { Graphic } graphic 
	 */
	drawStatistics(graphic) {
		const canvasRenderingContext = graphic.getCanvasRenderingContext();
		const timeManager = this.getTimeManager();
		const viewManager = this.getViewManager();
		const inputManager = this.getInputManager();

		const textPosition = Vector2.create(16, 16);
		this.#statisticsTextRect.position = textPosition.clone();
		const drawStatisticsText = (text) => {
			if (text) {
				// 출력.
				canvasRenderingContext.fillText(text, textPosition.x, textPosition.y);
				
				// 자동 외곽선 출력.
				// canvasRenderingContext.strokeText(text, textPosition.x, textPosition.y);
				// canvasRenderingContext.fillText(text, textPosition.x, textPosition.y);

				// 수동 외곽선 두께 출력.
				// const offsets = [
				// 	[-2, -2], [2, -2], [-2, 2], [2, 2], 
				// 	[-2, 0], [2, 0], [0, -2], [0, 2]
				// ];
				// canvasRenderingContext.fillStyle = Colors.black;
				// for (let i = 0; i < offsets.length; ++i) {
				// 	canvasRenderingContext.fillText(text, textPosition.x + offsets[i][0], textPosition.y + offsets[i][1]);
				// }

				// 수동 외곽선 안쪽 출력.
				// canvasRenderingContext.fillStyle = Colors.white;
				// canvasRenderingContext.fillText(text, textPosition.x, textPosition.y);
			}

			// 위치 증가.
			textPosition.y += 16;

			// 영역 출력.
			const metrics = canvasRenderingContext.measureText(text);
			const width = metrics.width; // metrics.actualBoundingBoxLeft + metrics.actualBoundingBoxRight)
			const height = metrics.actualBoundingBoxAscent + metrics.actualBoundingBoxDescent;
			const textRect = Rect.create(textPosition.x, textPosition.y, width, height);

			this.#statisticsTextRect.size.x = Math.max(this.#statisticsTextRect.size.x, width);
			this.#statisticsTextRect.size.y += 16;
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
		canvasRenderingContext.setTransform(1, 0, 0, 1, 0, 0);
		canvasRenderingContext.scale(1.4, 1.4);
		graphic.setFillColor("rgba(0, 0, 0, 0.6)");
		graphic.drawRoundRect(Rect.create(
			this.#statisticsTextRect.position.x - 10,
			this.#statisticsTextRect.position.y - 10,
			this.#statisticsTextRect.size.x + 20,
			this.#statisticsTextRect.size.y + 20,
		), 12);
		// this.#statisticsTextRect.size.set(0, 0);
		this.#statisticsTextRect.size.y = 0;

		// canvasRenderingContext.letterSpacing = "-1px";
		canvasRenderingContext.font = `16px DOSGothic`;
		canvasRenderingContext.textAlign = "left";
		canvasRenderingContext.textBaseline = "top";
		canvasRenderingContext.fillStyle = Colors.white;
		// canvasRenderingContext.fillStyle = Colors.white; // Colors.lightVanilla;
		// canvasRenderingContext.lineWidth = 4;
		// canvasRenderingContext.strokeStyle = Colors.black; // Colors.darkVanilla;
		// canvasRenderingContext.textRendering = "auto"; //optimizeLegibility"; //"geometricPrecision";
		// canvasRenderingContext.shadowColor = Colors.white;
		// canvasRenderingContext.shadowOffsetX = 0.5;
		// canvasRenderingContext.shadowOffsetY = 0.5;
		
		// canvasRenderingContext.imageSmoothingEnabled = false;
		// canvasRenderingContext.scale(1.4, 1.4);

		// 플랫폼 정보 출력.
		this.#platform.getPlatformInfo();
		const versionString = this.getVersionString();
		drawStatisticsText(`engineVersion: ${versionString}`);
		drawStatisticsText(`platformName: ${this.#platform.platformName}`);
		drawStatisticsText(`browserName: ${this.#platform.browserName}`);
		drawStatisticsText(``);

		// 화면 정보 출력.
		// const clientNativeSize = viewManager.getClientNativeSize();
		const canvasNativeSize = viewManager.getCanvasNativeSize();
		// const canvasPixelSize = viewManager.getCanvasPixelSize();
		const viewScaleMode = viewManager.getViewScaleMode();
		const referenceResolutionSize = viewManager.getReferenceResolutionSize();
		// const screenSize = viewManager.getScreenSize();
		const viewNativeRect = viewManager.getViewNativeRect();
		const viewSize = viewManager.getViewSize();
		const canvasNativeInputPosition = inputManager.getCanvasNativeInputPosition();
		const viewInputPosition = inputManager.getViewInputPosition();
		// drawOutlineText(`clientNativeSize: (${clientNativeSize.x}, ${clientNativeSize.y})`);
		drawStatisticsText(`canvasNativeSize: (${canvasNativeSize.x}, ${canvasNativeSize.y})`);
		// drawOutlineText(`canvasPixelSize: (${canvasPixelSize.x}, ${canvasPixelSize.y})`);
		drawStatisticsText(`referenceResolutionSize: (${referenceResolutionSize.x}, ${referenceResolutionSize.y})`);
		// drawOutlineText(`screenSize: (${screenSize.x}, ${screenSize.y})`);
		drawStatisticsText(`viewScaleMode: ${viewScaleMode}`);
		drawStatisticsText(`viewNativeRect: (${viewNativeRect.position.x}, ${viewNativeRect.position.y}) - (${viewNativeRect.size.x}, ${viewNativeRect.size.y})`);
		drawStatisticsText(`viewSize: (${viewSize.x}, ${viewSize.y})`);
		drawStatisticsText(`canvasNativeInputPosition: (${canvasNativeInputPosition.x}, ${canvasNativeInputPosition.y})`);
		drawStatisticsText(`viewInputPosition: (${viewInputPosition.x}, ${viewInputPosition.y})`);
		drawStatisticsText(``);

		// 초당 프레임 정보 출력.
		// const realtimeScinceStartup = timeManager.getRealtimeSinceStartup().toFixed(2);
		const time = timeManager.getTime().toFixed(2);
		const framePerSecond = timeManager.getFramePerSecond();
		const timeDelta = timeManager.getTimeDelta().toFixed(3);
		// drawOutlineText(`realtimeScinceStartup: ${realtimeScinceStartup}`);
		drawStatisticsText(`time: ${time}s`);
		drawStatisticsText(`framePerSecond: ${framePerSecond}`);
		drawStatisticsText(`timeDelta: ${timeDelta}s`);
		// drawOutlineText(``);

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
		timeManager.update(timestamp);
		const timeDelta = timeManager.getTimeDelta();

		// 입력 처리.
		const inputManager = this.getInputManager();
		inputManager.tick(timeDelta);

		// // 화면 더 부드럽게.
		// this.CanvasContext.scale(this.#view.devicePixelRatio, this.#view.devicePixelRatio);
		// this.CanvasContext.imageSmoothingEnabled = true;
    	// this.CanvasContext.imageSmoothingQuality = 'high';
		// this.canvasRenderingContext.canvas.style.textRendering = 'optimizeLegibility';

		// 씬 처리.
		const sceneManager = this.getSceneManager();
		const loadedScenes = sceneManager.getAllLoadedScenes();
		for (const loadedScene of loadedScenes) {
			try {
				if (!loadedScene.isLoaded()) {
					// 로딩 중: 로딩 전용 출력만 호출. 씬의 tick/draw는 호출하지 않음.
					loadedScene.drawOnLoad(graphic);
					continue;
				}

				// 갱신.
				loadedScene.tick(timeDelta);

				// 출력.
				loadedScene.preDraw(graphic);
				loadedScene.draw(graphic);
				loadedScene.postDraw(graphic);

				const isGizmoVisible = loadedScene.isGizmoVisible();
				if (isGizmoVisible) {
					loadedScene.drawGizmos(graphic);
				}
			}
			catch (error) {
				console.error(error);
			}
		}

		// 개발 정보 출력.
		const engineConfiguration = this.getEngineConfiguration();
		if (engineConfiguration.useStatistics) {
			this.drawStatistics(graphic);
		}
		
		// 입력 관련해서 상태 유지가 아닌, 현재 프레임이 끝난 후에는 다음 프레임에서는 상태를 유지하지 않음. (1회성)
		inputManager.setTouchPressed(false);
		inputManager.setTouchReleased(false);
		inputManager.setTouchCancelled(false);

		// 다음 프레임 호출 요청.
		++this.#frameNumber;
		System.window.requestAnimationFrame(this.#updateEngineCallback);
	}

	//==============================================================================
	// 커서 보이기 설정.
	//==============================================================================
	/**
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
	 * @returns { Platform }
	 */
	getPlatform() {
		return this.#platform;
	}

	//==============================================================================
	// 씬 매니저 반환.
	//==============================================================================
	/**
	 * @returns { SceneManager }
	 */
	getSceneManager() {
		return this.#sceneManager;
	}
	
	//==============================================================================
	// 시간 매니저 반환.
	//==============================================================================
	/**
	 * @returns { TimeManager }
	 */
	getTimeManager() {
		return this.#timeManager;
	}
	
	//==============================================================================
	// 뷰 매니저 반환.
	//==============================================================================
	/**
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
	// 오디오 매니저 반환.
	//==============================================================================
	/**
	 * @returns { AudioManager }
	 */
	getAudioManager() {
		return this.#audioManager;
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
	// 엔진 설정 반환.
	//==============================================================================
	/**
	 * @returns { EngineConfiguration }
	 */
	getEngineConfiguration() {
		return this.#engineConfiguration;
	}

	//==============================================================================
	// 현재 프레임 번호 반환.
	//==============================================================================
	/**
	 * @returns { number }
	 */
	getFrameNumber() {
		return this.#frameNumber;
	}
}
