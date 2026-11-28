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
// - 이름을 붙인 클립(프레임 시퀀스)을 등록해 두고 SpriteAnimator.play(node, "run") 이나 playClip("run") 으로 전환한다.
// - 같은 클립을 다시 틀어도 재시작하지 않는다. (restartIfSame 옵션으로 바꿀 수 있다)
// - 클립이 끝나면 onComplete 콜백으로 다음 상태를 이어 갈 수 있다. (FSM 과 결합)
// - 같은 노드의 Sprite 컴포넌트에 현재 프레임(image + rect)을 반영한다.
// - 사용:
//     const animator = node.addComponent(SpriteAnimator);
//     animator.addClip("idle", image, idleRects, 10, true);
//     animator.addClip("attack", image, attackRects, 12, false);
//     SpriteAnimator.play(node, "attack", { onComplete: () => animator.playClip("idle") });
// - 두 엔진이 같은 꼴: 정적 SpriteAnimator.play(node, clipName, options) 가 노드의 애니메이터로 틀고, 애니메이터만 있을 때(완료 콜백 안)는 playClip 이다.
//   (러스트 판 SpriteAnimator::play, play_clip)
//==============================================================================
/**
 * @example <caption>대기 클립을 돌리다 누르면 공격 한 번 뒤 대기로 돌아가기</caption>
 * import { Engine, EngineConfiguration, Scene, WorldNode, Sprite, SpriteAnimator, ImageAsset, Rect, Vector2, Pivot } from "./build/vanilla.js";
 *
 * const imageAsset = new ImageAsset();
 * await imageAsset.load("examples/assets/spritesheet.png");
 * const image = imageAsset.getImage();
 * const idleRects = [];
 * const attackRects = [];
 * for (let column = 0; column < 3; ++column) {
 * 	idleRects.push(Rect.create(column * 200, 0, 200, 200));
 * 	attackRects.push(Rect.create(column * 200, 200, 200, 200));
 * }
 *
 * const characterNode = new WorldNode();
 * characterNode.addComponent(Sprite);
 * const spriteAnimator = characterNode.addComponent(SpriteAnimator);
 * spriteAnimator.addClip("idle", image, idleRects, 6, true);
 * spriteAnimator.addClip("attack", image, attackRects, 12, false);
 * spriteAnimator.playClip("idle");
 *
 * class MainScene extends Scene {
 * 	initialize(engine) {
 * 		super.initialize(engine);
 * 		characterNode.setPivot(Pivot.middleCenter);
 * 		characterNode.setLocalPosition(Vector2.create(320, 180));
 * 		characterNode.setContentSize(Vector2.create(200, 200));
 * 		const root = this.getRoot();
 * 		root.addChild(characterNode);
 * 	}
 *
 * 	touchPress(viewInputPosition) {
 * 		super.touchPress(viewInputPosition);
 * 		spriteAnimator.playClip("attack", {
 * 			onComplete: () => {
 * 				spriteAnimator.playClip("idle");
 * 			},
 * 		});
 * 	}
 * }
 *
 * const engineConfiguration = new EngineConfiguration();
 * const engine = new Engine(engineConfiguration);
 * engine.run(new MainScene());
 */
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
	 * @param { string } clipName 클립 이름.
	 * @param { HTMLImageElement } image 프레임을 잘라 쓸 이미지.
	 * @param { Rect[] } frameRects 프레임마다 이미지 안에서 잘라 쓸 영역. (픽셀)
	 * @param { number } fps 초당 프레임 수. (기본 10)
	 * @param { boolean } isLoop 되풀이하면 참. (기본 참, 거짓이면 마지막 프레임에서 멈추고 onComplete 를 부른다)
	 */
	addClip(clipName, image, frameRects, fps = 10, isLoop = true) {
		this.#clipTable.set(clipName, { image: image, frameRects: frameRects, fps: fps, isLoop: isLoop });
	}

	//==============================================================================
	// 아틀라스 JSON 으로 클립 등록.
	// - TexturePacker 형식({ frames: { 이름: { frame: {x,y,w,h} } } })을 받는다.
	//==============================================================================
	/**
	 * @param { string } clipName 클립 이름.
	 * @param { HTMLImageElement } image 프레임을 잘라 쓸 이미지.
	 * @param { object } atlasJson TexturePacker 형식 아틀라스 자료.
	 * @param { string[] } frameIds 차례대로 쓸 프레임 이름 목록. (아틀라스에 없는 이름은 건너뛴다)
	 * @param { number } fps 초당 프레임 수. (기본 10)
	 * @param { boolean } isLoop 되풀이하면 참. (기본 참, 거짓이면 마지막 프레임에서 멈추고 onComplete 를 부른다)
	 * @example <caption>아틀라스 JSON 의 프레임 이름으로 클립 만들기</caption>
	 * import { SpriteAnimator, ImageAsset } from "./build/vanilla.js";
	 *
	 * const imageAsset = new ImageAsset();
	 * await imageAsset.load("examples/assets/spritesheet.png");
	 * const image = imageAsset.getImage();
	 * const atlasJson = {
	 * 	frames: {
	 * 		"run_0": { frame: { x: 0, y: 400, w: 200, h: 200 } },
	 * 		"run_1": { frame: { x: 200, y: 400, w: 200, h: 200 } },
	 * 		"run_2": { frame: { x: 400, y: 400, w: 200, h: 200 } },
	 * 	},
	 * };
	 * const spriteAnimator = new SpriteAnimator();
	 * spriteAnimator.addClipFromAtlas("run", image, atlasJson, ["run_0", "run_1", "run_2"], 12, true);
	 * console.log(spriteAnimator.hasClip("run"), spriteAnimator.playClip("run"));
	 * spriteAnimator.tick(0.1);
	 * console.log(spriteAnimator.getClipName(), spriteAnimator.getCurrentFrameIndex());
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
	// 애니메이터로 재생. (러스트 판 play_clip)
	// - 같은 클립이 이미 도는 중이면 다시 시작하지 않는다. (restartIfSame 이 참이면 재시작)
	// - 같은 노드의 Sprite 에 그 자리에서 첫 프레임을 넣는다.
	//==============================================================================
	/**
	 * @param { string } clipName 재생할 클립 이름. (등록하지 않은 이름이면 false)
	 * @param { object } options { onComplete?, restartIfSame = false }
	 * @returns { boolean } 재생 시작 여부.
	 */
	playClip(clipName, options = {}) {
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
	 * @param { number } timeDelta 지난 프레임부터의 시간. (초)
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
	 * @returns { Sprite | null } 같은 노드의 첫 Sprite 컴포넌트. (없거나 노드에 붙지 않았으면 null)
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
	 * @returns { string | null } 지금 클립 이름. (재생한 적이 없으면 null)
	 */
	getClipName() {
		return this.#clipName;
	}

	//==============================================================================
	// 재생 중 여부.
	//==============================================================================
	/**
	 * @returns { boolean } 재생 중이면 참.
	 */
	isPlaying() {
		return this.#animation.isPlaying();
	}

	//==============================================================================
	// 지금 프레임 번호 반환. (클립 안에서 0 부터)
	//==============================================================================
	/**
	 * @returns { number } 지금 프레임 번호. (클립 안에서 0 부터)
	 */
	getCurrentFrameIndex() {
		return this.#animation.getCurrentFrameIndex();
	}

	//==============================================================================
	// 클립 존재 여부.
	//==============================================================================
	/**
	 * @param { string } clipName 찾을 클립 이름.
	 * @returns { boolean } 등록된 클립이면 참.
	 */
	hasClip(clipName) {
		return this.#clipTable.has(clipName);
	}

	//==============================================================================
	// 노드의 애니메이터로 재생. (정적, 같은 노드의 Sprite 에 그 자리에서 첫 프레임을 넣는다, 노드에 애니메이터가 없으면 false)
	//==============================================================================
	/**
	 * @param { object } node SpriteAnimator 를 붙인 노드.
	 * @param { string } clipName 재생할 클립 이름. (등록하지 않은 이름이면 false)
	 * @param { object } options { onComplete?, restartIfSame = false }
	 * @returns { boolean } 재생 시작 여부.
	 */
	static play(node, clipName, options = {}) {
		const spriteAnimator = node.getComponent(SpriteAnimator);
		if (!spriteAnimator) {
			return false;
		}
		const isStarted = spriteAnimator.playClip(clipName, options);
		return isStarted;
	}
}
