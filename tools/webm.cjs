//==============================================================================
// 포함 모듈 목록.
//==============================================================================
const fs = require('fs');
const path = require('path');
const ffmpeg = require('fluent-ffmpeg');
const ffmpegPath = require('ffmpeg-static');


//==============================================================================
// 전역 상수 목록.
//==============================================================================
const AUDIO_EXTENSIONS = ['.mp3', '.wav', '.ogg', '.flac', '.aac', '.m4a', '.wma', '.opus', '.aiff', '.au'];


//==============================================================================
// 음원 파일 재귀 수집.
// - 지정된 디렉토리 하위의 모든 음원 파일 경로를 배열로 반환.
//==============================================================================
/**
 * @param {string} targetDirectory
 * @returns {string[]}
 */
function collectAudioFiles(targetDirectory) {
	const audioFiles = [];
	const entries = fs.readdirSync(targetDirectory);

	for (const entry of entries) {
		const entryPath = path.join(targetDirectory, entry);
		const entryStat = fs.statSync(entryPath);

		if (entryStat.isDirectory()) {
			const subFiles = collectAudioFiles(entryPath);
			for (const subFile of subFiles) {
				audioFiles.push(subFile);
			}
		}
		else {
			const entryExtension = path.extname(entry).toLowerCase();
			if (AUDIO_EXTENSIONS.includes(entryExtension)) {
				audioFiles.push(entryPath);
			}
		}
	}

	return audioFiles;
}


//==============================================================================
// 단일 음원 파일 webm 변환.
// - 입력 파일을 libopus 코덱의 webm 형식으로 변환 후 동일 경로에 저장.
//==============================================================================
/**
 * @param {string} inputFilePath
 * @returns {Promise<void>}
 */
function convertToWebm(inputFilePath) {
	return new Promise((resolve, reject) => {
		const outputFilePath = path.join(
			path.dirname(inputFilePath),
			path.basename(inputFilePath, path.extname(inputFilePath)) + '.webm'
		);

		ffmpeg(inputFilePath)
			.audioCodec('libopus')
			.format('webm')
			.on('end', () => {
				console.log(`[ConvertWebm] 완료: ${inputFilePath} → ${path.basename(outputFilePath)}`);
				resolve();
			})
			.on('error', (error) => {
				console.error(`[ConvertWebm] 오류: ${inputFilePath} - ${error.message}`);
				reject(error);
			})
			.save(outputFilePath);
	});
}


//==============================================================================
// 디렉토리 하위 전체 음원 변환.
// - 수집된 음원 파일을 순차적으로 webm 변환.
//==============================================================================
/**
 * @param {string} targetDirectory
 */
async function convertAllToWebm(targetDirectory) {
	if (!fs.existsSync(targetDirectory) || !fs.statSync(targetDirectory).isDirectory()) {
		console.error(`[ConvertWebm] 오류: 입력 폴더가 존재하지 않거나 폴더가 아닙니다: ${targetDirectory}`);
		process.exit(1);
	}

	const audioFiles = collectAudioFiles(targetDirectory);

	if (audioFiles.length === 0) {
		console.log('[ConvertWebm] 변환할 음원 파일이 없습니다.');
		return;
	}

	console.log(`[ConvertWebm] 총 ${audioFiles.length}개 파일 변환 시작...`);

	for (const audioFile of audioFiles) {
		try {
			await convertToWebm(audioFile);
		}
		catch (error) {
			console.error(`[ConvertWebm] 건너뜀: ${audioFile}`);
		}
	}

	console.log('[ConvertWebm] 모든 변환 완료.');
}


//==============================================================================
// 진입점.
//==============================================================================
function main() {
	const args = process.argv.slice(2);

	if (args.length === 0) {
		console.log('[ConvertWebm] 사용법: node webm.cjs <폴더경로>');
		process.exit(1);
	}

	// fluent-ffmpeg, ffmpeg-static 패키지 로드 가능 여부 사전 체크
	try {
		require.resolve('fluent-ffmpeg');
		require.resolve('ffmpeg-static');
	}
	catch (error) {
		console.error("[ConvertWebm] 오류: 필수 패키지가 설치되어 있지 않습니다.");
		console.error("다음 명령어를 실행하여 패키지를 설치해주세요: npm install fluent-ffmpeg ffmpeg-static");
		process.exit(1);
	}

	ffmpeg.setFfmpegPath(ffmpegPath);

	const targetDirectory = path.resolve(args[0]);

	convertAllToWebm(targetDirectory).catch((error) => {
		console.error('[ConvertWebm] 오류: 작업 중 예기치 않은 오류가 발생했습니다:', error);
	});
}

main();
