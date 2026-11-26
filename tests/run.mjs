//==============================================================================
// 원본 시험 모두 돌리기. (node tests/run.mjs [--node-only] [거를 글 ...])
// - tests/ 아래의 *.test.mjs 를 모두 찾아 node 로 따로 돌린다. (testdata 폴더는 보지 않는다)
// - 이름에 chrome 이 든 시험은 헤드리스 크롬 시험이다. puppeteer-core 가 NODE_PATH 에 있어야 한다. (NODE_PATH=$(npm root -g))
//   크롬 시험은 한 번에 하나씩, node 시험은 코어 수만큼 같이 돌린다.
// - --node-only 면 크롬 시험을 돌리지 않고 건너뛴 것을 찍는다. 거를 글을 주면 경로에 그 글이 든 시험만 돌린다.
// - 하나라도 실패하면 1 로 끝난다. 시험이 찍은 "두 엔진 차이(건너뜀)" 줄은 끝에 모아 다시 찍는다.
//==============================================================================
import { spawn } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import url from "node:url";

const testsPath = path.dirname(url.fileURLToPath(import.meta.url));
const argumentList = process.argv.slice(2);
const isNodeOnly = argumentList.includes("--node-only");
const filterTextList = argumentList.filter((argument) => !argument.startsWith("--"));

//==============================================================================
// 시험 파일 찾기. (이름 차례)
//==============================================================================
function findTestFileList(directoryPath) {
	const testFileList = [];
	for (const entry of fs.readdirSync(directoryPath, { withFileTypes: true })) {
		const entryPath = path.join(directoryPath, entry.name);
		if (entry.isDirectory()) {
			if (entry.name !== "testdata" && entry.name !== "node_modules") {
				testFileList.push(...findTestFileList(entryPath));
			}
		}
		else if (entry.name.endsWith(".test.mjs")) {
			testFileList.push(entryPath);
		}
	}
	return testFileList.sort();
}

//==============================================================================
// 시험 하나 돌리기. (끝 상태와 찍은 글)
//==============================================================================
function runTestFile(testFilePath) {
	return new Promise((resolve) => {
		const startTime = Date.now();
		const childProcess = spawn(process.execPath, [testFilePath], { cwd: path.dirname(testsPath), env: process.env });
		let outputText = "";
		childProcess.stdout.on("data", (chunk) => {
			outputText += chunk;
		});
		childProcess.stderr.on("data", (chunk) => {
			outputText += chunk;
		});
		childProcess.on("close", (exitCode) => {
			resolve({ testFilePath, exitCode, outputText, elapsedSeconds: (Date.now() - startTime) / 1000 });
		});
	});
}

//==============================================================================
// 여럿을 정한 수만큼 같이 돌리기.
//==============================================================================
async function runTestFileList(testFileList, parallelCount) {
	const resultList = new Array(testFileList.length);
	let nextIndex = 0;
	async function runNext() {
		while (nextIndex < testFileList.length) {
			const testIndex = nextIndex++;
			resultList[testIndex] = await runTestFile(testFileList[testIndex]);
			printResult(resultList[testIndex]);
		}
	}
	const workerList = [];
	for (let workerIndex = 0; workerIndex < parallelCount; workerIndex++) {
		workerList.push(runNext());
	}
	await Promise.all(workerList);
	return resultList;
}

function getRelativePath(testFilePath) {
	return path.relative(path.dirname(testsPath), testFilePath).split(path.sep).join("/");
}

function printResult(result) {
	const statusText = result.exitCode === 0 ? "통과" : "실패";
	console.log("[" + statusText + "] " + getRelativePath(result.testFilePath) + " (" + result.elapsedSeconds.toFixed(1) + " 초)");
	if (result.exitCode !== 0) {
		console.log(result.outputText.trim().split("\n").slice(-12).map((line) => "    " + line).join("\n"));
	}
}

const allTestFileList = findTestFileList(testsPath).filter((testFilePath) => {
	return filterTextList.length === 0 || filterTextList.some((filterText) => getRelativePath(testFilePath).includes(filterText));
});
const chromeTestFileList = allTestFileList.filter((testFilePath) => path.basename(testFilePath).includes("chrome"));
const nodeTestFileList = allTestFileList.filter((testFilePath) => !chromeTestFileList.includes(testFilePath));
const parallelCount = Math.max(1, Math.min(nodeTestFileList.length, os.availableParallelism ? os.availableParallelism() : os.cpus().length));

const resultList = await runTestFileList(nodeTestFileList, parallelCount);
if (isNodeOnly) {
	for (const testFilePath of chromeTestFileList) {
		console.log("[건너뜀] " + getRelativePath(testFilePath) + " (--node-only, 크롬 시험)");
	}
}
else {
	resultList.push(...await runTestFileList(chromeTestFileList, 1));
}

const failedResultList = resultList.filter((result) => result.exitCode !== 0);
const differenceLineList = [];
for (const result of resultList) {
	for (const line of result.outputText.split("\n")) {
		if (line.startsWith("두 엔진 차이")) {
			differenceLineList.push(getRelativePath(result.testFilePath) + ": " + line);
		}
	}
}
if (differenceLineList.length > 0) {
	console.log("\n두 엔진 차이 " + differenceLineList.length + " 건 (시험에서 건너뜀, 맞춘 뒤 check 로 바꾼다)");
	for (const differenceLine of differenceLineList) {
		console.log("  " + differenceLine);
	}
}
console.log("\n시험 " + resultList.length + " 개: 통과 " + (resultList.length - failedResultList.length) + ", 실패 " + failedResultList.length + (isNodeOnly ? ", 건너뜀 " + chromeTestFileList.length : ""));
process.exit(failedResultList.length > 0 ? 1 : 0);
