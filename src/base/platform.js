//==============================================================================
// 포함 모듈 목록.
//==============================================================================
const System = globalThis;
import { Object } from "./object.js";
import { Rect } from "./rect.js";


//==============================================================================
// 공통 시스템 폰트 목록.
//==============================================================================
export const SYSTEM_FONT_STRING = "-apple-system, \"Segoe UI\", Roboto, \"Apple SD Gothic Neo\", \"Malgun Gothic\", sans-serif";


//==============================================================================
// 플랫폼 타입.
//==============================================================================
export const PlatformType = { //System.Object.freeze({
	windows: "Windows", // 윈도우.
	macOS: "macOS", // 맥.
	android: "Android", // 안드로이드.
	steamDeck: "SteamDeck", // 스팀덱 추가
	iPadOS: "iPadOS",       // iPadOS 추가
	iOS: "iOS", // 아이폰, 아이팟.
	linux: "Linux", // 리눅스.
	unknown: "Unknown" // 알 수 없음.
};
// });


//==============================================================================
// 브라우저 타입.
//==============================================================================
export const BrowserType = { //System.freeze({
	chrome: "Chrome", // 크롬.
	edge: "Edge", // 엣지.
	firefox: "Firefox", // 파이어폭스.
	internetExplorer: "Internet Explorer", // 인터넷 익스플로러.
	safari: "Safari", // 사파리.
	unknown: "Unknown" // 알 수 없음.
};
// });


//==============================================================================
// 플랫폼 정보.
//==============================================================================
/**
 * @example <caption>user agent 글로 플랫폼 가리기</caption>
 * import { Platform, PlatformType, BrowserType } from "./build/vanilla.js";
 *
 * const platform = new Platform();
 * platform.applyUserAgent("Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Mobile Safari/537.36");
 * console.log(platform.platformName === PlatformType.android, platform.browserName === BrowserType.chrome, platform.isMobile);
 * @example <caption>지금 기기 알아보기</caption>
 * import { Platform } from "./build/vanilla.js";
 *
 * const platform = new Platform();
 * const platformInfo = platform.getPlatformInfo();
 * console.log(platformInfo.platformName, platformInfo.browserName, platform.isMobile, platform.isDesktopWeb());
 */
export class Platform extends Object {
	//==============================================================================
	// 멤버 변수 목록.
	//==============================================================================
	/** @type { string } */ platformName = PlatformType.unknown; // 플랫폼 이름. (PlatformType 값, getPlatformInfo 나 applyUserAgent 가 채운다)
	/** @type { string } */ browserName = BrowserType.unknown; // 브라우저 이름. (BrowserType 값, getPlatformInfo 나 applyUserAgent 가 채운다)
	/** @type { boolean } */ isMobile = false; // 모바일 기기인지. (user agent 에 Mobi, Android, iPhone, iPad 가 있으면 참)


	//==============================================================================
	// 생성.
	//==============================================================================
	constructor() {
		super();
		this.platformName = PlatformType.unknown;
		this.browserName = BrowserType.unknown;
		this.isMobile = false;
	}

	//==============================================================================
	// 캔버스 생성 or 반환.
	//==============================================================================
	/**
	 * @param { string } canvasId 찾을 요소의 id.
	 * @returns { HTMLCanvasElement } 그 id 의 요소. (없으면 캔버스를 만들어 id 를 주고 body 끝에 붙인다)
	 */
	getOrAddCanvas(canvasId) {
		let canvas = document.getElementById(canvasId);
		if (canvas === null || canvas === undefined) {
			canvas = document.createElement("canvas");
			canvas.id = canvasId;
			System.document.body.appendChild(canvas);
		}

		return canvas;
	}

	//==============================================================================
	// 플랫폼 정보 탐지 및 적용.
	//==============================================================================
	/**
	 * @returns { { platformName: string, browserName: string } } navigator.userAgent 로 고른 플랫폼 이름과 브라우저 이름. (platformName, browserName, isMobile 필드도 채운다)
	*/
	getPlatformInfo() {
		// if (System.navigator.userAgentData && !/Valve Steam GameOverlay|iPad/i.test(System.navigator.userAgent))
		// {
		// 	try
		// 	{
		// 		const userAgentData = System.navigator.userAgentData;
		// 		const mainBrand = userAgentData.brands.find(b => b.brand !== "Chromium") || userAgentData.brands[0];
				
		// 		const platform = userAgentData.platform;
		// 		if (platform.toLowerCase() === "windows") this.platformName = PlatformType.Windows;
		// 		else if (platform.toLowerCase() === "macos") this.platformName = PlatformType.macOS;
		// 		else if (platform.toLowerCase() === "android") this.platformName = PlatformType.Android;
		// 		else if (platform.toLowerCase() === "linux") this.platformName = PlatformType.Linux;
		// 		else if (platform.toLowerCase() === "ios") this.platformName = PlatformType.iOS;
		// 		else this.platformName = PlatformType.Unknown;

		// 		this.browserName = System.Object.keys(BrowserType).map(b => b.toLowerCase() === mainBrand.brand.toLowerCase()) || BrowserType.Unknown;
		// 		//this.browserName = System.Object.entries(BrowserType).map(key => BrowserType[key]).find(browserType => browserType.toLowerCase() === mainBrand.brand.toLowerCase()) || BrowserType.Unknown;
		// 		this.IsMobile = userAgentData.mobile;
		// 		return Promise.resolve();
		// 	}
		// 	catch (exception)
		// 	{
		// 		console.error(exception);
		// 	}
		// }

		const userAgent = System.navigator.userAgent;
		this.applyUserAgent(userAgent);

		return {
			platformName: this.platformName,
			browserName: this.browserName,
		};
	}

	//==============================================================================
	// user agent 글로 플랫폼, 브라우저, 모바일 여부 고르기. (getPlatformInfo 가 브라우저의 글로 부른다)
	//==============================================================================
	/**
	 * @param { string } userAgent 브라우저의 user agent 글. (navigator.userAgent 꼴)
	 */
	applyUserAgent(userAgent) {
		this.isMobile = /Mobi|Android|iPhone|iPad/i.test(userAgent);

		// 플랫폼 감지.
		if (/Windows/i.test(userAgent)) this.platformName = PlatformType.windows;
		else if (/Valve Steam GameOverlay/i.test(userAgent)) this.platformName = PlatformType.steamDeck;
		else if (/iPad/i.test(userAgent)) this.platformName = PlatformType.iPadOS;
		else if (/iPhone|iPod/i.test(userAgent)) this.platformName = PlatformType.iOS;
		else if (/Macintosh|Mac OS X/i.test(userAgent)) this.platformName = PlatformType.macOS;
		else if (/Android/i.test(userAgent)) this.platformName = PlatformType.android;
		else if (/Linux/i.test(userAgent)) this.platformName = PlatformType.linux;
		else this.platformName = PlatformType.unknown;

		// 브라우저 감지.
		if (/Edg/i.test(userAgent)) this.browserName = BrowserType.edge;
		else if (/Chrome/i.test(userAgent) && !/Edg/i.test(userAgent)) this.browserName = BrowserType.chrome;
		else if (/Safari/i.test(userAgent) && !/Chrome/i.test(userAgent) && !/Edg/i.test(userAgent)) this.browserName = BrowserType.safari;
		else if (/Firefox/i.test(userAgent)) this.browserName = BrowserType.firefox;
		else if (/MSIE|Trident/i.test(userAgent)) this.browserName = BrowserType.internetExplorer;
		else this.browserName = BrowserType.unknown;
	}

	//==============================================================================
	// 데스크탑 웹인지 반환. (마우스 휠, 키보드 안내처럼 데스크탑에서만 보일 것을 가릴 때 쓴다)
	// - 모바일이면 아니다. 아이패드의 사파리는 데스크탑처럼 맥이라고 알리므로, 맥인데 손가락 입력이 여럿 되면 아이패드로 본다.
	// - 플랫폼 정보를 새로 읽는다.
	//==============================================================================
	/**
	 * @returns { boolean } 데스크탑 웹이면 참.
	 */
	isDesktopWeb() {
		this.getPlatformInfo();
		if (this.isMobile) {
			return false;
		}
		const maxTouchPoints = System.navigator.maxTouchPoints || 0;
		if (this.platformName === PlatformType.macOS && maxTouchPoints > 1) {
			return false;
		}
		return true;
	}

	//==============================================================================
	// 주된 손이 손가락인지 반환. (CSS 의 pointer: coarse, 단축키 안내처럼 마우스로 하는 화면에만 보일 것을 가릴 때 쓴다)
	//==============================================================================
	/**
	 * @returns { boolean } (pointer: coarse) 미디어 질의가 맞으면 참. (matchMedia 가 없으면 거짓)
	 */
	isCoarsePointer() {
		if (typeof System.matchMedia !== "function") {
			return false;
		}
		const mediaQueryList = System.matchMedia("(pointer: coarse)");
		return mediaQueryList.matches;
	}

	//==============================================================================
	// 리소스 사용량 반환.
	//==============================================================================
	/**
	 * @returns { { totalTransferSize: number, totalDecodedSize: number, loadedFiles: array } } 네트워크로 받은 크기의 합, 풀린 크기의 합(바이트)과 불러온 파일 목록. (파일마다 path, name, type, transferSize, decodedSize, performance 의 resource 항목에서 읽는다)
	*/
	getResourceUsage() {
		const resources = performance.getEntriesByType("resource");		
		let totalTransferSize = 0; // 네트워크 전송량 (압축된 크기)
		let totalDecodedSize = 0;  // 실제 압축 해제된 크기
		let loadedFiles = [];

		resources.forEach(resource => {
			totalTransferSize += resource.transferSize;
			totalDecodedSize += resource.decodedBodySize;
			loadedFiles.push({
				path: resource.name,
				name: resource.name.split("/").pop(), 
				type: resource.initiatorType,
				transferSize: resource.transferSize,
				decodedSize: resource.decodedBodySize,
			});
		});

		// 자료구조 출력.
		// console.table(files);

		return {
			totalTransferSize,
			totalDecodedSize,
			loadedFiles
		};
	}

	//==============================================================================
	// 리소스 사용량 반환. (옛 이름의 오타를 그대로 둔 별칭, getResourceUsage 와 같다)
	//==============================================================================
	/**
	 * @returns { { totalTransferSize: number, totalDecodedSize: number, loadedFiles: array } } getResourceUsage 의 결과.
	*/
	getResouceUsage() {
		return this.getResourceUsage();
	}

	//==============================================================================
	// 세이프 에어리어 반환.
	//==============================================================================
	/**
     * @param { HTMLCanvasElement | null } canvas 크기를 잴 캔버스. (CSS 크기 clientWidth, clientHeight 를 쓴다, null 이면 창의 innerWidth, innerHeight 를 쓴다)
	 * @returns { Rect } 세이프 에어리어 여백을 뺀 사각형. (모두 CSS 픽셀, left, top 은 왼쪽, 위 여백, 여백은 CSS 의 env(safe-area-inset-*) 값, 너비와 높이는 0 이상)
	 * @example <caption>캔버스에서 노치를 피한 자리 구하기</caption>
	 * import { Platform } from "./build/vanilla.js";
	 *
	 * const platform = new Platform();
	 * const canvas = platform.getOrAddCanvas("gameCanvas");
	 * canvas.width = 640;
	 * canvas.height = 360;
	 * const safeAreaRect = platform.getSafeAreaRect(canvas);
	 * console.log(safeAreaRect.left, safeAreaRect.top, safeAreaRect.width, safeAreaRect.height);
	*/
	getSafeAreaRect(canvas) {
		const div = System.document.createElement("div");
		div.style.position = "absolute";
		div.style.visibility = "hidden";
		div.style.paddingTop = "env(safe-area-inset-top)";
		div.style.paddingRight = "env(safe-area-inset-right)";
		div.style.paddingBottom = "env(safe-area-inset-bottom)";
		div.style.paddingLeft = "env(safe-area-inset-left)";
		System.document.body.appendChild(div);

		const style = System.window.getComputedStyle(div);
		const top = Number.parseInt(style.paddingTop) || 0;
		const right = Number.parseInt(style.paddingRight) || 0;
		const bottom = Number.parseInt(style.paddingBottom) || 0;
		const left = Number.parseInt(style.paddingLeft) || 0;

		System.document.body.removeChild(div);

		// 여백은 CSS 픽셀이므로 캔버스도 그리기 버퍼 크기(width, height, 기기 픽셀일 수 있다)가 아니라 CSS 크기로 잰다.
		let areaWidth = System.window.innerWidth;
		let areaHeight = System.window.innerHeight;
		if (canvas !== null && canvas !== undefined) {
			areaWidth = canvas.clientWidth;
			areaHeight = canvas.clientHeight;
		}
		const safeWidth = System.Math.max(areaWidth - left - right, 0);
		const safeHeight = System.Math.max(areaHeight - top - bottom, 0);
		return Rect.create(left, top, safeWidth, safeHeight);
	}
}
