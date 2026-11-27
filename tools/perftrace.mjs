//==============================================================================
// 크롬 트레이스로 '프레임 전체 시간' 재기. (게임이 어느 엔진 판으로 돌든 같은 방식으로 잰다)
//
// 쓰는 법 (셋):
//   (가) 주소 열기: 새 헤드리스 크롬을 띄워 주소를 열고 잰다.
//   (나) 열린 페이지에 붙기(--attach): 이미 떠 있는 크롬(원격 디버깅)의 페이지에 붙어, 그 페이지를 그대로(해상도, dpr 안 바꿈, 데움 기본 0) 잰다. 찍개가 페이지 안에서 장면(로비, 매칭, 판)까지 데려간 뒤 재는 데 쓴다. 끝나면 떨어질 뿐 크롬은 끄지 않는다.
//       크롬 띄우기 예: "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome" --headless=new --remote-debugging-port=9222 --user-data-dir=/tmp/perfprofile <주소>
//       NODE_PATH=$(npm root -g) node tools/perftrace.mjs --attach http://127.0.0.1:9222 [--target 주소에 든 글] [--seconds 4] [--warmup 0] [--out 결과.json] [--keep-trace 트레이스.json]
//       --target 은 주소에 그 글이 든 첫 페이지를 고른다(없으면 첫 페이지). ws:// 주소(브라우저 웹소켓)도 받는다.
//   (다) 모듈로 부르기(게임 찍개 안에서): 이미 puppeteer 를 쥔 스크립트가 page(또는 browser)를 넘긴다. 같은 결과 객체를 돌려준다.
//       import { measureAttached } from "<엔진 저장소>/tools/perftrace.mjs";
//       const result = await measureAttached(page, { seconds: 4, warmup: 0, keepTrace: null, silent: false });  // browser 를 넘기면 options.target 으로 페이지를 고른다
//       옵션: seconds(4), warmup(0), target(browser 일 때만), keepTrace(트레이스 파일 경로), out(결과 json 경로), silent(true 면 표를 찍지 않음). 프레임이 모자라거나 rAF 가 안 잡히면 오류를 던진다. 부르는 쪽 puppeteer 를 쓰므로 puppeteer-core 를 따로 읽지 않는다.
//   (가) 의 명령:
//   NODE_PATH=$(npm root -g) node tools/perftrace.mjs <주소 또는 로컬 html 경로> [--seconds 4] [--warmup 2] [--width 1280 --height 720 --dpr 1] [--out 결과.json] [--chrome 크롬 실행 파일] [--root 서버 뿌리 폴더] [--keep-trace 트레이스.json]
//   - 주소(http, https)는 그대로 연다. 게임의 ?perfScene=mid 같은 값은 주소에 붙여 그대로 넘긴다. (로컬 경로도 "경로?값" 꼴이면 값을 넘긴다)
//   - 로컬 html 경로를 주면 작은 서버를 띄워 연다. 서버는 교차 출처 격리(COOP, COEP) 머리를 단다. 서버 뿌리는 그 html 이 든 저장소 뿌리(이 파일의 한 칸 위 폴더) 안이면 그 뿌리, 아니면 html 이 든 폴더. --root 로 바꾼다.
//   - 크롬은 헤드리스(창이 뜨지 않음). 기본 경로는 맥의 /Applications/Google Chrome.app. 다른 운영체제는 --chrome 으로 준다.
//   - puppeteer-core 가 있어야 한다. 저장소 의존에 더하지 않고 전역 것을 쓴다: NODE_PATH=$(npm root -g)
//
// 무엇을 재나 ('프레임 전체 시간' 의 뜻):
//   페이지의 rAF(requestAnimationFrame) 콜백이 불린 시각을 프레임 경계로 삼는다. 프레임 i 는 [i 번째 콜백 시작, i+1 번째 콜백 시작) 이다. 그 간격 안에서
//   (1) 렌더러 메인 스레드 바쁜 시간: 렌더러 프로세스 CrRendererMain 의 최상위 작업(RunTask)이 간격과 겹친 시간의 합(겹침은 한 번만 셈). 스크립트, 스타일, 레이아웃, 그림 기록, GL 명령을 명령 버퍼에 쓰는 일, 기다림이 모두 든다. '프레임을 만드는 데 렌더러가 쓴 전체 시간'.
//   (2) 그 안의 명령 버퍼 기다림: gpu 갈래의 CommandBufferHelper::WaitForAvailableEntries 가 같은 스레드에서 간격과 겹친 시간의 합. 렌더러가 GPU 프로세스의 명령 버퍼 자리가 나기를 기다린 몫이다. (1) 이 일해서 바쁜 게 아니라 GPU 프로세스를 기다려 바쁘다는 뜻이다.
//   (3) GPU 프로세스 메인 스레드 바쁜 시간: GPU 프로세스 CrGpuMain 의 최상위 작업이 간격과 겹친 시간의 합. 명령을 풀어 실제 GL 을 부르는 몫.
//   (4) rAF 콜백 시간: 렌더러의 FireAnimationFrame 이벤트 길이(스크립트가 한 프레임에 쓴 시간. 그리기 호출이 GL 명령을 쓰는 시간은 여기 든다).
//   (5) 프레임 간격: 이어진 두 콜백 시작의 차. (화면 주사율에 묶이면 16.7 ms 근처에 붙는다. 그래서 일의 양은 (1) 과 (3) 을 본다)
//   값은 프레임마다 모은 가운데 값(중앙값), 평균, 95 번째(p95)로 찍는다. 간격 첫 프레임과 마지막은 버린다.
//   읽는 법: 렌더러가 병목이면 (1) 이 크고 (2) 가 작다. GPU 프로세스가 병목이면 (3) 이 크고 (1) 안의 (2) 가 크다. 합치기, 호출 수 줄이기를 비교할 때 (1) 과 (3) 이 같이 내려가는지 본다.
//
// 결과 json: { url, width, height, dpr, seconds, frameCount, rows: { 이름: { median, mean, p95 } }, threads: { renderer, gpu } }
// 트레이스 갈래: devtools.timeline, gpu, gpu.service, cc, blink, toplevel, disabled-by-default-devtools.timeline.frame
//==============================================================================
import fs from "node:fs";
import http from "node:http";
import path from "node:path";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";

const toolsDirectory = path.dirname(fileURLToPath(import.meta.url));
const repositoryRoot = path.resolve(toolsDirectory, "..");
//==============================================================================
// 셈. 트레이스 파일에서 결과 객체를 만든다(오류는 던진다).
//==============================================================================
const TRACE_CATEGORIES = ["devtools.timeline", "gpu", "gpu.service", "cc", "blink", "toplevel", "disabled-by-default-devtools.timeline.frame"];
function computeResult(tracePath, meta) {
const data = JSON.parse(fs.readFileSync(tracePath, "utf8"));
const events = data.traceEvents ?? data;
const threadName = new Map(), processName = new Map();
for (const event of events) {
	if (event.ph !== "M") continue;
	if (event.name === "thread_name") threadName.set(event.pid + ":" + event.tid, event.args.name);
	if (event.name === "process_name") processName.set(event.pid, event.args.name);
}
// 렌더러 메인 스레드는 rAF 콜백(FireAnimationFrame)이 가장 많이 든 CrRendererMain 이다.
const animationCount = new Map();
for (const event of events) {
	if (event.name === "FireAnimationFrame" && event.ph === "X") animationCount.set(event.pid + ":" + event.tid, (animationCount.get(event.pid + ":" + event.tid) ?? 0) + 1);
}
const rendererKey = [...animationCount.entries()].sort((a, b) => b[1] - a[1])[0]?.[0];
if (rendererKey === undefined) throw new Error("rAF 콜백이 하나도 안 잡혔다. 페이지가 requestAnimationFrame 으로 돌아야 한다.");
const rendererPid = Number(rendererKey.split(":")[0]);
let gpuKey = null;
for (const [key, name] of threadName) {
	if (name === "CrGpuMain") gpuKey = key;
}
const isTopLevel = (event) => event.ph === "X" && event.dur !== undefined && (event.name === "RunTask" || event.name === "ThreadControllerImpl::RunTask");
function collectIntervals(key, filter) {
	const list = [];
	for (const event of events) {
		if (event.pid + ":" + event.tid !== key || !filter(event)) continue;
		list.push([event.ts, event.ts + event.dur]);
	}
	list.sort((a, b) => a[0] - b[0]);
	// 겹침은 한 번만 세게 합친다.
	const merged = [];
	for (const interval of list) {
		const last = merged[merged.length - 1];
		if (last !== undefined && interval[0] <= last[1]) last[1] = Math.max(last[1], interval[1]);
		else merged.push([interval[0], interval[1]]);
	}
	return merged;
}
const rendererBusy = collectIntervals(rendererKey, isTopLevel);
const rendererWait = collectIntervals(rendererKey, (event) => event.ph === "X" && event.dur !== undefined && event.name === "CommandBufferHelper::WaitForAvailableEntries");
const gpuBusy = gpuKey === null ? [] : collectIntervals(gpuKey, isTopLevel);
const animations = events.filter((event) => event.name === "FireAnimationFrame" && event.ph === "X" && event.pid + ":" + event.tid === rendererKey).sort((a, b) => a.ts - b.ts);
function overlap(list, start, end) {
	let sum = 0;
	for (const [a, b] of list) {
		if (b <= start) continue;
		if (a >= end) break;
		sum += Math.min(end, b) - Math.max(start, a);
	}
	return sum;
}
const series = { rendererBusy: [], commandBufferWait: [], gpuBusy: [], rafCallback: [], frameInterval: [] };
for (let index = 1; index < animations.length - 1; ++index) {
	const start = animations[index].ts, end = animations[index + 1].ts;
	series.rendererBusy.push(overlap(rendererBusy, start, end) / 1000);
	series.commandBufferWait.push(overlap(rendererWait, start, end) / 1000);
	series.gpuBusy.push(overlap(gpuBusy, start, end) / 1000);
	series.rafCallback.push(animations[index].dur / 1000);
	series.frameInterval.push((end - start) / 1000);
}
const frameCount = series.rendererBusy.length;
if (frameCount < 3) throw new Error("프레임이 너무 적다: " + frameCount);
function summarize(list) {
	const sorted = [...list].sort((a, b) => a - b);
	const pick = (ratio) => sorted[Math.min(sorted.length - 1, Math.floor(sorted.length * ratio))];
	return { median: pick(0.5), mean: list.reduce((sum, value) => sum + value, 0) / list.length, p95: pick(0.95) };
}
const rows = {};
for (const name of Object.keys(series)) rows[name] = summarize(series[name]);
return { url: meta.url, width: meta.width, height: meta.height, dpr: meta.dpr, seconds: meta.seconds, frameCount, rows, threads: { renderer: (processName.get(rendererPid) ?? "?") + " / " + (threadName.get(rendererKey) ?? "?"), gpu: gpuKey === null ? "없음(CrGpuMain 못 찾음)" : (processName.get(Number(gpuKey.split(":")[0])) ?? "?") + " / " + threadName.get(gpuKey) } };
}

const labels = { rendererBusy: "(1) 렌더러 메인 스레드 바쁜 시간", commandBufferWait: "(2) 그 안의 명령 버퍼 기다림", gpuBusy: "(3) GPU 프로세스 메인 스레드 바쁜 시간", rafCallback: "(4) rAF 콜백 시간(스크립트)", frameInterval: "(5) 프레임 간격" };
function printResult(result) {
	console.log("주소 " + result.url);
	console.log("프레임 " + result.frameCount + " 개, " + result.width + "x" + result.height + " dpr " + result.dpr + ", 렌더러 " + result.threads.renderer + ", GPU " + result.threads.gpu);
	console.log("항목".padEnd(44) + "가운데".padStart(10) + "평균".padStart(10) + "p95".padStart(10) + "  (ms)");
	for (const name of Object.keys(labels)) {
		const row = result.rows[name];
		console.log(labels[name].padEnd(40) + row.median.toFixed(2).padStart(10) + row.mean.toFixed(2).padStart(10) + row.p95.toFixed(2).padStart(10));
	}
}

//==============================================================================
// 열린 페이지에 붙어 재기. browserOrPage 는 puppeteer 의 Browser 나 Page.
//==============================================================================
export async function measureAttached(browserOrPage, options = {}) {
	const settings = { seconds: 4, warmup: 0, target: null, keepTrace: null, out: null, silent: false, ...options };
	let page = browserOrPage;
	if (typeof browserOrPage.pages === "function") {
		const pages = await browserOrPage.pages();
		page = (settings.target !== null ? pages.find((candidate) => candidate.url().includes(settings.target)) : undefined) ?? pages[0];
		if (page === undefined) throw new Error("붙을 페이지가 없다");
	}
	const tracePath = settings.keepTrace ?? path.join(process.env.TMPDIR ?? "/tmp", "perftrace_" + process.pid + "_" + Date.now() + ".json");
	if (settings.warmup > 0) await new Promise((resolve) => setTimeout(resolve, settings.warmup * 1000));
	const view = await page.evaluate(() => ({ width: window.innerWidth, height: window.innerHeight, dpr: window.devicePixelRatio }));
	await page.tracing.start({ path: tracePath, categories: TRACE_CATEGORIES });
	await new Promise((resolve) => setTimeout(resolve, settings.seconds * 1000));
	await page.tracing.stop();
	let result;
	try {
		result = computeResult(tracePath, { url: page.url(), width: view.width, height: view.height, dpr: view.dpr, seconds: settings.seconds });
	}
	finally {
		if (settings.keepTrace === null) fs.unlinkSync(tracePath);
	}
	if (!settings.silent) printResult(result);
	if (settings.out !== null) fs.writeFileSync(settings.out, JSON.stringify(result, null, "\t"));
	return result;
}

//==============================================================================
// 명령 줄.
//==============================================================================
async function main() {
	const argumentList = process.argv.slice(2);
	const options = { seconds: 4, warmup: null, width: 1280, height: 720, dpr: 1, out: null, chrome: "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome", root: null, keepTrace: null, attach: null, target: null };
	let positional = null;
	for (let index = 0; index < argumentList.length; ++index) {
		const argument = argumentList[index];
		if (argument.startsWith("--")) {
			const name = argument.slice(2).replace(/-([a-z])/g, (_, letter) => letter.toUpperCase());
			if (!(name in options)) { console.error("모르는 인자: " + argument); process.exit(1); }
			const value = argumentList[++index];
			options[name] = typeof options[name] === "number" || name === "warmup" ? Number(value) : value;
		}
		else {
			positional = argument;
		}
	}
	if (positional === null && options.attach === null) {
		console.error("쓰는 법: node tools/perftrace.mjs <주소 또는 로컬 html 경로> [--seconds 4] [--warmup 2] [--width 1280 --height 720 --dpr 1] [--out 결과.json] [--chrome 경로] [--root 폴더] [--keep-trace 트레이스.json]");
		console.error("       node tools/perftrace.mjs --attach <http://127.0.0.1:9222 또는 ws://...> [--target 주소에 든 글] [--seconds 4] [--warmup 0] [--out 결과.json] [--keep-trace 트레이스.json]");
		process.exit(1);
	}
	const require = createRequire(import.meta.url);
	const puppeteer = require("puppeteer-core");
	try {
		if (options.attach !== null) {
			const connectOptions = /^wss?:/.test(options.attach) ? { browserWSEndpoint: options.attach, defaultViewport: null } : { browserURL: options.attach, defaultViewport: null };
			const browser = await puppeteer.connect(connectOptions);
			try {
				await measureAttached(browser, { seconds: options.seconds, warmup: options.warmup ?? 0, target: options.target, keepTrace: options.keepTrace, out: options.out });
			}
			finally {
				await browser.disconnect();
			}
			return;
		}
		await openAndMeasure(puppeteer, positional, { ...options, warmup: options.warmup ?? 2 });
	}
	catch (error) {
		console.error(error.message);
		process.exit(2);
	}
}

//==============================================================================
// 주소 열어 재기.
//==============================================================================
async function openAndMeasure(puppeteer, target, options) {
const MIME = { html: "text/html", js: "text/javascript", mjs: "text/javascript", cjs: "text/javascript", json: "application/json", css: "text/css", svg: "image/svg+xml", png: "image/png", jpg: "image/jpeg", jpeg: "image/jpeg", webp: "image/webp", gif: "image/gif", wasm: "application/wasm", glb: "model/gltf-binary", gltf: "model/gltf+json", webm: "audio/webm", mp3: "audio/mpeg", ogg: "audio/ogg", wav: "audio/wav", ttf: "font/ttf", otf: "font/otf", woff: "font/woff", woff2: "font/woff2", txt: "text/plain", map: "application/json" };
let server = null;
let pageUrl = target;
if (!/^https?:\/\//.test(target)) {
	const queryIndex = target.indexOf("?");
	const filePart = queryIndex < 0 ? target : target.slice(0, queryIndex);
	const queryPart = queryIndex < 0 ? "" : target.slice(queryIndex);
	const absoluteFile = path.resolve(filePart);
	if (!fs.existsSync(absoluteFile)) { console.error("파일이 없다: " + absoluteFile); process.exit(1); }
	let root;
	if (options.root !== null) root = path.resolve(options.root);
	else root = absoluteFile.startsWith(repositoryRoot + path.sep) ? repositoryRoot : path.dirname(absoluteFile);
	const relative = path.relative(root, absoluteFile).split(path.sep).join("/");
	server = http.createServer((request, response) => {
		response.setHeader("Cross-Origin-Opener-Policy", "same-origin");
		response.setHeader("Cross-Origin-Embedder-Policy", "require-corp");
		response.setHeader("Cross-Origin-Resource-Policy", "same-origin");
		response.setHeader("Cache-Control", "no-store");
		let requestPath = decodeURIComponent(new URL(request.url, "http://localhost").pathname);
		let filePath = path.join(root, requestPath);
		if (!filePath.startsWith(root)) { response.writeHead(403); response.end(); return; }
		if (fs.existsSync(filePath) && fs.statSync(filePath).isDirectory()) filePath = path.join(filePath, "index.html");
		if (!fs.existsSync(filePath)) { response.writeHead(404); response.end(); return; }
		response.writeHead(200, { "Content-Type": MIME[path.extname(filePath).slice(1).toLowerCase()] ?? "application/octet-stream" });
		fs.createReadStream(filePath).pipe(response);
	});
	await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
	pageUrl = "http://127.0.0.1:" + server.address().port + "/" + relative.split("/").map(encodeURIComponent).join("/") + queryPart;
}

	const tracePath = options.keepTrace ?? path.join(process.env.TMPDIR ?? "/tmp", "perftrace_" + process.pid + ".json");
	const browser = await puppeteer.launch({ executablePath: options.chrome, headless: true, defaultViewport: { width: options.width, height: options.height, deviceScaleFactor: options.dpr } });
	try {
		const page = await browser.newPage();
		page.on("pageerror", (error) => console.error("페이지 오류: " + error.message));
		await page.goto(pageUrl, { waitUntil: "load" });
		await new Promise((resolve) => setTimeout(resolve, options.warmup * 1000));
		await page.tracing.start({ path: tracePath, categories: TRACE_CATEGORIES });
		await new Promise((resolve) => setTimeout(resolve, options.seconds * 1000));
		await page.tracing.stop();
	}
	finally {
		await browser.close();
		if (server !== null) server.close();
	}
	const result = computeResult(tracePath, { url: pageUrl, width: options.width, height: options.height, dpr: options.dpr, seconds: options.seconds });
	printResult(result);
	if (options.out !== null) fs.writeFileSync(options.out, JSON.stringify(result, null, "\t"));
	if (options.keepTrace === null) fs.unlinkSync(tracePath);
}

if (process.argv[1] !== undefined && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) await main();
