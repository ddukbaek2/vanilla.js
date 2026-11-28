//==============================================================================
// 포함 모듈 목록.
//==============================================================================
const System = globalThis;
import { Object } from "../base/object.js";
import { ModalDialogKind, ModalDialog, ModalDialogHandle, ModalDialogResult } from "./modaldialog.js";
import { Version } from "../base/version.js";
import { Colors } from "../base/colors.js";
import { Vector2 } from "../base/vector2.js";
import { TimeManager } from "./timemanager.js";
import { ViewManager, ViewScaleMode } from "./viewmanager.js";
import { InputManager, InputDevice, MouseButton } from "./inputmanager.js";
import { Platform, PlatformType, BrowserType, SYSTEM_FONT_STRING } from "../base/platform.js";
import { Graphic } from "./graphic.js";
import { ColorSpace, readColorSpace } from "./graphic/colorspace.js";
import { Scene } from "./scene.js";
import { Rect } from "../base/rect.js";
import { SceneManager } from "./scenemanager.js";
import { AudioManager } from "./audiomanager.js";
import { FontAsset } from "../resource/fontasset.js";
import { PointerCursor } from "./pointercursor.js";


// 최대 FPS 제한에서 제 차례보다 일찍 온 프레임도 처리하는 여유. (밀리초) 주사율의 흔들림 때문에 제 차례보다 조금 일찍 온 프레임을 건너뛰지 않게 한다.
const FRAME_LIMIT_TOLERANCE_MILLISECONDS = 4;

// 최대 FPS 제한에서 제 차례보다 이만큼 안쪽으로 일찍 온 프레임을 처리하면 그 시각부터 다시 센다. (밀리초) 주사율이 최대 FPS 와 거의 같은 화면(60.05 Hz 에서 60 FPS 등)에서 조금씩 앞서 간 것이 쌓여 가끔 한 프레임을 건너뛰지 않게 한다.
const FRAME_LIMIT_RESYNC_MILLISECONDS = 1;

// 손가락을 뗀 뒤 이 안에 온 마우스 사건은 마지막 장치를 마우스로 바꾸지 않는다. (밀리초, 브라우저가 흉내 내 보내는 마우스 사건)
const COMPATIBILITY_MOUSE_MILLISECONDS = 800;

// 마우스가 이만큼(CSS 픽셀) 넘게 움직여야 마지막 장치를 마우스로 본다. (창이 흔들릴 때 나는 작은 움직임을 거른다)
const MOUSE_DEVICE_MOVE_THRESHOLD = 6;

// 검증용 화면 저장의 기본 파일 이름. ("{frame}" 은 프레임 번호로 바뀐다)
const DEFAULT_CAPTURE_FILE_NAME = "capture_{frame}.png";

// 찍기 모드(주소 쿼리 capture)의 한 프레임 간격. (밀리초, 1/60 초. 러스트 판 찍기 모드와 같은 셈)
const CAPTURE_FRAME_MILLISECONDS = 1000 / 60;

// GPU 처리량 재기(measureGpuThroughput)의 데움 프레임 수와 한 덩이의 프레임 수. (덩이마다 1 화소 readPixels 로 GPU 를 기다리고 다음 rAF 로 넘겨 한 번에 길게 막지 않는다)
const GPU_THROUGHPUT_WARMUP_FRAME_COUNT = 10;
const GPU_THROUGHPUT_CHUNK_FRAME_COUNT = 30;


//==============================================================================
// 페이지 이벤트. (엔진이 리스너에 넘긴다, addPageEventListener)
//==============================================================================
export const PageEvent = System.Object.freeze({
	hidden: "hidden", // 페이지가 가려짐. (다른 탭, 앱 전환)
	visible: "visible", // 페이지가 다시 보임.
	blurred: "blurred", // 창이 포커스를 잃음. (blur)
	focused: "focused", // 창이 포커스를 얻음. (focus)
	pointerDown: "pointerDown", // 창을 누름. (pointerdown, 포커스를 알리지 않아도 누르면 창은 포커스를 가진 것이다)
});


//==============================================================================
// 그래픽 컨텍스트 이벤트. (엔진이 리스너에 넘긴다, addGraphicContextEventListener)
//==============================================================================
export const GraphicContextEvent = System.Object.freeze({
	lost: "lost", // WebGL 컨텍스트를 잃음. (GPU 메모리 부족, 드라이버 재설정, 백그라운드 회수. 잃은 동안 엔진은 그리지 않고 씬 갱신만 한다)
	restored: "restored", // 컨텍스트가 되살아나 엔진이 기본 자원을 다시 지음. (게임이 지은 GL 객체와 3D 렌더러, 렌더 타겟은 죽었으니 이때 다시 짓는다)
});


//==============================================================================
// 엔진 설정.
//==============================================================================
/**
 * @example <caption>설정을 채워 엔진 만들기</caption>
 * import { Engine, EngineConfiguration, Scene, Vector2, ViewScaleMode, ColorSpace } from "./build/vanilla.js";
 *
 * const engineConfiguration = new EngineConfiguration();
 * engineConfiguration.canvasId = "gameCanvas";
 * engineConfiguration.title = "My Game";
 * engineConfiguration.referenceResolutionSize = Vector2.create(1920, 1080);
 * engineConfiguration.viewScaleMode = ViewScaleMode.stretchShortExpandLong;
 * engineConfiguration.autoResizeOnWindowResize = true;
 * engineConfiguration.maximumFramePerSecond = 60;
 * engineConfiguration.antialias = true;
 * engineConfiguration.useStatistics = true;
 * engineConfiguration.useDevTools = false;
 * engineConfiguration.colorSpace = ColorSpace.gamma;
 * const engine = new Engine(engineConfiguration);
 * engine.run(new Scene());
 */
export class EngineConfiguration extends Object {
	//==============================================================================
	// 멤버 변수 목록.
	//==============================================================================
	/** @type { Vector2 } */ referenceResolutionSize; // 기준 해상도.
	// 뷰 스케일 모드. (기본 ViewScaleMode.stretchShort, 엔진이 만들 때 뷰 매니저에 넣는다. UIScene 과 GameScene 은 initialize 에서 저마다의 모드로 바꾼다)
	/** @type { string } */ viewScaleMode;

	// 캔버스 식별자. 문서에 그 id 의 요소가 없으면 캔버스를 새로 만들어 그 id 를 주고 body 끝에 붙인다.
	/** @type { string } */ canvasId; // 캔버스 식별자.
	/** @type { boolean } */ useStatistics; // 정보창 출력 여부.
	/** @type { boolean } */ autoResizeOnWindowResize; // 윈도우가 리사이즈 될 때 캔버스 사이즈 자동 반영.
	/** @type { string } */ title; // 이름.
	// 프레임이 끝난 뒤에도 그린 것을 캔버스에 남길지. 캔버스 위에 후처리를 얹는 프로젝트가 켠다.
	// (다른 캔버스가 texImage2D 나 drawImage 로 읽으려면 필요하다) 한 번 더 복사하는 만큼 비용이 있다.
	/** @type { boolean } */ preserveDrawingBuffer;
	// 캔버스(기본 프레임 버퍼)의 멀티샘플 안티에일리어싱(MSAA)을 켤지. 생성 때 정한다. 켜면(기본) 지금까지와 같다.
	// 끄면 도형과 3D 의 가장자리가 계단져 보이는 대신 고해상도 모바일에서 프레임마다 드는 리졸브 비용이 빠진다.
	// (웹은 WebGL 컨텍스트 속성 antialias 로 켬과 끔만 고르고 표본 수는 브라우저가 정한다. 데스크탑은 켜면 표본 4)
	// 후처리(ToonPostProcess)가 자기 MSAA 판에 그리므로 그걸 쓰는 게임은 캔버스 antialias 를 false 로 짓는다.
	// true 면 캔버스 자체가 MSAA 라 화면에 옮기는 패스와 UI 가 표본마다 섞여 값이 더 든다.
	// (맥미니 2560x1440 툰 후처리 장면 GPU 처리량 6.89 → 6.49 ms, 끈 판 6.81 → 5.22 ms)
	// 예: engineConfiguration.antialias = false; (ToonPostProcess 를 쓰는 게임)
	/** @type { boolean } */ antialias;
	// 최대 FPS. 0 이면 제한하지 않는다. (화면 주사율을 따른다) 정하면 그보다 빨리 온 프레임은 건너뛰어
	// 주사율이 높거나 프레임이 들쭉날쭉한 기기에서도 고른 간격으로 돈다.
	/** @type { number } */ maximumFramePerSecond;
	// 기본 글꼴 주소. (처음은 빈 글, 러스트 판 default_font_url 과 같다) 주면 run() 이 뒤에서 받아 글꼴 이름 "default" 로 올린다.
	// - 글꼴 이름 "default"(엔진 기본 글꼴 사슬)의 첫 글꼴이 되고, 그 뒤는 시스템 글꼴 사슬 SYSTEM_FONT_STRING 이다. 비우면 받지 않고 시스템 글꼴로 그린다.
	// - 엔진은 글꼴을 따로 받지 않는다. 게임 글꼴은 이 주소나 FontAsset 으로 넣는다.
	/** @type { string } */ defaultFontUrl;
	// 글자 입력칸이 포커스된 동안 가로는 그대로이고 세로만 줄어드는 리사이즈를 무시할지. (모바일의 화면 키보드)
	// 끄면(기본) iOS 사파리에서 키보드가 뜰 때 visualViewport 의 세로가 줄어 캔버스와 화면 전체가 작아진다. 키보드가 내려가면 다시 맞춘다.
	/** @type { boolean } */ ignoreVirtualKeyboardResize;
	// 웹 폰트가 늦게 받아지면 그 폰트로 구운 글자 텍스처 가운데 그 폰트의 글자 범위에 든 것만 버려 다시 굽게 할지.
	// 끄면(기본) 받기 전에 다른 폰트로 구운 글자는 캐시에서 밀려날 때까지 그대로 남는다.
	// (unicode-range 로 나눈 폰트 조각을 그때그때 받는 프로젝트가 켠다. 받은 조각마다 그 글자만 다시 구우므로 프레임이 크게 길어지지 않는다)
	/** @type { boolean } */ rebakeTextOnFontLoad;
	// 개발자 도구(F2 로 여닫는 패널과 기즈모)를 쓸지. 끄면 GameScene 이 만들지 않고 F2 도 받지 않는다.
	// (켜면(기본) 지금까지와 같다. 출시 빌드처럼 사용자에게 보이면 안 되는 곳에서 끈다)
	/** @type { boolean } */ useDevTools;
	// 캔버스의 긴 쪽이 짧은 쪽의 몇 배까지인지. 0 이면 제한하지 않는다. (기본, 지금까지와 같다)
	// 정하면 autoResizeOnWindowResize 로 맞출 때 창이 그보다 길쭉하면 캔버스를 그 비까지 줄여 창의 가운데에 둔다. (남는 곳은 페이지의 바탕)
	// (게임 영역의 가로세로 비를 제한하는 포털처럼, 캔버스가 창을 다 채우면 안 되는 곳에서 정한다)
	/** @type { number } */ maxCanvasAspectRatio;
	// 손을 뗄 때(touchend, pointerup)에도 오디오 컨텍스트를 깨울지. 생성 때 정한다.
	// 끄면(기본) 지금까지처럼 click, touchstart, keydown 에서만 깨운다. touchstart 는 사용자 활성화를 주지 않아,
	// iOS WebKit 에서 앱 전환이나 전면 광고로 멈춘(suspended, interrupted) 컨텍스트를 화면을 끌기만 하는 게임이 다시 깨우지 못했다.
	// (캔버스를 끄는 조작이 기본 동작을 막아 click 이 생기지 않는 게임이 켠다)
	/** @type { boolean } */ resumeAudioOnTouchEnd;
	// 3D 색 공간. (ColorSpace.gamma 가 기본, 지금까지와 같은 화면. ColorSpace.linear 면 sRGB 텍스처와 sRGB 표준 곡선으로 선형 공간에서 빛을 셈한다)
	// 생성 때 정한다. 툰 렌더러, 후처리, 화면 바깥선, GLB 읽기가 따로 받지 않으면 이 값을 따른다. 2D 는 어느 값이든 감마 공간에서 합성한다. (유니티 Player Settings 의 Color Space)
	/** @type { string } */ colorSpace;

	//==============================================================================
	// 생성.
	//==============================================================================
	constructor() {
		super();
		// this.scene = null;
		this.referenceResolutionSize = Vector2.zero();
		this.viewScaleMode = ViewScaleMode.stretchShort;
		this.canvasId = "";
		this.useStatistics = false;
		this.autoResizeOnWindowResize = false;
		this.title = "";
		this.preserveDrawingBuffer = false;
		this.antialias = true;
		this.maximumFramePerSecond = 0;
		this.defaultFontUrl = "";
		this.ignoreVirtualKeyboardResize = false;
		this.rebakeTextOnFontLoad = false;
		this.useDevTools = true;
		this.maxCanvasAspectRatio = 0;
		this.resumeAudioOnTouchEnd = false;
		this.colorSpace = ColorSpace.gamma;
	}
}


//==============================================================================
// 엔진.
//==============================================================================
/**
 * @example <caption>씬 하나로 엔진 돌리기</caption>
 * import { Engine, EngineConfiguration, Scene, Vector2, Rect, Colors } from "./build/vanilla.js";
 *
 * class MainScene extends Scene {
 * 	draw(graphic) {
 * 		super.draw(graphic);
 * 		graphic.setFillColor(Colors.white);
 * 		graphic.drawRect(Rect.create(100, 100, 200, 120));
 * 	}
 * }
 *
 * const engineConfiguration = new EngineConfiguration();
 * engineConfiguration.referenceResolutionSize = Vector2.create(1280, 720);
 * engineConfiguration.autoResizeOnWindowResize = true;
 * const engine = new Engine(engineConfiguration);
 * engine.run(new MainScene());
 */
export class Engine extends Object {
	//==============================================================================
	// 멤버 변수 목록.
	//==============================================================================
	/** @private @type { EngineConfiguration } */ #engineConfiguration;
	/** @private @type { Platform } */ #platform;
	/** @private @type { ModalDialog[] } */ #modalDialogList; // 떠 있는 질문 창. (맨 앞이 보이고, 답하면 다음이 뜬다)
	/** @private @type { Graphic } */ #graphic;
	/** @private @type { SceneManager } */ #sceneManager;
	/** @private @type { TimeManager } */ #timeManager;
	/** @private @type { ViewManager } */ #viewManager;
	/** @private @type { InputManager } */ #inputManager;
	/** @private @type { AudioManager } */ #audioManager;
	/** @private @type { () => void  } */ #resizeCallback;
	/** @private @type { Vector2 | null } */ #appliedClientNativeSize; // 마지막으로 캔버스에 준 CSS 크기.
	/** @private @type { () => void  } */ #resumeCallback;
	/** @private @type { FrameRequestCallback } */ #updateEngineCallback;
	/** @private @type { number } */ #frameNumber;
	/** @private @type { number } */ #frameLimitStartTimestamp; // 최대 FPS 제한에서 프레임 수를 세기 시작한 시각. (밀리초, 아직 없으면 -1)
	/** @private @type { number } */ #frameLimitFrameCount; // 세기 시작한 뒤 처리한 프레임 수.
	/** @private @type { number } */ #frameLimitFramePerSecond; // 세고 있는 최대 FPS. (바뀌면 다시 센다)
	/** @private @type { Rect } */ #statisticsTextRect;
	/** @private @type { Version } */ #version;
	/** @private @type { Map<number, Array<Function>> } */ #frameCaptureRequests; // 프레임 번호 → 화면을 받을 함수 목록. (검증용 화면 저장)
	/** @private @type { boolean } */ #isCaptureTimeStepFixed; // 찍기 모드라 시간을 프레임마다 1/60 초씩 보내는지. (주소 쿼리 capture)
	/** @private @type { Array<() => boolean> } */ #engineFrameCallbacks; // 엔진 프레임마다 시간을 올린 바로 뒤 부를 함수 목록. (참을 돌려주면 뺀다, 찍기 모드의 로딩 기다림)
	/** @private @type { boolean } */ #isExitRequested; // 종료를 요청했는지.
	/** @private @type { boolean } */ #isPageHidden; // 페이지가 가려져 있는지.
	/** @private @type { Array<Function> } */ #graphicContextEventListeners; // 그래픽 컨텍스트 이벤트 리스너. ((graphicContextEvent) => void)
	/** @private @type { Array<Function> } */ #pageEventListeners; // 페이지 이벤트 리스너. ((pageEvent) => void)
	/** @private @type { object | null } */ #gpuThroughputMeasurement; // 재고 있는 GPU 처리량. (없으면 null, measureGpuThroughput)

	//==============================================================================
	// 생성.
	//==============================================================================
	/**
	 * @constructor
	 * @param { EngineConfiguration } engineConfiguration 엔진 설정. (EngineConfiguration 이 아니면 예외를 던진다)
	 */
	constructor(engineConfiguration) {
		super();
		if (engineConfiguration === null || engineConfiguration === undefined || engineConfiguration instanceof EngineConfiguration === false) {
			throw new System.Error(`engineConfiguration is invalid.`);
		}
		this.#engineConfiguration = engineConfiguration;
		this.#platform = new Platform();
		this.#modalDialogList = [];

		// 이름 설정.
		if (engineConfiguration.title !== "") {
			System.document.title = engineConfiguration.title;
		}

		// 캔버스 설정.
		const canvasId = this.#engineConfiguration.canvasId;
		const canvas = this.#platform.getOrAddCanvas(canvasId);
		

		this.#graphic = new Graphic(canvas, engineConfiguration.preserveDrawingBuffer === true, engineConfiguration.antialias !== false, readColorSpace(engineConfiguration.colorSpace));
		this.#sceneManager = new SceneManager(this);
		this.#timeManager = new TimeManager(this);
		this.#viewManager = new ViewManager(this);
		this.#viewManager.setCanvas(canvas);
		this.#viewManager.setViewScaleMode(engineConfiguration.viewScaleMode ?? ViewScaleMode.stretchShort);
		this.#inputManager = new InputManager(this);
		this.#audioManager = new AudioManager(this);

		this.#resizeCallback = this.resize.bind(this);
		this.#appliedClientNativeSize = null;
		// 일반 resume (visibilitychange/focus 등), user gesture 가 아닐 수 있으므로
		// AudioManager 가 hasUserGesture 체크 후 silently skip.
		this.#resumeCallback = this.resume.bind(this);
		this.#updateEngineCallback = this.updateEngine.bind(this);
		this.#frameNumber = 0;
		this.#frameLimitStartTimestamp = -1;
		this.#frameLimitFrameCount = 0;
		this.#frameLimitFramePerSecond = 0;

		this.#statisticsTextRect = Rect.zero();
		this.#version = Version.create(0, 3, 2);
		this.#frameCaptureRequests = new System.Map();
		this.#isCaptureTimeStepFixed = false;
		this.#engineFrameCallbacks = [];
		this.#isExitRequested = false;
		this.#isPageHidden = System.document.visibilityState === "hidden";
		this.#pageEventListeners = [];
		this.#graphicContextEventListeners = [];
		// 컨텍스트를 잃으면 엔진 오류 길(console.error)로 한 번 알리고 리스너에 넘긴다. 되살아나면 리스너에 넘긴다.
		this.#graphic.setContextEventCallback((graphicContextEvent) => {
			if (graphicContextEvent === GraphicContextEvent.lost) {
				console.error("Engine: WebGL2 context lost. Drawing is paused until the context is restored.");
			}
			else {
				console.warn("Engine: WebGL2 context restored. Engine resources were rebuilt, rebuild game-owned GL objects now.");
			}
			this.dispatchGraphicContextEvent(graphicContextEvent);
		});
		this.#gpuThroughputMeasurement = null;

		// 현재 엔진 인스턴스 글로벌 등록. (루트 노드 등 컨텍스트 없는 객체에서 ViewManager 등 접근용)
		System.vanillaEngine = this;

		// 이벤트 설정.
		this.setupAllDocumentEvents();
		this.resize();

		// 주소 쿼리로 건 검증용 화면 저장. (?capture=120,240&captureName=shot_{frame}.png&captureExit=1)
		this.requestFrameCapturesFromUrl();
	}

	//==============================================================================
	// 시작.
	//==============================================================================
	/**
	 * @param { Scene } scene 처음 불러올 씬. (Scene 이 아니면 예외를 던진다)
	 */
	run(scene) {
		if (scene === null || scene === undefined || scene instanceof Scene === false) {
			throw new System.Error(`scene is invalid.`);
		}
		
		// 씬 로드와 렌더 루프 시작. (기본 폰트가 실패하거나 늦어도 여기는 막히지 않는다)
		const startEngine = () => {
			// 씬 로드는 백그라운드로 시작. (렌더 루프가 drawOnLoad로 로딩 화면 출력)
			const sceneManager = this.getSceneManager();
			sceneManager.loadScene(scene).catch((error) => {
				console.error(error);
			});

			// 렌더 루프 즉시 시작.
			System.window.addEventListener("resize", this.#resizeCallback);

			// visualViewport 변경도 리사이즈로 처리. (iOS Safari URL 바 슬라이딩이 일반
			//  resize 이벤트로는 안정적으로 발화하지 않아서 visualViewport 의
			//  resize / scroll 이벤트로 보강.)
			if (System.window.visualViewport) {
				System.window.visualViewport.addEventListener("resize", this.#resizeCallback);
				System.window.visualViewport.addEventListener("scroll", this.#resizeCallback);
			}

			++this.#frameNumber;
			System.window.requestAnimationFrame(this.#updateEngineCallback);
		};
		startEngine();

		// 웹 폰트가 받아질 때마다 그 폰트의 글자로 구운 텍스처만 다시 굽게 한다. (옵션)
		const engineConfiguration = this.getEngineConfiguration();
		if (engineConfiguration.rebakeTextOnFontLoad && System.document.fonts) {
			System.document.fonts.addEventListener("loadingdone", (fontFaceSetLoadEvent) => {
				const graphic = this.getGraphic();
				const textStringTextureCache = graphic.getTextStringTextureCache();
				textStringTextureCache.invalidateFontFaces(fontFaceSetLoadEvent.fontfaces);
			});
		}

		// 기본 글꼴은 뒤에서 불러와 글꼴 이름 "default" 로 올린다. (성공하면 이후 그리는 글자부터 반영, 러스트 판처럼 "default" 사슬의 첫 글꼴) 주소가 비었으면 불러오지 않는다.
		const defaultFontUrl = engineConfiguration.defaultFontUrl;
		if (!defaultFontUrl) {
			return;
		}
		const internalFontFace = new FontFace("default", `url("${defaultFontUrl}")`);
		internalFontFace.load().then((loadedFont) => {
			document.fonts.add(loadedFont);
		}).catch((error) => {
			console.warn(`기본 폰트 로드 실패 — 시스템 폰트로 계속합니다.`, error);
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
	// 첫 user gesture (click/touch/keydown) 핸들러.
	// AudioManager 에 user gesture 발생을 알리고 컨텍스트 재개를 시도한다.
	//==============================================================================
	resumeOnUserGesture() {
		const audioManager = this.getAudioManager();
		if (audioManager) {
			audioManager.markUserGesture();
			audioManager.resumeContext();
		}
	}

	//==============================================================================
	// 해상도 변경됨.
	//==============================================================================
	resize() {
		const engineConfiguration = this.getEngineConfiguration();
		const viewManager = this.getViewManager();

		// 설정: 윈도우가 리사이즈 될 때 캔버스 사이즈 자동 반영.
		if (engineConfiguration.autoResizeOnWindowResize) {
			// visualViewport 가 있으면 그것을 우선 사용. (모바일 URL 바 / 키보드 등으로
			//  layout viewport 와 visual viewport 가 다를 때 후자가 실제 보이는 영역)
			const visualViewport = System.window.visualViewport;
			const clientWidth = visualViewport ? visualViewport.width : System.window.innerWidth;
			let clientHeight = visualViewport ? visualViewport.height : System.window.innerHeight;

			// 화면 키보드: 글자 입력칸이 포커스된 동안 가로가 같고 세로만 줄었으면 크기를 그대로 둔다. (설정으로 켠다)
			const appliedClientNativeSize = this.#appliedClientNativeSize;
			const isTextInputFocused = this.isTextInputFocused();
			if (engineConfiguration.ignoreVirtualKeyboardResize && isTextInputFocused && appliedClientNativeSize !== null) {
				const isSameWidth = System.Math.abs(clientWidth - appliedClientNativeSize.x) < 1;
				if (isSameWidth && clientHeight < appliedClientNativeSize.y) {
					clientHeight = appliedClientNativeSize.y;
				}
			}
			const clientNativeSize = Vector2.create(clientWidth, clientHeight);
			this.#appliedClientNativeSize = clientNativeSize;
			const canvas = viewManager.getCanvas();

			// 설정: 캔버스의 가로세로 비 제한. (창이 그보다 길쭉하면 캔버스를 줄여 창의 가운데에 둔다)
			const maxCanvasAspectRatio = engineConfiguration.maxCanvasAspectRatio;
			if (maxCanvasAspectRatio > 0) {
				const canvasWidth = System.Math.floor(System.Math.min(clientNativeSize.x, clientNativeSize.y * maxCanvasAspectRatio));
				const canvasHeight = System.Math.floor(System.Math.min(clientNativeSize.y, clientNativeSize.x * maxCanvasAspectRatio));
				const canvasLeft = System.Math.floor((clientNativeSize.x - canvasWidth) * 0.5);
				const canvasTop = System.Math.floor((clientNativeSize.y - canvasHeight) * 0.5);
				canvas.style.width = `${canvasWidth}px`;
				canvas.style.height = `${canvasHeight}px`;
				canvas.style.marginLeft = `${canvasLeft}px`;
				canvas.style.marginTop = `${canvasTop}px`;
			}
			else {
				// 캔버스 크기 스타일 조정. (사파리에서 필수)
				canvas.style.width = `${clientNativeSize.x}px`;
				canvas.style.height = `${clientNativeSize.y}px`;
				// 제한을 끄면 가운데에 두던 여백을 지운다. (정한 적이 없으면 아무것도 바뀌지 않는다)
				canvas.style.marginLeft = "";
				canvas.style.marginTop = "";
			}
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
	// 글자 입력칸이 포커스되어 있는지. (input 의 글자 종류, textarea, contenteditable)
	//==============================================================================
	/**
	 * @returns { boolean } 글자 입력칸이 포커스되어 있으면 참.
	 */
	isTextInputFocused() {
		const activeElement = System.document.activeElement;
		if (!activeElement) {
			return false;
		}
		if (activeElement.isContentEditable) {
			return true;
		}
		const tagName = activeElement.tagName;
		if (tagName === "TEXTAREA") {
			return true;
		}
		if (tagName !== "INPUT") {
			return false;
		}
		const inputType = (activeElement.type || "text").toLowerCase();
		const nonTextInputTypes = ["button", "checkbox", "color", "file", "hidden", "image", "radio", "range", "reset", "submit"];
		return !nonTextInputTypes.includes(inputType);
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

				recoverEngineState();
				const sceneManager = this.getSceneManager();
				const loadedScenes = sceneManager.getAllLoadedScenes();
				for (const loadedScene of loadedScenes) {
					loadedScene.onPageProcessRestored();
				}
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

		// 손가락을 마지막으로 댄 때. (흉내 낸 마우스 사건을 거른다)
		let lastTouchTimestamp = -COMPATIBILITY_MOUSE_MILLISECONDS;
		const noteMouseDevice = () => {
			if (System.performance.now() - lastTouchTimestamp < COMPATIBILITY_MOUSE_MILLISECONDS) {
				return;
			}
			inputManager.setLastInputDevice(InputDevice.mouse);
		};

		// 키보드 누름.
		System.document.addEventListener("keydown", (keyboardEvent) => {
			const key = keyboardEvent.code;
			inputManager.pushKey(key);
			inputManager.setLastInputDevice(InputDevice.keyboard);
			// 막을 키의 브라우저 기본 동작. (글자 입력칸에 쓰는 중이면 그대로)
			const isKeyPrevented = inputManager.isKeyPrevented(key);
			if (isKeyPrevented && !inputManager.isTypingInTextField()) {
				keyboardEvent.preventDefault();
			}
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
			const inputManager = this.getInputManager();
			if (inputManager.isContextMenuPrevented()) {
				touchEvent.preventDefault();
			}
		});

		// 마우스 누를 때. (단추 셋을 적고, 왼쪽만 터치로 넘기게 했으면 다른 단추는 터치가 아니다)
		canvas.addEventListener("mousedown", (touchEvent) => {
				const inputManager = this.getInputManager();
				inputManager.setMouseButtonDown(touchEvent.button, true);
				noteMouseDevice();
				const isTouchButton = !inputManager.isTouchFromLeftButtonOnly() || touchEvent.button === MouseButton.left;
				if (isTouchButton) {
					inputManager.setTouchPressed(true);
					inputManager.setTouchMoved(true);
					inputManager.setTouchDown(true);
				}
				this.updateCanvasNativeInputPosition(touchEvent.clientX, touchEvent.clientY);
			});

		// 마우스 움직일 때.
		canvas.addEventListener("mousemove", (touchEvent) => {
				const movement = System.Math.abs(touchEvent.movementX) + System.Math.abs(touchEvent.movementY);
				if (movement >= MOUSE_DEVICE_MOVE_THRESHOLD) {
					noteMouseDevice();
				}
				this.updateCanvasNativeInputPosition(touchEvent.clientX, touchEvent.clientY);
			});

		// 마우스 뗄 때.
		canvas.addEventListener("mouseup", (touchEvent) => {
				const inputManager = this.getInputManager();
				inputManager.setMouseButtonDown(touchEvent.button, false);
				const isTouchButton = !inputManager.isTouchFromLeftButtonOnly() || touchEvent.button === MouseButton.left;
				if (isTouchButton) {
					inputManager.setTouchMoved(false);
					inputManager.setTouchDown(false);
					inputManager.setTouchReleased(true);
				}
				this.updateCanvasNativeInputPosition(touchEvent.clientX, touchEvent.clientY);
			});

		// 마우스 휠. (DOM WheelEvent 의 deltaX/deltaY 를 그대로 누적)
		canvas.addEventListener("wheel", (wheelEvent) => {
				const inputManager = this.getInputManager();
				inputManager.addWheelDelta(wheelEvent.deltaX, wheelEvent.deltaY);
				inputManager.setWheelWithCtrl(wheelEvent.ctrlKey);
				noteMouseDevice();
				this.updateCanvasNativeInputPosition(wheelEvent.clientX, wheelEvent.clientY);
				wheelEvent.preventDefault();
			}, { passive: false });

		// 마우스 뗄 때 (캔버스 밖에서 뗄 때 처리).
		System.window.addEventListener("mouseup", (touchEvent) => {
				const inputManager = this.getInputManager();
				inputManager.setMouseButtonDown(touchEvent.button, false);
				if (!inputManager.isTouchMoved()) {
					return;
				}
				const isTouchButton = !inputManager.isTouchFromLeftButtonOnly() || touchEvent.button === MouseButton.left;
				if (!isTouchButton) {
					return;
				}
				inputManager.setTouchMoved(false);
				inputManager.setTouchDown(false);
				inputManager.setTouchReleased(true);
				this.updateCanvasNativeInputPosition(touchEvent.clientX, touchEvent.clientY);
			});

		// 터치 누를 때.
		canvas.addEventListener("touchstart", (touchEvent) => {
				lastTouchTimestamp = System.performance.now();
				this.updateTouchPoints(touchEvent);
				const touch = touchEvent.changedTouches[0];
				if (!touch) {
					return;
				}

				const inputManager = this.getInputManager();
				inputManager.setTouchMoved(true);
				inputManager.setTouchDown(true);
				inputManager.setTouchPressed(true);
				this.updateCanvasNativeInputPosition(touch.clientX, touch.clientY);
				touchEvent.preventDefault();
			}, { passive: false });

		// 터치 움직일 때.
		canvas.addEventListener("touchmove", (touchEvent) => {
				lastTouchTimestamp = System.performance.now();
				this.updateTouchPoints(touchEvent);
				const touch = touchEvent.changedTouches[0];
				if (!touch) {
					return;
				}

				this.updateCanvasNativeInputPosition(touch.clientX, touch.clientY);
				touchEvent.preventDefault();
			}, { passive: false });

		// 터치 뗄 때.
		canvas.addEventListener("touchend", (touchEvent) => {
				lastTouchTimestamp = System.performance.now();
				this.updateTouchPoints(touchEvent);
				const touch = touchEvent.changedTouches[0];
				if (touch) {
					this.updateCanvasNativeInputPosition(touch.clientX, touch.clientY);
				}

				const inputManager = this.getInputManager();
				inputManager.setTouchMoved(false);
				inputManager.setTouchDown(false);
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
					inputManager.setTouchDown(false);
					inputManager.setTouchReleased(true);				
				}
			});

		// 터치 취소 될 때.
		canvas.addEventListener("touchcancel", (touchEvent) => {
				lastTouchTimestamp = System.performance.now();
				this.updateTouchPoints(touchEvent);
				const touch = touchEvent.changedTouches[0];
				if (touch) {
					this.updateCanvasNativeInputPosition(touch.clientX, touch.clientY);
				}

				const inputManager = this.getInputManager();
				inputManager.setTouchMoved(false);
				inputManager.setTouchDown(false);
				inputManager.setTouchCancelled(true);
			});

		// 앱이나 창이 전환 될 때.
		// - 포커스를 잃으면 keyup, mouseup 이 오지 않으므로 키, 마우스 단추, 손가락 눌림을 모두 놓고 터치는 뗀 것으로 넘긴다.
		System.window.addEventListener("blur", (focusEvent) => {
			const inputManager = this.getInputManager();
			inputManager.clear();
			inputManager.setTouchReleased(true);
			focusEvent.preventDefault();
		}, { passive: false });

		// 오디오 컨텍스트 재개.
		// click/touchstart/keydown 은 진짜 user gesture → markUserGesture + resume.
		// focus 는 user gesture 가 아니므로 일반 resume 만 (gesture 전이면 silently skip).
		const userGestureHandler = this.resumeOnUserGesture.bind(this);
		System.window.addEventListener("click", userGestureHandler);
		System.window.addEventListener("touchstart", userGestureHandler);
		System.window.addEventListener("keydown", userGestureHandler);
		// touchend 와 (마우스가 아닌) pointerup 은 사용자 활성화를 준다. (켠 때만)
		if (this.#engineConfiguration.resumeAudioOnTouchEnd) {
			System.window.addEventListener("touchend", userGestureHandler);
			System.window.addEventListener("pointerup", userGestureHandler);
		}
		System.window.addEventListener("focus", this.#resumeCallback);
		System.document.addEventListener("visibilitychange", () => {
			if (System.document.visibilityState === "visible") {
				this.resume();
			}
		});

		// 커서가 보이거나 감춰질 때.
		System.document.addEventListener("pointerlockchange", () => {
			if (document.pointerLockElement === canvas) {
				// console.log("커서가 숨겨졌습니다.");
			} else {
				// console.log("커서가 다시 나타났습니다.");
			}
		});

		// 페이지 이벤트. (가려짐과 보임, 포커스를 잃고 얻음, 창 누름을 리스너에 넘긴다)
		System.document.addEventListener("visibilitychange", () => {
			const isHidden = System.document.visibilityState === "hidden";
			const pageEvent = isHidden ? PageEvent.hidden : PageEvent.visible;
			this.dispatchPageEvent(pageEvent);
		});
		System.window.addEventListener("blur", () => {
			this.dispatchPageEvent(PageEvent.blurred);
		});
		System.window.addEventListener("focus", () => {
			this.dispatchPageEvent(PageEvent.focused);
		});
		System.window.addEventListener("pointerdown", () => {
			this.dispatchPageEvent(PageEvent.pointerDown);
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
	// 손가락 목록 갱신. (터치 사건의 바뀐 손가락마다 닿음, 움직임, 뗌을 적고, 사건의 touches 에 없는 손가락은 취소로 지운다)
	//==============================================================================
	/**
	 * @param { TouchEvent } touchEvent 브라우저의 터치 사건.
	 */
	updateTouchPoints(touchEvent) {
		const inputManager = this.getInputManager();
		const viewManager = this.getViewManager();
		const canvas = viewManager.getCanvas();
		const canvasRect = canvas.getBoundingClientRect();
		const eventType = touchEvent.type;
		inputManager.setLastInputDevice(InputDevice.touch);
		const changedTouches = touchEvent.changedTouches;
		for (let touchIndex = 0; touchIndex < changedTouches.length; ++touchIndex) {
			const touch = changedTouches[touchIndex];
			const canvasNativePosition = Vector2.create(touch.clientX - canvasRect.left, touch.clientY - canvasRect.top);
			const viewPosition = viewManager.canvasPositionToViewPosition(canvasNativePosition);
			switch (eventType) {
				case "touchstart": {
					inputManager.beginTouchPoint(touch.identifier, canvasNativePosition, viewPosition);
					break;
				}
				case "touchmove": {
					inputManager.moveTouchPoint(touch.identifier, canvasNativePosition, viewPosition);
					break;
				}
				case "touchend": {
					inputManager.endTouchPoint(touch.identifier, canvasNativePosition, viewPosition, false);
					break;
				}
				default: {
					inputManager.endTouchPoint(touch.identifier, canvasNativePosition, viewPosition, true);
					break;
				}
			}
		}

		// 놓친 뗌. (사건의 touches 는 지금 화면에 닿은 손가락 전부다)
		const touchingIdentifiers = new System.Set();
		const touches = touchEvent.touches;
		for (let touchIndex = 0; touchIndex < touches.length; ++touchIndex) {
			touchingIdentifiers.add(touches[touchIndex].identifier);
		}
		const touchPoints = inputManager.getTouchPoints().slice();
		for (const touchPoint of touchPoints) {
			if (!touchingIdentifiers.has(touchPoint.identifier)) {
				inputManager.endTouchPoint(touchPoint.identifier, touchPoint.canvasNativePosition, touchPoint.viewPosition, true);
			}
		}
	}

	//==============================================================================
	// 입력 좌표 갱신.
	//==============================================================================
	/**
	 * @param { number } x 클라이언트 X 좌표. (CSS 픽셀, clientX)
	 * @param { number } y 클라이언트 Y 좌표. (CSS 픽셀, clientY)
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
	 * @param { Graphic } graphic 그릴 그래픽.
	 */
	drawStatistics(graphic) {
		const timeManager = this.getTimeManager();
		const viewManager = this.getViewManager();
		const inputManager = this.getInputManager();

		const textPosition = Vector2.create(16, 16);
		this.#statisticsTextRect.position = textPosition.clone();
		const drawStatisticsText = (text) => {
			if (text) {
				// 출력.
				graphic.drawFillText(text, textPosition.x, textPosition.y);
				
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
			const metrics = graphic.measureText(text);
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
		graphic.setTransform(1, 0, 0, 1, 0, 0);
		graphic.scale(1.4, 1.4);
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
		graphic.setFontString("16px default");
		graphic.setTextAlign("left");
		graphic.setTextBaseline("top");
		graphic.setFillColor(Colors.white);
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
		const drawCallCount = graphic.getLastFrameDrawCallCount();
		const vertexCount = graphic.getLastFrameVertexCount();
		const triangleCount = graphic.getLastFrameTriangleCount();
		drawStatisticsText(`drawCalls: ${drawCallCount}`);
		drawStatisticsText(`vertices: ${vertexCount}`);
		drawStatisticsText(`triangles: ${triangleCount}`);
		const culledNodeCount = graphic.getLastFrameCulledNodeCount();
		drawStatisticsText(`culledNodes: ${culledNodeCount}`);
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
	 * @param { number } timestamp requestAnimationFrame 이 넘긴 시각. (밀리초)
	 */
	updateEngine(timestamp) {

		// GPU 처리량을 재는 중이면 이 rAF 는 씬을 갱신하지 않고 그리기만 한 덩이 잇달아 한다. (시간, 입력, 엔진 프레임 함수, 프레임 번호를 건드리지 않는다)
		if (this.#gpuThroughputMeasurement !== null) {
			this.#runGpuThroughputChunk();
			System.window.requestAnimationFrame(this.#updateEngineCallback);
			return;
		}

		// 최대 FPS 제한. (세기 시작한 때부터 처리한 프레임 수로 다음 프레임의 차례를 정하고, 차례보다 일찍 온 프레임은 건너뛴다.
		//  밀린 것은 다음 프레임에 처리하므로 주사율이 최대 FPS 로 나누어떨어지지 않아도(90 Hz 에서 60 FPS 등) 평균이 최대 FPS 가 된다)
		const engineConfiguration = this.getEngineConfiguration();
		const maximumFramePerSecond = engineConfiguration.maximumFramePerSecond;
		if (maximumFramePerSecond > 0 && !this.#isCaptureTimeStepFixed) {
			const frameInterval = 1000 / maximumFramePerSecond;
			if (this.#frameLimitStartTimestamp < 0 || this.#frameLimitFramePerSecond !== maximumFramePerSecond) {
				this.#frameLimitStartTimestamp = timestamp;
				this.#frameLimitFrameCount = 0;
				this.#frameLimitFramePerSecond = maximumFramePerSecond;
			}
			const dueTimestamp = this.#frameLimitStartTimestamp + this.#frameLimitFrameCount * frameInterval;
			const earlyMilliseconds = dueTimestamp - timestamp;
			if (earlyMilliseconds > FRAME_LIMIT_TOLERANCE_MILLISECONDS) {
				System.window.requestAnimationFrame(this.#updateEngineCallback);
				return;
			}

			// 한 프레임 넘게 밀렸거나(창이 가려졌다 돌아옴 등) 차례와 거의 같게 왔으면 이 시각부터 다시 센다. (밀린 것을 몰아서 처리하지 않고, 조금씩 앞서 간 것이 쌓이지 않게)
			if (earlyMilliseconds < -frameInterval || (earlyMilliseconds > 0 && earlyMilliseconds <= FRAME_LIMIT_RESYNC_MILLISECONDS)) {
				this.#frameLimitStartTimestamp = timestamp;
				this.#frameLimitFrameCount = 0;
			}
			++this.#frameLimitFrameCount;
		}

		// 렌더 배율 상한을 바꿨으면 프레임 머리에서 캔버스 크기를 맞춘다. (그리는 중에 바꾸면 그 프레임이 까맣다)
		if (this.getViewManager().isViewRectPending()) {
			this.resize();
		}

		// 렌더러 처리. (컨텍스트를 잃은 동안은 GL 을 부르지 않는다)
		const graphic = this.getGraphic();
		if (!graphic.isContextLost()) {
			graphic.applySettings(this);
		}

		// 시간 처리.
		// 찍기 모드는 결정적으로 찍게 실제 시각 대신 프레임 번호 x 1/60 초를 쓴다. (기계 빠르기와 상관없이 같은 프레임에 같은 시간, 러스트 판과 같은 셈)
		// 최대 FPS 제한도 건너뛴다. (같은 시각이 되풀이되면 제한이 프레임을 넘기지 못한다)
		if (this.#isCaptureTimeStepFixed) {
			timestamp = this.#frameNumber * CAPTURE_FRAME_MILLISECONDS;
		}
		const timeManager = this.getTimeManager();
		timeManager.update(timestamp);
		const timeDelta = timeManager.getTimeDelta();

		// 엔진 프레임 함수 부르기. (시간을 올린 바로 뒤, 씬 갱신 앞. 찍기 모드의 로딩 기다림이 여기서 엔진 시계를 본다)
		if (this.#engineFrameCallbacks.length > 0) {
			const engineFrameCallbacks = this.#engineFrameCallbacks;
			this.#engineFrameCallbacks = [];
			for (const engineFrameCallback of engineFrameCallbacks) {
				let isFinished = true;
				try {
					isFinished = engineFrameCallback() !== false;
				}
				catch (error) {
					console.error(error);
				}
				if (!isFinished) {
					this.#engineFrameCallbacks.push(engineFrameCallback);
				}
			}
		}

		// 입력 처리.
		const inputManager = this.getInputManager();
		inputManager.tick(timeDelta);

		// 질문 창. (떠 있으면 씬을 갱신하지 않고 창이 입력을 받는다, 러스트 판과 같다)
		const isModalDialogOpen = this.isModalDialogOpen();
		if (isModalDialogOpen) {
			this.#tickModalDialog(graphic, timeDelta);
		}

		// // 화면 더 부드럽게.
		// this.CanvasContext.scale(this.#view.devicePixelRatio, this.#view.devicePixelRatio);
		// this.CanvasContext.imageSmoothingEnabled = true;
    	// this.CanvasContext.imageSmoothingQuality = "high";
		// this.canvasRenderingContext.canvas.style.textRendering = "optimizeLegibility";

		// 씬 갱신과 그리기.
		this.#tickAndDrawScenes(graphic, timeDelta, !isModalDialogOpen);

		// 마우스 커서. (켜져 있을 때만 캔버스의 커서를 정한다)
		const pointerCursor = PointerCursor.getInstance();
		pointerCursor.apply();
		
		// 입력 관련해서 상태 유지가 아닌, 현재 프레임이 끝난 후에는 다음 프레임에서는 상태를 유지하지 않음. (1회성)
		inputManager.setTouchPressed(false);
		inputManager.setTouchReleased(false);
		inputManager.setTouchCancelled(false);
		inputManager.clearWheelDelta();
		inputManager.updateFrameSnapshot();

		// 검증용 화면 저장. (요청한 프레임이면 그린 캔버스를 PNG 로 넘긴다)
		this.captureFrameIfRequested();

		// 다음 프레임 호출 요청.
		// 찍기 모드에서 실제 시간이 드는 불러오기(애셋 받기) 중인 씬이 있으면 프레임 번호를 올리지 않는다. (시계도 서고, 다 받은 뒤부터 센다)
		const sceneManager = this.getSceneManager();
		const isCaptureFrameHeld = this.#isCaptureTimeStepFixed && sceneManager.getAllLoadedScenes().some((loadedScene) => !loadedScene.isLoaded() && loadedScene.isCaptureFrameHeld());
		if (!isCaptureFrameHeld) {
			++this.#frameNumber;
		}
		System.window.requestAnimationFrame(this.#updateEngineCallback);
	}

	//==============================================================================
	// 씬 갱신과 그리기. (엔진 프레임과 GPU 처리량 재기가 같은 길로 그린다)
	//==============================================================================
	/**
	 * @private
	 * @param { Graphic } graphic 엔진 그래픽.
	 * @param { number } timeDelta 이번 프레임 간격. (초)
	 * @param { boolean } isTickEnabled 거짓이면 씬을 갱신하지 않고 그리기만 한다.
	 */
	#tickAndDrawScenes(graphic, timeDelta, isTickEnabled) {
		// 컨텍스트를 잃은 동안은 씬만 갱신하고 그리지 않는다. (GL 이 null 을 주어 그리기 길마다 예외를 프레임마다 던지지 않게, 되살아나면 다음 프레임부터 그린다)
		const isContextLost = graphic.isContextLost();

		// 그리기 통계. (지난 프레임 값을 넘겨 두고 이번 프레임을 새로 센다)
		graphic.beginFrameStatistics();

		// 씬 처리.
		// 씬마다 그리기 앞에 뷰 좌표를 걸어 둔다. (씬이 받는 터치 좌표와 같은 좌표, 기기 픽셀 배율이 1 이 아닌 화면에서도 같은 크기와 자리로 그린다)
		// 캔버스의 실제 픽셀로 그리려면 씬에서 graphic.setTransform(1, 0, 0, 1, 0, 0) 을 부른다.
		const sceneManager = this.getSceneManager();
		const viewManager = this.getViewManager();
		const loadedScenes = sceneManager.getAllLoadedScenes();
		for (const loadedScene of loadedScenes) {
			try {
				if (!loadedScene.isLoaded()) {
					// 로딩 중: 로딩 전용 출력만 호출. 씬의 tick/draw는 호출하지 않음.
					if (!isContextLost) {
						viewManager.applyViewRect(graphic);
						loadedScene.drawOnLoad(graphic);
					}
					continue;
				}

				// 갱신. (질문 창이 떠 있거나 GPU 처리량을 재는 중이면 멈춘 화면 그대로 그리기만 한다)
				if (isTickEnabled) {
					loadedScene.tick(timeDelta);
				}

				if (isContextLost) {
					continue;
				}

				// 출력. (앞 씬의 그리기와 이 씬의 갱신 사이에 바깥 WebGL 이 바꾼 묶음과 상태는 Graphic 이 그리기 앞에 상태 캐시에 견주어 다시 건다)
				viewManager.applyViewRect(graphic);
				loadedScene.preDraw(graphic);
				loadedScene.draw(graphic);
				loadedScene.postDraw(graphic);

				const isGizmoVisible = loadedScene.isGizmoVisible();
				if (isGizmoVisible) {
					loadedScene.drawGizmos(graphic);
				}
			}
			catch (error) {
				// 컨텍스트를 막 잃어 webglcontextlost 가 오기 전의 프레임이면 GL 이 null 을 주어 던진 것이다. (이벤트가 와서 한 번 알리므로 여기서는 알리지 않는다, 오류 길에서만 GL 에 묻는다)
				if (!isContextLost && graphic.getWebGL2RenderingContext().isContextLost()) {
					continue;
				}
				console.error(error);
			}
		}

		if (isContextLost) {
			return;
		}

		// 개발 정보 출력.
		const engineConfiguration = this.getEngineConfiguration();
		if (engineConfiguration.useStatistics) {
			this.drawStatistics(graphic);
		}

		// 질문 창. (모든 것 위에, 캔버스 안쪽 CSS 픽셀 좌표)
		if (this.isModalDialogOpen()) {
			viewManager.applyCanvasNativeRect(graphic);
			this.#modalDialogList[0].draw(graphic, viewManager.getCanvasNativeSize());
		}

		// 묶어 그리기로 쌓여 남은 것을 그린다.
		graphic.flushBatch();
	}

	//==============================================================================
	// GPU 처리량 재기. (지금 장면을 갱신 없이 그리기만 잇달아 하고 GPU 가 다 그리길 기다린 프레임당 시간)
	// - 지금 장면을 씬 갱신(tick) 없이 엔진 프레임과 같은 그리기 길로 frameCount 번 잇달아 그리고, 1 화소 readPixels 로 GPU 가 다 그리길 기다린 벽시계 시간을 프레임 수로 나눈다.
	//   렌더러(스크립트와 GL 명령 쓰기), GPU 프로세스(명령 풀기), GPU 실행 가운데 가장 느린 단의 몫이다. GPU 가 가장 느리면 GPU 가 실제로 한 프레임을 그리는 시간이다.
	//   (크롬 트레이스의 GPU 프로세스 메인 스레드 시간은 명령을 푸는 CPU 시간이라 GPU 가 그리는 양이 바뀌어도 거의 움직이지 않는다)
	// - 다음 rAF 부터 시작한다. 데움 10 프레임 뒤 30 프레임씩 덩이로 나눠 rAF 하나에 한 덩이를 그리고 덩이마다 GPU 를 기다린다. (한 번에 길게 막지 않는다, 덩이 사이는 재지 않는다)
	// - 재는 동안 엔진 시간, 입력, 엔진 프레임 함수, 프레임 번호, 화면 크기 맞추기, 찍기는 서 있고 씬의 tick 을 부르지 않는다. 씬의 draw 가 게임 상태를 바꾸지 않으면 게임 상태는 그대로다.
	//   다 재면 엔진 루프가 그대로 이어 돈다. (이어 도는 첫 프레임 간격은 탭을 숨겼다 돌아올 때처럼 TimeManager 의 간격 상한 안이다, 기본 0.25 초)
	// - 같은 상태를 되풀이해 그리므로 바뀐 것만 다시 그리는 캐시(그림자 onChange 같은)는 다시 굽지 않는다. 움직이는 장면에서 프레임마다 다시 굽는 비용은 들지 않는다.
	// - 캔버스의 기본 프레임 버퍼에 잇달아 그려 화면에 내는 것(합성)은 덩이마다 마지막 프레임만 한다. 합성 비용은 들지 않는다.
	// - 페이지가 가려져 rAF 가 서면 기다린다. 재는 중에 또 부르거나 엔진 루프가 돌기 전이면 거부한다.
	//==============================================================================
	/**
	 * @param { number } [frameCount=120] 잴 프레임 수. (1 이상의 정수, 데움은 빼고 센다)
	 * @returns { Promise<{ frameCount: number, chunkFrameCount: number, millisecondsPerFrame: number, chunkMillisecondsPerFrame: number[] }> } 잰 프레임 수, 덩이 프레임 수, 프레임당 시간(밀리초, 모든 덩이 시간의 합 / 프레임 수), 덩이마다 프레임당 시간(밀리초).
	 * @example <caption>지금 장면의 GPU 처리량 재기</caption>
	 * import { Engine, EngineConfiguration, Scene, Rect, Vector2 } from "./build/vanilla.js";
	 *
	 * class MainScene extends Scene {
	 * 	draw(graphic) {
	 * 		super.draw(graphic);
	 * 		graphic.setFillColor("#203040");
	 * 		graphic.drawRect(Rect.create(0, 0, 640, 360));
	 * 	}
	 * }
	 *
	 * const engineConfiguration = new EngineConfiguration();
	 * engineConfiguration.referenceResolutionSize = Vector2.create(640, 360);
	 * const engine = new Engine(engineConfiguration);
	 * engine.run(new MainScene());
	 * const timeBefore = engine.getTimeManager().getTime();
	 * const result = await Engine.getEngine().measureGpuThroughput(60);
	 * const timeAfter = engine.getTimeManager().getTime();
	 * console.log(result.frameCount, result.chunkMillisecondsPerFrame.length, result.millisecondsPerFrame > 0, timeBefore === timeAfter);
	 */
	measureGpuThroughput(frameCount = 120) {
		if (!System.Number.isInteger(frameCount) || frameCount < 1) {
			return System.Promise.reject(new System.Error(`frameCount is invalid: ${frameCount}`));
		}
		if (this.#gpuThroughputMeasurement !== null) {
			return System.Promise.reject(new System.Error("measureGpuThroughput is already running."));
		}
		if (this.#frameNumber === 0) {
			return System.Promise.reject(new System.Error("measureGpuThroughput needs a running engine loop. (call run first)"));
		}
		const webGL2RenderingContext = this.getGraphic().getWebGL2RenderingContext();
		if (webGL2RenderingContext === null || webGL2RenderingContext === undefined || webGL2RenderingContext.isContextLost()) {
			return System.Promise.reject(new System.Error("measureGpuThroughput needs a WebGL2 context."));
		}
		return new System.Promise((resolve, reject) => {
			this.#gpuThroughputMeasurement = {
				frameCount: frameCount,
				warmupFrameCount: GPU_THROUGHPUT_WARMUP_FRAME_COUNT,
				measuredFrameCount: 0,
				totalMilliseconds: 0,
				chunkMillisecondsPerFrame: [],
				pixel: new System.Uint8Array(4),
				resolve: resolve,
				reject: reject,
			};
		});
	}

	//==============================================================================
	// GPU 처리량 재기의 한 덩이.
	//==============================================================================
	/**
	 * @private
	 * GPU 처리량 재기의 한 덩이. (데움이 남았으면 데움 덩이, 다 재면 Promise 를 풀고 재기를 끝낸다)
	 */
	#runGpuThroughputChunk() {
		const measurement = this.#gpuThroughputMeasurement;
		try {
			const graphic = this.getGraphic();
			const webGL2RenderingContext = graphic.getWebGL2RenderingContext();
			if (webGL2RenderingContext.isContextLost()) {
				throw new System.Error("WebGL2 context lost while measureGpuThroughput.");
			}
			graphic.applySettings(this);
			const timeDelta = this.getTimeManager().getTimeDelta();
			const isWarmup = measurement.warmupFrameCount > 0;
			const chunkFrameCount = isWarmup ? measurement.warmupFrameCount : System.Math.min(GPU_THROUGHPUT_CHUNK_FRAME_COUNT, measurement.frameCount - measurement.measuredFrameCount);
			const startMilliseconds = System.performance.now();
			for (let index = 0; index < chunkFrameCount; ++index) {
				this.#tickAndDrawScenes(graphic, timeDelta, false);
			}
			this.#waitGpuForGpuThroughput(webGL2RenderingContext, measurement.pixel);
			const chunkMilliseconds = System.performance.now() - startMilliseconds;
			if (isWarmup) {
				measurement.warmupFrameCount = 0;
				return;
			}
			measurement.measuredFrameCount += chunkFrameCount;
			measurement.totalMilliseconds += chunkMilliseconds;
			measurement.chunkMillisecondsPerFrame.push(chunkMilliseconds / chunkFrameCount);
			if (measurement.measuredFrameCount >= measurement.frameCount) {
				this.#gpuThroughputMeasurement = null;
				measurement.resolve({
					frameCount: measurement.measuredFrameCount,
					chunkFrameCount: GPU_THROUGHPUT_CHUNK_FRAME_COUNT,
					millisecondsPerFrame: measurement.totalMilliseconds / measurement.measuredFrameCount,
					chunkMillisecondsPerFrame: measurement.chunkMillisecondsPerFrame,
				});
			}
		}
		catch (error) {
			this.#gpuThroughputMeasurement = null;
			measurement.reject(error);
		}
	}

	//==============================================================================
	// GPU 처리량 재기의 GPU 기다리기.
	//==============================================================================
	/**
	 * @private
	 * 캔버스의 1 화소를 읽어 GPU 가 앞의 명령을 다 그리길 기다린다. (읽는 프레임 버퍼와 픽셀 팩 버퍼를 잠깐 바꿨다가 되돌린다)
	 * @param { WebGL2RenderingContext } webGL2RenderingContext 엔진의 GL 컨텍스트.
	 * @param { Uint8Array } pixel 읽을 4 바이트.
	 */
	#waitGpuForGpuThroughput(webGL2RenderingContext, pixel) {
		const previousReadFramebuffer = webGL2RenderingContext.getParameter(webGL2RenderingContext.READ_FRAMEBUFFER_BINDING);
		const previousPixelPackBuffer = webGL2RenderingContext.getParameter(webGL2RenderingContext.PIXEL_PACK_BUFFER_BINDING);
		if (previousReadFramebuffer !== null) {
			webGL2RenderingContext.bindFramebuffer(webGL2RenderingContext.READ_FRAMEBUFFER, null);
		}
		if (previousPixelPackBuffer !== null) {
			webGL2RenderingContext.bindBuffer(webGL2RenderingContext.PIXEL_PACK_BUFFER, null);
		}
		webGL2RenderingContext.readPixels(0, 0, 1, 1, webGL2RenderingContext.RGBA, webGL2RenderingContext.UNSIGNED_BYTE, pixel);
		if (previousPixelPackBuffer !== null) {
			webGL2RenderingContext.bindBuffer(webGL2RenderingContext.PIXEL_PACK_BUFFER, previousPixelPackBuffer);
		}
		if (previousReadFramebuffer !== null) {
			webGL2RenderingContext.bindFramebuffer(webGL2RenderingContext.READ_FRAMEBUFFER, previousReadFramebuffer);
		}
	}

	//==============================================================================
	// 커서 보이기 설정.
	//==============================================================================
	/**
	 * @param { boolean } visibled 참이면 body 의 커서를 기본 커서로, 거짓이면 숨긴다.
	 */
	setVisibleCursor(visibled) {
		if (visibled) {
			document.body.style.cursor = "default";
		}
		else {
			document.body.style.cursor = "none";
		}
	}

	//==============================================================================
	// 캔버스 정보 반환.
	//==============================================================================
	/**
	 * @returns { HTMLCanvasElement } 엔진이 그리는 캔버스.
	 */
	getCanvas() {
		const viewManager = this.getViewManager();
		return viewManager.getCanvas();
	}

	//==============================================================================
	// 플랫폼 정보 반환.
	//==============================================================================
	/**
	 * @returns { Platform } 플랫폼 정보.
	 */
	getPlatform() {
		return this.#platform;
	}

	//==============================================================================
	// 씬 매니저 반환.
	//==============================================================================
	/**
	 * @private
	 * @returns { SceneManager } 씬 매니저.
	 */
	getSceneManager() {
		return this.#sceneManager;
	}
	
	//==============================================================================
	// 시간 매니저 반환.
	//==============================================================================
	/**
	 * @returns { TimeManager } 시간 매니저.
	 */
	getTimeManager() {
		return this.#timeManager;
	}
	
	//==============================================================================
	// 뷰 매니저 반환.
	//==============================================================================
	/**
	 * @returns { ViewManager } 뷰 매니저.
	 */
	getViewManager() {
		return this.#viewManager;
	}

	//==============================================================================
	// 입력 매니저 반환.
	//==============================================================================
	/**
	 * @returns { InputManager } 입력 매니저.
	 */
	getInputManager() {
		return this.#inputManager;
	}

	//==============================================================================
	// 오디오 매니저 반환.
	//==============================================================================
	/**
	 * @returns { AudioManager } 오디오 매니저.
	 */
	getAudioManager() {
		return this.#audioManager;
	}

	//==============================================================================
	// 렌더러 반환.
	//==============================================================================
	/**
	 * @returns { Graphic } 렌더러.
	 */
	getGraphic() {
		return this.#graphic;
	}

	//==============================================================================
	// 3D 색 공간 반환. (생성 때 EngineConfiguration.colorSpace 로 정한 값, 툰 렌더러와 후처리의 기본값)
	//==============================================================================
	/**
	 * @returns { string } ColorSpace.gamma 나 ColorSpace.linear.
	 * @example <caption>엔진의 색 공간을 보고 색 공간마다 다른 값 고르기</caption>
	 * import { Engine, EngineConfiguration, ColorSpace } from "./vanilla.js";
	 * const engine = new Engine(new EngineConfiguration());
	 * const exposure = engine.getColorSpace() === ColorSpace.linear ? 1.2 : 1;
	 * if (engine.getColorSpace() !== ColorSpace.gamma || exposure !== 1) {
	 * 	throw new Error("default color space is not gamma");
	 * }
	 */
	getColorSpace() {
		return this.#graphic.getColorSpace();
	}

	//==============================================================================
	// 버전 반환.
	//==============================================================================
	/**
	 * @returns { string } 엔진 판 글. ("주.부.패치", 갈래가 있으면 "-갈래" 를 붙임)
	 */
	getVersionString() {
		return this.#version.getVersionString();
	}

	//==============================================================================
	// 최대 FPS 설정. (실행 중에 바꿀 수 있다, 0 이면 제한하지 않는다)
	// - EngineConfiguration.maximumFramePerSecond 에 적는다. 엔진은 프레임마다 그 값을 읽어, 바뀌면 그 프레임부터 다시 센다.
	// - 0 보다 작거나 숫자가 아니면 0 으로 둔다.
	//==============================================================================
	/**
	 * @param { number } maximumFramePerSecond 최대 FPS. (0 이면 제한하지 않는다)
	 */
	setMaximumFramePerSecond(maximumFramePerSecond) {
		const engineConfiguration = this.getEngineConfiguration();
		if (typeof maximumFramePerSecond !== "number" || !System.Number.isFinite(maximumFramePerSecond) || maximumFramePerSecond < 0) {
			engineConfiguration.maximumFramePerSecond = 0;
			return;
		}
		engineConfiguration.maximumFramePerSecond = maximumFramePerSecond;
	}

	//==============================================================================
	// 최대 FPS 반환. (0 이면 제한하지 않음)
	//==============================================================================
	/**
	 * @returns { number } 최대 FPS. (0 이면 제한하지 않음)
	 */
	getMaximumFramePerSecond() {
		const engineConfiguration = this.getEngineConfiguration();
		return engineConfiguration.maximumFramePerSecond;
	}

	//==============================================================================
	// 엔진 설정 반환.
	//==============================================================================
	/**
	 * @returns { EngineConfiguration } 생성 때 받은 엔진 설정.
	 */
	getEngineConfiguration() {
		return this.#engineConfiguration;
	}

	//==============================================================================
	// 응용 프로그램 종료.
	// - Capacitor 네이티브면 App 플러그인으로 끝내고, 웹이면 창 닫기를 시도한다.
	//   (둘 다 환경에 따라 거부될 수 있으며 실패해도 예외를 내지 않는다)
	//==============================================================================
	exitApplication() {
		this.#isExitRequested = true;
		try {
			const capacitor = System.Capacitor;
			if (capacitor && capacitor.Plugins && capacitor.Plugins.App && typeof capacitor.Plugins.App.exitApp === "function") {
				capacitor.Plugins.App.exitApp();
				return;
			}
		}
		catch (nativeError) {
			// 네이티브 종료 실패는 무시하고 웹 방식을 시도한다.
		}
		try {
			System.window.close();
		}
		catch (closeError) {
			// 브라우저가 거부하면 할 수 있는 것이 없다.
		}
	}

	//==============================================================================
	// 찍기 모드 여부 반환. (주소 쿼리 capture 로 시간을 프레임마다 1/60 초씩 보내는지)
	//==============================================================================
	/**
	 * @private
	 * @returns { boolean } 찍기 모드면 참. (씬 매니저와 게임 씬이 로딩 기다림을 엔진 시계로 셀 때 읽는다)
	 */
	isCaptureTimeStepFixed() {
		return this.#isCaptureTimeStepFixed;
	}

	//==============================================================================
	// 엔진 프레임 함수 걸기.
	// - 엔진 갱신이 시간을 올린 바로 뒤, 씬 갱신 앞에 프레임마다 부른다. false 를 돌려주면 다음 프레임에 또 부르고, 그 밖의 값이면 뺀다.
	// - 찍기 모드의 로딩 기다림이 실제 시각(setTimeout) 대신 엔진 시계로 세게 해, 같은 예제를 두 번 찍으면 같은 프레임에 같은 그림이 나오게 한다. (러스트 판이 프레임 머리에서 씬을 initialize 하는 자리와 같다)
	//==============================================================================
	/**
	 * @private
	 * @param { () => boolean } engineFrameCallback 프레임마다 부를 함수. (끝났으면 참)
	 */
	addEngineFrameCallback(engineFrameCallback) {
		this.#engineFrameCallbacks.push(engineFrameCallback);
	}

	//==============================================================================
	// 다음 엔진 프레임까지 기다리기.
	// - 엔진 갱신이 시간을 올린 바로 뒤 푼다. 이어지는 일은 그 프레임의 갱신과 그리기가 끝난 뒤 돈다.
	//==============================================================================
	/**
	 * @private
	 * @returns { Promise<void> } 다음 엔진 프레임에 풀리는 약속.
	 */
	waitForNextEngineFrame() {
		return new System.Promise((resolve) => {
			this.addEngineFrameCallback(() => {
				resolve();
				return true;
			});
		});
	}

	//==============================================================================
	// 현재 프레임 번호 반환.
	//==============================================================================
	/**
	 * @returns { number } 지금 프레임 번호. (run 을 부르면 1 이 되고 프레임을 마칠 때마다 1 씩 는다)
	 */
	getFrameNumber() {
		return this.#frameNumber;
	}

	//==============================================================================
	// 종료를 요청했는지. (exitApplication 을 불렀으면 참, 브라우저가 창 닫기를 거부해도 참)
	//==============================================================================
	/**
	 * @returns { boolean } exitApplication 을 불렀으면 참.
	 */
	isExitRequested() {
		return this.#isExitRequested;
	}

	//==============================================================================
	// 창 제목 설정. (탭 제목, document.title)
	//==============================================================================
	/**
	 * @param { string } title 창 제목.
	 */
	setTitle(title) {
		System.document.title = title;
	}

	//==============================================================================
	// 알림 창. (window.alert 자리, 엔진이 그린 창, 러스트 판 Engine::alert 와 같다)
	// - 확인을 누르면 끝나는 손잡이를 돌려준다. (답은 늘 확인)
	//==============================================================================
	/**
	 * @param { string } message 알릴 글.
	 * @returns { ModalDialogHandle } 질문 창 손잡이.
	 */
	alert(message) {
		return this.#showModalDialog(ModalDialogKind.alert, message, "");
	}

	//==============================================================================
	// 확인 창. (window.confirm 자리, 엔진이 그린 창, 러스트 판 Engine::confirm 과 같다)
	//==============================================================================
	/**
	 * @param { string } message 물을 글.
	 * @returns { ModalDialogHandle } 질문 창 손잡이. (확인하면 isConfirmed 가 참)
	 */
	confirm(message) {
		return this.#showModalDialog(ModalDialogKind.confirm, message, "");
	}

	//==============================================================================
	// 입력 창. (window.prompt 자리, 엔진이 그린 창, 러스트 판 Engine::prompt 와 같다)
	//==============================================================================
	/**
	 * @param { string } message 물을 글.
	 * @param { string } defaultValue 입력 칸의 기본값.
	 * @returns { ModalDialogHandle } 질문 창 손잡이. (확인하면 getPromptText 가 입력한 글)
	 */
	prompt(message, defaultValue = "") {
		return this.#showModalDialog(ModalDialogKind.prompt, message, defaultValue);
	}

	//==============================================================================
	// 알림 창을 띄우고 닫히면 풀리는 Promise. (러스트 판 Engine::alert_async)
	//==============================================================================
	/**
	 * @param { string } message 알릴 글.
	 * @returns { Promise<void> } 닫히면 풀린다.
	 */
	alertAsync(message) {
		return new System.Promise((resolve) => {
			this.alert(message).setCallback(() => {
				resolve();
			});
		});
	}

	//==============================================================================
	// 확인 창을 띄우고 답하면 풀리는 Promise. (러스트 판 Engine::confirm_async)
	//==============================================================================
	/**
	 * @param { string } message 물을 글.
	 * @returns { Promise<boolean> } 확인하면 참.
	 */
	confirmAsync(message) {
		return new System.Promise((resolve) => {
			this.confirm(message).setCallback((result) => {
				resolve(result.isConfirmed());
			});
		});
	}

	//==============================================================================
	// 입력 창을 띄우고 답하면 풀리는 Promise. (러스트 판 Engine::prompt_async)
	//==============================================================================
	/**
	 * @param { string } message 물을 글.
	 * @param { string } defaultValue 입력 칸의 기본값.
	 * @returns { Promise<string | null> } 입력한 글. (취소하면 null)
	 */
	promptAsync(message, defaultValue = "") {
		return new System.Promise((resolve) => {
			this.prompt(message, defaultValue).setCallback((result) => {
				resolve(result.isConfirmed() ? result.getText() : null);
			});
		});
	}

	//==============================================================================
	// 질문 창이 떠 있는지. (떠 있는 동안 엔진은 씬을 갱신하지 않는다, 러스트 판 Engine::is_modal_dialog_open 과 같다)
	//==============================================================================
	/**
	 * @returns { boolean } 떠 있으면 참.
	 */
	isModalDialogOpen() {
		return this.#modalDialogList.length > 0;
	}

	//==============================================================================
	// 질문 창 띄우기. (목록 끝에 더한다. 캔버스가 없는 곳(node)에서는 그 자리에서 alert 는 확인, confirm 과 prompt 는 취소로 끝난다)
	//==============================================================================
	/**
	 * @param { string } kind 종류. (ModalDialogKind 의 값)
	 * @param { string } message 묻는 글.
	 * @param { string } defaultValue prompt 입력 칸의 기본값.
	 * @returns { ModalDialogHandle } 질문 창 손잡이.
	 */
	#showModalDialog(kind, message, defaultValue) {
		const handle = new ModalDialogHandle();
		const viewManager = this.getViewManager();
		if (!System.document || !viewManager || !viewManager.getCanvas()) {
			handle.finish(kind === ModalDialogKind.alert ? ModalDialogResult.confirmed("") : ModalDialogResult.cancelled());
			return handle;
		}
		this.#modalDialogList.push(new ModalDialog(kind, System.String(message), System.String(defaultValue), handle, this.getPlatform().platformName));
		return handle;
	}

	//==============================================================================
	// 맨 앞 질문 창 갱신. (프레임마다 씬 대신 부른다. 답이 정해지면 창을 내리고 눌린 키와 단추를 비운 뒤 손잡이를 끝낸다)
	//==============================================================================
	/**
	 * @param { Graphic } graphic 글 폭을 잴 그래픽.
	 * @param { number } timeDelta 지난 프레임부터의 시간. (초)
	 */
	#tickModalDialog(graphic, timeDelta) {
		const dialog = this.#modalDialogList[0];
		if (!dialog) {
			return;
		}
		const inputManager = this.getInputManager();
		const canvas = this.getViewManager().getCanvas();
		const canvasRect = canvas ? canvas.getBoundingClientRect() : null;
		const answer = dialog.tick(inputManager, graphic, timeDelta, canvasRect ? Vector2.create(canvasRect.left, canvasRect.top) : Vector2.create(0, 0));
		if (dialog.isPointerOverButton()) {
			PointerCursor.getInstance().markOverButton();
		}
		if (answer !== null) {
			this.#modalDialogList.shift();
			inputManager.clear();
			dialog.finish(answer);
		}
	}

	//==============================================================================
	// 시스템 클립보드에 글 쓰기. (navigator.clipboard.writeText, 기다리지 않는다. 막히거나 없으면 아무것도 하지 않는다)
	//==============================================================================
	/**
	 * @param { string } text 클립보드에 쓸 글.
	 */
	writeClipboardText(text) {
		const clipboard = System.navigator ? System.navigator.clipboard : undefined;
		if (!clipboard || typeof clipboard.writeText !== "function") {
			return;
		}
		clipboard.writeText(text).catch((error) => {
			console.warn(`[Engine] 클립보드 쓰기 실패`, error);
		});
	}

	//==============================================================================
	// 시스템 클립보드 글 읽기. (navigator.clipboard.readText, 브라우저는 비동기라 Promise. 글이 없거나 막히면 null)
	// - 브라우저가 권한을 묻거나 사용자 입력 안에서만 허락할 수 있다.
	//==============================================================================
	/**
	 * @returns { Promise<string | null> } 클립보드의 글. (없거나 막히면 null)
	 * @example <caption>클립보드에 쓰고 읽기</caption>
	 * import { Engine, EngineConfiguration } from "./build/vanilla.js";
	 *
	 * const engineConfiguration = new EngineConfiguration();
	 * const engine = new Engine(engineConfiguration);
	 * engine.writeClipboardText("score: 100");
	 * const readPromise = engine.readClipboardText();
	 * readPromise.then((text) => {
	 * 	if (text === null) {
	 * 		console.log("clipboard blocked");
	 * 	}
	 * 	else {
	 * 		console.log(text);
	 * 	}
	 * });
	 */
	async readClipboardText() {
		const clipboard = System.navigator ? System.navigator.clipboard : undefined;
		if (!clipboard || typeof clipboard.readText !== "function") {
			return null;
		}
		try {
			const text = await clipboard.readText();
			return text;
		}
		catch (error) {
			console.warn(`[Engine] 클립보드 읽기 실패`, error);
			return null;
		}
	}

	//==============================================================================
	// 주된 손이 손가락인지. (CSS 의 pointer: coarse)
	//==============================================================================
	/**
	 * @returns { boolean } 주된 손이 손가락이면 참.
	 */
	isCoarsePointer() {
		const platform = this.getPlatform();
		return platform.isCoarsePointer();
	}

	//==============================================================================
	// 씬 불러오기. (SceneManager.loadScene 과 같다)
	//==============================================================================
	/**
	 * @param { Scene } scene 불러올 씬.
	 * @returns { Promise<void> } load, initialize 까지 마치면 끝나는 Promise. (이미 불러온 씬이면 바로 끝난다)
	 * @example <caption>씬 하나 더 불러오고 내리기</caption>
	 * import { Engine, EngineConfiguration, Scene } from "./build/vanilla.js";
	 *
	 * class GameScene extends Scene {
	 * }
	 *
	 * class PauseScene extends Scene {
	 * 	initialize(engine) {
	 * 		console.log("pause scene ready");
	 * 	}
	 * }
	 *
	 * const engineConfiguration = new EngineConfiguration();
	 * const engine = new Engine(engineConfiguration);
	 * engine.run(new GameScene());
	 * const pauseScene = new PauseScene();
	 * await engine.loadScene(pauseScene);
	 * const isPauseSceneLoaded = pauseScene.isLoaded();
	 * console.log(isPauseSceneLoaded);
	 * await engine.unloadScene(pauseScene);
	 * const loadedScenes = engine.getAllLoadedScenes();
	 * console.log(loadedScenes.length);
	 */
	loadScene(scene) {
		const sceneManager = this.getSceneManager();
		return sceneManager.loadScene(scene);
	}

	//==============================================================================
	// 씬 하나 내리기. (SceneManager.unloadScene 과 같다)
	//==============================================================================
	/**
	 * @param { Scene } scene 내릴 씬.
	 * @returns { Promise<void> } finalize, unload 를 마치고 목록에서 빼면 끝나는 Promise. (불러오지 않은 씬이면 바로 끝난다)
	 */
	unloadScene(scene) {
		const sceneManager = this.getSceneManager();
		return sceneManager.unloadScene(scene);
	}

	//==============================================================================
	// 모든 씬 내리기. (SceneManager.unloadAllScenes 와 같다)
	//==============================================================================
	/**
	 * @returns { Promise<void> } 불러온 씬을 차례로 모두 내리면 끝나는 Promise.
	 */
	unloadAllScenes() {
		const sceneManager = this.getSceneManager();
		return sceneManager.unloadAllScenes();
	}

	//==============================================================================
	// 불러온 씬 목록 반환. (불러온 차례, 러스트 판 get_all_loaded_scenes 와 같다)
	//==============================================================================
	/**
	 * @returns { Scene[] } 불러온 씬 목록. (엔진이 들고 있는 배열이라 고치지 않는다)
	 * @example <caption>run 한 씬이 목록에 든다</caption>
	 * import { Engine, EngineConfiguration, Scene } from "./build/vanilla.js";
	 *
	 * const engine = new Engine(new EngineConfiguration());
	 * engine.run(new Scene());
	 * console.log(engine.getAllLoadedScenes().length);
	 */
	getAllLoadedScenes() {
		const sceneManager = this.getSceneManager();
		return sceneManager.getAllLoadedScenes();
	}

	//==============================================================================
	// 페이지가 가려져 있는지. (다른 탭, 앱 전환)
	//==============================================================================
	/**
	 * @returns { boolean } 페이지가 가려져 있으면 참.
	 */
	isPageHidden() {
		return this.#isPageHidden;
	}

	//==============================================================================
	// 페이지 이벤트 리스너 더하기. ((pageEvent) => void, PageEvent 의 값을 받는다)
	//==============================================================================
	/**
	 * @param { Function } pageEventListener (pageEvent) => void. 같은 함수는 한 번만 더한다.
	 * @example <caption>페이지가 가려지면 멈추기</caption>
	 * import { Engine, EngineConfiguration, Scene, PageEvent } from "./build/vanilla.js";
	 *
	 * const engineConfiguration = new EngineConfiguration();
	 * const engine = new Engine(engineConfiguration);
	 * engine.run(new Scene());
	 * const timeManager = engine.getTimeManager();
	 * const pageEventListener = (pageEvent) => {
	 * 	if (pageEvent === PageEvent.hidden) {
	 * 		timeManager.setTimeScale(0);
	 * 	}
	 * 	else if (pageEvent === PageEvent.visible) {
	 * 		timeManager.setTimeScale(1);
	 * 	}
	 * };
	 * engine.addPageEventListener(pageEventListener);
	 * const isPageHidden = engine.isPageHidden();
	 * console.log(isPageHidden);
	 */
	addPageEventListener(pageEventListener) {
		if (this.#pageEventListeners.includes(pageEventListener)) {
			return;
		}
		this.#pageEventListeners.push(pageEventListener);
	}

	//==============================================================================
	// 페이지 이벤트 리스너 빼기.
	//==============================================================================
	/**
	 * @param { Function } pageEventListener 더했던 리스너. (없으면 아무것도 하지 않는다)
	 */
	removePageEventListener(pageEventListener) {
		const listenerIndex = this.#pageEventListeners.indexOf(pageEventListener);
		if (listenerIndex < 0) {
			return;
		}
		this.#pageEventListeners.splice(listenerIndex, 1);
	}

	//==============================================================================
	// 그래픽 컨텍스트 이벤트 리스너 더하기. ((graphicContextEvent) => void, GraphicContextEvent 의 값을 받는다)
	//==============================================================================
	/**
	 * WebGL 컨텍스트를 잃으면 lost, 되살아나 엔진이 기본 자원을 다시 지으면 restored 를 넘긴다. 잃은 동안 엔진은 그리지 않고 씬 갱신만 한다.
	 * @param { Function } graphicContextEventListener (graphicContextEvent) => void. 같은 함수는 한 번만 더한다.
	 * @example <caption>컨텍스트를 되살리면 게임의 GL 객체 다시 짓기</caption>
	 * import { Engine, EngineConfiguration, Scene, GraphicContextEvent } from "./build/vanilla.js";
	 *
	 * const engine = new Engine(new EngineConfiguration());
	 * engine.run(new Scene());
	 * let isRebuildNeeded = false;
	 * engine.addGraphicContextEventListener((graphicContextEvent) => {
	 * 	if (graphicContextEvent === GraphicContextEvent.restored) {
	 * 		isRebuildNeeded = true;
	 * 	}
	 * });
	 * console.log(isRebuildNeeded);
	 */
	addGraphicContextEventListener(graphicContextEventListener) {
		if (this.#graphicContextEventListeners.includes(graphicContextEventListener)) {
			return;
		}
		this.#graphicContextEventListeners.push(graphicContextEventListener);
	}

	//==============================================================================
	// 그래픽 컨텍스트 이벤트 리스너 빼기.
	//==============================================================================
	/**
	 * @param { Function } graphicContextEventListener 더했던 리스너. (없으면 아무것도 하지 않는다)
	 * @example <caption>더한 리스너 빼기</caption>
	 * import { Engine, EngineConfiguration, Scene } from "./build/vanilla.js";
	 *
	 * const engine = new Engine(new EngineConfiguration());
	 * engine.run(new Scene());
	 * const graphicContextEventListener = (graphicContextEvent) => {
	 * 	console.log(graphicContextEvent);
	 * };
	 * engine.addGraphicContextEventListener(graphicContextEventListener);
	 * engine.removeGraphicContextEventListener(graphicContextEventListener);
	 */
	removeGraphicContextEventListener(graphicContextEventListener) {
		const listenerIndex = this.#graphicContextEventListeners.indexOf(graphicContextEventListener);
		if (listenerIndex < 0) {
			return;
		}
		this.#graphicContextEventListeners.splice(listenerIndex, 1);
	}

	//==============================================================================
	// 그래픽 컨텍스트 이벤트 알리기. (리스너에 그 자리에서 넘긴다, 리스너의 예외는 알리고 다음으로 간다)
	//==============================================================================
	/**
	 * @param { string } graphicContextEvent GraphicContextEvent 의 값.
	 */
	dispatchGraphicContextEvent(graphicContextEvent) {
		const graphicContextEventListeners = this.#graphicContextEventListeners.slice();
		for (const graphicContextEventListener of graphicContextEventListeners) {
			try {
				graphicContextEventListener(graphicContextEvent);
			}
			catch (error) {
				console.error(error);
			}
		}
	}

	//==============================================================================
	// GPU 메모리 읽기. (개발용, Graphic.readGpuMemoryUsage 와 같다)
	//==============================================================================
	/**
	 * @returns { { totalBytes: number, canvasBytes: number, kindTable: object, ownerList: Array<{ owner: string, kind: string, count: number, bytes: number }> } }
	 * 합(캔버스 몫 포함), 캔버스 몫, 종류별 { count, bytes }, 주인별 몫(큰 것부터).
	 * @example <caption>종류별 GPU 메모리 읽기</caption>
	 * import { Engine, EngineConfiguration, Scene } from "./build/vanilla.js";
	 *
	 * const engine = new Engine(new EngineConfiguration());
	 * engine.run(new Scene());
	 * const usage = engine.readGpuMemoryUsage();
	 * console.log(usage.kindTable.texture.bytes, usage.kindTable.renderbuffer.bytes, usage.kindTable.buffer.bytes);
	 */
	readGpuMemoryUsage() {
		return this.getGraphic().readGpuMemoryUsage();
	}

	//==============================================================================
	// 페이지 이벤트 알리기. (가려짐을 적고 리스너에 그 자리에서 넘긴다, 리스너의 예외는 알리고 다음으로 간다)
	//==============================================================================
	/**
	 * @param { string } pageEvent PageEvent 의 값.
	 */
	dispatchPageEvent(pageEvent) {
		if (pageEvent === PageEvent.hidden) {
			this.#isPageHidden = true;
		}
		else if (pageEvent === PageEvent.visible) {
			this.#isPageHidden = false;
		}
		const pageEventListeners = this.#pageEventListeners.slice();
		for (const pageEventListener of pageEventListeners) {
			try {
				pageEventListener(pageEvent);
			}
			catch (error) {
				console.error(error);
			}
		}
	}

	//==============================================================================
	// 검증용 화면 저장 요청. (그 프레임을 다 그린 뒤 캔버스를 PNG data URL 로 넘긴다)
	// - 이미 지난 번호면 이번(프레임 사이에 부르면 다음) 프레임을 저장한다.
	// - 주소 쿼리로도 건다. (?capture=120,240 은 그 프레임들을 내려받기로 저장, captureName 은 파일 이름("{frame}" 은 번호), captureExit=1 은 마지막 저장 뒤 exitApplication)
	//   주소 쿼리로 건 찍기 모드는 결정적으로 찍게 시간이 프레임마다 1/60 초씩 간다. (실제 시각과 최대 FPS 제한을 쓰지 않는다, 러스트 판 VANILLA_CAPTURE_* 와 같다)
	//==============================================================================
	/**
	 * @param { number } frameNumber 저장할 프레임 번호. (소수는 버리고, 이미 지났으면 지금 프레임)
	 * @returns { Promise<string> } PNG data URL.
	 * @example <caption>30 번째 프레임을 PNG 로 받기</caption>
	 * import { Engine, EngineConfiguration, Scene } from "./build/vanilla.js";
	 *
	 * const engineConfiguration = new EngineConfiguration();
	 * const engine = new Engine(engineConfiguration);
	 * engine.run(new Scene());
	 * const capturePromise = engine.requestFrameCapture(30);
	 * capturePromise.then((dataUrl) => {
	 * 	console.log(dataUrl.length);
	 * });
	 */
	requestFrameCapture(frameNumber) {
		const currentFrameNumber = this.getFrameNumber();
		const targetFrameNumber = System.Math.max(System.Math.floor(frameNumber), currentFrameNumber);
		const promise = new System.Promise((resolve) => {
			let captureHandlers = this.#frameCaptureRequests.get(targetFrameNumber);
			if (captureHandlers === undefined) {
				captureHandlers = [];
				this.#frameCaptureRequests.set(targetFrameNumber, captureHandlers);
			}
			captureHandlers.push(resolve);
		});
		return promise;
	}

	//==============================================================================
	// 요청된 프레임이면 캔버스를 PNG 로 넘기기. (프레임 끝, 그린 것이 캔버스에 남아 있을 때 부른다)
	//==============================================================================
	captureFrameIfRequested() {
		const frameNumber = this.getFrameNumber();
		const captureHandlers = this.#frameCaptureRequests.get(frameNumber);
		if (captureHandlers === undefined) {
			return;
		}
		this.#frameCaptureRequests.delete(frameNumber);
		const canvas = this.getCanvas();
		const dataUrl = canvas.toDataURL("image/png");
		for (const captureHandler of captureHandlers) {
			try {
				captureHandler(dataUrl);
			}
			catch (error) {
				console.error(error);
			}
		}
	}

	//==============================================================================
	// 주소 쿼리의 화면 저장 요청 걸기. (capture, captureName, captureExit)
	//==============================================================================
	requestFrameCapturesFromUrl() {
		if (!System.location || typeof System.URLSearchParams !== "function") {
			return;
		}
		const searchParameters = new System.URLSearchParams(System.location.search);
		const captureText = searchParameters.get("capture");
		if (captureText === null) {
			return;
		}
		const frameNumbers = [];
		for (const frameText of captureText.split(",")) {
			const frameNumber = System.Number.parseInt(frameText.trim(), 10);
			if (System.Number.isFinite(frameNumber) && !frameNumbers.includes(frameNumber)) {
				frameNumbers.push(frameNumber);
			}
		}
		if (frameNumbers.length === 0) {
			frameNumbers.push(120);
		}
		this.#isCaptureTimeStepFixed = true;
		const captureNameText = searchParameters.get("captureName");
		const captureFileName = captureNameText !== null && captureNameText !== "" ? captureNameText : DEFAULT_CAPTURE_FILE_NAME;
		const isExitAfterLastCapture = searchParameters.get("captureExit") === "1";
		let remainingCount = frameNumbers.length;
		for (const frameNumber of frameNumbers) {
			const capturePromise = this.requestFrameCapture(frameNumber);
			capturePromise.then((dataUrl) => {
				const fileName = captureFileName.split("{frame}").join(System.String(frameNumber));
				const anchorElement = System.document.createElement("a");
				anchorElement.href = dataUrl;
				anchorElement.download = fileName;
				System.document.body.appendChild(anchorElement);
				anchorElement.click();
				anchorElement.remove();
				const canvas = this.getCanvas();
				console.log(`[Engine] 화면 저장 ${fileName} (${canvas.width}x${canvas.height})`);
				remainingCount -= 1;
				if (remainingCount === 0 && isExitAfterLastCapture) {
					this.exitApplication();
				}
			});
		}
	}

	//==============================================================================
	// 전역 인스턴스 반환.
	//==============================================================================
	/**
	 * @returns { Engine } 마지막으로 만든 엔진. (만든 적이 없으면 undefined)
	 */
	static getEngine() {
		return System.vanillaEngine;
	}
}
