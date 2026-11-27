//==============================================================================
// UIDocument 그림 잇기의 크롬 시험. (NODE_PATH=$(npm root -g) node tests/ui/uidocumentchrome.test.mjs)
// - 헤드리스 크롬(창을 띄우지 않는다)에서 원본 엔진을 불러 그림을 실제로 읽는다. (node 에는 그림이 없다)
// - 같은 문서로 적고 읽은 복제본(UIListView.setTemplateNode)은 본의 그림을 그대로 쓴다.
// - bindPendingImages 는 그사이 게임이 넣은 그림이나 바꾼 경로를 덮지 않는다.
// - loadImages 가 읽지 못한 그림은 다음 loadImages 가 다시 요청한다.
// - 크롬 경로는 CHROME_PATH 로 바꿀 수 있다. puppeteer-core 나 크롬이 없으면 실패한다. (말없이 건너뛰지 않는다)
//==============================================================================
import fs from "node:fs";
import http from "node:http";
import path from "node:path";
import url from "node:url";
import { createRequire } from "node:module";
import { check, checkJson, finish } from "../testcheck.mjs";
import { gotoPage } from "../chromepage.mjs";

const require = createRequire(import.meta.url);
const puppeteer = require("puppeteer-core");

const repositoryPath = path.resolve(path.dirname(url.fileURLToPath(import.meta.url)), "../..");
const contentTypeTable = { ".js": "text/javascript", ".mjs": "text/javascript", ".json": "application/json", ".html": "text/html", ".png": "image/png" };

// 저장소를 잠깐 내주는 http 서버. (모듈은 file:// 로 못 불러온다)
const server = http.createServer((request, response) => {
	const requestPath = decodeURIComponent(new URL(request.url, "http://localhost").pathname);
	if (requestPath === "/") {
		response.writeHead(200, { "Content-Type": "text/html" });
		response.end("<!doctype html><title>uidocument</title><link rel=\"icon\" href=\"data:,\"><style>body{margin:0}</style>");
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
await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
const port = server.address().port;

const chromePathList = [
	...(process.env.CHROME_PATH ? [process.env.CHROME_PATH] : []),
	"/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
	"C:/Program Files/Google/Chrome/Application/chrome.exe",
	"/usr/bin/google-chrome",
];
const executablePath = chromePathList.find((chromePath) => fs.existsSync(chromePath));
check(executablePath !== undefined, "크롬을 찾지 못함 (CHROME_PATH)");

const browser = await puppeteer.launch({ executablePath, headless: true, args: ["--use-angle=swiftshader", "--enable-unsafe-swiftshader"] });
try {
	const page = await browser.newPage();
	page.on("pageerror", (error) => {
		console.log("페이지 오류: " + error.message);
	});
	await gotoPage(page, "http://127.0.0.1:" + port + "/");
	const result = await page.evaluate(async () => {
		const { UIDocument, UIListView, WorldNode, Sprite, ShadowImage, Vector2 } = await import("/import.js");
		const imagePath = "examples/assets/spritesheet.png";
		const missingPath = "examples/assets/missing.png";
		const warningList = [];
		const originalWarn = console.warn;
		console.warn = (...argumentList) => {
			warningList.push(argumentList.join(" "));
		};
		const output = {};
		try {
			// 1. 문서로 그림을 읽은 템플릿과 게임이 그림을 넣은 템플릿을 UIListView.setTemplateNode 로 복제한다.
			const templateText = JSON.stringify({ version: 1, root: { name: "Item", contentSize: [100, 40], components: [{ type: "Sprite", imagePath: imagePath }], children: [] } });
			const templateDocument = new UIDocument();
			await Promise.all(templateDocument.loadImages(templateText));
			const templateNode = templateDocument.fromJsonText(templateText);
			const templateImage = templateNode.getComponent(Sprite).getImage();
			const canvas = document.createElement("canvas");
			const shadowNode = new WorldNode();
			shadowNode.setName("Shadow");
			const shadowImage = shadowNode.addComponent(ShadowImage);
			shadowImage.setImage(canvas);
			shadowImage.setImagePath("images/never-loaded.png");
			templateNode.addChild(shadowNode);
			const listNode = new WorldNode();
			listNode.setContentSize(Vector2.create(200, 200));
			const listView = listNode.addComponent(UIListView);
			listView.setTemplateNode(templateNode);
			listView.setItemCount(3);
			const warningCountBeforeItems = warningList.length;
			listView.tick(0);
			const itemNode = listView.getItemNode(1);
			output.templateHasImage = templateImage !== null;
			output.itemSpriteImage = itemNode !== null && itemNode.getComponent(Sprite).getImage() === templateImage;
			output.itemShadowImage = itemNode !== null && itemNode.findChildByName("Shadow").getComponent(ShadowImage).getImage() === canvas;
			output.itemWarningCount = warningList.length - warningCountBeforeItems;

			// 5. 기다리지 않고 지은 뒤 게임이 그림을 넣거나 경로를 바꾸면 bindPendingImages 가 덮지 않는다.
			const lateText = JSON.stringify({ version: 1, root: { name: "Late", components: [{ type: "Sprite", imagePath: imagePath }], children: [{ name: "Moved", components: [{ type: "Sprite", imagePath: imagePath }] }] } });
			const lateDocument = new UIDocument();
			const latePromiseList = lateDocument.loadImages(lateText);
			const lateNode = lateDocument.fromJsonText(lateText);
			const lateSprite = lateNode.getComponent(Sprite);
			const gameCanvas = document.createElement("canvas");
			lateSprite.setImage(gameCanvas);
			const movedSprite = lateNode.findChildByName("Moved").getComponent(Sprite);
			movedSprite.setImagePath("images/other.png");
			await Promise.all(latePromiseList);
			output.lateRemainCount = lateDocument.bindPendingImages();
			output.gameImageKept = lateSprite.getImage() === gameCanvas;
			output.movedImageEmpty = movedSprite.getImage() === null;

			// 7. 읽지 못한 그림은 다음 loadImages 가 다시 요청한다.
			const missingText = JSON.stringify({ version: 1, root: { name: "Missing", components: [{ type: "Sprite", imagePath: missingPath }] } });
			const missingDocument = new UIDocument();
			const firstPromiseList = missingDocument.loadImages(missingText);
			await Promise.all(firstPromiseList);
			missingDocument.fromJsonText(missingText);
			const secondPromiseList = missingDocument.loadImages(missingText);
			await Promise.all(secondPromiseList);
			output.missingRequestCounts = [firstPromiseList.length, secondPromiseList.length];
			output.missingResolved = missingDocument.resolveImage(missingPath) === null;
		}
		finally {
			console.warn = originalWarn;
		}
		return output;
	});
	checkJson({ templateHasImage: result.templateHasImage, itemSpriteImage: result.itemSpriteImage, itemShadowImage: result.itemShadowImage, itemWarningCount: result.itemWarningCount },
		{ templateHasImage: true, itemSpriteImage: true, itemShadowImage: true, itemWarningCount: 0 }, "setTemplateNode 복제본은 본의 그림을 쓴다 (경고 없이)");
	checkJson({ lateRemainCount: result.lateRemainCount, gameImageKept: result.gameImageKept, movedImageEmpty: result.movedImageEmpty },
		{ lateRemainCount: 0, gameImageKept: true, movedImageEmpty: true }, "bindPendingImages 는 게임이 넣은 그림과 바꾼 경로를 덮지 않는다");
	checkJson({ missingRequestCounts: result.missingRequestCounts, missingResolved: result.missingResolved },
		{ missingRequestCounts: [1, 1], missingResolved: true }, "읽지 못한 그림은 다시 요청한다");
}
finally {
	await browser.close();
	server.close();
}

finish("tests/ui/uidocumentchrome.test.mjs");
