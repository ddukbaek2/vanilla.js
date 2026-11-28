//==============================================================================
// 2D 뼈대 애니메이션 상태. (트랙마다 클립 하나, 트랙 안 크로스페이드, 트랙끼리 층 섞기, 사건)
// - 초안: 0.4.0 뒤 기능, API 가 바뀔 수 있다.
// - 트랙은 번호 차례로 쌓인다. 0 번이 바탕이고, 위 트랙은 그 몫(alpha)만큼 아래 결과를 덮는다. (유니티 Animator 의 덮어쓰기 층, Spine 트랙과 같은 꼴)
// - 트랙에 새 클립을 섞는 시간과 함께 걸면 앞 클립이 그 시간 동안 이어 돌며 새 클립으로 넘어간다. 빈 트랙에 걸면 그 시간 동안 나타난다.
// - apply 는 지금 자세에서 시작해, 걸린 클립들이 움직이는 값만 처음 자세로 되돌린 뒤 섞는다.
//   클립이 움직이지 않는 뼈(IK 목표처럼 코드가 옮기는 뼈)는 그대로 남는다. 클립이 놓아 준 값도 그대로 남는다. (처음으로 돌리려면 Skeleton2D.setToSetupPose)
// - 사건은 트랙의 지금 클립(섞여 나가는 앞 클립은 빼고)이 지난 시각의 것을 모았다가 takeEvents 로 꺼낸다.
//==============================================================================

/**
 * @example <caption>걷기 위에 손 흔들기를 반만 얹고 0.5 초 뒤 사건 꺼내기</caption>
 * import * as Experimental from "./src/experimental/experimental.js";
 *
 * const skeletonData = Experimental.Skeleton2DData.createFromJson({
 * 	bones: [{ name: "root" }, { name: "leg", parent: "root" }, { name: "arm", parent: "root" }],
 * 	animations: {
 * 		walk: { bones: { leg: { rotate: [{ time: 0, value: -20 }, { time: 1, value: 20 }] } }, events: [{ time: 0.5, name: "step" }] },
 * 		wave: { bones: { arm: { rotate: [{ time: 0, value: 0 }, { time: 1, value: 80 }] } } },
 * 	},
 * });
 * const skeleton = new Experimental.Skeleton2D(skeletonData);
 * const animationState = new Experimental.Skeleton2DAnimationState(skeletonData);
 * animationState.setAnimation(0, "walk", true, 0);
 * animationState.setAnimation(1, "wave", true, 0);
 * animationState.setTrackAlpha(1, 0.5);
 * animationState.update(0.5);
 * animationState.apply(skeleton);
 * const firedEvents = animationState.takeEvents();
 * console.log(skeleton.findBone("leg").getRotation(), skeleton.findBone("arm").getRotation(), firedEvents[0].getEvent().getName());
 */


//==============================================================================
// 포함 모듈 목록.
//==============================================================================
const System = globalThis;
import { Object } from "../../base/object.js";
import { Skeleton2DPose } from "./skeleton2danimation.js";


//==============================================================================
// 트랙 항목. (트랙에 건 클립 하나의 재생 상태)
//==============================================================================
/**
 * @example <caption>트랙 항목 읽기</caption>
 * import * as Experimental from "./src/experimental/experimental.js";
 *
 * const skeletonData = Experimental.Skeleton2DData.createFromJson({
 * 	bones: [{ name: "root" }],
 * 	animations: { idle: { duration: 2, bones: { root: { translate: [{ time: 0, y: 0 }, { time: 2, y: 4 }] } } } },
 * });
 * const animationState = new Experimental.Skeleton2DAnimationState(skeletonData);
 * animationState.setAnimation(0, "idle", false, 0.25);
 * animationState.update(2.5);
 * const trackEntry = animationState.getTrack(0);
 * console.log(trackEntry.getAnimationName(), trackEntry.getAnimationTime(), trackEntry.getMixRatio(), trackEntry.isComplete());
 */
export class Skeleton2DTrackEntry extends Object {
	//==============================================================================
	// 멤버 변수 목록.
	//==============================================================================
	/** @private @type { object } */ #animation;
	/** @private @type { boolean } */ #isLoop;
	/** @private @type { number } */ #trackTime;
	/** @private @type { number } */ #previousTrackTime;
	/** @private @type { number } */ #alpha;
	/** @private @type { number } */ #mixDuration;
	/** @private @type { number } */ #mixTime;
	/** @private @type { Skeleton2DTrackEntry | null } */ #mixingFrom;
	/** @private @type { boolean } */ #isStarted;

	//==============================================================================
	// 생성. (트랙 시각 0, 아직 돌지 않음)
	//==============================================================================
	/**
	 * @param { object } animation 클립. (Skeleton2DAnimation)
	 * @param { boolean } isLoop 되풀이하면 참.
	 * @param { number } alpha 층 몫. (0 ~ 1)
	 * @param { number } mixDuration 섞는 시간. (초, 0 이면 바로)
	 */
	constructor(animation, isLoop, alpha, mixDuration) {
		super();
		this.#animation = animation;
		this.#isLoop = isLoop;
		this.#trackTime = 0;
		this.#previousTrackTime = -1;
		this.#alpha = alpha;
		this.#mixDuration = mixDuration;
		this.#mixTime = 0;
		this.#mixingFrom = null;
		this.#isStarted = false;
	}

	//==============================================================================
	// 클립 반환.
	//==============================================================================
	/**
	 * @returns { object } 클립. (Skeleton2DAnimation)
	 */
	getAnimation() {
		return this.#animation;
	}

	//==============================================================================
	// 클립 이름 반환.
	//==============================================================================
	/**
	 * @returns { string } 클립 이름.
	 */
	getAnimationName() {
		const animation = this.getAnimation();
		return animation.getName();
	}

	//==============================================================================
	// 되풀이 여부 반환.
	//==============================================================================
	/**
	 * @returns { boolean } 되풀이하면 참.
	 */
	isLoop() {
		return this.#isLoop;
	}

	//==============================================================================
	// 트랙 시각 반환. (건 뒤 흐른 시간, 되풀이해도 접지 않는다)
	//==============================================================================
	/**
	 * @returns { number } 트랙 시각. (초)
	 */
	getTrackTime() {
		return this.#trackTime;
	}

	//==============================================================================
	// 트랙 시각 설정. (건너뛰기, 그 사이 사건은 알리지 않는다)
	//==============================================================================
	/**
	 * @param { number } trackTime 트랙 시각. (초)
	 */
	setTrackTime(trackTime) {
		this.#trackTime = trackTime;
		this.#previousTrackTime = trackTime;
		this.#isStarted = true;
	}

	//==============================================================================
	// 앞 update 의 트랙 시각 반환. (아직 돌지 않았으면 -1)
	//==============================================================================
	/**
	 * @returns { number } 앞 트랙 시각. (초)
	 */
	getPreviousTrackTime() {
		return this.#previousTrackTime;
	}

	//==============================================================================
	// 트랙 시각 흘리기. (앞 시각을 적어 두고 더한다, 처음 흘릴 때의 앞 시각은 -1 이라 0 의 사건도 든다, 섞는 시간도 흐른다)
	//==============================================================================
	/**
	 * @param { number } timeDelta 흐른 시간. (초)
	 */
	advance(timeDelta) {
		this.#previousTrackTime = this.#isStarted ? this.#trackTime : -1;
		this.#isStarted = true;
		this.#trackTime += timeDelta;
		this.#mixTime += timeDelta;
	}

	//==============================================================================
	// 클립 안의 시각 반환. (되풀이하면 길이로 접고, 아니면 길이에서 멈춘다)
	//==============================================================================
	/**
	 * @returns { number } 클립 안의 시각. (초)
	 */
	getAnimationTime() {
		const animation = this.getAnimation();
		const duration = animation.getDuration();
		const trackTime = this.#trackTime;
		if (duration <= 0) {
			return 0;
		}
		if (this.#isLoop) {
			return trackTime - System.Math.floor(trackTime / duration) * duration;
		}
		return System.Math.min(trackTime, duration);
	}

	//==============================================================================
	// 층 몫 반환.
	//==============================================================================
	/**
	 * @returns { number } 층 몫. (0 ~ 1)
	 */
	getAlpha() {
		return this.#alpha;
	}

	//==============================================================================
	// 층 몫 설정.
	//==============================================================================
	/**
	 * @param { number } alpha 층 몫. (0 이면 보이지 않고 1 이면 아래를 다 덮는다)
	 */
	setAlpha(alpha) {
		this.#alpha = alpha;
	}

	//==============================================================================
	// 섞는 시간 반환.
	//==============================================================================
	/**
	 * @returns { number } 섞는 시간. (초)
	 */
	getMixDuration() {
		return this.#mixDuration;
	}

	//==============================================================================
	// 섞기 시작 뒤 흐른 시간 반환.
	//==============================================================================
	/**
	 * @returns { number } 흐른 시간. (초)
	 */
	getMixTime() {
		return this.#mixTime;
	}

	//==============================================================================
	// 섞인 몫 반환. (섞는 시간이 0 이거나 다 섞였으면 1)
	//==============================================================================
	/**
	 * @returns { number } 이 클립의 몫. (0 ~ 1)
	 */
	getMixRatio() {
		const mixDuration = this.#mixDuration;
		if (mixDuration <= 0) {
			return 1;
		}
		return System.Math.min(this.#mixTime / mixDuration, 1);
	}

	//==============================================================================
	// 섞여 나가는 앞 항목 반환. (없으면 null)
	//==============================================================================
	/**
	 * @returns { Skeleton2DTrackEntry | null } 앞 항목.
	 */
	getMixingFrom() {
		return this.#mixingFrom;
	}

	//==============================================================================
	// 섞여 나가는 앞 항목 설정. (Skeleton2DAnimationState 가 쓴다)
	//==============================================================================
	/**
	 * @param { Skeleton2DTrackEntry | null } mixingFrom 앞 항목. (null 이면 끊는다)
	 */
	setMixingFrom(mixingFrom) {
		this.#mixingFrom = mixingFrom;
	}

	//==============================================================================
	// 끝났는지. (되풀이하지 않는 클립이 길이에 닿았으면 참, 되풀이하면 늘 거짓)
	//==============================================================================
	/**
	 * @returns { boolean } 끝났으면 참.
	 */
	isComplete() {
		if (this.#isLoop) {
			return false;
		}
		const animation = this.getAnimation();
		const duration = animation.getDuration();
		return this.#trackTime >= duration;
	}
}


//==============================================================================
// 알린 사건. (어느 트랙의 어느 클립에서 난 사건인지)
//==============================================================================
/**
 * @example <caption>알린 사건 읽기</caption>
 * import * as Experimental from "./src/experimental/experimental.js";
 *
 * const event = new Experimental.Skeleton2DEvent("hit", 0.2);
 * const firedEvent = new Experimental.Skeleton2DFiredEvent(1, "attack", event);
 * console.log(firedEvent.getTrackIndex(), firedEvent.getAnimationName(), firedEvent.getEvent().getName());
 */
export class Skeleton2DFiredEvent extends Object {
	//==============================================================================
	// 멤버 변수 목록.
	//==============================================================================
	/** @private @type { number } */ #trackIndex;
	/** @private @type { string } */ #animationName;
	/** @private @type { object } */ #event;

	//==============================================================================
	// 생성.
	//==============================================================================
	/**
	 * @param { number } trackIndex 트랙 번호.
	 * @param { string } animationName 클립 이름.
	 * @param { object } event 사건. (Skeleton2DEvent)
	 */
	constructor(trackIndex, animationName, event) {
		super();
		this.#trackIndex = trackIndex;
		this.#animationName = animationName;
		this.#event = event;
	}

	//==============================================================================
	// 트랙 번호 반환.
	//==============================================================================
	/**
	 * @returns { number } 트랙 번호.
	 */
	getTrackIndex() {
		return this.#trackIndex;
	}

	//==============================================================================
	// 클립 이름 반환.
	//==============================================================================
	/**
	 * @returns { string } 클립 이름.
	 */
	getAnimationName() {
		return this.#animationName;
	}

	//==============================================================================
	// 사건 반환.
	//==============================================================================
	/**
	 * @returns { object } 사건. (Skeleton2DEvent)
	 */
	getEvent() {
		return this.#event;
	}
}


//==============================================================================
// 2D 뼈대 애니메이션 상태.
//==============================================================================
/**
 * @example <caption>대기에서 걷기로 0.2 초 동안 넘어가기</caption>
 * import * as Experimental from "./src/experimental/experimental.js";
 *
 * const skeletonData = Experimental.Skeleton2DData.createFromJson({
 * 	bones: [{ name: "root" }, { name: "body", parent: "root" }],
 * 	animations: {
 * 		idle: { duration: 1, bones: { body: { translate: [{ time: 0, y: 0 }] } } },
 * 		walk: { duration: 1, bones: { body: { translate: [{ time: 0, y: -10 }] } } },
 * 	},
 * });
 * const skeleton = new Experimental.Skeleton2D(skeletonData);
 * const animationState = new Experimental.Skeleton2DAnimationState(skeletonData);
 * animationState.setAnimation(0, "idle", true, 0);
 * animationState.update(0.5);
 * animationState.setAnimation(0, "walk", true, 0.2);
 * animationState.update(0.1);
 * animationState.apply(skeleton);
 * console.log(skeleton.findBone("body").getY());
 */
export class Skeleton2DAnimationState extends Object {
	//==============================================================================
	// 멤버 변수 목록.
	//==============================================================================
	/** @private @type { object } */ #data;
	/** @private @type { (Skeleton2DTrackEntry | null)[] } */ #tracks;
	/** @private @type { Skeleton2DFiredEvent[] } */ #firedEvents;
	/** @private @type { Skeleton2DPose } */ #basePose;
	/** @private @type { Skeleton2DPose } */ #fromPose;
	/** @private @type { Skeleton2DPose } */ #toPose;

	//==============================================================================
	// 생성. (트랙 없음)
	//==============================================================================
	/**
	 * @param { object } skeletonData 뼈대 자료. (Skeleton2DData)
	 */
	constructor(skeletonData) {
		super();
		this.#data = skeletonData;
		this.#tracks = [];
		this.#firedEvents = [];
		const boneCount = skeletonData.getBones().length;
		const slotCount = skeletonData.getSlots().length;
		this.#basePose = new Skeleton2DPose(boneCount, slotCount);
		this.#fromPose = new Skeleton2DPose(boneCount, slotCount);
		this.#toPose = new Skeleton2DPose(boneCount, slotCount);
	}

	//==============================================================================
	// 자료 반환.
	//==============================================================================
	/**
	 * @returns { object } 뼈대 자료. (Skeleton2DData)
	 */
	getData() {
		return this.#data;
	}

	//==============================================================================
	// 트랙에 클립 걸기. (없는 클립이면 false)
	// - 섞는 시간이 0 보다 크면 그 트랙의 앞 클립이 그 시간 동안 이어 돌며 섞여 나간다. 트랙이 비었으면 그 시간 동안 나타난다.
	// - 층 몫은 그 트랙의 앞 항목 것을 이어받는다. (처음은 1)
	//==============================================================================
	/**
	 * @param { number } trackIndex 트랙 번호. (0 이 바탕)
	 * @param { string } animationName 클립 이름.
	 * @param { boolean } isLoop 되풀이하면 참. (기본 참)
	 * @param { number } mixDuration 섞는 시간. (초, 기본 0)
	 * @returns { boolean } 걸었으면 참.
	 */
	setAnimation(trackIndex, animationName, isLoop = true, mixDuration = 0) {
		const skeletonData = this.getData();
		const animation = skeletonData.findAnimation(animationName);
		if (animation === null) {
			return false;
		}
		const tracks = this.#tracks;
		while (tracks.length <= trackIndex) {
			tracks.push(null);
		}
		const currentEntry = tracks[trackIndex];
		const alpha = currentEntry === null ? 1 : currentEntry.getAlpha();
		const trackEntry = new Skeleton2DTrackEntry(animation, isLoop, alpha, mixDuration);
		if (currentEntry !== null && mixDuration > 0) {
			currentEntry.setMixingFrom(null);
			trackEntry.setMixingFrom(currentEntry);
		}
		tracks[trackIndex] = trackEntry;
		return true;
	}

	//==============================================================================
	// 트랙 항목 반환. (없으면 null)
	//==============================================================================
	/**
	 * @param { number } trackIndex 트랙 번호.
	 * @returns { Skeleton2DTrackEntry | null } 트랙 항목.
	 */
	getTrack(trackIndex) {
		const tracks = this.#tracks;
		if (trackIndex < 0 || trackIndex >= tracks.length) {
			return null;
		}
		return tracks[trackIndex];
	}

	//==============================================================================
	// 트랙 수 반환. (가장 큰 번호 + 1, 빈 트랙도 센다)
	//==============================================================================
	/**
	 * @returns { number } 트랙 수.
	 */
	getTrackCount() {
		return this.#tracks.length;
	}

	//==============================================================================
	// 트랙 비우기. (그 트랙이 움직이던 값은 그대로 남는다)
	//==============================================================================
	/**
	 * @param { number } trackIndex 트랙 번호.
	 */
	clearTrack(trackIndex) {
		const tracks = this.#tracks;
		if (trackIndex >= 0 && trackIndex < tracks.length) {
			tracks[trackIndex] = null;
		}
	}

	//==============================================================================
	// 모든 트랙 비우기.
	//==============================================================================
	clearTracks() {
		this.#tracks.length = 0;
	}

	//==============================================================================
	// 트랙의 층 몫 설정. (빈 트랙이면 아무것도 하지 않는다)
	//==============================================================================
	/**
	 * @param { number } trackIndex 트랙 번호.
	 * @param { number } alpha 층 몫. (0 ~ 1)
	 */
	setTrackAlpha(trackIndex, alpha) {
		const trackEntry = this.getTrack(trackIndex);
		if (trackEntry === null) {
			return;
		}
		trackEntry.setAlpha(alpha);
	}

	//==============================================================================
	// 트랙의 층 몫 반환. (빈 트랙이면 0)
	//==============================================================================
	/**
	 * @param { number } trackIndex 트랙 번호.
	 * @returns { number } 층 몫.
	 */
	getTrackAlpha(trackIndex) {
		const trackEntry = this.getTrack(trackIndex);
		if (trackEntry === null) {
			return 0;
		}
		return trackEntry.getAlpha();
	}

	//==============================================================================
	// 한 항목이 지난 시각의 사건 모으기. (되풀이하면 접힌 구간마다)
	//==============================================================================
	/**
	 * @private
	 * @param { number } trackIndex 트랙 번호.
	 * @param { Skeleton2DTrackEntry } trackEntry 항목.
	 */
	collectTrackEvents(trackIndex, trackEntry) {
		const animation = trackEntry.getAnimation();
		const duration = animation.getDuration();
		const previousTrackTime = trackEntry.getPreviousTrackTime();
		const trackTime = trackEntry.getTrackTime();
		const events = [];
		if (!trackEntry.isLoop() || duration <= 0) {
			const toTime = duration > 0 ? System.Math.min(trackTime, duration) : trackTime;
			if (toTime > previousTrackTime) {
				animation.collectEvents(previousTrackTime, toTime, events);
			}
		}
		else {
			const startLoop = previousTrackTime < 0 ? 0 : System.Math.floor(previousTrackTime / duration);
			const previousLocalTime = previousTrackTime < 0 ? -1 : previousTrackTime - startLoop * duration;
			const currentLoop = System.Math.floor(trackTime / duration);
			const currentLocalTime = trackTime - currentLoop * duration;
			if (currentLoop === startLoop) {
				animation.collectEvents(previousLocalTime, currentLocalTime, events);
			}
			else {
				animation.collectEvents(previousLocalTime, duration, events);
				for (let loopIndex = startLoop + 1; loopIndex < currentLoop; ++loopIndex) {
					animation.collectEvents(-1, duration, events);
				}
				animation.collectEvents(-1, currentLocalTime, events);
			}
		}
		const animationName = animation.getName();
		for (const event of events) {
			this.#firedEvents.push(new Skeleton2DFiredEvent(trackIndex, animationName, event));
		}
	}

	//==============================================================================
	// 시간 흘리기. (트랙과 섞여 나가는 항목의 시각, 다 섞인 앞 항목은 떼고, 사건을 모은다)
	//==============================================================================
	/**
	 * @param { number } timeDelta 흐른 시간. (초)
	 */
	update(timeDelta) {
		const tracks = this.#tracks;
		for (let trackIndex = 0; trackIndex < tracks.length; ++trackIndex) {
			const trackEntry = tracks[trackIndex];
			if (trackEntry === null) {
				continue;
			}
			trackEntry.advance(timeDelta);
			const mixingFrom = trackEntry.getMixingFrom();
			if (mixingFrom !== null) {
				mixingFrom.advance(timeDelta);
				if (trackEntry.getMixRatio() >= 1) {
					trackEntry.setMixingFrom(null);
				}
			}
			this.collectTrackEvents(trackIndex, trackEntry);
		}
	}

	//==============================================================================
	// 뼈대에 걸기. (트랙 0 부터 차례로 섞어 뼈대의 지역 값과 슬롯에 쓴다)
	//==============================================================================
	/**
	 * @param { object } skeleton 쓸 뼈대. (Skeleton2D, 이 자료로 지은 것)
	 */
	apply(skeleton) {
		const skeletonData = this.getData();
		const basePose = this.#basePose;
		const fromPose = this.#fromPose;
		const toPose = this.#toPose;
		const tracks = this.#tracks;
		skeleton.readPose(basePose);

		// 걸린 클립들이 움직이는 값은 처음 자세에서 시작한다. (프레임마다 쌓이지 않게)
		for (const trackEntry of tracks) {
			if (trackEntry === null) {
				continue;
			}
			const animation = trackEntry.getAnimation();
			animation.resetKeyedToSetup(basePose, skeletonData);
			const mixingFrom = trackEntry.getMixingFrom();
			if (mixingFrom !== null) {
				const fromAnimation = mixingFrom.getAnimation();
				fromAnimation.resetKeyedToSetup(basePose, skeletonData);
			}
		}

		for (const trackEntry of tracks) {
			if (trackEntry === null) {
				continue;
			}
			const animation = trackEntry.getAnimation();
			const animationTime = trackEntry.getAnimationTime();
			const mixRatio = trackEntry.getMixRatio();
			const mixingFrom = trackEntry.getMixingFrom();
			let alpha = trackEntry.getAlpha();
			toPose.copyFrom(basePose);
			animation.apply(toPose, skeletonData, animationTime);
			if (mixingFrom !== null) {
				const fromAnimation = mixingFrom.getAnimation();
				const fromAnimationTime = mixingFrom.getAnimationTime();
				fromPose.copyFrom(basePose);
				fromAnimation.apply(fromPose, skeletonData, fromAnimationTime);
				fromPose.blend(toPose, mixRatio);
				basePose.blend(fromPose, alpha);
			}
			else {
				alpha *= mixRatio;
				basePose.blend(toPose, alpha);
			}
		}
		skeleton.writePose(basePose);
	}

	//==============================================================================
	// 모은 사건 꺼내기. (꺼낸 뒤 비운다)
	//==============================================================================
	/**
	 * @returns { Skeleton2DFiredEvent[] } 지난 update 들에서 모은 사건. (난 차례)
	 */
	takeEvents() {
		const firedEvents = this.#firedEvents;
		this.#firedEvents = [];
		return firedEvents;
	}
}
