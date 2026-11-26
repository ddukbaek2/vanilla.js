//==============================================================================
// 포함 모듈 목록.
//==============================================================================
const System = globalThis;
import { Rect } from "../base/rect.js";
import { Object } from "../base/object.js";


//==============================================================================
// 애니메이션 클립.
// - 프레임은 스프라이트 시트 안의 영역(Rect) 목록이다. (Animator 가 그 영역을 스프라이트의 setImageRect 로 건다)
//==============================================================================
/**
 * @example <caption>아틀라스 JSON 으로 걷기 클립 만들기</caption>
 * import { AnimationClip } from "./build/vanilla.js";
 *
 * const atlasJson = {
 * 	frames: {
 * 		walk0: { frame: { x: 0, y: 0, w: 200, h: 200 } },
 * 		walk1: { frame: { x: 200, y: 0, w: 200, h: 200 } },
 * 		walk2: { frame: { x: 400, y: 0, w: 200, h: 200 } },
 * 	},
 * };
 * const clip = AnimationClip.fromAtlas(atlasJson, ["walk0", "walk1", "walk2"], 12, true);
 * const firstRect = clip.getFrame(0);
 * console.log(clip.getFrameCount(), clip.getDuration(), clip.isLoop(), firstRect.width);
 */
export class AnimationClip extends Object {
	/** @private @type { Rect[] } */ #frames; // 프레임 영역 목록.
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
	// 아틀라스 JSON 으로 클립 생성. (정적)
	// - TexturePacker 형식({ frames: { 이름: { frame: {x,y,w,h} } } })과
	//   배열 형식([{x,y,w,h}, ...]) 둘 다 받는다.
	// - frameIds 순서대로 프레임을 뽑아 duration = frameCount / fps 로 만든다.
	//==============================================================================
	/**
	 * @param { object } atlasJson 아틀라스 JSON. (TexturePacker 형식 객체나 영역 배열, 영역은 x, y 와 w, h 나 width, height)
	 * @param { string[] | number[] } frameIds 뽑을 프레임 이름이나 번호의 차례. (아틀라스에 없는 것은 건너뛴다)
	 * @param { number } fps 초당 프레임 수. (기본 10, 0 이하이면 지속 시간 0)
	 * @param { boolean } isLoop 반복 재생 여부. (기본 참)
	 * @returns { AnimationClip } 만든 클립. (프레임은 Rect 목록)
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

	//==============================================================================
	// 프레임 목록 설정.
	//==============================================================================
	/**
	 * @param { Rect[] } frames 프레임 영역 목록. (스프라이트 시트 안의 픽셀 영역, fromAtlas 도 Rect 목록을 넣는다)
	 */
	setFrames(frames) {
		this.#frames = frames;
	}

	//==============================================================================
	// 반복 재생 여부 설정.
	//==============================================================================
	/**
	 * @param { boolean } isLoop 반복 재생하면 참.
	 */
	setLoop(isLoop) {
		this.#isLoop = isLoop;
	}

	//==============================================================================
	// 애니메이션 지속 시간 설정.
	//==============================================================================
	/**
	 * @param { number } duration 지속 시간. (초)
	 */
	setDuration(duration) {
		this.#duration = duration;
	}

	//==============================================================================
	// 반복 재생 여부 반환.
	//==============================================================================
	/**
	 * @returns { boolean } 반복 재생하면 참. (기본 거짓)
	 */
	isLoop() {
		return this.#isLoop;
	}

	//==============================================================================
	// 대상 인덱스에 대한 프레임 반환.
	//==============================================================================
	/**
	 * @param { number } index 프레임 번호. (0 부터)
	 * @returns { Rect } 그 번호의 프레임 영역. (범위 밖이면 undefined)
	 */
	getFrame(index) {
		return this.#frames[index];
	}

	//==============================================================================
	// 프레임 목록 반환.
	//==============================================================================
	/**
	 * @returns { Rect[] } 프레임 영역 목록.
	 */
	getFrames() {
		return this.#frames;
	}

	//==============================================================================
	// 전체 프레임 수 반환.
	//==============================================================================
	/**
	 * @returns { number } 프레임 수.
	 */
	getFrameCount() {
		return this.#frames.length;
	}

	//==============================================================================
	// 애니메이션 지속 시간 반환.
	//==============================================================================
	/**
	 * @returns { number } 지속 시간. (초, 기본 0)
	 */
	getDuration() {
		return this.#duration;
	}
}