//==============================================================================
// 소리 읽기 방식의 크롬 시험. (NODE_PATH=$(npm root -g) node tests/core/audiostreamingchrome.test.mjs)
// - 헤드리스 크롬(puppeteer-core 와 시스템 크롬, 창을 띄우지 않고 소리를 내보내지 않는다)에서 통째로 풀기와 스트리밍이
//   AudioPlayer 로 같게 도는지 본다. (재생, 위치, 음량, 음소거, 위치 옮기기, 멈춤, 끝, 반복, 컨텍스트 멈춤, 빠르기)
//   소리 값은 AnalyserNode 로 잰다. (MediaElementAudioSourceNode 는 OfflineAudioContext 에 만들 수 없어 두 방식 모두 같은 실시간 컨텍스트로 잰다)
// - 자동 읽기가 크기로 고르는지, SoundSystem 의 배경음악이 스트리밍으로 나고 바꾸면 줄어드는지도 본다.
// - 크롬 경로는 CHROME_PATH 로 바꿀 수 있다. puppeteer-core 나 크롬이 없으면 실패한다. (말없이 건너뛰지 않는다)
//==============================================================================
const System = globalThis;
import fs from "node:fs";
import http from "node:http";
import path from "node:path";
import url from "node:url";
import { createRequire } from "node:module";
import { gotoPage } from "../chromepage.mjs";

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
		response.end("<!doctype html><title>audiostreaming</title>");
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
const browser = await puppeteer.launch({ executablePath, headless: true, args: ["--autoplay-policy=no-user-gesture-required", "--mute-audio"] });
let result = null;
try {
	const page = await browser.newPage();
	await gotoPage(page, "http://127.0.0.1:" + port + "/");
	result = await page.evaluate(async () => {
		const { AudioAsset, AudioLoadType, AudioPlayer, SoundSystem, Engine, EngineConfiguration } = await import("/import.js");
		const sleep = (milliseconds) => new Promise((resolve) => setTimeout(resolve, milliseconds));
		// 사인파 WAV (모노 16 비트 44100)
		const makeWav = (seconds, frequency, amplitude) => {
			const sampleRate = 44100;
			const frameCount = Math.round(seconds * sampleRate);
			const buffer = new ArrayBuffer(44 + frameCount * 2);
			const view = new DataView(buffer);
			const writeText = (offset, text) => {
				for (let index = 0; index < text.length; index++) {
					view.setUint8(offset + index, text.charCodeAt(index));
				}
			};
			writeText(0, "RIFF");
			view.setUint32(4, 36 + frameCount * 2, true);
			writeText(8, "WAVE");
			writeText(12, "fmt ");
			view.setUint32(16, 16, true);
			view.setUint16(20, 1, true);
			view.setUint16(22, 1, true);
			view.setUint32(24, sampleRate, true);
			view.setUint32(28, sampleRate * 2, true);
			view.setUint16(32, 2, true);
			view.setUint16(34, 16, true);
			writeText(36, "data");
			view.setUint32(40, frameCount * 2, true);
			for (let frame = 0; frame < frameCount; frame++) {
				view.setInt16(44 + frame * 2, Math.round(Math.sin(2 * Math.PI * frequency * frame / sampleRate) * amplitude * 32767), true);
			}
			return buffer;
		};
		const audioContext = new AudioContext();
		await audioContext.resume();
		const analyser = audioContext.createAnalyser();
		analyser.fftSize = 2048;
		const tapNode = audioContext.createGain();
		tapNode.connect(analyser);
		tapNode.connect(audioContext.destination);
		const readPeak = async (analyserNode) => {
			const samples = new Float32Array(analyserNode.fftSize);
			let peak = 0;
			for (let attempt = 0; attempt < 4; attempt++) {
				await sleep(40);
				analyserNode.getFloatTimeDomainData(samples);
				for (const sample of samples) {
					peak = Math.max(peak, Math.abs(sample));
				}
			}
			return peak;
		};
		const loadAsset = async (loadType, seconds) => {
			const audioAsset = new AudioAsset();
			audioAsset.setLoadType(loadType);
			await audioAsset.loadFromBytes(makeWav(seconds, 440, 0.5));
			return audioAsset;
		};
		const modeResult = {};
		for (const loadType of [AudioLoadType.decompressOnLoad, AudioLoadType.streaming]) {
			const record = {};
			const longAsset = await loadAsset(loadType, 2.0);
			const shortAsset = await loadAsset(loadType, 0.6);
			record.isStreaming = longAsset.isStreaming();
			record.hasBuffer = longAsset.getAudioBuffer() !== null;
			record.duration = longAsset.getDuration();
			const player = new AudioPlayer(audioContext, tapNode);
			player.setAudioAsset(longAsset);
			player.play(false);
			await sleep(400);
			record.playingAfterPlay = player.isPlaying();
			record.timeAfterPlay = player.getTime();
			record.peakFull = await readPeak(analyser);
			player.setVolume(0.5);
			await sleep(60);
			record.peakHalf = await readPeak(analyser);
			player.mute();
			await sleep(60);
			record.peakMuted = await readPeak(analyser);
			player.unmute();
			player.setVolume(1);
			player.setTime(1.2);
			await sleep(200);
			record.timeAfterSeek = player.getTime();
			player.stop();
			record.playingAfterStop = player.isPlaying();
			record.timeAfterStop = player.getTime();
			await sleep(60);
			record.peakStopped = await readPeak(analyser);
			player.setTime(0);
			player.setAudioAsset(shortAsset);
			player.play(false);
			await sleep(1100);
			record.playingAfterEnd = player.isPlaying();
			player.play(true);
			await sleep(1000);
			record.playingLoop = player.isPlaying();
			record.timeLoop = player.getTime();
			record.peakLoop = await readPeak(analyser);
			player.stop();
			player.setAudioAsset(longAsset);
			player.play(true);
			await sleep(300);
			await audioContext.suspend();
			await sleep(50);
			const suspendedTime = player.getTime();
			await sleep(400);
			record.suspendDrift = Math.abs(player.getTime() - suspendedTime);
			await audioContext.resume();
			await sleep(400);
			record.resumeAdvance = player.getTime() - suspendedTime;
			record.playingAfterResume = player.isPlaying();
			player.stop();
			player.setPlaybackRate(2);
			player.setTime(0);
			player.play(false);
			await sleep(500);
			record.timeRateTwo = player.getTime();
			player.stop();
			modeResult[loadType] = record;
		}
		// 한 플레이어에서 스트리밍과 통째로 풀기를 번갈아 튼다. (스트리밍 요소를 놓고 버퍼로, 다시 스트리밍으로)
		const mixedPlayer = new AudioPlayer(audioContext, tapNode);
		const mixedStreamAsset = await loadAsset(AudioLoadType.streaming, 2.0);
		const mixedBufferAsset = await loadAsset(AudioLoadType.decompressOnLoad, 2.0);
		const mixedPeakList = [];
		for (const mixedAsset of [mixedStreamAsset, mixedBufferAsset, mixedStreamAsset]) {
			mixedPlayer.setAudioAsset(mixedAsset);
			mixedPlayer.setTime(0);
			mixedPlayer.play(false);
			await sleep(200);
			mixedPeakList.push(await readPeak(analyser));
			mixedPlayer.stop();
			await sleep(60);
			mixedPeakList.push(await readPeak(analyser));
		}
		const automaticLong = await loadAsset(AudioLoadType.automatic, 13.0); // 모노 16 비트 13 초는 약 1.1 MiB
		const automaticShort = await loadAsset(AudioLoadType.automatic, 0.6);
		const unloadAsset = await loadAsset(AudioLoadType.streaming, 0.6);
		unloadAsset.unload();
		const unknownAsset = new AudioAsset();
		unknownAsset.setLoadType("nothing");

		// SoundSystem 배경음악. (스트리밍 애셋을 소리 표에 걸고 틀었다가 끈다)
		const engine = new Engine(new EngineConfiguration());
		const soundSystem = new SoundSystem(engine.getAudioManager(), [{ id: "music", isMusic: true, volume: 1 }]);
		soundSystem.addSoundAsset("music", await loadAsset(AudioLoadType.streaming, 3.0));
		soundSystem.update();
		const musicBus = soundSystem.getMusicBus();
		const musicContext = musicBus.getGainNode().context;
		await musicContext.resume();
		const musicAnalyser = musicContext.createAnalyser();
		musicAnalyser.fftSize = 2048;
		musicBus.getGainNode().connect(musicAnalyser);
		soundSystem.playMusic("music", 0);
		soundSystem.update();
		await sleep(400);
		const musicPeak = await readPeak(musicAnalyser);
		soundSystem.playMusic("", 0.1);
		soundSystem.update();
		await sleep(400);
		const musicPeakAfter = await readPeak(musicAnalyser);
		soundSystem.playMusic("music", 0, true);
		soundSystem.update();
		await sleep(300);
		const musicPeakResumed = await readPeak(musicAnalyser);
		soundSystem.playMusic("", 0);
		soundSystem.update();
		return {
			modeResult,
			mixedPeakList,
			automaticLongStreaming: automaticLong.isStreaming(),
			automaticShortStreaming: automaticShort.isStreaming(),
			unloadStreaming: unloadAsset.isStreaming(),
			unloadLoaded: unloadAsset.isLoaded(),
			unknownLoadType: unknownAsset.getLoadType(),
			defaultLoadType: new AudioAsset().getLoadType(),
			musicPeak,
			musicPeakAfter,
			musicPeakResumed,
		};
	});
}
finally {
	await browser.close();
	server.close();
}

const near = (value, expected, tolerance) => Math.abs(value - expected) <= tolerance;
for (const [loadType, record] of Object.entries(result.modeResult)) {
	const isStreamingMode = loadType === "streaming";
	check(record.isStreaming === isStreamingMode, loadType + " isStreaming " + record.isStreaming);
	check(record.hasBuffer === !isStreamingMode, loadType + " 버퍼 " + record.hasBuffer);
	check(near(record.duration, 2.0, 0.05), loadType + " 길이 " + record.duration);
	check(record.playingAfterPlay, loadType + " 틀면 재생 중");
	check(record.timeAfterPlay > 0.2 && record.timeAfterPlay < 0.8, loadType + " 흐르는 위치 " + record.timeAfterPlay);
	check(near(record.peakFull, 0.5, 0.05), loadType + " 음량 1 의 진폭 " + record.peakFull);
	check(near(record.peakHalf, 0.25, 0.04), loadType + " 음량 0.5 의 진폭 " + record.peakHalf);
	check(record.peakMuted < 0.01, loadType + " 음소거 진폭 " + record.peakMuted);
	check(record.timeAfterSeek > 1.2 && record.timeAfterSeek < 1.7, loadType + " 옮긴 위치 " + record.timeAfterSeek);
	check(record.playingAfterStop === false, loadType + " 멈추면 재생 아님");
	check(record.timeAfterStop === 1.2, loadType + " 멈춘 뒤 위치는 setTime 의 자리 " + record.timeAfterStop);
	check(record.peakStopped < 0.01, loadType + " 멈춘 뒤 진폭 " + record.peakStopped);
	check(record.playingAfterEnd === false, loadType + " 끝나면 재생 아님");
	check(record.playingLoop, loadType + " 반복은 끝나지 않음");
	check(record.timeLoop >= 0 && record.timeLoop < 0.6, loadType + " 반복 위치는 길이 안 " + record.timeLoop);
	check(record.peakLoop > 0.4, loadType + " 반복 중 진폭 " + record.peakLoop);
	check(record.suspendDrift < 0.06, loadType + " 컨텍스트가 멈추면 위치도 멈춤 " + record.suspendDrift);
	check(record.resumeAdvance > 0.2 && record.playingAfterResume, loadType + " 다시 돌면 이어 틂 " + record.resumeAdvance);
	check(record.timeRateTwo > 0.75 && record.timeRateTwo < 1.3, loadType + " 빠르기 2 의 위치 " + record.timeRateTwo);
}
for (let index = 0; index < result.mixedPeakList.length; index += 2) {
	check(near(result.mixedPeakList[index], 0.5, 0.05), "번갈아 틀기 " + index / 2 + " 진폭 " + result.mixedPeakList[index]);
	check(result.mixedPeakList[index + 1] < 0.01, "번갈아 틀기 " + index / 2 + " 멈춘 뒤 진폭 " + result.mixedPeakList[index + 1]);
}
check(result.automaticLongStreaming === true, "자동: 1 MiB 넘는 소리는 스트리밍");
check(result.automaticShortStreaming === false, "자동: 작은 소리는 통째로 풀기");
check(result.unloadStreaming === false && result.unloadLoaded === false, "내리면 스트리밍 주소를 놓음");
check(result.unknownLoadType === "decompressOnLoad", "모르는 읽기 방식은 decompressOnLoad");
check(result.defaultLoadType === "decompressOnLoad", "기본 읽기 방식은 decompressOnLoad");
check(near(result.musicPeak, 0.5, 0.06), "SoundSystem 스트리밍 배경음악 진폭 " + result.musicPeak);
check(result.musicPeakAfter < 0.01, "SoundSystem 배경음악을 끄면 조용 " + result.musicPeakAfter);
check(near(result.musicPeakResumed, 0.5, 0.06), "SoundSystem 배경음악 이어 틀기 " + result.musicPeakResumed);
console.log(JSON.stringify(result.modeResult));
console.log("audiostreamingchrome: 검사 " + checkCount + " 개 통과");
