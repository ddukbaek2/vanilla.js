#!/usr/bin/env node
//==============================================================================
// 엔진 묶음 짓기. (build/vanilla.js, build/vanilla.js.map, build/vanilla.min.js)
//
// 사용법:
//   node tools/bundle.cjs
//
// - build/vanilla.js 는 읽는 판이다. 줄과 들여쓰기는 남기고 주석은 뺀다. 원래 소스와 주석은 소스 맵(vanilla.js.map)에 다 든다.
//   esbuild 는 줄이지 않은 묶음에 소스의 주석을 그대로 남긴다. (0.4.0 은 주석이 묶음의 40% 쯤이라 브라우저가 묶음을 읽는 시간이 는다)
//   그래서 공백만 줄여 주석을 뺀 묶음을 build 안의 임시 폴더에 짓고, 그것을 esbuild 로 한 번 더 펴서 쓴다. (두 번째 걸음은 첫 묶음의 소스 맵을 읽어 원래 소스로 잇는다)
// - build/vanilla.min.js 는 줄인 판이다. (--minify, 이름은 --keep-names 로 지킨다)
// - 두 판 다 머리의 /*! */ 한 줄이 엔진 라이선스와 제3자 고지 파일을 가리킨다.
// - esbuild 가 PATH 에 있어야 한다. (npm install -g esbuild)
//==============================================================================
'use strict';
const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const ROOT_DIRECTORY = path.resolve(__dirname, '..');
const BUILD_DIRECTORY = path.join(ROOT_DIRECTORY, 'build');
const ENTRY_FILE = path.join(ROOT_DIRECTORY, 'import.js');
const BANNER = '/*! vanilla.js | (c) 2026 vanillapunch | MIT License | https://github.com/ddukbaek2/vanilla.js/blob/release/LICENSE | Third-party notices: https://github.com/ddukbaek2/vanilla.js/blob/release/THIRD_PARTY_LICENSES.md */';


//==============================================================================
// esbuild 부르기. (인자는 큰따옴표로 감싸 넘긴다, 셸이 있는 모든 운영체제에서 같다)
//==============================================================================
function runEsbuild(argumentList) {
	const command = 'esbuild ' + argumentList.map((argument) => '"' + argument + '"').join(' ');
	execSync(command, { stdio: 'inherit', cwd: ROOT_DIRECTORY });
}


//==============================================================================
// 읽는 판 짓기. (주석을 뺀 묶음을 펴서 쓴다, 소스 맵은 원래 소스로 잇는다)
// - 임시 폴더를 build 안에 두어 소스 맵의 소스 경로가 build/vanilla.js 에서 본 상대 경로(../src/...)가 되게 한다.
//==============================================================================
function buildReadableBundle() {
	const stageDirectory = fs.mkdtempSync(path.join(BUILD_DIRECTORY, '.stage-'));
	try {
		const stageFile = path.join(stageDirectory, 'vanilla.js');
		runEsbuild([ENTRY_FILE, '--bundle', '--format=esm', '--keep-names', '--minify-whitespace', '--sourcemap', '--log-level=warning', '--outfile=' + stageFile]);
		runEsbuild([stageFile, '--format=esm', '--sourcemap', '--log-level=warning', '--banner:js=' + BANNER, '--outfile=' + path.join(BUILD_DIRECTORY, 'vanilla.js')]);
	}
	finally {
		fs.rmSync(stageDirectory, { recursive: true, force: true });
	}
}


//==============================================================================
// 줄인 판 짓기.
//==============================================================================
function buildMinifiedBundle() {
	runEsbuild([ENTRY_FILE, '--bundle', '--format=esm', '--minify', '--keep-names', '--log-level=warning', '--banner:js=' + BANNER, '--outfile=' + path.join(BUILD_DIRECTORY, 'vanilla.min.js')]);
}


//==============================================================================
// 진입.
//==============================================================================
fs.mkdirSync(BUILD_DIRECTORY, { recursive: true });
buildReadableBundle();
buildMinifiedBundle();
for (const fileName of ['vanilla.js', 'vanilla.js.map', 'vanilla.min.js']) {
	const filePath = path.join(BUILD_DIRECTORY, fileName);
	console.log(fileName + ' ' + fs.statSync(filePath).size + ' bytes');
}
