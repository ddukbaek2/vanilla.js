//==============================================================================
// 포함 모듈 목록.
//==============================================================================
const System = globalThis;
import { Component } from "../core/component.js";
import { Animation } from "../core/animation.js";
import { Sprite } from "../core/component/sprite.js";
import { Rect } from "../base/rect.js";


//==============================================================================
// 스프라이트 애니메이터 컴포넌트.
// - 이름을 붙인 클립(프레임 시퀀스)을 등록해 두고 play("run") 으로 전환한다.
// - 같은 클립을 다시 play 해도 재시작하지 않는다. (restartIfSame 옵션으로 바꿀 수 있다)
// - 클립이 끝나면 onComplete 콜백으로 다음 상태를 이어 갈 수 있다. (FSM 과 결합)
// - 같은 노드의 Sprite 컴포넌트에 현재 프레임(image + rect)을 반영한다.
// - 사용:
//     const animator = node.addComponent(SpriteAnimator);
//     animator.addClip("idle", image, idleRects, 10, true);
//     animator.addClip("attack", image, attackRects, 12, false);
//     animator.play("attack", { onComplete: () => animator.play("idle") });
//==============================================================================
export class SpriteAnimator extends Component {
	//==============================================================================
	// 멤버 변수 목록.
	//==============================================================================
	/** @private @type { Map } */ #clipTable;
	/** @private @type { string | null } */ #clipName;
	/** @private @type { Animation } */ #animation;
	/** @private @type { Sprite | null } */ #sprite;

	//==============================================================================
	// 생성.
	//==============================================================================
	constructor() {
		super();
		this.setComponentType("SpriteAnimator");
		this.#clipTable = new System.Map();
		this.#clipName = null;
		this.#animation = new Animation();
		this.#sprite = null;
	}

	//==============================================================================
	// 클립 등록.
	//==============================================================================
	/**
	 * @param { string } clipName
	 * @param { HTMLImageElement } image
	 * @param { Rect[] } frameRects
	 * @param { number } fps
	 * @param { boolean } isLoop
	 */
	addClip(clipName, image, frameRects, fps = 10, isLoop = true) {
		this.#clipTable.set(clipName, { image: image, frameRects: frameRects, fps: fps, isLoop: isLoop });
	}

	//==============================================================================
	// 아틀라스 JSON 으로 클립 등록.
	// - TexturePacker 형식({ frames: { 이름: { frame: {x,y,w,h} } } })을 받는다.
	//==============================================================================
	/**
	 * @param { string } clipName
	 * @param { HTMLImageElement } image
	 * @param { object } atlasJson
	 * @param { string[] } frameIds
	 * @param { number } fps
	 * @param { boolean } isLoop
	 */
	addClipFromAtlas(clipName, image, atlasJson, frameIds, fps = 10, isLoop = true) {
		const frameRects = [];
		for (const frameId of frameIds) {
			const frameData = atlasJson && atlasJson.frames ? atlasJson.frames[frameId] : null;
			if (!frameData) {
				continue;
			}
			const rectData = frameData.frame ? frameData.frame : frameData;
			const width = (rectData.w !== undefined) ? rectData.w : rectData.width;
			const height = (rectData.h !== undefined) ? rectData.h : rectData.height;
			frameRects.push(Rect.create(rectData.x, rectData.y, width, height));
		}
		this.addClip(clipName, image, frameRects, fps, isLoop);
	}

	//==============================================================================
	// 재생.
	// - 같은 클립이 이미 도는 중이면 다시 시작하지 않는다. (restartIfSame 이 참이면 재시작)
	//==============================================================================
	/**
	 * @param { string } clipName
	 * @param { object } options { onComplete?, restartIfSame = false }
	 * @returns { boolean } 재생 시작 여부.
	 */
	play(clipName, options = {}) {
		const clip = this.#clipTable.get(clipName);
		if (!clip) {
			return false;
		}
		const restartIfSame = options.restartIfSame ? true : false;
		if (this.#clipName === clipName && this.#animation.isPlaying() && !restartIfSame) {

			// 완주 콜백만 갈아 끼운다.
			this.#animation.setOnComplete(options.onComplete ? options.onComplete : null);
			return false;
		}
		this.#clipName = clipName;
		this.#animation.stop();
		this.#animation.setFramesFromRects(clip.image, clip.frameRects);
		this.#animation.setAnimationSpeed(clip.fps);
		this.#animation.setLoop(clip.isLoop);
		this.#animation.setOnComplete(options.onComplete ? options.onComplete : null);
		this.#animation.gotoAndPlay(0);
		this.applyCurrentFrame();
		return true;
	}

	//==============================================================================
	// 정지.
	//==============================================================================
	stop() {
		this.#animation.stop();
	}

	//==============================================================================
	// 갱신.
	//==============================================================================
	/**
	 * @override
	 * @param { number } timeDelta
	 */
	tick(timeDelta) {
		super.tick(timeDelta);
		this.#animation.tick(timeDelta);
		this.applyCurrentFrame();
	}

	//==============================================================================
	// 현재 프레임을 스프라이트에 반영.
	//==============================================================================
	applyCurrentFrame() {
		const currentFrame = this.#animation.getCurrentFrame();
		if (!currentFrame) {
			return;
		}
		const sprite = this.findSprite();
		if (!sprite) {
			return;
		}
		sprite.setImage(currentFrame.getImage());
		const frameRect = currentFrame.getImageRect();
		if (frameRect) {
			sprite.setImageRect(frameRect);
		}
	}

	//==============================================================================
	// 같은 노드의 스프라이트 찾기. (한 번 찾으면 캐시)
	//==============================================================================
	/**
	 * @returns { Sprite | null }
	 */
	findSprite() {
		if (this.#sprite) {
			return this.#sprite;
		}
		const node = this.getNode();
		if (!node) {
			return null;
		}
		const spriteComponents = node.getComponents(Sprite);
		if (spriteComponents.length > 0) {
			this.#sprite = spriteComponents[0];
		}
		return this.#sprite;
	}

	//==============================================================================
	// 현재 클립 이름 반환.
	//==============================================================================
	/**
	 * @returns { string | null }
	 */
	getClipName() {
		return this.#clipName;
	}

	//==============================================================================
	// 재생 중 여부.
	//==============================================================================
	/**
	 * @returns { boolean }
	 */
	isPlaying() {
		return this.#animation.isPlaying();
	}

	//==============================================================================
	// 클립 존재 여부.
	//==============================================================================
	/**
	 * @param { string } clipName
	 * @returns { boolean }
	 */
	hasClip(clipName) {
		return this.#clipTable.has(clipName);
	}
}
