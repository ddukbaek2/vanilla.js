//==============================================================================
// 포함 모듈 목록.
//==============================================================================
import { VObject } from "../base/object.js";
import { VView } from "./view.js";
import { VInput } from "./input.js";
import { VGameInstance } from "./gameinstance.js";
import { VPlatform, PlatformType, BrowserType } from "../base/platform.js";
import { VRenderer } from "./renderer.js";


//==============================================================================
// 엔진.
//==============================================================================
export class VEngine extends VObject {
	//==============================================================================
	// 멤버 변수 목록.
	//==============================================================================
	/** @private @type { () => void  } */ #onResizeCallback = null;
	/** @private @type { FrameRequestCallback } */ #onEngineUpdateCallback = null;
	/** @private @type { VGameInstance } */ #gameInstance = null;

	/** @public @type { HTMLCanvasElement } */ canvas = null;
	/** @public @type { CanvasRenderingContext2D } */ canvasContext = null;	

	/** @public @type { VInput } */ #input = null;
	/** @public @type { } */ Time = null;
	/** @public @type { VView } */ view = null;

	/** @public @type { number } */ width = 0;
	/** @public @type { number } */ height = 0;

	/** @public @type { boolean } */ isDevelopment = false;
	/** @public @type { VPlatform } */ platform = null;
	/** @public @type { VRenderer } */ renderer = null;

	//==============================================================================
	// 생성.
	//==============================================================================
	constructor(width, height, canvasId, isDevelopment = true) {
		super();

		this.width = width;
		this.height = height;
		this.canvas = document.getElementById(canvasId);
		this.canvasContext = this.canvas.getContext("2d", { alpha: false });

		this.view = new VView();

		this.#input = new VInput();

		this.Time = {
			Last: 0,
			TimeDelta: 0,
			ElapsedTime: 0,
			FPS: 0,
			FramesThisSecond: 0,
			LastFPSTime: 0
		};

		this.#gameInstance = null;

		this.#onResizeCallback = this.#onResize.bind(this);
		this.#onEngineUpdateCallback = this.#updateEngine.bind(this);
		this.isDevelopment = isDevelopment;
		this.platform = new VPlatform();
		this.renderer = new VRenderer(this);

		this.#setupAllEvents();
		this.#onResize();
	}

	//==============================================================================
	// 게임 인스턴스 설정.
	//==============================================================================
	/**
	 * @method
	 * @public
	 * @param { VGameInstance } gameInstance
	 */
	setGameInstance(gameInstance) {
		this.#gameInstance = gameInstance;
		if (this.#gameInstance && typeof this.#gameInstance.onInitialize === "function") {
			this.#gameInstance.onInitialize(this);
		}
	}

	//==============================================================================
	// 시작.
	//==============================================================================
	/**
	 * @param { VGameInstance } gameInstance
	 */
	run(gameInstance) {
		if (gameInstance != null)
			this.setGameInstance(gameInstance);

		window.addEventListener("resize", this.#onResizeCallback);
		window.requestAnimationFrame(this.#onEngineUpdateCallback);
	}

	//==============================================================================
	// 해상도 변경됨.
	//==============================================================================
	/**
	 * @private
	 * @method
	 */
	#onResize() {
		const screenWidth = window.innerWidth;
		const screenHeight = window.innerHeight;
		const devicePixelRatio = window.devicePixelRatio || 1;

		this.canvas.width = Math.round(screenWidth * devicePixelRatio);
		this.canvas.height = Math.round(screenHeight * devicePixelRatio);
		this.canvas.style.width = `${screenWidth}px`;
		this.canvas.style.height = `${screenHeight}px`;

		const scale = Math.min(
			screenWidth / this.width,
			screenHeight / this.height
		);

		const viewWidth = Math.round(this.width * scale);
		const viewHeight = Math.round(this.height * scale);
		const viewX = Math.floor((screenWidth - viewWidth) * 0.5);
		const viewY = Math.floor((screenHeight - viewHeight) * 0.5);

		this.view.ScreenWidth = screenWidth;
		this.view.ScreenHeight = screenHeight;
		this.view.devicePixelRatio = devicePixelRatio;
		this.view.X = viewX;
		this.view.Y = viewY;
		this.view.width = viewWidth;
		this.view.height = viewHeight;
		this.view.Scale = scale;

		if (this.#gameInstance && typeof this.#gameInstance.onResize === "function")
		{
			this.#gameInstance.onResize(this);
		}
	}

	//==============================================================================
	// 이벤트 설정.
	//==============================================================================
	/**
	 * @private
	 * @method
	 */
	#setupAllEvents() {
		const canvas = this.canvas;

		canvas.addEventListener("mousedown", (touchEvent) => 
			{
				// if (!this.#IsInsideView(touchEvent.clientX, touchEvent.clientY)) {
				// 	return;
				// }

				this.#input.isDown = true;
				this.#input.justPressed = true;
				this.#updatePointer(touchEvent.clientX, touchEvent.clientY);
			});

		window.addEventListener("mousemove", (touchEvent) =>
			{
				this.#updatePointer(touchEvent.clientX, touchEvent.clientY);
			});

		window.addEventListener("mouseup", (touchEvent) =>
			{
				this.#input.isDown = false;
				this.#input.justReleased = true;
				this.#updatePointer(touchEvent.clientX, touchEvent.clientY);
			});

		canvas.addEventListener("touchstart", (touchEvent) =>
			{
				const touch = touchEvent.changedTouches[0];
				if (!touch) return;

				// if (!this.#IsInsideView(touch.clientX, touch.clientY)) {
				// 	return;
				// }

				this.#input.isDown = true;
				this.#input.justPressed = true;
				this.#updatePointer(touch.clientX, touch.clientY);
				touchEvent.preventDefault();
			}, { passive: false });

		window.addEventListener("touchmove", (touchEvent) =>
			{
				const touch = touchEvent.changedTouches[0];
				if (!touch) return;

				this.#updatePointer(touch.clientX, touch.clientY);
				touchEvent.preventDefault();
			}, { passive: false });

		window.addEventListener("touchend", (touchEvent) =>
			{
				const touch = touchEvent.changedTouches[0];
				if (touch) {
					this.#updatePointer(touch.clientX, touch.clientY);
				}

				this.#input.isDown = false;
				this.#input.justReleased = true;
				touchEvent.preventDefault();
			}, { passive: false });

		// 커서 상태 변경 감지.
		document.addEventListener("pointerlockchange", () => {
			if (document.pointerLockElement === canvas) {
				// console.log('커서가 숨겨졌습니다.');
			} else {
				// console.log('커서가 다시 나타났습니다.');
			}
		});
	}

	//==============================================================================
	// 대상 좌표가 클라이언트 영역 안에 존재하는지 여부.
	//==============================================================================
	/**
	 * @private
	 * @method
	 */
	#isInsideView(x, y) {
		return (
			x >= this.view.X &&
			x <= this.view.X + this.view.width &&
			y >= this.view.Y &&
			y <= this.view.Y + this.view.height
		);
	}

	//==============================================================================
	// 입력 좌표 갱신.
	//==============================================================================
	/**
	 * @private
	 * @method
	 */
	#updatePointer(x, y) {
		const localX = x - this.view.X;
		const localY = y - this.view.Y;
		this.#input.position.x = (localX / this.view.width) * this.width;
		this.#input.position.y = (localY / this.view.height) * this.height;
	}

	//==============================================================================
	// 시간 갱신.
	//==============================================================================
	/**
	 * @private
	 * @method
	 * @param { number } timestamp
	 * @returns { number }
	 */
	#updateTime(timestamp) {
		if (this.Time.Last === 0) {
			this.Time.Last = timestamp;
			this.Time.LastFPSTime = timestamp; // FPS 타이머 초기화
		}

		let timeDelta = (timestamp - this.Time.Last) / 1000;
		this.Time.Last = timestamp;

		if (timeDelta > 0.033) {
			timeDelta = 0.033;
		}

		this.Time.TimeDelta = timeDelta;
		this.Time.ElapsedTime += timeDelta;

		// FPS 계산
		if (timestamp > this.Time.LastFPSTime + 1000)
		{
			this.Time.FPS = this.Time.FramesThisSecond;
			this.Time.FramesThisSecond = 0;
			this.Time.LastFPSTime = timestamp;
		}
		this.Time.FramesThisSecond++;


		return timeDelta;
	}
	
	//==============================================================================
	// 개발모드 출력.
	//==============================================================================
	/**
	 * @param { VEngine } engine 
	 * @param { CanvasRenderingContext2D } canvasContext 
	 */
	#drawDevelopment(engine, canvasContext) {
		if (!engine.isDevelopment)
			return;
	
		const SYSTEM_FONT_STRING = '-apple-system, "Segoe UI", Roboto, "Apple SD Gothic Neo", "Malgun Gothic", sans-serif';

		let x = 10;
		let y = 10;

		// 기본 위치인 화면 좌상단으로 이동.
		canvasContext.setTransform(1, 0, 0, 1, 0, 0);
		canvasContext.font = `24px ${SYSTEM_FONT_STRING}`;
		canvasContext.fillStyle = "white";
		canvasContext.textAlign = "left";

		// 초당 프레임 체크.
		y += 24; canvasContext.fillText(`framePerSecond: ${engine.Time.FPS}`, x, y);

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


		// 메모리 사용량 체크.
		// 크로미움 기반 API. (비표준)
		const memory = performance.memory;
		if (memory)
		{
			const usedJSHeapSize = formatSizeString(memory.usedJSHeapSize);
			const totalJSHeapSize = formatSizeString(memory.totalJSHeapSize);
			const jsHeapSizeLimit = formatSizeString(memory.jsHeapSizeLimit);
			y += 26; canvasContext.fillText(`usedJSHeapSize: ${usedJSHeapSize}`, x, y);
			y += 26; canvasContext.fillText(`totalJSHeapSize: ${totalJSHeapSize}`, x, y);
			y += 26; canvasContext.fillText(`jsHeapSizeLimit: ${jsHeapSizeLimit}`, x, y);
		}
		else
		{
			y += 26; canvasContext.fillText(`usedJSHeapSize: Not Supported`, x, y);
			y += 26; canvasContext.fillText(`totalJSHeapSize: Not Supported`, x, y);
			y += 26; canvasContext.fillText(`jsHeapSizeLimit: Not Supported`, x, y);
		}

		this.platform.getPlatformInfo();
		y += 26; canvasContext.fillText(`platformName: ${this.platform.platformName}`, x, y);
		y += 26; canvasContext.fillText(`browserName: ${this.platform.browserName}`, x, y);

		var resourceUsage = this.platform.getResouceUsage();
		const totalTransferSize = formatSizeString(resourceUsage.totalTransferSize);
		const totalDecodedSize = formatSizeString(resourceUsage.totalDecodedSize);
		const loadedFiles = resourceUsage.loadedFiles;

		// // 다운 로드된 리소스 목록.
		// y += 26; canvasContext.fillText(`totalTransferSize: ${totalTransferSize}`, x, y);
		// for (let i = 0; i < loadedFiles.length; ++i)
		// {
		// 	const loadedFile = loadedFiles[i];
		// 	const name = loadedFile.name;
		// 	if (loadedFile.transferSize < 1024)
		// 		continue;

		// 	const transferSizeString = formatSizeString(loadedFile.transferSize);
		// 	y += 26; canvasContext.fillText(` - ${name} (${transferSizeString})`, x, y);
		// }

		// 로드된 리소스 목록.
		y += 26; canvasContext.fillText(`totalDecodedSize: ${totalDecodedSize}`, x, y);
		// for (let i = 0; i < loadedFiles.length; ++i)
		// {
		// 	const loadedFile = loadedFiles[i];
		// 	const name = loadedFile.name;
		// 	if (loadedFile.decodedSize < 1024)
		// 		continue;

		// 	const decodedSizeString = formatSizeString(loadedFile.decodedSize);
		// 	y += 26; canvasContext.fillText(` - ${name} (${decodedSizeString})`, x, y);
		// }
	}

	//==============================================================================
	// 엔진 갱신.
	//==============================================================================
	/**
	 * @private
	 * @method
	 * @param { number } timestamp
	 */
	#updateEngine(timestamp) {
		this.#updateTime(timestamp);

		// // 화면 더 부드럽게.
		// this.CanvasContext.scale(this.view.devicePixelRatio, this.view.devicePixelRatio);
		// this.CanvasContext.imageSmoothingEnabled = true;
    	// this.CanvasContext.imageSmoothingQuality = 'high';
		// this.canvasContext.canvas.style.textRendering = 'optimizeLegibility';

		if (this.#gameInstance) {
			if (typeof this.#gameInstance.onUpdate === "function") {
				this.#gameInstance.onUpdate(this.Time.TimeDelta);
			}
			if (typeof this.#gameInstance.onPreDraw === "function") {
				this.#gameInstance.onPreDraw(this.renderer);
			}
			if (typeof this.#gameInstance.onDraw === "function") {
				this.#gameInstance.onDraw(this.renderer);
			}
			if (typeof this.#gameInstance.onPostDraw === "function") {
				this.#gameInstance.onPostDraw(this.renderer);
			}
		}
		if (this.isDevelopment) {
			this.#drawDevelopment(this, this.canvasContext);
		}
		
		this.#input.justPressed = false;
		this.#input.justReleased = false;

		window.requestAnimationFrame(this.#onEngineUpdateCallback);
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
	// 화면 비우기.
	//==============================================================================
	/**
	 * @public
	 * @method
	 * @param { string } color
	 */
	viewIdentity(color = "#000000") {
		// 좌표계 초기화.
		this.canvasContext.setTransform(1, 0, 0, 1, 0, 0);

		// 영역 전체 칠하기.
		this.canvasContext.fillStyle = color;
		this.canvasContext.fillRect(0, 0, this.canvas.width, this.canvas.height);
	}

	//==============================================================================
	// 게임 영역 좌표계 정리.
	//==============================================================================
	/**
	 * @public
	 * @method
	 * @param { string } color
	 */
	gameViewIdentity(color = "#000000") {
		// 좌표계 초기화.
		const devicePixelRatio = this.view.devicePixelRatio;
		this.canvasContext.setTransform(
			this.view.Scale * devicePixelRatio, 0,
			0, this.view.Scale * devicePixelRatio,
			this.view.X * devicePixelRatio, this.view.Y * devicePixelRatio
		);

		// 영역 전체 칠하기.
		this.canvasContext.fillStyle = color;
		this.canvasContext.fillRect(0, 0, this.width, this.height);
	}

	//==============================================================================
	// 입력 반환.
	//==============================================================================
	/**
	 * @public
	 * @method
	 * @returns { VInput }
	 */
	getInput() {
		return this.#input;
	}
}
