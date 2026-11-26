//==============================================================================
// 2D 뼈대 초안의 크롬 비트 시험. (NODE_PATH=$(npm root -g) node tests/experimental/skeleton2dchrome.test.mjs [--write])
// - 헤드리스 크롬(puppeteer-core 와 시스템 크롬, 창을 띄우지 않는다)에서 월드 변환, IK(뼈 둘, 꺾임 쪽, 닿지 않음, 뼈 하나와 세기),
//   크로스페이드와 층을 돌려 뼈 값을 f64 비트로 뜨고 chrome_skeleton2d.json 과 견준다. 원본은 크롬의 Math.sin, cos, atan2, acos, hypot 으로 셈한다.
// - 러스트 판 vanilla-engine 의 experimental::skeleton2d 시험 same_bits_as_chrome 이 같은 입력, 같은 비트를 견준다. (두 엔진이 같은 수를 내는지)
// - --write 를 주면 견주지 않고 chrome_skeleton2d.json 을 새로 쓴다. 크롬 경로는 CHROME_PATH 로 바꿀 수 있다.
//   puppeteer-core 나 크롬이 없으면 실패한다. (말없이 건너뛰지 않는다)
//==============================================================================
const System = globalThis;
import fs from "node:fs";
import http from "node:http";
import path from "node:path";
import url from "node:url";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const puppeteer = require("puppeteer-core");
const repositoryPath = path.resolve(path.dirname(url.fileURLToPath(import.meta.url)), "../..");
const contentTypeTable = { ".js": "text/javascript", ".mjs": "text/javascript", ".json": "application/json", ".html": "text/html" };
let checkCount = 0;
function check(condition, message) {
	checkCount++;
	if (!condition) {
		throw new System.Error("시험 실패: " + message);
	}
}

// 저장소를 잠깐 내주는 http 서버. (모듈은 file:// 로 못 불러온다)
const server = http.createServer((request, response) => {
	const requestPath = decodeURIComponent(new URL(request.url, "http://localhost").pathname);
	if (requestPath === "/") {
		response.writeHead(200, { "Content-Type": "text/html" });
		response.end("<!doctype html><title>skeleton2d</title>");
		return;
	}
	const filePath = path.join(repositoryPath, requestPath);
	if (!filePath.startsWith(repositoryPath) || !fs.existsSync(filePath) || fs.statSync(filePath).isDirectory()) {
		response.writeHead(404);
		response.end();
		return;
	}
	response.writeHead(200, { "Content-Type": contentTypeTable[path.extname(filePath)] ?? "application/octet-stream" });
	fs.createReadStream(filePath).pipe(response);
});
await new System.Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
const port = server.address().port;

const chromePathList = [
	...(process.env.CHROME_PATH ? [process.env.CHROME_PATH] : []),
	"/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
	"C:/Program Files/Google/Chrome/Application/chrome.exe",
	"/usr/bin/google-chrome",
];
const executablePath = chromePathList.find((chromePath) => fs.existsSync(chromePath));
check(executablePath !== undefined, "크롬을 찾지 못함 (CHROME_PATH)");
const browser = await puppeteer.launch({ executablePath, headless: true });
const chromeVersion = await browser.version();
let result = null;
try {
	const page = await browser.newPage();
	await page.goto("http://127.0.0.1:" + port + "/");
	result = await page.evaluate(async () => {
		const Experimental = await import("/src/experimental/experimental.js");
		const { Skeleton2DData, Skeleton2D, Skeleton2DAnimationState } = Experimental;
		const valueList = [];
		const view = new DataView(new ArrayBuffer(8));
		const push = (label, value) => {
			view.setFloat64(0, value);
			valueList.push([label, view.getBigUint64(0).toString(16).padStart(16, "0")]);
		};
		const pushBone = (label, bone) => {
			push(label + " a", bone.getWorldA());
			push(label + " b", bone.getWorldB());
			push(label + " c", bone.getWorldC());
			push(label + " d", bone.getWorldD());
			push(label + " x", bone.getWorldX());
			push(label + " y", bone.getWorldY());
			push(label + " rotation", bone.getWorldRotation());
			push(label + " scale x", bone.getWorldScaleX());
			push(label + " scale y", bone.getWorldScaleY());
			push(label + " applied", bone.getAppliedRotation());
		};
		// 1. 월드 변환.
		const world = new Skeleton2D(Skeleton2DData.createFromJson({
			bones: [
				{ name: "root", x: 100, y: 50, rotation: 90, scaleX: 2 },
				{ name: "child", parent: "root", x: 10, rotation: -90 },
				{ name: "sheared", parent: "child", x: 5, shearY: 30 },
				{ name: "odd", parent: "sheared", x: 7.3, y: -2.1, rotation: 33.3, scaleX: 1.7, scaleY: 0.6, shearX: 12.5, shearY: -7.25 },
			],
		}));
		world.updateWorldTransform();
		for (const name of ["child", "sheared", "odd"]) {
			pushBone("world " + name, world.findBone(name));
		}
		// 2. IK.
		const ikCaseList = [["ik positive", true, 60, 40, 1], ["ik negative", false, 60, 40, 1], ["ik far", true, 0, 300, 1], ["ik odd", true, 37.7, -21.3, 0.65]];
		for (const [label, isBendPositive, targetX, targetY, mix] of ikCaseList) {
			const arm = new Skeleton2D(Skeleton2DData.createFromJson({
				bones: [
					{ name: "root", rotation: 7.5 },
					{ name: "upper", parent: "root", length: 50, rotation: 12.5 },
					{ name: "lower", parent: "upper", x: 50, length: 43.2, rotation: -31 },
					{ name: "target", parent: "root", x: targetX, y: targetY },
				],
				ik: [{ name: "armIk", bones: ["upper", "lower"], target: "target", bendPositive: isBendPositive, mix }],
			}));
			arm.updateWorldTransform();
			pushBone(label + " upper", arm.findBone("upper"));
			pushBone(label + " lower", arm.findBone("lower"));
		}
		const aim = new Skeleton2D(Skeleton2DData.createFromJson({
			bones: [{ name: "root", rotation: 30 }, { name: "arm", parent: "root", length: 10 }, { name: "target", parent: "root", x: 0, y: 10 }],
			ik: [{ name: "aim", bones: ["arm"], target: "target", mix: 0.5 }],
		}));
		aim.updateWorldTransform();
		pushBone("ik aim arm", aim.findBone("arm"));
		// 3. 크로스페이드와 층.
		const animationData = Skeleton2DData.createFromJson({
			bones: [{ name: "root" }, { name: "body", parent: "root", y: -20 }, { name: "leg", parent: "root", rotation: 90 }, { name: "arm", parent: "root" }],
			animations: {
				idle: { duration: 1, bones: { body: { translate: [{ time: 0, y: 0 }] } } },
				walk: {
					duration: 1,
					bones: {
						body: { translate: [{ time: 0, y: -10 }] },
						leg: { rotate: [{ time: 0, value: -20, curve: "stepped" }, { time: 0.5, value: 20, curve: [0.42, 0, 0.58, 1] }, { time: 1, value: -20 }] },
					},
				},
				wave: { bones: { arm: { rotate: [{ time: 0, value: 0 }, { time: 1, value: 80 }] } } },
			},
		});
		const animated = new Skeleton2D(animationData);
		const animationState = new Skeleton2DAnimationState(animationData);
		const pushAnimated = (label) => {
			animationState.apply(animated);
			push(label + " body y", animated.findBone("body").getY());
			push(label + " leg rotation", animated.findBone("leg").getRotation());
			push(label + " arm rotation", animated.findBone("arm").getRotation());
		};
		animationState.setAnimation(0, "idle", true, 0);
		animationState.update(0.5);
		animationState.setAnimation(0, "walk", true, 0.2);
		animationState.update(0.1);
		pushAnimated("fade");
		animationState.update(0.15);
		pushAnimated("fade end");
		animationState.update(0.37);
		pushAnimated("bezier");
		animationState.setAnimation(1, "wave", true, 0);
		animationState.setTrackAlpha(1, 0.5);
		animationState.update(0.4321);
		pushAnimated("layer");
		animated.updateWorldTransform();
		pushBone("layer leg", animated.findBone("leg"));
		pushBone("layer arm", animated.findBone("arm"));
		return { valueList };
	});
}
finally {
	await browser.close();
	server.close();
}

const fixturePath = path.join(repositoryPath, "tests/experimental/chrome_skeleton2d.json");
if (process.argv.includes("--write")) {
	fs.writeFileSync(fixturePath, JSON.stringify({ chrome: chromeVersion, values: result.valueList }, null, "\t") + "\n");
	console.log(`chrome_skeleton2d.json 을 썼다 (${result.valueList.length} 값, ${chromeVersion})`);
}
else {
	const fixture = JSON.parse(fs.readFileSync(fixturePath, "utf8"));
	check(fixture.values.length === result.valueList.length, "값 수 " + result.valueList.length + " (기댓값 " + fixture.values.length + ")");
	for (let index = 0; index < fixture.values.length; index++) {
		const [label, bits] = fixture.values[index];
		check(result.valueList[index][0] === label && result.valueList[index][1] === bits, label + ": " + result.valueList[index][1] + " (기댓값 " + bits + ")");
	}
	console.log(`2D 뼈대 크롬 비트 시험 ${checkCount} 개 통과 (${chromeVersion})`);
}
