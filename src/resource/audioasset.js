//==============================================================================
// 포함 모듈 목록.
//==============================================================================
const System = globalThis;
import { Asset, AssetType } from "../core/asset.js";


// OfflineAudioContext 로 디코딩할 때의 샘플레이트. (재생하는 AudioContext 의 샘플레이트가 다르면 재생할 때 맞춰진다)
const DECODE_SAMPLE_RATE = 44100;

// 자동(AudioLoadType.automatic)일 때 스트리밍으로 고르는 파일 크기. (바이트, 이보다 크면 스트리밍)
// - 통째로 풀면 1 초에 채널마다 44100 개의 float32 를 든다. (스테레오 1 초 약 345 KiB, 3 분이면 약 61 MiB)
//   128 kbps MP3 1 MiB 는 약 65 초라 풀면 약 22 MiB 다. 효과음은 거의 이보다 작고, 이보다 큰 WAV 도 6 초 안팎이라 흘려 틀어도 된다.
export const AUTOMATIC_STREAMING_BYTE_THRESHOLD = 1024 * 1024;


//==============================================================================
// 소리 읽기 방식. (유니티 AudioClip 의 Load Type, 언리얼 사운드 웨이브의 스트리밍과 같은 갈래)
//==============================================================================
/**
 * @example <caption>배경음은 스트리밍, 효과음은 통째로 풀기</caption>
 * import { AudioAsset, AudioLoadType } from "./build/vanilla.js";
 *
 * const musicAsset = new AudioAsset();
 * musicAsset.setLoadType(AudioLoadType.streaming);
 * await musicAsset.load("examples/assets/beep.wav");
 * const effectAsset = new AudioAsset();
 * effectAsset.setLoadType(AudioLoadType.decompressOnLoad);
 * await effectAsset.load("examples/assets/beep.wav");
 * console.log(musicAsset.isStreaming(), musicAsset.getAudioBuffer(), effectAsset.isStreaming(), effectAsset.getDuration());
 */
export const AudioLoadType = System.Object.freeze({
	automatic: "automatic", // 크기를 보고 고른다. (AUTOMATIC_STREAMING_BYTE_THRESHOLD 보다 큰 파일은 스트리밍, 아니면 통째로 풀기, 고른 애셋만)
	decompressOnLoad: "decompressOnLoad", // 읽을 때 PCM 으로 통째로 푼다. (효과음처럼 짧고 자주 겹쳐 트는 소리, 시작이 바로이고 겹쳐 틀어도 싸다, 기본)
	streaming: "streaming", // 풀지 않고 미디어 요소(HTMLAudioElement)가 조금씩 풀어 흘린다. (배경음처럼 긴 소리, 메모리는 압축된 파일 크기 이하)
});


//==============================================================================
// 오디오 애셋.
//==============================================================================
/**
 * 읽기 방식(setLoadType)이 통째로 풀기면 오디오 버퍼(getAudioBuffer)를 들고, 스트리밍이면 미디어 요소가 틀 주소(getStreamUrl)만 든다.
 * 어느 쪽이든 AudioPlayer 와 SoundSystem 이 같은 꼴로 튼다. (재생, 멈춤, 반복, 음량, 위치, 끝)
 * @example <caption>소리 파일 읽고 길이 보기</caption>
 * import { AudioAsset } from "./build/vanilla.js";
 *
 * const audioAsset = new AudioAsset();
 * await audioAsset.load("examples/assets/beep.wav");
 * const audioBuffer = audioAsset.getAudioBuffer();
 * console.log(audioAsset.getDuration(), audioBuffer.sampleRate, audioAsset.getLoadError());
 */
export class AudioAsset extends Asset {
	//==============================================================================
	// 멤버 변수 목록.
	//==============================================================================
	/** @private @type { AudioBuffer | null } */ #audioBuffer;
	/** @private @type { string | null } */ #loadError; // 마지막 읽기 실패의 까닭. (없으면 null)
	/** @private @type { string } */ #loadType; // 읽기 방식. (AudioLoadType, 다음 읽기부터)
	/** @private @type { string | null } */ #streamUrl; // 스트리밍으로 읽었으면 미디어 요소가 틀 주소. (파일 경로나 blob: 주소, 아니면 null)
	/** @private @type { boolean } */ #isStreamUrlOwned; // 그 주소가 이 애셋이 만든 blob: 주소인지. (내릴 때 놓는다)
	/** @private @type { number } */ #streamDuration; // 스트리밍 소리의 길이. (초, 메타데이터에서)

	//==============================================================================
	// 생성.
	//==============================================================================
	constructor() {
		super();
		this.setAssetType(AssetType.audio);
		this.#audioBuffer = null;
		this.#loadError = null;
		this.#loadType = AudioLoadType.decompressOnLoad;
		this.#streamUrl = null;
		this.#isStreamUrlOwned = false;
		this.#streamDuration = 0;
	}

	//==============================================================================
	// 읽기 방식 설정. (다음 load, loadFromBytes 부터, 이미 읽혔으면 unload 뒤에 다시 읽어야 바뀐다)
	//==============================================================================
	/**
	 * @param { string } loadType 읽기 방식. (AudioLoadType 의 값, 모르는 값이면 decompressOnLoad)
	 * @example <caption>긴 배경음을 스트리밍으로 읽기</caption>
	 * import { AudioAsset, AudioLoadType } from "./build/vanilla.js";
	 *
	 * const audioAsset = new AudioAsset();
	 * audioAsset.setLoadType(AudioLoadType.streaming);
	 * await audioAsset.load("examples/assets/beep.wav");
	 * console.log(audioAsset.getLoadType(), audioAsset.isStreaming(), audioAsset.getDuration());
	 */
	setLoadType(loadType) {
		const isKnown = System.Object.values(AudioLoadType).includes(loadType);
		this.#loadType = isKnown ? loadType : AudioLoadType.decompressOnLoad;
	}

	//==============================================================================
	// 읽기 방식 반환.
	//==============================================================================
	/**
	 * @returns { string } 읽기 방식. (AudioLoadType 의 값, 기본 decompressOnLoad, 실기기(아이폰, 아이패드 사파리)에서 확인한 뒤 배경음 기본을 streaming 으로 바꿀 예정)
	 */
	getLoadType() {
		return this.#loadType;
	}

	//==============================================================================
	// 스트리밍으로 읽혔는지. (읽기 방식이 automatic 이면 읽은 뒤에 정해진다)
	//==============================================================================
	/**
	 * @returns { boolean } 스트리밍으로 읽혔으면 참. (통째로 풀었거나 읽기 전이면 거짓)
	 */
	isStreaming() {
		return this.#streamUrl !== null;
	}

	//==============================================================================
	// 스트리밍 소리의 주소. (미디어 요소의 src 로 쓴다)
	//==============================================================================
	/**
	 * @returns { string | null } 파일 경로나 blob: 주소. (스트리밍이 아니면 null)
	 */
	getStreamUrl() {
		return this.#streamUrl;
	}

	//==============================================================================
	// 비동기 애셋 로드.
	//==============================================================================
	/**
	 * @override
	 * @param { string } assetPath 소리 파일 경로. (이미 읽혔으면 아무것도 하지 않는다)
	 * @returns { Promise<void> } 다 읽으면 풀리는 프로미스. (받기나 디코딩이 실패하면 getLoadError 에 까닭을 남기고 거부된다, 디코딩할 수 없는 환경이면 까닭만 남기고 풀린다)
	 */
	async load(assetPath) {
		// 이미 로드 된 상태라면.
		const isLoaded = this.isLoaded();
		if (isLoaded) {
			return Promise.resolve();
		}

		this.#loadError = null;
		if (!isAudioDecodingSupported()) {
			this.#loadError = "AudioContext is not supported.";
			console.error(`AudioContext is not supported.`);
			return;
		}

		try {
			const loadType = this.getLoadType();
			// 스트리밍이면 받지 않고 미디어 요소가 그 경로에서 조금씩 받는다.
			if (loadType === AudioLoadType.streaming) {
				await this.openStream(assetPath, false);
				return;
			}
			const response = await System.fetch(assetPath);
			// 실패 응답(404 등)은 디코딩 전에 실패로 친다.
			if (!response.ok) {
				throw new System.Error(`HTTP ${response.status}`);
			}
			// 자동이면 머리의 크기로 먼저 가린다. (크면 몸을 받지 않고 그 경로를 흘려 튼다)
			if (loadType === AudioLoadType.automatic) {
				const contentLength = System.Number(response.headers.get("Content-Length"));
				if (contentLength > AUTOMATIC_STREAMING_BYTE_THRESHOLD) {
					if (response.body) {
						response.body.cancel().catch(() => {
							return;
						});
					}
					await this.openStream(assetPath, false);
					return;
				}
			}
			const arrayBuffer = await response.arrayBuffer();
			await this.openBytes(arrayBuffer);
		}
		catch (error) {
			this.#loadError = `Error loading sound: ${assetPath} (${error})`;
			console.error(`Error loading sound: ${assetPath}`, error);
			throw error;
		}
	}

	//==============================================================================
	// 이미 가진 바이트로 읽기. (내장 자료나 직접 받은 파일, 디코딩이 끝나면 isLoaded() 가 참, 이미 읽혔으면 아무것도 하지 않는다)
	//==============================================================================
	/**
	 * @param { ArrayBuffer | ArrayBufferView } bytes 소리 파일의 바이트. (넘긴 것은 바뀌지 않는다)
	 * @example <caption>받아 둔 바이트로 소리 읽기</caption>
	 * import { AudioAsset } from "./build/vanilla.js";
	 *
	 * const response = await fetch("examples/assets/beep.wav");
	 * const bytes = await response.arrayBuffer();
	 * const audioAsset = new AudioAsset();
	 * await audioAsset.loadFromBytes(bytes);
	 * console.log(audioAsset.isLoaded(), audioAsset.getDuration(), bytes.byteLength);
	 */
	async loadFromBytes(bytes) {
		const isLoaded = this.isLoaded();
		if (isLoaded) {
			return;
		}
		this.#loadError = null;
		if (!isAudioDecodingSupported()) {
			this.#loadError = "AudioContext is not supported.";
			console.error(`AudioContext is not supported.`);
			return;
		}
		try {
			const arrayBuffer = copyToArrayBuffer(bytes);
			await this.openBytes(arrayBuffer);
		}
		catch (error) {
			this.#loadError = `Error loading sound from memory (${error})`;
			console.error(`Error loading sound from bytes`, error);
			throw error;
		}
	}

	//==============================================================================
	// 받은 바이트를 읽기 방식대로 열기. (스트리밍이거나 자동인데 문턱보다 크면 blob: 주소로 흘려 틀고, 아니면 통째로 푼다)
	//==============================================================================
	/**
	 * @private
	 * @param { ArrayBuffer } arrayBuffer 소리 파일의 바이트. (풀면 떼어 간다)
	 */
	async openBytes(arrayBuffer) {
		const loadType = this.getLoadType();
		const isStreamed = loadType === AudioLoadType.streaming || (loadType === AudioLoadType.automatic && arrayBuffer.byteLength > AUTOMATIC_STREAMING_BYTE_THRESHOLD);
		if (!isStreamed) {
			await this.decodeArrayBuffer(arrayBuffer);
			return;
		}
		const blob = new System.Blob([arrayBuffer]);
		const blobUrl = System.URL.createObjectURL(blob);
		try {
			await this.openStream(blobUrl, true);
		}
		catch (error) {
			System.URL.revokeObjectURL(blobUrl);
			throw error;
		}
	}

	//==============================================================================
	// 스트리밍으로 열기. (미디어 요소로 메타데이터만 읽어 길이를 알고, 주소를 든다, 소리는 AudioPlayer 가 틀 때 미디어 요소가 조금씩 푼다)
	//==============================================================================
	/**
	 * @private
	 * @param { string } streamUrl 파일 경로나 blob: 주소.
	 * @param { boolean } isStreamUrlOwned 이 애셋이 만든 blob: 주소면 참. (내릴 때 놓는다)
	 */
	async openStream(streamUrl, isStreamUrlOwned) {
		if (!isMediaStreamingSupported()) {
			throw new System.Error("HTMLAudioElement is not supported.");
		}
		const mediaElement = createStreamMediaElement();
		mediaElement.preload = "metadata";
		try {
			await new System.Promise((resolve, reject) => {
				mediaElement.addEventListener("loadedmetadata", resolve, { once: true });
				mediaElement.addEventListener("error", () => {
					const mediaError = mediaElement.error;
					reject(new System.Error(`MediaError ${mediaError ? mediaError.code : 0}`));
				}, { once: true });
				setStreamMediaElementUrl(mediaElement, streamUrl);
			});
			const duration = mediaElement.duration;
			this.#streamDuration = System.Number.isFinite(duration) ? duration : 0;
		}
		finally {
			releaseMediaElement(mediaElement);
		}
		this.#audioBuffer = null;
		this.#streamUrl = streamUrl;
		this.#isStreamUrlOwned = isStreamUrlOwned;
		this.setLoaded(true);
	}

	//==============================================================================
	// 소리 바이트 디코딩. (다 되면 오디오 버퍼를 들고 읽힌 것으로 둔다)
	// - 디코딩은 OfflineAudioContext 로 한다. (스피커를 잡지 않고, user gesture 전에 만들어도 자동재생 경고가 없으며,
	//   여러 애셋을 한꺼번에 받아도 실시간 AudioContext 의 개수 제한에 걸리지 않는다) 없으면 잠시 쓰는 AudioContext 로 한다.
	//==============================================================================
	/**
	 * @param { ArrayBuffer } arrayBuffer 디코딩이 떼어 가므로 뒤에 다시 쓰지 않는다.
	 */
	async decodeArrayBuffer(arrayBuffer) {
		const offlineAudioContextType = System.window.OfflineAudioContext || System.window.webkitOfflineAudioContext;
		const audioContextType = System.window.AudioContext || System.window.webkitAudioContext;
		if (offlineAudioContextType) {
			const decodeAudioContext = new offlineAudioContextType(1, 1, DECODE_SAMPLE_RATE);
			this.#audioBuffer = await decodeAudioContext.decodeAudioData(arrayBuffer);
		}
		else {
			const tempAudioContext = new audioContextType();
			this.#audioBuffer = await tempAudioContext.decodeAudioData(arrayBuffer);
			await tempAudioContext.close();
		}
		this.#streamUrl = null;
		this.#isStreamUrlOwned = false;
		this.#streamDuration = 0;
		this.setLoaded(true);
	}

	//==============================================================================
	// 애셋 언로드. (오디오 버퍼를 놓고, 이 애셋이 만든 blob: 주소를 놓는다, 읽기 방식은 그대로)
	//==============================================================================
	/**
	 * @override
	 */
	unload() {
		if (this.#isStreamUrlOwned && this.#streamUrl !== null) {
			System.URL.revokeObjectURL(this.#streamUrl);
		}
		this.#audioBuffer = null;
		this.#streamUrl = null;
		this.#isStreamUrlOwned = false;
		this.#streamDuration = 0;
		super.unload();
	}

	//==============================================================================
	// 마지막 읽기 실패의 까닭. (받기나 디코딩이 실패했으면 글, 아니면 null, 다시 읽기 시작하면 지운다)
	//==============================================================================
	/**
	 * @returns { string | null } 실패 까닭. (없으면 null)
	 */
	getLoadError() {
		return this.#loadError;
	}

	//==============================================================================
	// 오디오 버퍼 반환.
	//==============================================================================
	/**
	 * @returns { AudioBuffer | null } 디코딩한 오디오 버퍼. (읽기 전이거나 스트리밍이면 null)
	 */
	getAudioBuffer() {
		return this.#audioBuffer;
	}

	//==============================================================================
	// 재생 시간 반환.
	//==============================================================================
	/**
	 * @returns { number } 재생 시간. (초, 읽기 전이면 0, 스트리밍이면 메타데이터의 길이)
	 */
	getDuration() {
		if (this.#audioBuffer !== null && this.#audioBuffer !== undefined) {
			return this.#audioBuffer.duration;
		}
		if (this.#streamUrl !== null) {
			return this.#streamDuration;
		}
		return 0.0;
	}
}

//==============================================================================
// 바이트를 새 ArrayBuffer 로 복사. (ArrayBuffer 나 Uint8Array 같은 형식 배열, 디코딩이 받은 버퍼를 떼어 가도 넘긴 쪽은 그대로다)
//==============================================================================
/**
 * @param { ArrayBuffer | ArrayBufferView } bytes
 * @returns { ArrayBuffer }
 */
function copyToArrayBuffer(bytes) {
	if (bytes instanceof System.ArrayBuffer) {
		return bytes.slice(0);
	}
	const byteOffset = bytes.byteOffset;
	const byteLength = bytes.byteLength;
	return bytes.buffer.slice(byteOffset, byteOffset + byteLength);
}


//==============================================================================
// 소리를 디코딩할 수 있는지. (OfflineAudioContext 나 AudioContext 가 있으면)
//==============================================================================
/**
 * @returns { boolean }
 */
function isAudioDecodingSupported() {
	const offlineAudioContextType = System.window.OfflineAudioContext || System.window.webkitOfflineAudioContext;
	const audioContextType = System.window.AudioContext || System.window.webkitAudioContext;
	return offlineAudioContextType !== undefined || audioContextType !== undefined;
}


//==============================================================================
// 미디어 요소로 흘려 틀 수 있는지. (HTMLAudioElement 가 있으면)
//==============================================================================
/**
 * @returns { boolean }
 */
function isMediaStreamingSupported() {
	return System.document !== undefined && typeof System.window.HTMLAudioElement === "function";
}

//==============================================================================
// 스트리밍 소리를 틀 미디어 요소 만들기. (페이지에 붙이지 않는다, 주소는 setStreamMediaElementUrl 로 건다)
// - 음 높이는 재생 빠르기를 따라 바뀐다. (AudioBufferSourceNode.playbackRate 와 같게, 미디어 요소의 기본은 음 높이를 지킨다)
//==============================================================================
/**
 * @returns { HTMLAudioElement }
 */
export function createStreamMediaElement() {
	const mediaElement = System.document.createElement("audio");
	mediaElement.preservesPitch = false;
	mediaElement.webkitPreservesPitch = false;
	return mediaElement;
}

//==============================================================================
// 미디어 요소에 스트리밍 주소 걸기.
// - 다른 출처의 파일은 CORS 로 받는다. (MediaElementAudioSourceNode 는 CORS 없이 받은 다른 출처의 소리를 0 으로 낸다, blob: 과 data: 는 같은 출처)
//==============================================================================
/**
 * @param { HTMLMediaElement } mediaElement
 * @param { string } streamUrl 틀 주소.
 */
export function setStreamMediaElementUrl(mediaElement, streamUrl) {
	const isLocalUrl = streamUrl.startsWith("blob:") || streamUrl.startsWith("data:");
	mediaElement.crossOrigin = isLocalUrl ? null : "anonymous";
	mediaElement.src = streamUrl;
}

//==============================================================================
// 미디어 요소 놓기. (멈추고 src 를 비워 받던 것과 푼 것을 놓게 한다, HTML 표준의 미디어 요소 버리기)
//==============================================================================
/**
 * @param { HTMLMediaElement } mediaElement
 */
export function releaseMediaElement(mediaElement) {
	mediaElement.pause();
	mediaElement.removeAttribute("src");
	mediaElement.load();
}
