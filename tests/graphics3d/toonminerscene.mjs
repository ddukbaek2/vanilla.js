//==============================================================================
// 광부 키우기 mid 꼴의 툰 장면. (tooninstancebufferbench.mjs 와 tooninstancebufferchrome.test.mjs 가 브라우저에서 같이 쓴다)
// - 엔진만으로 짠다. 땅 하나, 바위 모형 세 종의 인스턴스 칸마다(24 x 20 칸 가운데 480 개), 건물 스무 채, 해 그림자(onChange), 화면 공간 바깥선(꺾임 선, 번호마다 색).
// - 바위는 칸마다 선 번호가 다르다. (광부의 돌과 건물이 놓인 칸마다 번호) 몇 개는 틴트와 빛남이 다르다.
// - 길은 둘. array: ToonDrawQueue.addMeshInstanced (프레임마다 인스턴스 배열을 올림), buffer: addMeshInstanceBuffer (한 번 올린 버퍼를 같이 씀).
// - 묶음: chunkCount 를 주면 바위를 x 쪽으로 그만큼 쪼갠 칸 묶음(청크)마다 따로 담는다. (종류 x 청크 수만큼 인스턴스 묶음, 큰 맵을 청크로 나눠 그리는 꼴)
// - 쓰는 법: const scene = createMinerScene(vanilla, webGL2RenderingContext, width, height, "buffer", 1); scene.drawFrame(); scene.setRock(묶음, 번호, 고칠 것);
//==============================================================================
const System = globalThis;

// 장면의 꼴.
export const MINER_ROCK_KIND_COUNT = 3;
export const MINER_GRID_WIDTH = 24;
export const MINER_GRID_DEPTH = 20;
export const MINER_BUILDING_COUNT = 20;

//==============================================================================
// 장면 짓기.
//==============================================================================
/**
 * @param { object } vanilla - import.js 의 모듈.
 * @param { WebGL2RenderingContext } webGL2RenderingContext - 그릴 컨텍스트.
 * @param { number } width - 캔버스 너비.
 * @param { number } height - 캔버스 높이.
 * @param { string } path - "array" 나 "buffer".
 * @param { number } [chunkCount] - 바위를 x 쪽으로 쪼갤 청크 수. (기본 1)
 * @param { object } [options] - { shadowResolution (기본 1024, 광부 게임은 2048), outlineResolutionScale (기본 엔진 기본값 1, 광부 게임은 CSS 화소 하나에 1.5 화소라 DPR 2 에서 0.75), shadowUpdateMode (기본 onChange) }
 * @returns { object } { renderer, queue, drawFrame(), setRock(batch, index, change), getBatchCount(), getRockCount(batch), readRock(batch, index) }
 */
export function createMinerScene(vanilla, webGL2RenderingContext, width, height, path, chunkCount = 1, options = {}) {
	const { ToonRenderer, ToonDrawQueue, ToonScreenOutline, MeshBuilder, createBoxGeometry, createOctahedronGeometry, createFacetedChunkGeometry, createRoundedBoxGeometry, createCylinderGeometry, ShadowMap, ShadowUpdateMode, Camera3D, Matrix4, Vector3 } = vanilla;
	const renderer = new ToonRenderer(webGL2RenderingContext);
	const createMesh = (geometry, matrix, color, hasOutline) => {
		const builder = new MeshBuilder();
		builder.addPart(geometry, matrix, color, { hasOutline: hasOutline });
		return renderer.createMesh(builder.readArrays());
	};
	const groundMesh = createMesh(createBoxGeometry(MINER_GRID_WIDTH + 2, 0.2, MINER_GRID_DEPTH + 2), Matrix4.createTranslation(0, -0.1, 0), "#8a7a64", false);
	const rockMeshList = [
		createMesh(createOctahedronGeometry(0.32), Matrix4.createTranslation(0, 0.26, 0), "#9a948c", true),
		createMesh(createFacetedChunkGeometry(0.34, [1, 0.8, 1.1], [1, 1, 1]), Matrix4.createTranslation(0, 0.24, 0), "#b08a60", true),
		createMesh(createRoundedBoxGeometry(0.5, 0.4, 0.5, 2, 0.08), Matrix4.createTranslation(0, 0.2, 0), "#7c8a96", true),
	];
	const buildingMeshList = [
		createMesh(createRoundedBoxGeometry(1.4, 1.2, 1.2, 3, 0.12), Matrix4.createTranslation(0, 0.6, 0), "#d8c8a8", true),
		createMesh(createCylinderGeometry(0.5, 0.6, 1.6, 12), Matrix4.createTranslation(0, 0.8, 0), "#a8b8c8", true),
	];

	// 바위 칸. (칸마다 선 번호, 건물이 놓인 칸은 비운다)
	const buildingCellSet = new System.Set();
	const buildingList = [];
	for (let index = 0; index < MINER_BUILDING_COUNT; ++index) {
		const cellX = (index * 7) % MINER_GRID_WIDTH;
		const cellZ = (index * 5 + System.Math.floor(index / 4)) % MINER_GRID_DEPTH;
		buildingCellSet.add(cellZ * MINER_GRID_WIDTH + cellX);
		buildingList.push({ mesh: buildingMeshList[index % buildingMeshList.length], modelMatrix: Matrix4.createTranslation(cellX - MINER_GRID_WIDTH / 2 + 0.5, 0, cellZ - MINER_GRID_DEPTH / 2 + 0.5), lineId: 2000 + index });
	}
	const batchCount = MINER_ROCK_KIND_COUNT * chunkCount;
	const rockInstanceList = [];
	for (let batch = 0; batch < batchCount; ++batch) {
		rockInstanceList.push([]);
	}
	for (let cellZ = 0; cellZ < MINER_GRID_DEPTH; ++cellZ) {
		for (let cellX = 0; cellX < MINER_GRID_WIDTH; ++cellX) {
			const cellIndex = cellZ * MINER_GRID_WIDTH + cellX;
			if (buildingCellSet.has(cellIndex)) {
				continue;
			}
			const kind = (cellX * 3 + cellZ * 5) % MINER_ROCK_KIND_COUNT;
			const turn = ((cellX * 13 + cellZ * 7) % 16) / 16 * System.Math.PI * 2;
			const scale = 0.85 + ((cellX * 5 + cellZ * 11) % 7) * 0.05;
			const modelMatrix = Matrix4.createTranslation(cellX - MINER_GRID_WIDTH / 2 + 0.5, 0, cellZ - MINER_GRID_DEPTH / 2 + 0.5);
			modelMatrix.multiply(Matrix4.createRotationY(turn));
			modelMatrix.multiply(Matrix4.createScale(scale, scale, scale));
			const shade = 0.8 + ((cellX + cellZ) % 5) * 0.05;
			const instance = { modelMatrix: modelMatrix, tintColor: [shade, shade, shade * 0.95, 1], lineId: 1 + cellIndex };
			if (cellIndex % 37 === 0) {
				instance.emissiveColor = [1, 0.8, 0.3];
				instance.emissiveIntensity = 0.4;
			}
			const chunk = System.Math.min(chunkCount - 1, System.Math.floor(cellX * chunkCount / MINER_GRID_WIDTH));
			rockInstanceList[chunk * MINER_ROCK_KIND_COUNT + kind].push(instance);
		}
	}

	// 인스턴스 버퍼. (행렬 16, 틴트 4, 선 번호 1, drawMeshInstanced 가 올리는 꼴과 같은 수)
	const instanceLayout = renderer.createInstanceLayout([{ name: "instanceMatrix", size: 16 }, { name: "instanceTint", size: 4 }, { name: "instanceLineId", size: 1 }]);
	const floatCount = instanceLayout.getFloatCount();
	const writeInstance = (data, offset, instance) => {
		data.set(instance.modelMatrix.getElements(), offset);
		const emissiveColor = instance.emissiveColor !== undefined ? instance.emissiveColor : null;
		data[offset + 3] = emissiveColor !== null ? emissiveColor[0] : 0;
		data[offset + 7] = emissiveColor !== null ? emissiveColor[1] : 0;
		data[offset + 11] = emissiveColor !== null ? emissiveColor[2] : 0;
		data[offset + 15] = emissiveColor !== null && instance.emissiveIntensity !== undefined ? instance.emissiveIntensity : 1;
		data.set(instance.tintColor, offset + 16);
		data[offset + 20] = instance.lineId;
	};
	const rockBufferList = rockInstanceList.map((instances) => {
		if (path !== "buffer") {
			return null;
		}
		const data = new System.Float32Array(instances.length * floatCount);
		instances.forEach((instance, index) => {
			writeInstance(data, index * floatCount, instance);
		});
		return renderer.createInstanceBuffer(instanceLayout, data, "dynamic");
	});

	// 바깥선, 그림자, 카메라.
	const screenOutline = new ToonScreenOutline(webGL2RenderingContext);
	screenOutline.setWidth(2);
	if (options.outlineResolutionScale !== undefined) {
		screenOutline.setResolutionScale(options.outlineResolutionScale);
	}
	screenOutline.setCrease(40, 1, 0.8);
	for (let index = 0; index < MINER_BUILDING_COUNT; index += 3) {
		screenOutline.setLineColor(2000 + index, [0.55, 0.1, 0.05, 1]);
	}
	for (let lineId = 1; lineId < MINER_GRID_WIDTH * MINER_GRID_DEPTH; lineId += 29) {
		screenOutline.setLineColor(lineId, [0.05, 0.2, 0.6, 1]);
	}
	const queue = new ToonDrawQueue();
	queue.setScreenOutline(screenOutline);
	const shadowMap = new ShadowMap(webGL2RenderingContext, options.shadowResolution ?? 1024);
	shadowMap.setUpdateMode(options.shadowUpdateMode ?? ShadowUpdateMode.onChange);
	shadowMap.updateLightMatrix(Vector3.create(0, 0, 0), Vector3.create(-0.45, -1, -0.35), 16, 0.1, 40);
	renderer.setShadow(shadowMap, 0.6);
	const camera = new Camera3D();
	camera.setPerspective(0.75, 0.1, 80);
	camera.setAspectRatio(width / height);
	camera.lookAt(Vector3.create(0, 13, 13), Vector3.create(0, 0, 0.5), Vector3.create(0, 1, 0));

	return {
		renderer: renderer,
		queue: queue,
		rockMeshList: rockMeshList,
		shadowMap: shadowMap,
		screenOutline: screenOutline,
		// 한 프레임. (담기, 그림자, 선의 판, 몸, 바깥선)
		drawFrame() {
			queue.clear();
			queue.addMesh(groundMesh, Matrix4.createIdentity(), { lineId: 1, hasScreenOutline: false, hasCreaseLine: false });
			for (let batch = 0; batch < batchCount; ++batch) {
				const rockMesh = rockMeshList[batch % MINER_ROCK_KIND_COUNT];
				if (path === "buffer") {
					queue.addMeshInstanceBuffer(rockMesh, rockBufferList[batch], rockInstanceList[batch].length, { specularScale: 0 });
				}
				else {
					queue.addMeshInstanced(rockMesh, rockInstanceList[batch], { specularScale: 0 });
				}
			}
			for (const building of buildingList) {
				queue.addMesh(building.mesh, building.modelMatrix, { lineId: building.lineId });
			}
			queue.drawShadows(renderer, shadowMap);
			webGL2RenderingContext.bindFramebuffer(webGL2RenderingContext.FRAMEBUFFER, null);
			webGL2RenderingContext.viewport(0, 0, width, height);
			webGL2RenderingContext.clearColor(0.42, 0.55, 0.62, 1);
			webGL2RenderingContext.clear(webGL2RenderingContext.COLOR_BUFFER_BIT | webGL2RenderingContext.DEPTH_BUFFER_BIT);
			queue.draw(renderer, camera);
		},
		// 바위 하나 고치기. (change 의 modelMatrix, tintColor, lineId 를 덮는다, buffer 길은 그 인스턴스만 bufferSubData)
		setRock(batch, index, change) {
			const instance = System.Object.assign(rockInstanceList[batch][index], change);
			if (path === "buffer") {
				const data = new System.Float32Array(floatCount);
				writeInstance(data, 0, instance);
				renderer.updateInstanceBufferRange(rockBufferList[batch], index, data);
			}
		},
		getBatchCount() {
			return batchCount;
		},
		getRockCount(batch) {
			return rockInstanceList[batch].length;
		},
		readRock(batch, index) {
			return rockInstanceList[batch][index];
		},
	};
}
