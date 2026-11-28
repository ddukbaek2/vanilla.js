//==============================================================================
// 포함 모듈 목록.
//==============================================================================
const System = globalThis;
import { Scene, WorldNode, Vector2, Color, Rect, Pivot, Text, TextAlign, SpriteAtlas, JsonAsset } from "../../import.js";
import * as Experimental from "../../src/experimental/experimental.js";


//==============================================================================
// 2D 뼈대 예제 씬. (러스트 예제 skeleton2d 와 같은 장면)
// - 저장소 자산 hero(도형으로 그린 아틀라스, 엔진 JSON, DragonBones JSON)를 넷 세운다.
//   1. DragonBones JSON 으로 읽은 걷기. (걸음 사건을 센다)
//   2. 걷기 위에 손 흔들기를 0.7 만 얹은 층.
//   3. 대기와 걷기를 2 초마다 0.6 초 동안 섞어 넘기는 크로스페이드.
//   4. 대기 위에 앞팔 두 뼈 IK. 목표 뼈를 원을 따라 옮기고 목표에 점을 그린다.
// - 화면을 같게 찍으려고 시간은 프레임마다 1/60 초씩 흘린다. (애니메이터의 빠르기는 0, 씬이 update 를 부른다)
//   frozenFrame 이 있으면 그 프레임 수만큼만 흘리고 멈춘다. (러스트 SKELETON2D_FRAME, 원본 ?frame=)
//==============================================================================


//==============================================================================
// 전역 상수 목록.
//==============================================================================
const VIEW_WIDTH = 960;
const VIEW_HEIGHT = 540;
const GROUND_Y = 430;
const CHARACTER_SCALE = 2;
const CHARACTER_X_LIST = [120, 360, 600, 840];
const TIME_STEP = 1 / 60;
const CROSSFADE_PERIOD_FRAMES = 120;
const CROSSFADE_MIX_SECONDS = 0.6;
const BACKGROUND_COLOR = new Color(0.11, 0.133, 0.188, 1);
const GROUND_COLOR = new Color(0.165, 0.192, 0.259, 1);
const LABEL_COLOR = new Color(0.82, 0.85, 0.9, 1);
const TARGET_COLOR = new Color(1, 0.84, 0.3, 1);
const LABEL_TEXT_LIST = ["DragonBones walk", "walk + wave 0.7", "idle <-> walk mix", "arm IK"];


//==============================================================================
// 2D 뼈대 예제 씬.
//==============================================================================
export class Skeleton2DScene extends Scene {
	//==============================================================================
	// 멤버 변수 목록.
	//==============================================================================
	/** @private @type { number | null } */ #frozenFrame;
	/** @private @type { number } */ #frameIndex;
	/** @private @type { number } */ #stepCount;
	/** @private @type { object[] } */ #animatorList;
	/** @private @type { object[] } */ #characterNodeList;
	/** @private @type { WorldNode | null } */ #stepLabelNode;
	/** @private @type { SpriteAtlas } */ #spriteAtlas;
	/** @private @type { JsonAsset } */ #skeletonJsonAsset;
	/** @private @type { JsonAsset } */ #dragonBonesJsonAsset;

	//==============================================================================
	// 생성.
	//==============================================================================
	/**
	 * @param { number | null } frozenFrame 흘릴 프레임 수. (null 이면 멈추지 않는다)
	 */
	constructor(frozenFrame) {
		super();
		this.#frozenFrame = frozenFrame;
		this.#frameIndex = 0;
		this.#stepCount = 0;
		this.#animatorList = [];
		this.#characterNodeList = [];
		this.#stepLabelNode = null;
		this.#spriteAtlas = new SpriteAtlas();
		this.#skeletonJsonAsset = new JsonAsset();
		this.#dragonBonesJsonAsset = new JsonAsset();
	}

	//==============================================================================
	// 읽기. (아틀라스, 엔진 JSON, DragonBones JSON)
	//==============================================================================
	async load(engine) {
		await super.load(engine);
		await this.#spriteAtlas.load("assets/hero.atlas.json");
		await this.#skeletonJsonAsset.load("assets/hero.skeleton.json");
		await this.#dragonBonesJsonAsset.load("assets/hero_ske.json");
	}

	//==============================================================================
	// 초기화. (캐릭터 넷과 이름 글)
	//==============================================================================
	initialize(engine) {
		super.initialize(engine);
		const skeletonData = Experimental.Skeleton2DData.createFromJson(this.#skeletonJsonAsset.data);
		const dragonBonesData = Experimental.Skeleton2DData.createFromDragonBones(this.#dragonBonesJsonAsset.data, "hero");
		const root = this.getRoot();
		for (let characterIndex = 0; characterIndex < CHARACTER_X_LIST.length; ++characterIndex) {
			const characterNode = new WorldNode();
			characterNode.setLocalPosition(Vector2.create(CHARACTER_X_LIST[characterIndex], GROUND_Y));
			characterNode.setLocalScale(Vector2.create(CHARACTER_SCALE, CHARACTER_SCALE));
			root.addChild(characterNode);
			const skeletonAnimator = characterNode.addComponent(Experimental.Skeleton2DAnimator);
			skeletonAnimator.setSkeletonData(characterIndex === 0 ? dragonBonesData : skeletonData);
			skeletonAnimator.setAtlas(this.#spriteAtlas);
			skeletonAnimator.setTimeScale(0);
			this.#animatorList.push(skeletonAnimator);
			this.#characterNodeList.push(characterNode);

			const labelNode = new WorldNode();
			labelNode.setPivot(Pivot.middleCenter);
			labelNode.setLocalPosition(Vector2.create(CHARACTER_X_LIST[characterIndex], GROUND_Y + 40));
			labelNode.setContentSize(Vector2.create(220, 24));
			root.addChild(labelNode);
			const text = labelNode.addComponent(Text);
			text.setText(LABEL_TEXT_LIST[characterIndex]);
			text.setFontSize(16);
			text.setTextColor(LABEL_COLOR);
			text.setTextAlign(TextAlign.center);
			if (characterIndex === 0) {
				this.#stepLabelNode = new WorldNode();
				this.#stepLabelNode.setPivot(Pivot.middleCenter);
				this.#stepLabelNode.setLocalPosition(Vector2.create(CHARACTER_X_LIST[characterIndex], GROUND_Y + 66));
				this.#stepLabelNode.setContentSize(Vector2.create(220, 24));
				root.addChild(this.#stepLabelNode);
				const stepText = this.#stepLabelNode.addComponent(Text);
				stepText.setText("steps 0");
				stepText.setFontSize(16);
				stepText.setTextColor(LABEL_COLOR);
				stepText.setTextAlign(TextAlign.center);
			}
		}
		const animatorList = this.#animatorList;
		animatorList[0].setAnimation(0, "walk", true, 0);
		animatorList[1].setAnimation(0, "walk", true, 0);
		animatorList[1].setAnimation(1, "wave", true, 0);
		animatorList[1].setTrackAlpha(1, 0.7);
		animatorList[3].setAnimation(0, "idle", true, 0);
		const ikConstraint = animatorList[3].getSkeleton().findIkConstraint("armIk");
		ikConstraint.setMix(1);
	}

	//==============================================================================
	// IK 목표 자리. (뼈대 기준, 어깨 앞의 원)
	//==============================================================================
	/**
	 * @param { number } frameIndex
	 * @returns { Vector2 }
	 */
	readTargetPosition(frameIndex) {
		const angle = frameIndex * TIME_STEP * 2;
		return Vector2.create(16 + System.Math.cos(angle) * 16, -70 + System.Math.sin(angle) * 16);
	}

	//==============================================================================
	// 한 걸음. (크로스페이드 넘기기, 시간 흘리기, 사건 세기, IK 목표 옮기기)
	//==============================================================================
	step() {
		const frameIndex = this.#frameIndex;
		const animatorList = this.#animatorList;
		if (frameIndex % (CROSSFADE_PERIOD_FRAMES * 2) === 0) {
			animatorList[2].setAnimation(0, "idle", true, frameIndex === 0 ? 0 : CROSSFADE_MIX_SECONDS);
		}
		else if (frameIndex % (CROSSFADE_PERIOD_FRAMES * 2) === CROSSFADE_PERIOD_FRAMES) {
			animatorList[2].setAnimation(0, "walk", true, CROSSFADE_MIX_SECONDS);
		}
		for (const skeletonAnimator of animatorList) {
			skeletonAnimator.update(TIME_STEP);
		}
		const firedEvents = animatorList[0].takeEvents();
		for (const firedEvent of firedEvents) {
			const event = firedEvent.getEvent();
			if (event.getName() === "step") {
				this.#stepCount += 1;
			}
		}
		for (let animatorIndex = 1; animatorIndex < animatorList.length; ++animatorIndex) {
			animatorList[animatorIndex].takeEvents();
		}
		const targetPosition = this.readTargetPosition(frameIndex + 1);
		const targetBone = animatorList[3].findBone("handTarget");
		targetBone.setPosition(targetPosition.x, targetPosition.y);
		const stepText = this.#stepLabelNode.getComponent(Text);
		stepText.setText("steps " + this.#stepCount);
		this.#frameIndex += 1;
	}

	//==============================================================================
	// 주기적 갱신.
	//==============================================================================
	tick(timeDelta) {
		super.tick(timeDelta);
		if (this.#animatorList.length === 0) {
			return;
		}
		if (this.#frozenFrame === null || this.#frameIndex < this.#frozenFrame) {
			this.step();
		}
	}

	//==============================================================================
	// 이전 출력. (배경과 바닥)
	//==============================================================================
	preDraw(graphic) {
		super.preDraw(graphic);
		graphic.setFillColor(BACKGROUND_COLOR);
		graphic.drawRect(Rect.create(0, 0, VIEW_WIDTH, VIEW_HEIGHT));
		graphic.setFillColor(GROUND_COLOR);
		graphic.drawRect(Rect.create(0, GROUND_Y, VIEW_WIDTH, VIEW_HEIGHT - GROUND_Y));
	}

	//==============================================================================
	// 이후 출력. (IK 목표 점)
	//==============================================================================
	postDraw(graphic) {
		super.postDraw(graphic);
		if (this.#animatorList.length === 0) {
			return;
		}
		const targetPosition = this.readTargetPosition(this.#frameIndex);
		const center = Vector2.create(CHARACTER_X_LIST[3] + targetPosition.x * CHARACTER_SCALE, GROUND_Y + targetPosition.y * CHARACTER_SCALE);
		graphic.setFillColor(TARGET_COLOR);
		graphic.drawCircle(center, 4);
	}
}
