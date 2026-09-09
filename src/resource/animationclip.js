//==============================================================================
// 포함 모듈 목록.
//==============================================================================
const System = globalThis;
import { Rect } from "../base/rect.js";
import { Object } from "../base/object.js";
import { Frame } from "../core/frame.js";


//==============================================================================
// 애니메이션 클립.
//==============================================================================
export class AnimationClip extends Object {
	/** @private @type { Frame[] } */ #frames; // 프레임 목록.
	/** @private @type { boolean } */ #isLoop; // 반복 재생 여부.
	/** @private @type { number } */ #duration; // 총 애니메이션 재생 시간.

	//==============================================================================
	// 생성.
	//==============================================================================
	/**
	 * @constructor
	 */
	constructor() {
		super();
		this.#frames = [];
		this.#duration = 0;
		this.#isLoop = false;
	}

	//==============================================================================
	// 프레임 목록 설정.
	//==============================================================================
	/**
	 * @param { Frame[] } frames
	 */
	//==============================================================================
	// 아틀라스 JSON 으로 클립 생성. (정적)
	// - TexturePacker 형식({ frames: { 이름: { frame: {x,y,w,h} } } })과
	//   배열 형식([{x,y,w,h}, ...]) 둘 다 받는다.
	// - frameIds 순서대로 프레임을 뽑아 duration = frameCount / fps 로 만든다.
	//==============================================================================
	/**
	 * @param { object } atlasJson
	 * @param { string[] | number[] } frameIds
	 * @param { number } fps
	 * @param { boolean } isLoop
	 * @returns { AnimationClip }
	 */
	static fromAtlas(atlasJson, frameIds, fps = 10, isLoop = true) {
		const clip = new AnimationClip();
		const frameRects = [];
		for (const frameId of frameIds) {
			let frameData = null;
			if (System.Array.isArray(atlasJson)) {
				frameData = atlasJson[frameId];
			}
			else if (atlasJson && atlasJson.frames) {
				frameData = atlasJson.frames[frameId];
			}
			if (!frameData) {
				continue;
			}
			const rectData = frameData.frame ? frameData.frame : frameData;
			const width = (rectData.w !== undefined) ? rectData.w : rectData.width;
			const height = (rectData.h !== undefined) ? rectData.h : rectData.height;
			frameRects.push(Rect.create(rectData.x, rectData.y, width, height));
		}
		clip.setFrames(frameRects);
		clip.setLoop(isLoop);
		clip.setDuration((fps > 0) ? (frameRects.length / fps) : 0);
		return clip;
	}

	setFrames(frames) {
		this.#frames = frames;
	}

	//==============================================================================
	// 반복 재생 여부 설정.
	//==============================================================================
	/**
	 * @param { boolean } isLoop
	 */
	setLoop(isLoop) {
		this.#isLoop = isLoop;
	}

	//==============================================================================
	// 애니메이션 지속 시간 설정.
	//==============================================================================
	/**
	 * @param { number } duration
	 */
	setDuration(duration) {
		this.#duration = duration;
	}

	//==============================================================================
	// 반복 재생 여부 반환.
	//==============================================================================
	/**
	 * @returns { boolean }
	 */
	isLoop() {
		return this.#isLoop;
	}

	//==============================================================================
	// 대상 인덱스에 대한 프레임 반환.
	//==============================================================================
	/**
	 * @param { number } index
	 * @returns { Frame }
	 */
	getFrame(index) {
		return this.#frames[index];
	}

	//==============================================================================
	// 프레임 목록 반환.
	//==============================================================================
	/**
	 * @returns { Frame[] }
	 */
	getFrames() {
		return this.#frames;
	}

	//==============================================================================
	// 전체 프레임 수 반환.
	//==============================================================================
	/**
	 * @returns { number }
	 */
	getFrameCount() {
		return this.#frames.length;
	}

	//==============================================================================
	// 애니메이션 지속 시간 반환.
	//==============================================================================
	/**
	 * @returns { number }
	 */
	getDuration() {
		return this.#duration;
	}
}