//==============================================================================
// 포함 모듈 목록.
//==============================================================================
const System = globalThis;
import { ToonBlendMode } from "./toonmaterial.js";


//==============================================================================
// 전역 상수 목록.
//==============================================================================
// 그리기 줄의 단계. (addPass 의 콜백을 부를 자리)
// - beforeOpaque: 불투명한 몸 앞. (평면 거울에 비친 모습, 하늘)
// - afterOpaque: 불투명한 몸 뒤, 바깥선 껍데기 앞.
// - afterOutline: 바깥선 껍데기 뒤, 비치는 것 앞. (화면 공간 바깥선 ToonScreenOutline.drawOutline 을 섞을 자리)
// - afterTransparent: 비치는 것 뒤. (효과)
export const ToonDrawStage = System.Object.freeze({
	beforeOpaque: "beforeOpaque",
	afterOpaque: "afterOpaque",
	afterOutline: "afterOutline",
	afterTransparent: "afterTransparent",
});


//==============================================================================
// 툰 그리기 줄. (한 프레임에 그릴 모형을 담아 두었다가 ToonRenderer 로 차례를 맞춰 그린다)
// - 차례: 단계 beforeOpaque → 불투명한 몸 → afterOpaque → 불투명한 것의 바깥선 → afterOutline → 비치는 것(카메라에서 먼 것부터, 깊이는 쓰지 않음) → afterTransparent.
//   몸을 다 그린 뒤 바깥선을 몰아 그려 프로그램을 덜 바꾸고, 비치는 것은 뒤의 것이 비쳐 보이게 맨 끝에 먼 것부터 섞는다.
// - 비치는 것: 그릴 때의 alpha 나 tintColor 의 알파가 1 보다 작거나 blendMode 가 alpha 가 아닌 것. 바깥선도 함께(hasOutline) 그린다.
// - 묶음: options.group 이 같은 비치는 것은 한 덩어리로 가운데 깊이(담긴 것의 평균)로 정렬하고 담은 차례로 그린다.
//   options.isDepthPrepassed 가 묶음 안에 하나라도 있으면 그 덩어리는 깊이만 먼저 그린 뒤 같은 깊이(LEQUAL)인 화소에만 색을 칠한다.
//   여러 부품이 겹친 홀로그램이 두 겹으로 밝지 않고 한 덩어리로 비친다. 덩어리끼리는 먼 것부터라 서로 비친다.
// - 단계 콜백: addPass(stage, callback) 의 callback(renderer, webGL2RenderingContext) 를 그 자리에서 부른다. 부른 뒤 렌더러가 프레임의 그리기 상태를 다시 건다.
// - 인스턴스 묶음(addMeshInstanced)은 불투명이면 몸과 바깥선을 한 번에 그리고, 비치면 인스턴스 자리의 가운데로 한 덩어리로 정렬한다.
// - 그림자: drawShadows(renderer, shadowMap) 가 castsShadow 가 false 가 아닌 불투명한 것만 그림자 깊이로 그린다. draw 보다 먼저 부른다.
// - 사용: 매 프레임 clear() → addMesh / addMeshInstanced / addPass → (drawShadows) → draw(renderer, camera) 나 drawWithMatrices(renderer, 보기 행렬, 투영 행렬)
//   draw 는 renderer.beginFrameWithCamera(camera) 와 endFrame 을 스스로 부른다. drawWithMatrices 는 beginFrameWithMatrices 를 부른다. (직교 원 행렬 카메라)
//   화면 사각형(ToonRenderer.setScreenRect)은 그 전에 건다. clear 는 담은 모형과 단계 콜백을 모두 비운다.
// - 담는 것은 행렬과 꼴의 참조다. draw 를 부를 때까지 고치지 않는다.
//==============================================================================
export class ToonDrawQueue {
	//==============================================================================
	// 멤버 변수 목록.
	//==============================================================================
	/** @private @type { Array<object> } */ #itemList; // { mesh, modelMatrix, instances, options, isTransparent, depthPosition, depth }
	/** @private @type { Array<object> } */ #passList; // { stage, callback }

	//==============================================================================
	// 생성.
	//==============================================================================
	constructor() {
		this.#itemList = [];
		this.#passList = [];
	}

	//==============================================================================
	// 비우기. (프레임마다 담기 전에, 단계 콜백도 비운다)
	//==============================================================================
	clear() {
		this.#itemList.length = 0;
		this.#passList.length = 0;
	}

	//==============================================================================
	// 담은 수 반환.
	//==============================================================================
	/**
	 * @returns { number }
	 */
	getItemCount() {
		return this.#itemList.length;
	}

	//==============================================================================
	// 단계 콜백 담기. (ToonDrawStage 의 자리에서 callback(renderer, webGL2RenderingContext) 를 부른다, 담은 차례로)
	//==============================================================================
	/**
	 * @param { string } stage - ToonDrawStage
	 * @param { Function } callback
	 */
	addPass(stage, callback) {
		this.#passList.push({ stage: stage, callback: callback });
	}

	//==============================================================================
	// 모형 하나 담기. (null 이면 담지 않는다)
	//==============================================================================
	/**
	 * @param { object | null } mesh - ToonRenderer.createMesh 의 결과.
	 * @param { Matrix4 } modelMatrix
	 * @param { object } [options] - ToonRenderer.drawMesh 의 꼴과 castsShadow (기본 true), group, isDepthPrepassed
	 */
	addMesh(mesh, modelMatrix, options = {}) {
		if (mesh === null || mesh === undefined) {
			return;
		}
		const center = mesh.boundingCenter;
		const depthPosition = modelMatrix.transformPoint(center[0], center[1], center[2]);
		this.#itemList.push({ mesh: mesh, modelMatrix: modelMatrix, instances: null, options: options, isTransparent: this.isTransparentOptions(options), depthPosition: depthPosition, depth: 0 });
	}

	//==============================================================================
	// 같은 모형 여럿 담기. (GPU 인스턴싱, 비어 있거나 null 이면 담지 않는다)
	//==============================================================================
	/**
	 * @param { object | null } mesh
	 * @param { Array<object> } instances - { modelMatrix, tintColor } 의 배열.
	 * @param { object } [options]
	 */
	addMeshInstanced(mesh, instances, options = {}) {
		if (mesh === null || mesh === undefined || instances.length === 0) {
			return;
		}
		const depthPosition = { x: 0, y: 0, z: 0 };
		for (const instance of instances) {
			const elements = instance.modelMatrix.getElements();
			depthPosition.x += elements[12];
			depthPosition.y += elements[13];
			depthPosition.z += elements[14];
		}
		depthPosition.x /= instances.length;
		depthPosition.y /= instances.length;
		depthPosition.z /= instances.length;
		this.#itemList.push({ mesh: mesh, modelMatrix: null, instances: instances, options: options, isTransparent: this.isTransparentOptions(options), depthPosition: depthPosition, depth: 0 });
	}

	//==============================================================================
	// 그릴 꼴이 비치는지. (alpha 나 틴트의 알파가 1 보다 작거나 섞는 방식이 곧은 알파가 아님)
	//==============================================================================
	/**
	 * @param { object } options
	 * @returns { boolean }
	 */
	isTransparentOptions(options) {
		const alpha = options.alpha !== undefined ? options.alpha : 1;
		const tintAlpha = options.tintColor !== undefined ? options.tintColor[3] : 1;
		const blendMode = options.blendMode !== undefined ? options.blendMode : ToonBlendMode.alpha;
		return alpha < 1 || tintAlpha < 1 || blendMode !== ToonBlendMode.alpha;
	}

	//==============================================================================
	// 그림자 깊이 그리기. (불투명하고 castsShadow 가 false 가 아닌 것만, 앞의 프레임버퍼와 뷰포트는 되돌린다)
	//==============================================================================
	/**
	 * @param { object } renderer - ToonRenderer
	 * @param { object } shadowMap - ShadowMap
	 */
	drawShadows(renderer, shadowMap) {
		renderer.beginShadowPass(shadowMap);
		for (const item of this.#itemList) {
			if (item.isTransparent || item.options.castsShadow === false) {
				continue;
			}
			this.drawItem(renderer, item, item.options);
		}
		renderer.endShadowPass();
	}

	//==============================================================================
	// 담은 것 그리기. (beginFrameWithCamera 와 endFrame 을 스스로 부른다)
	//==============================================================================
	/**
	 * @param { object } renderer - ToonRenderer
	 * @param { object } camera - Camera3D
	 */
	draw(renderer, camera) {
		renderer.beginFrameWithCamera(camera);
		this.drawStages(renderer, (position) => {
			return camera.readViewDepth(position.x, position.y, position.z);
		});
		renderer.endFrame();
	}

	//==============================================================================
	// 보기와 투영 행렬로 담은 것 그리기. (Camera3D 없이, beginFrameWithMatrices 와 endFrame 을 스스로 부른다)
	//==============================================================================
	/**
	 * @param { object } renderer - ToonRenderer
	 * @param { Matrix4 } viewMatrix
	 * @param { Matrix4 } projectionMatrix
	 */
	drawWithMatrices(renderer, viewMatrix, projectionMatrix) {
		renderer.beginFrameWithMatrices(viewMatrix, projectionMatrix);
		const elements = viewMatrix.getElements();
		this.drawStages(renderer, (position) => {
			return -(elements[2] * position.x + elements[6] * position.y + elements[10] * position.z + elements[14]);
		});
		renderer.endFrame();
	}

	//==============================================================================
	// 한 단계의 콜백 부르기. (부른 뒤 프레임의 그리기 상태를 다시 건다)
	//==============================================================================
	/**
	 * @param { object } renderer
	 * @param { string } stage
	 */
	runPasses(renderer, stage) {
		let isRun = false;
		for (const pass of this.#passList) {
			if (pass.stage !== stage) {
				continue;
			}
			pass.callback(renderer, renderer.getWebGL2RenderingContext());
			isRun = true;
		}
		if (isRun) {
			renderer.applyFrameState();
		}
	}

	//==============================================================================
	// 단계마다 그리기. (beginFrame 과 endFrame 사이, readDepth(자리) 는 카메라에서의 보기 깊이)
	//==============================================================================
	/**
	 * @param { object } renderer
	 * @param { Function } readDepth
	 */
	drawStages(renderer, readDepth) {
		const itemList = this.#itemList;
		const webGL2RenderingContext = renderer.getWebGL2RenderingContext();
		this.runPasses(renderer, ToonDrawStage.beforeOpaque);

		// 1. 불투명한 몸. (인스턴스 묶음은 바깥선까지 한 번에)
		const outlineItemList = [];
		for (const item of itemList) {
			if (item.isTransparent) {
				continue;
			}
			if (item.instances !== null) {
				this.drawItem(renderer, item, item.options);
				continue;
			}
			// 화면 밖이면 drawMesh 가 걸러 센다. 바깥선도 담지 않는다.
			if (item.options.isCulled !== false && !renderer.isVisible(item.mesh, item.modelMatrix.getElements())) {
				this.drawItem(renderer, item, item.options);
				continue;
			}
			const bodyOptions = System.Object.assign({}, item.options, { hasOutline: false });
			this.drawItem(renderer, item, bodyOptions);
			if (item.options.hasOutline !== false && item.mesh.outlineVertexArray !== null) {
				outlineItemList.push(item);
			}
		}
		this.runPasses(renderer, ToonDrawStage.afterOpaque);

		// 2. 불투명한 것의 바깥선.
		for (const item of outlineItemList) {
			renderer.drawMeshOutline(item.mesh, item.modelMatrix, item.options);
		}
		this.runPasses(renderer, ToonDrawStage.afterOutline);

		// 3. 비치는 것. (묶음은 한 덩어리로, 먼 것부터, 깊이는 쓰지 않음)
		const entryList = [];
		const groupTable = new Map();
		for (const item of itemList) {
			if (!item.isTransparent) {
				continue;
			}
			item.depth = readDepth(item.depthPosition);
			const group = item.options.group;
			const isDepthPrepassed = item.options.isDepthPrepassed === true;
			if (group === undefined || group === null) {
				entryList.push({ depthSum: item.depth, itemList: [item], isDepthPrepassed: isDepthPrepassed });
				continue;
			}
			let entry = groupTable.get(group);
			if (entry === undefined) {
				entry = { depthSum: 0, itemList: [], isDepthPrepassed: false };
				groupTable.set(group, entry);
				entryList.push(entry);
			}
			entry.depthSum += item.depth;
			entry.itemList.push(item);
			entry.isDepthPrepassed = entry.isDepthPrepassed || isDepthPrepassed;
		}
		if (entryList.length > 0) {
			entryList.sort((entry, other) => {
				return other.depthSum / other.itemList.length - entry.depthSum / entry.itemList.length;
			});
			webGL2RenderingContext.depthMask(false);
			for (const entry of entryList) {
				if (entry.isDepthPrepassed) {
					webGL2RenderingContext.colorMask(false, false, false, false);
					webGL2RenderingContext.depthMask(true);
					for (const item of entry.itemList) {
						this.drawItem(renderer, item, item.options);
					}
					webGL2RenderingContext.colorMask(true, true, true, true);
					webGL2RenderingContext.depthMask(false);
				}
				for (const item of entry.itemList) {
					this.drawItem(renderer, item, item.options);
				}
			}
			webGL2RenderingContext.depthMask(true);
		}
		this.runPasses(renderer, ToonDrawStage.afterTransparent);
	}

	//==============================================================================
	// 하나 그리기. (모형 하나는 drawMesh, 인스턴스 묶음은 drawMeshInstanced)
	//==============================================================================
	/**
	 * @param { object } renderer
	 * @param { object } item
	 * @param { object } options
	 */
	drawItem(renderer, item, options) {
		if (item.instances !== null) {
			renderer.drawMeshInstanced(item.mesh, item.instances, options);
		}
		else {
			renderer.drawMesh(item.mesh, item.modelMatrix, options);
		}
	}
}
