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
