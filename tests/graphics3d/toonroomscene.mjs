//==============================================================================
// 애버런트 판의 방 꼴의 툰 장면. (toondrawbench.mjs 와 toondrawitemchrome.test.mjs 가 브라우저에서 같이 쓴다)
// - 엔진만으로 짠다. 땅 하나, 부품 많은 모형 여섯 종(모형 하나에 부품 여섯, 부품마다 재질 범위 indexStart, indexCount 와 바깥선 범위),
//   모형 서른여섯(그리기 216), 부품마다 다른 꼴(색, 틴트, 빛남, 텍스처, 반사 세기, 머티리얼), 해 그림자(onChange), 화면 공간 바깥선.
// - 길은 둘.
//   fresh: 게임이 지금 하는 꼴. 부품마다 꼴 객체를 프레임마다 새로 짓고(Object.assign), 모형마다 행렬을 프레임마다 새로 짓는다.
//   item: 남겨 두는 그리기 항목(ToonDrawItem). 부품마다 한 번 짓고 프레임마다 addItem, 도는 모형만 setModelMatrix, 빛나는 부품 하나만 setOption.
//   (엔진에 ToonDrawItem 이 없으면 fresh 로 그린다, 고치기 전 엔진과 화면을 견줄 때)
// - 두 길의 화면은 같다. 프레임 번호로만 움직인다.
// - 쓰는 법: const scene = createRoomScene(vanilla, webGL2RenderingContext, width, height, "item"); scene.drawFrame(frame);
// - isCameraMoving 을 주면 카메라가 프레임마다 방을 돈다. (프레임 블록 값이 패스마다 바뀌는 꼴, toondrawbench.mjs 와 toonscenepage.html 의 roommove)
//==============================================================================
const System = globalThis;

export const ROOM_MODEL_COUNT = 36;
export const ROOM_PART_COUNT = 6;
export const ROOM_KIND_COUNT = 6;

//==============================================================================
// 장면 짓기.
//==============================================================================
/**
 * @param { object } vanilla - import.js 의 모듈.
 * @param { WebGL2RenderingContext } webGL2RenderingContext - 그릴 컨텍스트.
 * @param { number } width - 캔버스 너비.
 * @param { number } height - 캔버스 높이.
 * @param { string } path - "fresh" 나 "item".
 * @param { boolean } [isCameraMoving] - 참이면 카메라가 프레임마다 방을 돈다. (기본 거짓)
 * @returns { object } { renderer, queue, drawFrame(frame), path }
 */
export function createRoomScene(vanilla, webGL2RenderingContext, width, height, path, isCameraMoving = false) {
	const { ToonRenderer, ToonDrawQueue, ToonScreenOutline, ToonMaterial, MeshBuilder, createBoxGeometry, createSphereGeometry, createRoundedBoxGeometry, createCylinderGeometry, createOctahedronGeometry, ShadowMap, ShadowUpdateMode, Camera3D, Matrix4, Vector3 } = vanilla;
	const drawPath = path === "item" && vanilla.ToonDrawItem !== undefined ? "item" : "fresh";
	const renderer = new ToonRenderer(webGL2RenderingContext);
	const groundBuilder = new MeshBuilder();
	groundBuilder.addPart(createBoxGeometry(20, 0.2, 20), Matrix4.createTranslation(0, -0.1, 0), "#7a8090", { hasOutline: false });
	const groundMesh = renderer.createMesh(groundBuilder.readArrays());

	// 모형 여섯 종. (부품 여섯, 부품마다 몸과 바깥선 껍데기의 번호 범위)
	const kindList = [];
	for (let kind = 0; kind < ROOM_KIND_COUNT; ++kind) {
		const builder = new MeshBuilder();
		const rangeList = [];
		for (let part = 0; part < ROOM_PART_COUNT; ++part) {
			const size = 0.12 + ((kind + part) % 4) * 0.04;
			let geometry = null;
			switch ((kind + part) % 5) {
				case 0:
					geometry = createBoxGeometry(size * 2, size * 2, size * 2);
					break;
				case 1:
					geometry = createSphereGeometry(size, 12, 8);
					break;
				case 2:
					geometry = createRoundedBoxGeometry(size * 2, size * 1.4, size * 2, 2, size * 0.2);
					break;
				case 3:
					geometry = createCylinderGeometry(size * 0.6, size, size * 2, 10);
					break;
				default:
					geometry = createOctahedronGeometry(size * 1.2);
					break;
			}
			const indexStart = builder.getIndexCount();
			const outlineIndexStart = builder.getOutlineIndexCount();
			const partMatrix = Matrix4.createTranslation(((part % 3) - 1) * 0.3, 0.15 + System.Math.floor(part / 3) * 0.35, ((part * 5) % 3 - 1) * 0.12);
			builder.addPart(geometry, partMatrix, "#ffffff", { hasOutline: part % 3 !== 2 });
			rangeList.push({ indexStart: indexStart, indexCount: builder.getIndexCount() - indexStart, outlineIndexStart: outlineIndexStart, outlineIndexCount: builder.getOutlineIndexCount() - outlineIndexStart });
		}
		kindList.push({ mesh: renderer.createMesh(builder.readArrays()), rangeList: rangeList });
	}

	// 텍스처 둘, 머티리얼 둘.
	const textureList = [];
	for (let index = 0; index < 2; ++index) {
		const shade = 140 + index * 60;
		const data = new System.Uint8Array([255, 255, 255, 255, shade, 90, 180, 255, shade, 90, 180, 255, 255, 255, 255, 255]);
		textureList.push(renderer.createTexture({ width: 2, height: 2, data: data }, { isMipmapped: false, isRepeated: true }));
	}
	const materialList = [];
	for (let index = 0; index < 2; ++index) {
		materialList.push(new ToonMaterial({
			name: "roomStripe" + index,
			surfaceChunk: `void applySurface(inout ToonSurface surface) {
				float stripe = step(0.5, fract(surface.localPosition.y * ${(4 + index * 3).toFixed(1)}));
				surface.baseColor *= mix(0.8, 1.0, stripe);
			}`,
		}));
	}

	// 부품 꼴. (종류와 부품마다, 색과 틴트, 빛남, 텍스처, 반사 세기, 머티리얼)
	const colorList = [[0.88, 0.75, 0.63, 1], [0.63, 0.75, 0.88, 1], [0.75, 0.88, 0.63, 1], [0.88, 0.63, 0.75, 1], [0.94, 0.94, 0.88, 1], [0.56, 0.6, 0.63, 1], [0.75, 0.5, 0.38, 1]];
	const readPartLook = (kind, part) => {
		const index = kind * ROOM_PART_COUNT + part;
		const look = { tintColor: colorList[index % colorList.length].slice(), tintAmount: 1 };
		if (index % 5 === 1) {
			look.emissiveColor = [1, 0.7, 0.3];
			look.emissiveIntensity = 0.3;
		}
		if (index % 7 === 3) {
			look.baseColorTexture = textureList[index % textureList.length];
			look.uvTransform = [0, 0, 2, 2];
		}
		if (index % 4 === 2) {
			look.specularScale = 0.4;
		}
		if (index % 11 === 6) {
			look.material = materialList[index % materialList.length];
		}
		return look;
	};

	// 모형 서른여섯. (자리, 종류, 몇은 돈다)
	const modelList = [];
	for (let index = 0; index < ROOM_MODEL_COUNT; ++index) {
		const column = index % 6;
		const row = System.Math.floor(index / 6);
		const kind = (index * 5) % ROOM_KIND_COUNT;
		const partList = [];
		for (let part = 0; part < ROOM_PART_COUNT; ++part) {
			partList.push({ look: readPartLook(kind, part), lineId: 2 + index * ROOM_PART_COUNT + part, range: kindList[kind].rangeList[part], drawItem: null });
		}
		modelList.push({ x: column * 2.2 - 5.5, z: row * 2.2 - 5.5, turn: ((index * 7) % 12) / 12 * System.Math.PI * 2, kind: kind, isRotating: index % 9 === 4, partList: partList, matrix: null });
	}
	const readModelMatrix = (model, frame) => {
		const matrix = Matrix4.createTranslation(model.x, 0, model.z);
		matrix.multiply(Matrix4.createRotationY(model.turn + (model.isRotating ? frame * 0.03 : 0)));
		return matrix;
	};
	// 빛나는 부품 하나는 프레임마다 빛남 세기가 바뀐다.
	const pulsePart = modelList[3].partList[1];
	const readPulse = (frame) => {
		return 0.2 + 0.4 * ((frame % 30) / 30);
	};
	const readPartOptions = (part) => {
		return System.Object.assign({}, part.look, part.range, { lineId: part.lineId });
	};
	if (drawPath === "item") {
		for (const model of modelList) {
			model.matrix = readModelMatrix(model, 0);
			for (const part of model.partList) {
				part.drawItem = new vanilla.ToonDrawItem(kindList[model.kind].mesh, model.matrix, readPartOptions(part));
			}
		}
	}

	// 바깥선, 그림자, 카메라.
	const screenOutline = new ToonScreenOutline(webGL2RenderingContext);
	screenOutline.setWidth(2);
	screenOutline.setCrease(40, 1, 0.8);
	for (let lineId = 2; lineId < 2 + ROOM_MODEL_COUNT * ROOM_PART_COUNT; lineId += 13) {
		screenOutline.setLineColor(lineId, [0.5, 0.1, 0.1, 1]);
	}
	const queue = new ToonDrawQueue();
	queue.setScreenOutline(screenOutline);
	const shadowMap = new ShadowMap(webGL2RenderingContext, 1024);
	shadowMap.setUpdateMode(ShadowUpdateMode.onChange);
	shadowMap.updateLightMatrix(Vector3.create(0, 0, 0), Vector3.create(-0.4, -1, -0.3), 12, 0.1, 40);
	renderer.setShadow(shadowMap, 0.6);
	const camera = new Camera3D();
	camera.setPerspective(0.75, 0.1, 80);
	camera.setAspectRatio(width / height);
	camera.lookAt(Vector3.create(0, 9, 10), Vector3.create(0, 0, 0), Vector3.create(0, 1, 0));
	const groundItem = drawPath === "item" ? new vanilla.ToonDrawItem(groundMesh, Matrix4.createIdentity(), { lineId: 1, hasScreenOutline: false, hasCreaseLine: false }) : null;

	return {
		renderer: renderer,
		queue: queue,
		screenOutline: screenOutline,
		camera: camera,
		path: drawPath,
		drawFrame(frame) {
			if (isCameraMoving) {
				const angle = frame * 0.01;
				camera.lookAt(Vector3.create(10 * System.Math.sin(angle), 9, 10 * System.Math.cos(angle)), Vector3.create(0, 0, 0), Vector3.create(0, 1, 0));
			}
			pulsePart.look.emissiveIntensity = readPulse(frame);
			queue.clear();
			if (drawPath === "item") {
				pulsePart.drawItem.setOption("emissiveIntensity", pulsePart.look.emissiveIntensity);
				queue.addItem(groundItem);
				for (const model of modelList) {
					if (model.isRotating) {
						model.matrix.copyFrom(readModelMatrix(model, frame));
						for (const part of model.partList) {
							part.drawItem.setModelMatrix(model.matrix);
						}
					}
					for (const part of model.partList) {
						queue.addItem(part.drawItem);
					}
				}
			}
			else {
				queue.addMesh(groundMesh, Matrix4.createIdentity(), { lineId: 1, hasScreenOutline: false, hasCreaseLine: false });
				for (const model of modelList) {
					const modelMatrix = readModelMatrix(model, frame);
					const mesh = kindList[model.kind].mesh;
					for (const part of model.partList) {
						queue.addMesh(mesh, modelMatrix, readPartOptions(part));
					}
				}
			}
			queue.drawShadows(renderer, shadowMap);
			queue.draw(renderer, camera);
		},
	};
}
