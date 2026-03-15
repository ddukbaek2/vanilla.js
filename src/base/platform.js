//==============================================================================
// 포함 모듈 목록.
//==============================================================================
import { VObject } from "./object.js";


//==============================================================================
// 플랫폼 타입.
//==============================================================================
export const PlatformType = { //Object.freeze({
	Windows: "Windows",
	macOS: "macOS",
	Android: "Android",
	SteamDeck: "SteamDeck", // 스팀덱 추가
	iPadOS: "iPadOS",       // iPadOS 추가
	iOS: "iOS",
	Linux: "Linux",
	Unknown: "Unknown"
};
// });


//==============================================================================
// 브라우저 타입.
//==============================================================================
export const BrowserType = { //Object.freeze({
	Chrome: "Chrome",
	Edge: "Edge",
	Firefox: "Firefox",
	InternetExplorer: "Internet Explorer",
	Safari: "Safari",
	Unknown: "Unknown"
};
// });


//==============================================================================
// 플랫폼 정보.
//==============================================================================
export class VPlatform extends VObject {
	//==============================================================================
	// 멤버 변수 목록.
	//==============================================================================
	/** @type { string } */ platformName = PlatformType.Unknown;
	/** @type { string } */ browserName = BrowserType.Unknown;
	/** @type { boolean } */ isMobile = false;


	//==============================================================================
	// 생성.
	//==============================================================================
	constructor() {
		super();
	}

	//==============================================================================
	// 플랫폼 정보 탐지 및 적용.
	//==============================================================================
	/**
	 * @returns { { platformName: string, browserName: string } }
	*/
	getPlatformInfo() {
		// if (navigator.userAgentData && !/Valve Steam GameOverlay|iPad/i.test(navigator.userAgent))
		// {
		// 	try
		// 	{
		// 		const userAgentData = navigator.userAgentData;
		// 		const mainBrand = userAgentData.brands.find(b => b.brand !== "Chromium") || userAgentData.brands[0];
				
		// 		const platform = userAgentData.platform;
		// 		if (platform.toLowerCase() === "windows") this.platformName = PlatformType.Windows;
		// 		else if (platform.toLowerCase() === "macos") this.platformName = PlatformType.macOS;
		// 		else if (platform.toLowerCase() === "android") this.platformName = PlatformType.Android;
		// 		else if (platform.toLowerCase() === "linux") this.platformName = PlatformType.Linux;
		// 		else if (platform.toLowerCase() === "ios") this.platformName = PlatformType.iOS;
		// 		else this.platformName = PlatformType.Unknown;

		// 		this.browserName = globalThis.Object.keys(BrowserType).map(b => b.toLowerCase() === mainBrand.brand.toLowerCase()) || BrowserType.Unknown;
		// 		//this.browserName = Object.entries(BrowserType).map(key => BrowserType[key]).find(browserType => browserType.toLowerCase() === mainBrand.brand.toLowerCase()) || BrowserType.Unknown;
		// 		this.IsMobile = userAgentData.mobile;
		// 		return Promise.resolve();
		// 	}
		// 	catch (exception)
		// 	{
		// 		console.error(exception);
		// 	}
		// }

		const userAgent = navigator.userAgent;
		this.isMobile = /Mobi|Android|iPhone|iPad/i.test(userAgent);

		// 플랫폼 감지.
		if (/Windows/i.test(userAgent)) this.platformName = PlatformType.Windows;
		else if (/Valve Steam GameOverlay/i.test(userAgent)) this.platformName = PlatformType.SteamDeck;
		else if (/iPad/i.test(userAgent)) this.platformName = PlatformType.iPadOS;
		else if (/iPhone|iPod/i.test(userAgent)) this.platformName = PlatformType.iOS;
		else if (/Macintosh|Mac OS X/i.test(userAgent)) this.platformName = PlatformType.macOS;
		else if (/Android/i.test(userAgent)) this.platformName = PlatformType.Android;
		else if (/Linux/i.test(userAgent)) this.platformName = PlatformType.Linux;
		else this.platformName = PlatformType.Unknown;

		// 브라우저 감지.
		if (/Edg/i.test(userAgent)) this.browserName = BrowserType.Edge;
		else if (/Chrome/i.test(userAgent) && !/Edg/i.test(userAgent)) this.browserName = BrowserType.Chrome;
		else if (/Safari/i.test(userAgent) && !/Chrome/i.test(userAgent) && !/Edg/i.test(userAgent)) this.browserName = BrowserType.Safari;
		else if (/Firefox/i.test(userAgent)) this.browserName = BrowserType.Firefox;
		else if (/MSIE|Trident/i.test(userAgent)) this.browserName = BrowserType.InternetExplorer;
		else this.browserName = BrowserType.Unknown;

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
}
