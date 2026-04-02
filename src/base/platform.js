//==============================================================================
// 포함 모듈 목록.
//==============================================================================
const System = globalThis;
import { Object } from "./object.js";
import { Rect } from "./rect.js";


//==============================================================================
// 공통 시스템 폰트 목록.
//==============================================================================
export const SYSTEM_FONT_STRING = '-apple-system, "Segoe UI", Roboto, "Apple SD Gothic Neo", "Malgun Gothic", sans-serif';


//==============================================================================
// 플랫폼 타입.
//==============================================================================
export const PlatformType = { //System.Object.freeze({
	windows: "Windows",
	macOS: "macOS",
	android: "Android",
	steamDeck: "SteamDeck", // 스팀덱 추가
	iPadOS: "iPadOS",       // iPadOS 추가
	iOS: "iOS",
	linux: "Linux",
	unknown: "Unknown"
};
// });


//==============================================================================
// 브라우저 타입.
//==============================================================================
export const BrowserType = { //System.freeze({
	chrome: "Chrome",
	edge: "Edge",
	firefox: "Firefox",
	internetExplorer: "Internet Explorer",
	safari: "Safari",
	unknown: "Unknown"
};
// });


//==============================================================================
// 플랫폼 정보.
//==============================================================================
export class Platform extends Object {
	//==============================================================================
	// 멤버 변수 목록.
	//==============================================================================
	/** @type { string } */ platformName = PlatformType.unknown;
	/** @type { string } */ browserName = BrowserType.unknown;
	/** @type { boolean } */ isMobile = false;


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
	// 플랫폼 정보 탐지 및 적용.
	//==============================================================================
	/**
	 * @returns { { platformName: string, browserName: string } }
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

		return {
			platformName: this.platformName,
			browserName: this.browserName,
		};
	}

	//==============================================================================
	// 리소스 사용량 반환.
	//==============================================================================
	/**
	 * @returns { { totalTransferSize: number, totalDecodedSize: number, loadedFiles: array } }
	*/
	getResouceUsage() {
		const resources = performance.getEntriesByType('resource');		
		let totalTransferSize = 0; // 네트워크 전송량 (압축된 크기)
		let totalDecodedSize = 0;  // 실제 압축 해제된 크기
		let loadedFiles = [];

		resources.forEach(resource => {
			totalTransferSize += resource.transferSize;
			totalDecodedSize += resource.decodedBodySize;
			loadedFiles.push({
				path: resource.name,
				name: resource.name.split('/').pop(), 
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
	// 세이프 에어리어 반환.
	//==============================================================================
	/**
     * @param @type { HTMLCanvasElement | null } canvas
	 * @returns { Rect }
	*/
	getSafeAreaRect(canvas) {
		const div = System.document.createElement('div');
		div.style.position = 'absolute';
		div.style.visibility = 'hidden';
		div.style.paddingTop = 'env(safe-area-inset-top)';
		div.style.paddingRight = 'env(safe-area-inset-right)';
		div.style.paddingBottom = 'env(safe-area-inset-bottom)';
		div.style.paddingLeft = 'env(safe-area-inset-left)';
		System.document.body.appendChild(div);

		const style = Window.getComputedStyle(div);
		const top = Number.parseInt(style.paddingTop) || 0;
		const right = Number.parseInt(style.paddingRight) || 0;
		const bottom = Number.parseInt(style.paddingBottom) || 0;
		const left = Number.parseInt(style.paddingLeft) || 0;

		System.document.body.removeChild(div);

		if (canvas === null || canvas === undefined) {
			return Rect.create(left, top, System.window.innerWidth - left - right, System.window.innerHeight - top - bottom);
		}
		else {
			return Rect.create(left, top, canvas.width - left - right, canvas.height - top - bottom);
		}
	}
}
