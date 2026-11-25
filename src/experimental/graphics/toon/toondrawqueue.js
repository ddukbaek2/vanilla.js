//==============================================================================
// 포함 모듈 목록.
//==============================================================================
const System = globalThis;


//==============================================================================
// 툰 그리기 줄. (한 프레임에 그릴 모형을 담아 두었다가 ToonRenderer 로 차례를 맞춰 그린다)
// - 차례: 불투명한 몸 → 불투명한 것의 바깥선 → 비치는 것(카메라에서 먼 것부터, 깊이는 쓰지 않음).
//   몸을 다 그린 뒤 바깥선을 몰아 그려 프로그램을 덜 바꾸고, 비치는 것은 뒤의 것이 비쳐 보이게 맨 끝에 먼 것부터 섞는다.
// - 비치는 것: 그릴 때의 alpha 나 tintColor 의 알파가 1 보다 작은 것. 바깥선도 함께(hasOutline) 그린다.
// - 인스턴스 묶음(addMeshInstanced)은 불투명이면 몸과 바깥선을 한 번에 그리고, 비치면 인스턴스 자리의 가운데로 한 덩어리로 정렬한다.
// - 그림자: drawShadows(renderer, shadowMap) 가 castsShadow 가 false 가 아닌 불투명한 것만 그림자 깊이로 그린다. draw 보다 먼저 부른다.
// - 사용: 매 프레임 clear() → addMesh / addMeshInstanced → (drawShadows) → draw(renderer, camera)
//   draw 는 renderer.beginFrameWithCamera(camera) 와 endFrame 을 스스로 부른다. 화면 사각형(ToonRenderer.setScreenRect)은 그 전에 건다.
// - 담는 것은 행렬과 꼴의 참조다. draw 를 부를 때까지 고치지 않는다.
//==============================================================================
export class ToonDrawQueue {
	//==============================================================================
	// 멤버 변수 목록.
	//==============================================================================
	/** @private @type { Array<object> } */ #itemList; // { mesh, modelMatrix, instances, options, isTransparent, depthPosition, depth }

	//==============================================================================
	// 생성.
	//==============================================================================
	constructor() {
		this.#itemList = [];
	}

	//==============================================================================
	// 비우기. (프레임마다 담기 전에)
	//==============================================================================
	clear() {
		this.#itemList.length = 0;
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
	// 모형 하나 담기. (null 이면 담지 않는다)
	//==============================================================================
	/**
	 * @param { object | null } mesh - ToonRenderer.createMesh 의 결과.
	 * @param { Matrix4 } modelMatrix
	 * @param { object } [options] - ToonRenderer.drawMesh 의 꼴과 castsShadow (기본 true)
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
	// 그릴 꼴이 비치는지. (alpha 나 틴트의 알파가 1 보다 작음)
	//==============================================================================
	/**
	 * @param { object } options
	 * @returns { boolean }
	 */
	isTransparentOptions(options) {
		const alpha = options.alpha !== undefined ? options.alpha : 1;
		const tintAlpha = options.tintColor !== undefined ? options.tintColor[3] : 1;
		return alpha < 1 || tintAlpha < 1;
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
	// 담은 것 그리기. (불투명한 몸 → 바깥선 → 비치는 것을 먼 것부터, beginFrameWithCamera 와 endFrame 을 스스로 부른다)
	//==============================================================================
	/**
	 * @param { object } renderer - ToonRenderer
	 * @param { object } camera - Camera3D
	 */
	draw(renderer, camera) {
		const itemList = this.#itemList;
		const webGL2RenderingContext = renderer.getWebGL2RenderingContext();
		renderer.beginFrameWithCamera(camera);

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

		// 2. 불투명한 것의 바깥선.
		for (const item of outlineItemList) {
			renderer.drawMeshOutline(item.mesh, item.modelMatrix, item.options);
		}

		// 3. 비치는 것. (먼 것부터, 깊이는 쓰지 않음)
		const transparentItemList = [];
		for (const item of itemList) {
			if (!item.isTransparent) {
				continue;
			}
			const depthPosition = item.depthPosition;
			item.depth = camera.readViewDepth(depthPosition.x, depthPosition.y, depthPosition.z);
			transparentItemList.push(item);
		}
		if (transparentItemList.length > 0) {
			transparentItemList.sort((item, other) => {
				return other.depth - item.depth;
			});
			webGL2RenderingContext.depthMask(false);
			for (const item of transparentItemList) {
				this.drawItem(renderer, item, item.options);
			}
			webGL2RenderingContext.depthMask(true);
		}
		renderer.endFrame();
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
