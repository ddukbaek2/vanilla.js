//==============================================================================
// 헤드리스 크롬 시험의 페이지 열기. (tests/<분야>/<이름>chrome.test.mjs 가 같이 쓴다)
// - 윈도우의 크롬은 막 띄운 브라우저의 첫 탐색을 요청이 서버에 닿기 전에 취소할 때가 있다. (net::ERR_ABORTED, 네트워크 loadingFailed 의 canceled)
//   CI 의 윈도우 기계에서 브라우저를 띄울 때마다 첫 탐색이 이렇게 끊겼고, 같은 브라우저의 다음 탐색부터는 모두 됐다. (맥과 리눅스는 끊기지 않았다)
//   그래서 net::ERR_ABORTED 면 같은 페이지로 세 번까지 다시 연다. 다른 실패는 그대로 던진다.
//==============================================================================
const ATTEMPT_COUNT = 3;

//==============================================================================
// 주소를 연다. (page.goto 와 같은 인자, 같은 돌려줌)
//==============================================================================
export async function gotoPage(page, url, options) {
	for (let attempt = 1; ; attempt++) {
		try {
			return await page.goto(url, options);
		}
		catch (error) {
			if (attempt >= ATTEMPT_COUNT || !String(error.message).includes("net::ERR_ABORTED")) {
				throw error;
			}
			console.log("다시 열기 " + attempt + "/" + ATTEMPT_COUNT + ": " + String(error.message).split("\n")[0]);
		}
	}
}

//==============================================================================
// 브라우저를 띄운다. (puppeteer.launch 와 같은 인자, 같은 돌려줌)
// - GPU 가 없는 기계(CI 의 리눅스, 윈도우)의 크롬은 --enable-unsafe-swiftshader 가 있어야 WebGL 을 소프트웨어(SwiftShader)로 돌린다.
//   없으면 리눅스는 "Automatic fallback to software WebGL has been deprecated" 경고를 내고, 윈도우는 WebGL2 를 못 만든다.
//   이 인자는 GPU 가 있으면 GPU 를 그대로 쓰므로(맥), GPU 가 있는 기계의 화면은 바뀌지 않는다.
//==============================================================================
export async function launchBrowser(puppeteer, options) {
	const launchOptions = { ...options };
	const argumentList = [...(launchOptions.args ?? [])];
	if (!argumentList.includes("--enable-unsafe-swiftshader")) {
		argumentList.push("--enable-unsafe-swiftshader");
	}
	launchOptions.args = argumentList;
	return await puppeteer.launch(launchOptions);
}
