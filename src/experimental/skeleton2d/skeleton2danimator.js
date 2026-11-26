//==============================================================================
// 2D 뼈대 애니메이터 컴포넌트. (노드에 붙여 뼈대를 돌리고 그린다)
// - 초안: 0.4.0 뒤 기능, API 가 바뀔 수 있다.
// - Skeleton2D(자세)와 Skeleton2DAnimationState(트랙)를 들고, tick 에서 시간을 흘려 자세를 쓰고, draw 에서 월드 행렬과 IK 를 셈해 그린다.
//   draw 에서 셈하므로 씬의 tick 이 컴포넌트 tick 뒤에 옮긴 뼈(IK 목표 같은)도 그 프레임에 걸린다.
// - 그림은 붙임의 조각 이름으로 찾는다. setAtlas 가 엔진 SpriteAtlas 에서 모든 스킨의 조각을 찾아 담고, setFrame 으로 하나씩 넣을 수도 있다.
// - 슬롯마다 그리기 차례대로 삼각형을 Graphic 의 정점 자리(getVertexData, x, y, u, v)에 적어 drawVertices 로 그린다. 슬롯 색은 그림에 곱한다.
//   같은 쪽 그림의 슬롯은 엔진의 묶어 그리기가 한 번에 그린다. Graphic 은 고치지 않았다.
// - 뼈대 원점은 노드의 축점 자리다. (내용 크기가 0 이면 노드 자리)
// - SpriteAnimator(프레임 애니메이션)와는 따로다. 그것은 같은 노드의 Sprite 그림을 바꾸고, 이것은 스스로 그린다.
// - 기즈모를 켜면(setGizmoVisible) 뼈를 선으로 그린다.
//==============================================================================

/**
 * @example <caption>노드에 뼈대를 붙여 걷기를 틀고 IK 목표 옮기기</caption>
 * import { WorldNode, Vector2 } from "./import.js";
 * import * as Experimental from "./src/experimental/experimental.js";
 *
 * const skeletonData = Experimental.Skeleton2DData.createFromJson({
 * 	bones: [{ name: "root" }, { name: "leg", parent: "root", rotation: 90, length: 30 }, { name: "target", parent: "root", x: 20, y: 25 }],
 * 	ik: [{ name: "legIk", bones: ["leg"], target: "target" }],
 * 	animations: { walk: { bones: { root: { translate: [{ time: 0, y: 0 }, { time: 0.5, y: -4 }, { time: 1, y: 0 }] } } } },
 * });
 * const node = new WorldNode();
 * node.setLocalPosition(Vector2.create(320, 200));
 * const skeletonAnimator = node.addComponent(Experimental.Skeleton2DAnimator);
 * skeletonAnimator.setSkeletonData(skeletonData);
 * skeletonAnimator.setAnimation(0, "walk", true, 0);
 * skeletonAnimator.tick(0.25);
 * skeletonAnimator.findBone("target").setPosition(-20, 25);
 * const skeleton = skeletonAnimator.getSkeleton();
 * skeleton.updateWorldTransform();
 * console.log(skeletonAnimator.findBone("root").getY(), skeletonAnimator.findBone("leg").getWorldRotation().toFixed(2));
 */


//==============================================================================
// 포함 모듈 목록.
//==============================================================================
const System = globalThis;
import { Component } from "../../core/component.js";
import { Color } from "../../base/color.js";
import { Vector2 } from "../../base/vector2.js";
import { Skeleton2D } from "./skeleton2d.js";
import { Skeleton2DAnimationState } from "./skeleton2danimationstate.js";


//==============================================================================
// 전역 상수 목록.
//==============================================================================
// Graphic 정점 하나의 값 수. (x, y, u, v)
const FLOATS_PER_VERTEX = 4;

// 기즈모 뼈 선 색.
const GIZMO_BONE_COLOR = new Color(0.3, 0.9, 1, 1);

// 기즈모 관절 색.
const GIZMO_JOINT_COLOR = new Color(1, 0.8, 0.2, 1);


//==============================================================================
// 2D 뼈대 애니메이터 컴포넌트.
//==============================================================================
/**
 * @example <caption>아틀라스를 걸고 두 트랙을 섞어 그리기</caption>
 * import { Engine, EngineConfiguration, Scene, WorldNode, Vector2, SpriteAtlas } from "./import.js";
 * import * as Experimental from "./src/experimental/experimental.js";
 *
 * const spriteAtlas = new SpriteAtlas();
 * await spriteAtlas.loadData({ pagePaths: ["examples/assets/spritesheet.png"], frames: { body: [0, 0, 0, 200, 200] } });
 * const skeletonData = Experimental.Skeleton2DData.createFromJson({
 * 	bones: [{ name: "root" }, { name: "body", parent: "root", y: -50 }],
 * 	slots: [{ name: "body", bone: "body", attachment: "body" }],
 * 	skins: [{ name: "default", attachments: { body: { body: { type: "region", frame: "body", width: 100, height: 100 } } } }],
 * 	animations: {
 * 		bob: { bones: { body: { translate: [{ time: 0, y: 0 }, { time: 0.5, y: -10 }, { time: 1, y: 0 }] } } },
 * 		spin: { bones: { body: { rotate: [{ time: 0, value: 0 }, { time: 2, value: 360 }] } } },
 * 	},
 * });
 *
 * class MainScene extends Scene {
 * 	initialize(engine) {
 * 		super.initialize(engine);
 * 		const node = new WorldNode();
 * 		node.setLocalPosition(Vector2.create(320, 260));
 * 		const root = this.getRoot();
 * 		root.addChild(node);
 * 		const skeletonAnimator = node.addComponent(Experimental.Skeleton2DAnimator);
 * 		skeletonAnimator.setSkeletonData(skeletonData);
 * 		skeletonAnimator.setAtlas(spriteAtlas);
 * 		skeletonAnimator.setAnimation(0, "bob", true, 0);
 * 		skeletonAnimator.setAnimation(1, "spin", true, 0);
 * 		skeletonAnimator.setTrackAlpha(1, 0.5);
 * 	}
 * }
 *
 * const engineConfiguration = new EngineConfiguration();
 * engineConfiguration.referenceResolutionSize = Vector2.create(640, 360);
 * const engine = new Engine(engineConfiguration);
 * engine.run(new MainScene());
 */
export class Skeleton2DAnimator extends Component {
	//==============================================================================
	// 멤버 변수 목록.
	//==============================================================================
	/** @private @type { object | null } */ #skeletonData;
	/** @private @type { Skeleton2D | null } */ #skeleton;
	/** @private @type { Skeleton2DAnimationState | null } */ #animationState;
	/** @private @type { Map<string, object> } */ #frameTable;
	/** @private @type { number } */ #timeScale;
	/** @private @type { Float64Array } */ #vertexPositions;

	//==============================================================================
	// 생성. (자료 없음, 빠르기 1)
	//==============================================================================
	constructor() {
		super();
		this.setComponentType("Skeleton2DAnimator");
		this.#skeletonData = null;
		this.#skeleton = null;
		this.#animationState = null;
		this.#frameTable = new System.Map();
		this.#timeScale = 1;
		this.#vertexPositions = new System.Float64Array(64);
	}

	//==============================================================================
	// 뼈대 자료 설정. (새 Skeleton2D 와 Skeleton2DAnimationState 를 짓는다, 트랙은 비운다)
	//==============================================================================
	/**
	 * @param { object } skeletonData 뼈대 자료. (Skeleton2DData)
	 */
	setSkeletonData(skeletonData) {
		this.#skeletonData = skeletonData;
		this.#skeleton = new Skeleton2D(skeletonData);
		this.#animationState = new Skeleton2DAnimationState(skeletonData);
		this.#skeleton.updateWorldTransform();
	}

	//==============================================================================
	// 뼈대 자료 반환.
	//==============================================================================
	/**
	 * @returns { object | null } 뼈대 자료. (Skeleton2DData, 없으면 null)
	 */
	getSkeletonData() {
		return this.#skeletonData;
	}

	//==============================================================================
	// 뼈대 반환.
	//==============================================================================
	/**
	 * @returns { Skeleton2D | null } 뼈대. (자료가 없으면 null)
	 */
	getSkeleton() {
		return this.#skeleton;
	}

	//==============================================================================
	// 애니메이션 상태 반환.
	//==============================================================================
	/**
	 * @returns { Skeleton2DAnimationState | null } 애니메이션 상태. (자료가 없으면 null)
	 */
	getAnimationState() {
		return this.#animationState;
	}

	//==============================================================================
	// 아틀라스에서 조각 찾아 담기. (모든 스킨의 붙임 조각 이름으로, 다 찾았으면 true)
	// - 아틀라스를 다 읽은 뒤에 부른다. 자료를 바꾸면 다시 부른다.
	//==============================================================================
	/**
	 * @param { object } spriteAtlas 엔진 SpriteAtlas.
	 * @returns { boolean } 붙임의 조각을 모두 찾았으면 참. (자료가 없으면 거짓)
	 */
	setAtlas(spriteAtlas) {
		const skeletonData = this.getSkeletonData();
		if (skeletonData === null) {
			return false;
		}
		let isAllFound = true;
		const skins = skeletonData.getSkins();
		for (const skin of skins) {
			const attachmentList = skin.getAttachmentList();
			for (const attachment of attachmentList) {
				const frameName = attachment.getFrameName();
				const frame = spriteAtlas.readFrame(frameName);
				if (frame === null) {
					isAllFound = false;
					continue;
				}
				this.setFrame(frameName, frame);
			}
		}
		return isAllFound;
	}

	//==============================================================================
	// 조각 하나 넣기. (같은 이름이 있으면 바꾼다)
	//==============================================================================
	/**
	 * @param { string } frameName 붙임의 조각 이름.
	 * @param { object } frame 그림과 영역. (Frame)
	 */
	setFrame(frameName, frame) {
		this.#frameTable.set(frameName, frame);
	}

	//==============================================================================
	// 조각 찾기. (없으면 null)
	//==============================================================================
	/**
	 * @param { string } frameName 조각 이름.
	 * @returns { object | null } 조각. (Frame, 없으면 null)
	 */
	getFrame(frameName) {
		const frame = this.#frameTable.get(frameName);
		if (frame === undefined) {
			return null;
		}
		return frame;
	}

	//==============================================================================
	// 트랙에 클립 걸기. (Skeleton2DAnimationState.setAnimation, 자료가 없거나 클립이 없으면 false)
	//==============================================================================
	/**
	 * @param { number } trackIndex 트랙 번호. (0 이 바탕)
	 * @param { string } animationName 클립 이름.
	 * @param { boolean } isLoop 되풀이하면 참. (기본 참)
	 * @param { number } mixDuration 섞는 시간. (초, 기본 0)
	 * @returns { boolean } 걸었으면 참.
	 */
	setAnimation(trackIndex, animationName, isLoop = true, mixDuration = 0) {
		const animationState = this.getAnimationState();
		if (animationState === null) {
			return false;
		}
		return animationState.setAnimation(trackIndex, animationName, isLoop, mixDuration);
	}

	//==============================================================================
	// 트랙의 층 몫 설정.
	//==============================================================================
	/**
	 * @param { number } trackIndex 트랙 번호.
	 * @param { number } alpha 층 몫. (0 ~ 1)
	 */
	setTrackAlpha(trackIndex, alpha) {
		const animationState = this.getAnimationState();
		if (animationState === null) {
			return;
		}
		animationState.setTrackAlpha(trackIndex, alpha);
	}

	//==============================================================================
	// 뼈 찾기. (없거나 자료가 없으면 null)
	//==============================================================================
	/**
	 * @param { string } boneName 뼈 이름.
	 * @returns { object | null } 뼈. (Skeleton2DBone)
	 */
	findBone(boneName) {
		const skeleton = this.getSkeleton();
		if (skeleton === null) {
			return null;
		}
		return skeleton.findBone(boneName);
	}

	//==============================================================================
	// 빠르기 설정. (tick 이 흘리는 시간에 곱한다, 0 이면 멈춘다)
	//==============================================================================
	/**
	 * @param { number } timeScale 빠르기.
	 */
	setTimeScale(timeScale) {
		this.#timeScale = timeScale;
	}

	//==============================================================================
	// 빠르기 반환.
	//==============================================================================
	/**
	 * @returns { number } 빠르기.
	 */
	getTimeScale() {
		return this.#timeScale;
	}

	//==============================================================================
	// 시간을 흘려 자세 쓰기. (빠르기를 곱하지 않는다, 정해진 걸음으로 돌릴 때 직접 부른다)
	//==============================================================================
	/**
	 * @param { number } timeDelta 흐른 시간. (초)
	 */
	update(timeDelta) {
		const animationState = this.getAnimationState();
		const skeleton = this.getSkeleton();
		if (animationState === null || skeleton === null) {
			return;
		}
		animationState.update(timeDelta);
		animationState.apply(skeleton);
	}

	//==============================================================================
	// 모은 사건 꺼내기. (자료가 없으면 빈 배열)
	//==============================================================================
	/**
	 * @returns { object[] } 알린 사건 목록. (Skeleton2DFiredEvent)
	 */
	takeEvents() {
		const animationState = this.getAnimationState();
		if (animationState === null) {
			return [];
		}
		return animationState.takeEvents();
	}

	//==============================================================================
	// 갱신. (빠르기를 곱한 시간으로 update)
	//==============================================================================
	/**
	 * @override
	 * @param { number } timeDelta 지난 프레임부터의 시간. (초)
	 */
	tick(timeDelta) {
		super.tick(timeDelta);
		const timeScale = this.getTimeScale();
		this.update(timeDelta * timeScale);
	}

	//==============================================================================
	// 뼈대 원점 읽기. (노드 내용 영역 안의 축점 자리)
	//==============================================================================
	/**
	 * @returns { Vector2 } 뼈대 원점. (노드 내용 영역의 왼쪽 위 기준)
	 */
	readOrigin() {
		const node = this.getNode();
		if (node === null || typeof node.getPivot !== "function" || typeof node.getContentSize !== "function") {
			return Vector2.create(0, 0);
		}
		const pivot = node.getPivot();
		const contentSize = node.getContentSize();
		return Vector2.create(contentSize.x * pivot.x, contentSize.y * pivot.y);
	}

	//==============================================================================
	// 출력. (월드 행렬과 IK 를 셈하고 그리기 차례대로 슬롯을 그린다)
	//==============================================================================
	/**
	 * @override
	 * @param { object } graphic 그릴 그래픽. (Graphic)
	 */
	draw(graphic) {
		const skeleton = this.getSkeleton();
		if (skeleton === null) {
			return;
		}
		skeleton.updateWorldTransform();
		const origin = this.readOrigin();
		const imageTextureCache = graphic.getImageTextureCache();
		const isImageSmoothingEnabled = graphic.isImageSmoothingEnabled();
		const isImageMipmapEnabled = graphic.isImageMipmapEnabled();
		const vertexData = graphic.getVertexData();
		const maximumTriangleCount = System.Math.floor(vertexData.length / (FLOATS_PER_VERTEX * 3));
		const previousBlendMode = graphic.getBlendMode();
		const slots = skeleton.getSlots();
		const drawOrder = skeleton.getDrawOrder();
		const drawColor = new Color(1, 1, 1, 1);
		for (const slotIndex of drawOrder) {
			const attachment = skeleton.getSlotAttachment(slotIndex);
			if (attachment === null) {
				continue;
			}
			const slot = slots[slotIndex];
			const slotColor = slot.getColor();
			if (slotColor.alpha <= 0) {
				continue;
			}
			const frameName = attachment.getFrameName();
			const frame = this.getFrame(frameName);
			if (frame === null) {
				continue;
			}
			const image = frame.getImage();
			const texture = imageTextureCache.getTexture(image, isImageSmoothingEnabled, isImageMipmapEnabled);
			if (!texture) {
				continue;
			}
			const imageRect = frame.getImageRect();
			const rectX = imageRect.position.x;
			const rectY = imageRect.position.y;
			const rectWidth = imageRect.size.x;
			const rectHeight = imageRect.size.y;
			const vertexCount = attachment.getVertexCount();
			if (this.#vertexPositions.length < vertexCount * 2) {
				this.#vertexPositions = new System.Float64Array(vertexCount * 2);
			}
			const vertexPositions = this.#vertexPositions;
			skeleton.computeAttachmentVertices(slotIndex, vertexPositions, rectWidth, rectHeight);
			const uvs = attachment.getUvs();
			const triangles = attachment.getTriangles();
			const imageWidth = image.width;
			const imageHeight = image.height;
			const slotData = slot.getData();
			const blendMode = slotData.getBlendMode();
			graphic.setBlendMode(blendMode);
			drawColor.red = slotColor.red;
			drawColor.green = slotColor.green;
			drawColor.blue = slotColor.blue;
			drawColor.alpha = slotColor.alpha;

			// 삼각형을 정점 자리에 담을 만큼씩 나눠 그린다.
			const triangleCount = System.Math.floor(triangles.length / 3);
			for (let firstTriangle = 0; firstTriangle < triangleCount; firstTriangle += maximumTriangleCount) {
				const chunkTriangleCount = System.Math.min(maximumTriangleCount, triangleCount - firstTriangle);
				let offset = 0;
				for (let triangleIndex = firstTriangle; triangleIndex < firstTriangle + chunkTriangleCount; ++triangleIndex) {
					for (let cornerIndex = 0; cornerIndex < 3; ++cornerIndex) {
						const vertexIndex = triangles[triangleIndex * 3 + cornerIndex];
						vertexData[offset] = vertexPositions[vertexIndex * 2] + origin.x;
						vertexData[offset + 1] = vertexPositions[vertexIndex * 2 + 1] + origin.y;
						vertexData[offset + 2] = (rectX + uvs[vertexIndex * 2] * rectWidth) / imageWidth;
						vertexData[offset + 3] = (rectY + uvs[vertexIndex * 2 + 1] * rectHeight) / imageHeight;
						offset += FLOATS_PER_VERTEX;
					}
				}
				graphic.drawVertices(chunkTriangleCount * 3, texture, drawColor);
			}
		}
		graphic.setBlendMode(previousBlendMode);
	}

	//==============================================================================
	// 기즈모 출력. (뼈마다 원점에서 길이만큼 선, 원점에 점)
	//==============================================================================
	/**
	 * @override
	 * @param { object } graphic 그릴 그래픽. (Graphic)
	 */
	drawGizmos(graphic) {
		const isGizmoVisible = this.isGizmoVisible();
		const skeleton = this.getSkeleton();
		if (!isGizmoVisible || skeleton === null) {
			return;
		}
		const origin = this.readOrigin();
		const bones = skeleton.getBones();
		graphic.setStrokeColor(GIZMO_BONE_COLOR);
		graphic.setFillColor(GIZMO_JOINT_COLOR);
		for (const bone of bones) {
			const boneData = bone.getData();
			const length = boneData.getLength();
			const start = Vector2.create(bone.getWorldX() + origin.x, bone.getWorldY() + origin.y);
			if (length > 0) {
				const tip = bone.localToWorld(length, 0);
				const end = Vector2.create(tip.x + origin.x, tip.y + origin.y);
				graphic.drawLine([start, end], 2);
			}
			graphic.drawCircle(start, 3);
		}
	}
}
