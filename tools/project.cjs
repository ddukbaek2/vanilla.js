#!/usr/bin/env node
//==============================================================================
// 프로젝트 도구. (빌드 / 자산 현황 체크)
//
// 사용법:
//   node tools/project build --script <진입파일> --input <입력디렉토리> --output <출력디렉토리>
//   node tools/project check --input <입력디렉토리>
//
// 서브커맨드:
//   build    <입력>/tools/buildtemplate + <입력>/assets 를 <출력>으로 복사 후 esbuild 번들링.
//   check    <입력>/assets/sprites 하위 이미지/아틀라스 자산 현황을 리포트로 출력.
//
// 예시:
//   node tools/project build --script main.js --input . --output build/web
//   node tools/project check --input .
//==============================================================================
'use strict';
const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');


//==============================================================================
// 디렉토리 락 해제 대기 (임시 이름 변경을 통한 물리적 락 해제 확인)
//==============================================================================
async function waitUntilUnlocked(targetPath, maxRetries = 50, intervalMs = 200) {
    const tempPath = targetPath + '_temp_lock_check';
    for (let attempt = 0; attempt < maxRetries; attempt++) {
        try {
            fs.renameSync(targetPath, tempPath);
            fs.renameSync(tempPath, targetPath);
            return;
        }
        catch (error) {
            if (error.code !== 'EPERM' && error.code !== 'EBUSY' && error.code !== 'ENOENT') {
                throw error;
            }
            await new Promise(resolve => setTimeout(resolve, intervalMs));
        }
    }
}

//==============================================================================
// 읽기전용 해제.
//==============================================================================
function removeReadOnlyRecursive(targetPath) {
    if (!fs.existsSync(targetPath)) {
        return;
    }

	const stats = fs.statSync(targetPath);

    if (stats.isDirectory()) {
        fs.chmodSync(targetPath, 0o777);
        const entries = fs.readdirSync(targetPath);
        for (const entry of entries) {
            removeReadOnlyRecursive(path.join(targetPath, entry));
        }
    }
	else {
        fs.chmodSync(targetPath, 0o666);
    }
}

//==============================================================================
// 디렉토리를 재귀적으로 복사.
//==============================================================================
function copyDir(src, dest) {
	if (!fs.existsSync(src)) {
		return;
	}
	fs.mkdirSync(dest, { recursive: true });
	const entries = fs.readdirSync(src, { withFileTypes: true });
	for (const entry of entries) {
		const srcPath = path.join(src, entry.name);
		const destPath = path.join(dest, entry.name);
		if (entry.isDirectory()) {
			if (entry.name === '.buildignore') {
				continue;
			}
			copyDir(srcPath, destPath);
		}
		else {
			fs.copyFileSync(srcPath, destPath);
		}
	}
}

//==============================================================================
// 특정 확장자 파일만 복사. (재귀 없음, 단일 디렉토리)
//==============================================================================
function copyFilesByExtension(src, dest, ext) {
	if (!fs.existsSync(src)) {
		return 0;
	}
	fs.mkdirSync(dest, { recursive: true });
	const entries = fs.readdirSync(src, { withFileTypes: true });
	let count = 0;
	for (const entry of entries) {
		if (entry.isFile() && entry.name.endsWith(ext)) {
			fs.copyFileSync(path.join(src, entry.name), path.join(dest, entry.name));
			count++;
		}
	}
	return count;
}

//==============================================================================
// 메인 빌드.
//==============================================================================
async function build(script, input, output) {
	const inputDir = path.resolve(input);
	const outputDir = path.resolve(output);

	console.log(`빌드 시작`);
	console.log(`진입 파일: ${script}`);
	console.log(`입력 디렉토리: ${inputDir}`);
	console.log(`출력 디렉토리: ${outputDir}\n`);

	// 출력 디렉토리 초기화 (기존 내용 제거 후 재생성).
	if (fs.existsSync(outputDir)) {
		fs.rmSync(outputDir, { recursive: true, force: true });
	}
	fs.mkdirSync(outputDir, { recursive: true });

	// 1. <입력>/tools/buildtemplate 복사.
	const templateSrc = path.join(inputDir, 'tools', 'buildtemplate');
	if (fs.existsSync(templateSrc)) {
		copyDir(templateSrc, outputDir);
		console.log(`[1] 템플릿 복사 완료: ${templateSrc} -> ${outputDir}`);
	}
	else {
		console.warn(`[1] 템플릿 없음 (건너뜀): ${templateSrc}`);
	}

	// 2. <입력>/assets 전체 복사.
	const assetsSrc = path.join(inputDir, 'assets');
	const assetsDest = path.join(outputDir, 'assets');
	if (fs.existsSync(assetsSrc)) {
		copyDir(assetsSrc, assetsDest);
		console.log(`[2] 리소스 복사 완료: ${assetsSrc} -> ${assetsDest}`);
	}
	else {
		console.warn(`[2] 리소스 없음 (건너뜀): ${assetsSrc}`);
	}

	// 3. esbuild 번들링.
	const entryFile = path.resolve(inputDir, script);
	const bundleDest = path.join(outputDir, 'js', 'bundle.min.js');

	if (!fs.existsSync(entryFile)) {
		console.error(`[3] 진입 파일 없음: ${entryFile}`);
		process.exit(1);
	}

	fs.mkdirSync(path.dirname(bundleDest), { recursive: true });
	const esbuildCommand = `esbuild ${entryFile} --bundle --outfile=${bundleDest} --format=iife --minify`;
	console.log(`[3] esbuild 실행 중...`);
	console.log(`    ${esbuildCommand}`);
	execSync(esbuildCommand, { stdio: 'inherit' });
	console.log(`[3] 번들 완료: ${bundleDest}`);

	console.log(`\n빌드 완료: ${outputDir}`);
}


//==============================================================================
// 스테이지. 소스 디렉토리 전체를 대상 디렉토리로 복사한다.
// - 대상 디렉토리가 이미 존재하면 삭제 후 재생성한다.
// - skipTopLevel 로 지정된 최상위 항목은 건너뛴다.
//==============================================================================
/**
 * @param {string} source
 * @param {string} destination
 * @param {string[] | null} skipTopLevel
 */
function stage(source, destination, skipTopLevel) {
	const sourceDir = path.resolve(source);
	const destinationDir = path.resolve(destination);

	if (!fs.existsSync(sourceDir)) {
		console.error(`[stage] 소스 디렉토리가 없습니다: ${sourceDir}`);
		process.exit(1);
	}

	// 대상 디렉토리 초기화.
	if (fs.existsSync(destinationDir)) {
		fs.rmSync(destinationDir, { recursive: true, force: true });
	}
	fs.mkdirSync(destinationDir, { recursive: true });

	// skipTopLevel 목록에 없는 항목만 복사.
	const skipSet = skipTopLevel && skipTopLevel.length > 0 ? new Set(skipTopLevel) : null;
	const entries = fs.readdirSync(sourceDir, { withFileTypes: true });
	for (const entry of entries) {
		if (skipSet && skipSet.has(entry.name)) {
			continue;
		}
		const srcPath = path.join(sourceDir, entry.name);
		const destPath = path.join(destinationDir, entry.name);
		if (entry.isDirectory()) {
			copyDir(srcPath, destPath);
		}
		else {
			fs.copyFileSync(srcPath, destPath);
		}
	}

	console.log(`[stage] 복사 완료: ${sourceDir} -> ${destinationDir}`);
}


//==============================================================================
// 자산 현황 체크 상수.
//==============================================================================
const LARGE_TEXTURE_THRESHOLD = 512; // 이 픽셀 초과 시 경고 표시
const IMAGE_EXTENSIONS = ['.png', '.jpg', '.jpeg'];


//==============================================================================
// 바이트를 읽기 좋은 단위로 변환.
//==============================================================================
/**
 * @param {number} bytes
 * @returns {string}
 */
function formatBytes(bytes) {
	if (bytes < 1024) {
		return `${bytes} B`;
	}
	else if (bytes < 1024 * 1024) {
		const kilobytes = (bytes / 1024).toFixed(1);
		return `${kilobytes} KB`;
	}
	else {
		const megabytes = (bytes / (1024 * 1024)).toFixed(2);
		return `${megabytes} MB`;
	}
}


//==============================================================================
// 디렉토리를 재귀적으로 탐색하여 이미지 파일 경로 목록 반환.
// - .buildignore 폴더는 제외.
//==============================================================================
/**
 * @param {string} directory
 * @param {string[]} result
 * @returns {string[]}
 */
function collectImageFiles(directory, result) {
	if (!result) {
		result = [];
	}

	const entries = fs.readdirSync(directory, { withFileTypes: true });
	for (const entry of entries) {
		if (entry.isDirectory()) {
			if (entry.name === '.buildignore') {
				continue;
			}
			const subdirectory = path.join(directory, entry.name);
			collectImageFiles(subdirectory, result);
		}
		else {
			const extension = path.extname(entry.name).toLowerCase();
			const isImage = IMAGE_EXTENSIONS.includes(extension);
			if (isImage) {
				result.push(path.join(directory, entry.name));
			}
		}
	}

	return result;
}


//==============================================================================
// 게임 이름 추출.
// - sprites/ 바로 아래 폴더 이름을 게임 이름으로 사용.
// - sprites/ 루트에 직접 위치한 파일은 '(공통)' 으로 분류.
//==============================================================================
/**
 * @param {string} fileFullPath
 * @param {string} spritesDirectory
 * @returns {string}
 */
function extractGameName(fileFullPath, spritesDirectory) {
	const relativePath = path.relative(spritesDirectory, fileFullPath);
	const segments = relativePath.split(path.sep);
	if (segments.length === 1) {
		return '(공통)';
	}
	return segments[0];
}


//==============================================================================
// 이미지 정보 수집.
//==============================================================================
/**
 * @param {string[]} imageFilePaths
 * @param {string} spritesDirectory
 * @returns {Promise<Object[]>}
 */
async function collectImageInfoList(imageFilePaths, spritesDirectory) {
	const { loadImage } = require('canvas');
	const imageInfoList = [];

	for (const imageFilePath of imageFilePaths) {
		const stat = fs.statSync(imageFilePath);
		const fileSize = stat.size;

		let imageWidth = 0;
		let imageHeight = 0;
		try {
			const image = await loadImage(imageFilePath);
			imageWidth = image.width;
			imageHeight = image.height;
		}
		catch (error) {
			console.warn(`  [경고] 이미지 로드 실패: ${imageFilePath}`);
		}

		const gameName = extractGameName(imageFilePath, spritesDirectory);
		const relativePath = path.relative(spritesDirectory, imageFilePath);
		const isLarge = imageWidth > LARGE_TEXTURE_THRESHOLD || imageHeight > LARGE_TEXTURE_THRESHOLD;

		imageInfoList.push({
			gameName: gameName,
			relativePath: relativePath,
			fileFullPath: imageFilePath,
			fileSize: fileSize,
			imageWidth: imageWidth,
			imageHeight: imageHeight,
			isLarge: isLarge
		});
	}

	return imageInfoList;
}


//==============================================================================
// 아틀라스 JSON 파일 목록 수집.
//==============================================================================
/**
 * @param {string} spritesDirectory
 * @returns {Object[]}
 */
function collectAtlasInfoList(spritesDirectory) {
	const atlasInfoList = [];

	const gameEntries = fs.readdirSync(spritesDirectory, { withFileTypes: true });
	for (const gameEntry of gameEntries) {
		if (!gameEntry.isDirectory()) {
			continue;
		}

		const gameName = gameEntry.name;
		const gameDirectory = path.join(spritesDirectory, gameName);
		const fileEntries = fs.readdirSync(gameDirectory, { withFileTypes: true });

		for (const fileEntry of fileEntries) {
			if (fileEntry.isDirectory()) {
				continue;
			}

			const extension = path.extname(fileEntry.name).toLowerCase();
			if (extension !== '.json') {
				continue;
			}

			const jsonFilePath = path.join(gameDirectory, fileEntry.name);
			let atlasData = null;
			try {
				const jsonText = fs.readFileSync(jsonFilePath, 'utf-8');
				atlasData = JSON.parse(jsonText);
			}
			catch (error) {
				continue;
			}

			const isAtlas = atlasData && atlasData.meta && atlasData.images;
			if (!isAtlas) {
				continue;
			}

			atlasInfoList.push({
				gameName: gameName,
				fileName: fileEntry.name,
				atlasWidth: atlasData.meta.width,
				atlasHeight: atlasData.meta.height,
				frameCount: atlasData.meta.count
			});
		}
	}

	return atlasInfoList;
}


//==============================================================================
// 현황 출력.
//==============================================================================
/**
 * @param {Object[]} imageInfoList
 * @param {Object[]} atlasInfoList
 */
function printReport(imageInfoList, atlasInfoList) {
	// 게임별 그룹화
	const gameMap = {};
	for (const imageInfo of imageInfoList) {
		const gameName = imageInfo.gameName;
		if (!gameMap[gameName]) {
			gameMap[gameName] = [];
		}
		gameMap[gameName].push(imageInfo);
	}

	// 아틀라스 게임별 그룹화
	const atlasMap = {};
	for (const atlasInfo of atlasInfoList) {
		const gameName = atlasInfo.gameName;
		if (!atlasMap[gameName]) {
			atlasMap[gameName] = [];
		}
		atlasMap[gameName].push(atlasInfo);
	}

	const separatorLine = '='.repeat(72);
	const thinSeparatorLine = '-'.repeat(72);

	console.log('');
	console.log(separatorLine);
	console.log(' 프로젝트 자산 현황 리포트');
	console.log(separatorLine);

	let totalImageCount = 0;
	let totalFileSize = 0;
	let totalLargeCount = 0;

	const gameNames = Object.keys(gameMap).sort();
	for (const gameName of gameNames) {
		const gameImageInfoList = gameMap[gameName];
		const gameAtlasInfoList = atlasMap[gameName] || [];

		const gameImageCount = gameImageInfoList.length;
		const gameFileSize = gameImageInfoList.reduce((sum, info) => sum + info.fileSize, 0);
		const gameLargeCount = gameImageInfoList.filter(info => info.isLarge).length;

		totalImageCount += gameImageCount;
		totalFileSize += gameFileSize;
		totalLargeCount += gameLargeCount;

		console.log('');
		console.log(`[ ${gameName} ]  이미지 ${gameImageCount}개  /  ${formatBytes(gameFileSize)}`);
		console.log(thinSeparatorLine);

		// 이미지 목록
		for (const imageInfo of gameImageInfoList) {
			const sizeText = `${imageInfo.imageWidth}x${imageInfo.imageHeight}`;
			const fileSizeText = formatBytes(imageInfo.fileSize);
			const warningMark = imageInfo.isLarge ? ' !' : '  ';
			const relativePath = imageInfo.relativePath;
			const paddedSizeText = sizeText.padStart(10);
			const paddedFileSizeText = fileSizeText.padStart(8);
			console.log(`  ${warningMark} ${paddedSizeText}  ${paddedFileSizeText}  ${relativePath}`);
		}

		// 아틀라스 목록
		if (gameAtlasInfoList.length > 0) {
			console.log('');
			console.log('  [아틀라스]');
			for (const atlasInfo of gameAtlasInfoList) {
				const atlasSizeText = `${atlasInfo.atlasWidth}x${atlasInfo.atlasHeight}`;
				const frameText = `${atlasInfo.frameCount}프레임`;
				console.log(`    ${atlasInfo.fileName.padEnd(24)} ${atlasSizeText.padStart(10)}  ${frameText}`);
			}
		}
	}

	// 전체 합산
	console.log('');
	console.log(separatorLine);
	console.log(' 전체 합산');
	console.log(thinSeparatorLine);
	console.log(`  총 이미지 수  : ${totalImageCount}개`);
	console.log(`  총 파일 크기  : ${formatBytes(totalFileSize)}`);
	console.log(`  총 아틀라스   : ${atlasInfoList.length}개`);
	if (totalLargeCount > 0) {
		console.log(`  대형 텍스처   : ${totalLargeCount}개  (! 표시, ${LARGE_TEXTURE_THRESHOLD}px 초과)`);
	}
	console.log(separatorLine);
	console.log('');
}


//==============================================================================
// 프로젝트 자산 현황 체크.
//==============================================================================
/**
 * @param {string} input
 */
async function check(input) {
	// canvas 패키지 로드 가능 여부 사전 체크
	try {
		require.resolve('canvas');
	}
	catch (error) {
		console.error("[ProjectChecker] 오류: 'canvas' 패키지가 설치되어 있지 않습니다.");
		console.error("다음 명령어를 실행하여 패키지를 설치해주세요: npm install canvas");
		process.exit(1);
	}

	const inputDir = path.resolve(input);
	const spritesDirectory = path.join(inputDir, 'assets', 'sprites');

	if (!fs.existsSync(spritesDirectory)) {
		console.error(`[ProjectChecker] 오류: sprites 폴더를 찾을 수 없습니다: ${spritesDirectory}`);
		process.exit(1);
	}

	console.log('[ProjectChecker] 이미지 파일을 스캔하는 중...');

	const imageFilePaths = collectImageFiles(spritesDirectory, []);
	const imageInfoList = await collectImageInfoList(imageFilePaths, spritesDirectory);
	const atlasInfoList = collectAtlasInfoList(spritesDirectory);

	printReport(imageInfoList, atlasInfoList);
}


//==============================================================================
// CLI 인자 파싱.
//==============================================================================
function parseArgs(argv) {
	const args = argv.slice(2);
	const subcommand = args[0] || null;
	let script = null;
	let input = null;
	let output = null;
	let source = null;
	let destination = null;
	let skip = null;

	for (let i = 1; i < args.length; i++) {
		if (args[i] === '--script') {
			script = args[++i];
		}
		else if (args[i] === '--input') {
			input = args[++i];
		}
		else if (args[i] === '--output') {
			output = args[++i];
		}
		else if (args[i] === '--source') {
			source = args[++i];
		}
		else if (args[i] === '--destination') {
			destination = args[++i];
		}
		else if (args[i] === '--skip') {
			skip = args[++i];
		}
	}

	return { subcommand, script, input, output, source, destination, skip };
}

//==============================================================================
// 사용법 출력.
//==============================================================================
function printUsage() {
	console.log('사용법:');
	console.log('  node tools/project build --script <진입파일> --input <입력디렉토리> --output <출력디렉토리>');
	console.log('  node tools/project check --input <입력디렉토리>');
	console.log('  node tools/project stage --source <소스디렉토리> --destination <대상디렉토리> [--skip <파일1,파일2,...>]');
}

//==============================================================================
// 모듈 export. (상위 프로젝트의 특수화 도구에서 재사용)
//==============================================================================
module.exports = { waitUntilUnlocked, removeReadOnlyRecursive, copyDir, copyFilesByExtension, build, stage, check };

//==============================================================================
// CLI 진입점.
//==============================================================================
if (require.main === module) {
	const { subcommand, script, input, output, source, destination, skip } = parseArgs(process.argv);

	if (subcommand === 'build') {
		if (!script || !input || !output) {
			printUsage();
			process.exit(1);
		}
		build(script, input, output);
	}
	else if (subcommand === 'check') {
		if (!input) {
			printUsage();
			process.exit(1);
		}
		check(input).catch(error => {
			console.error('[ProjectChecker] 오류: 작업 중 예기치 않은 오류가 발생했습니다:', error);
		});
	}
	else if (subcommand === 'stage') {
		if (!source || !destination) {
			printUsage();
			process.exit(1);
		}
		const skipTopLevel = skip ? skip.split(',').map(value => value.trim()).filter(value => value.length > 0) : null;
		stage(source, destination, skipTopLevel);
	}
	else {
		printUsage();
		process.exit(1);
	}
}
