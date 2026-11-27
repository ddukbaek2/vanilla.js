//==============================================================================
// 애버런트 로비 꼴의 툰 장면. (toondrawbench.mjs 와 toondrawbatchchrome.test.mjs 가 브라우저에서 같이 쓴다)
// - 엔진만으로 짠다. 땅 하나, 모형 서른 종, 그리기 300 남짓(addMesh 하나씩), 서로 다른 그리기 꼴(색, 틴트, 빛남, 텍스처, 반사 세기) 마흔,
//   표면 조각 머티리얼 넷(프로그램이 다름), 반투명 열둘(묶음 하나 포함), 해 그림자(onChange), 화면 공간 바깥선(꺾임 선, 번호마다 색).
// - 게임 꼴을 흉내 낸다: 대부분은 물체마다 지어 둔 꼴 객체를 프레임마다 그대로 넘기고, 스물은 프레임마다 새 꼴 객체({ ...꼴, lineId })를 짓는다.
//   열은 프레임마다 돌고(새 행렬), 꼴 하나는 틴트 배열을 그 자리에서 고친다(같은 객체의 값이 바뀜).
// - 프레임 번호로만 움직인다. (같은 프레임 번호면 같은 화면)
// - 쓰는 법: const scene = createLobbyScene(vanilla, webGL2RenderingContext, width, height); scene.drawFrame(frame);
//==============================================================================
const System = globalThis;

export const LOBBY_OBJECT_COUNT = 300;
export const LOBBY_LOOK_COUNT = 40;
export const LOBBY_MESH_KIND_COUNT = 30;

//==============================================================================
// 장면 짓기.
//==============================================================================
/**
 * @param { object } vanilla - import.js 의 모듈.
 * @param { WebGL2RenderingContext } webGL2RenderingContext - 그릴 컨텍스트.
 * @param { number } width - 캔버스 너비.
 * @param { number } height - 캔버스 높이.
 * @param { object | null } [readCounter] - { count } 를 주면 엔진에 넘기는 꼴 객체를 Proxy 로 감싸 칸 읽기(get)를 센다. (재기용, 시간은 재지 않는다)
 * @returns { object } { renderer, queue, drawFrame(frame), looks }
 */
export function createLobbyScene(vanilla, webGL2RenderingContext, width, height, readCounter = null) {
	const wrapOptions = (options) => {
		if (readCounter === null) {
			return options;
		}
		return new System.Proxy(options, {
			get(target, key, receiver) {
				readCounter.count += 1;
				return System.Reflect.get(target, key, receiver);
			},
		});
	};
	const { ToonRenderer, ToonDrawQueue, ToonScreenOutline, ToonMaterial, MeshBuilder, createBoxGeometry, createSphereGeometry, createRoundedBoxGeometry, createCylinderGeometry, createOctahedronGeometry, ShadowMap, ShadowUpdateMode, Camera3D, Matrix4, Vector3 } = vanilla;
	const renderer = new ToonRenderer(webGL2RenderingContext);
	const createMesh = (geometry, matrix, color, hasOutline) => {
		const builder = new MeshBuilder();
		builder.addPart(geometry, matrix, color, { hasOutline: hasOutline });
		return renderer.createMesh(builder.readArrays());
	};
	const groundMesh = createMesh(createBoxGeometry(24, 0.2, 18), Matrix4.createTranslation(0, -0.1, 0), "#7a8090", false);
	const colorList = ["#e0c0a0", "#a0c0e0", "#c0e0a0", "#e0a0c0", "#f0f0e0", "#9098a0", "#c08060", "#60a0a0"];
	const meshList = [];
	for (let kind = 0; kind < LOBBY_MESH_KIND_COUNT; ++kind) {
		const size = 0.3 + (kind % 5) * 0.08;
		const color = colorList[kind % colorList.length];
		const hasOutline = kind % 3 !== 0;
		let geometry = null;
		switch (kind % 5) {
			case 0:
				geometry = createBoxGeometry(size * 2, size * 2, size * 2);
				break;
			case 1:
				geometry = createSphereGeometry(size, 16 + kind % 3 * 4, 12);
				break;
			case 2:
				geometry = createRoundedBoxGeometry(size * 2, size * 1.6, size * 2, 3, size * 0.2);
				break;
			case 3:
				geometry = createCylinderGeometry(size * 0.7, size, size * 2.4, 10 + kind % 4 * 2);
				break;
			default:
				geometry = createOctahedronGeometry(size * 1.2);
				break;
		}
		meshList.push(createMesh(geometry, Matrix4.createTranslation(0, size, 0), color, hasOutline));
	}

	// 텍스처 셋. (2 x 2 체크)
	const textureList = [];
	for (let index = 0; index < 3; ++index) {
		const shade = 120 + index * 50;
		const data = new System.Uint8Array([255, 255, 255, 255, shade, 90, 200 - index * 40, 255, shade, 90, 200 - index * 40, 255, 255, 255, 255, 255]);
		textureList.push(renderer.createTexture({ width: 2, height: 2, data: data }, { isMipmapped: false, isRepeated: true }));
	}

	// 표면 조각 머티리얼 넷. (줄무늬 굵기만 다름, 프로그램이 따로)
	const materialList = [];
	for (let index = 0; index < 4; ++index) {
		materialList.push(new ToonMaterial({
			name: "lobbyStripe" + index,
			surfaceChunk: `void applySurface(inout ToonSurface surface) {
				float stripe = step(0.5, fract(surface.localPosition.y * ${(3 + index * 2).toFixed(1)}));
				surface.baseColor *= mix(0.75, 1.0, stripe);
			}`,
		}));
	}

	// 그리기 꼴 마흔. (색, 틴트, 빛남, 텍스처, 반사 세기, 머티리얼이 섞임)
	const looks = [];
	for (let index = 0; index < LOBBY_LOOK_COUNT; ++index) {
		const look = {};
		const shade = 0.7 + (index % 7) * 0.05;
		look.tintColor = [shade, 0.6 + (index % 5) * 0.08, 1 - (index % 4) * 0.1, 1];
		if (index % 3 === 0) {
			look.tintAmount = 0.2 + (index % 4) * 0.1;
		}
		if (index % 5 === 1) {
			look.emissiveColor = [1, 0.7, 0.3];
			look.emissiveIntensity = 0.3 + (index % 3) * 0.2;
		}
		if (index % 4 === 2) {
			look.baseColorTexture = textureList[index % textureList.length];
			look.uvTransform = [0, 0, 2 + index % 3, 2];
		}
		if (index % 6 === 3) {
			look.specularScale = 0.3;
			look.rimScale = 1.5;
		}
		if (index % 8 === 5) {
			look.material = materialList[index % materialList.length];
		}
		if (index % 9 === 4) {
			look.shadeOffset = 0.15;
			look.outlineColor = [0.3, 0.1, 0.05, 1];
			look.outlineWidthScale = 1.4;
		}
		looks.push(look);
	}

	// 물체 300. (자리, 모형, 꼴, 선 번호)
	const objectList = [];
	for (let index = 0; index < LOBBY_OBJECT_COUNT; ++index) {
		const column = index % 20;
		const row = System.Math.floor(index / 20);
		const turn = ((index * 7) % 12) / 12 * System.Math.PI * 2;
		const modelMatrix = Matrix4.createTranslation(column * 1.1 - 10.5, 0, row * 1.05 - 7.5);
		modelMatrix.multiply(Matrix4.createRotationY(turn));
		const look = looks[(index * 13) % LOBBY_LOOK_COUNT];
		const options = System.Object.assign({}, look, { lineId: 2 + index });
		const isTransparent = index % 25 === 7;
		if (isTransparent) {
			options.alpha = 0.55;
			if (index % 50 === 7) {
				options.group = "glass";
				options.isDepthPrepassed = true;
			}
		}
		objectList.push({ mesh: meshList[(index * 7) % LOBBY_MESH_KIND_COUNT], baseMatrix: modelMatrix, modelMatrix: modelMatrix, look: look, rawOptions: options, options: wrapOptions(options), isRotating: index % 30 === 11, isFreshOptions: index % 15 === 4 });
	}

	// 바깥선, 그림자, 카메라.
	const screenOutline = new ToonScreenOutline(webGL2RenderingContext);
	screenOutline.setWidth(2);
	screenOutline.setCrease(40, 1, 0.8);
	for (let lineId = 2; lineId < 2 + LOBBY_OBJECT_COUNT; lineId += 17) {
		screenOutline.setLineColor(lineId, [0.5, 0.1, 0.1, 1]);
	}
	const queue = new ToonDrawQueue();
	queue.setScreenOutline(screenOutline);
	const shadowMap = new ShadowMap(webGL2RenderingContext, 1024);
	shadowMap.setUpdateMode(ShadowUpdateMode.onChange);
	shadowMap.updateLightMatrix(Vector3.create(0, 0, 0), Vector3.create(-0.4, -1, -0.3), 15, 0.1, 40);
	renderer.setShadow(shadowMap, 0.6);
	const camera = new Camera3D();
	camera.setPerspective(0.75, 0.1, 80);
	camera.setAspectRatio(width / height);
	camera.lookAt(Vector3.create(0, 11, 12), Vector3.create(0, 0, 0), Vector3.create(0, 1, 0));
	const animatedLook = looks[1];
	const groundOptions = wrapOptions({ lineId: 1, hasScreenOutline: false, hasCreaseLine: false });

	return {
		renderer: renderer,
		queue: queue,
		looks: looks,
		objectList: objectList,
		drawFrame(frame) {
			// 꼴 하나의 틴트를 그 자리에서 고친다. (같은 꼴 객체, 값만 바뀜)
			animatedLook.tintColor[0] = 0.6 + 0.3 * ((frame % 40) / 40);
			queue.clear();
			queue.addMesh(groundMesh, Matrix4.createIdentity(), groundOptions);
			for (const object of objectList) {
				if (object.isRotating) {
					const rotated = object.baseMatrix.clone();
					rotated.multiply(Matrix4.createRotationY(frame * 0.03));
					object.modelMatrix = rotated;
				}
				if (object.look === animatedLook) {
					object.rawOptions.tintColor = animatedLook.tintColor;
				}
				const options = object.isFreshOptions ? wrapOptions(System.Object.assign({}, object.rawOptions)) : object.options;
				queue.addMesh(object.mesh, object.modelMatrix, options);
			}
			queue.drawShadows(renderer, shadowMap);
			queue.draw(renderer, camera);
		},
	};
}
