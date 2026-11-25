//==============================================================================
// 포함 모듈 목록.
//==============================================================================
const System = globalThis;
import { Matrix4, Vector3, Camera3D, ToonRenderer, ToonDrawQueue, ToonDrawStage, ToonBlendMode, ToonBufferUsage, ToonMesh, createReflectionMatrix } from "../../import.js";


//==============================================================================
// 전역 상수 목록.
//==============================================================================
// 칠 획 숫자의 유니폼과 함수. (러스트 예제 toonmaterial 과 같은 글)
export const SEGMENT_CHUNK = `uniform float segmentMask;
uniform vec3 segmentColor;
float readSegmentDistance(vec2 point, vec2 start, vec2 end) {
	vec2 along = end - start;
	float ratio = clamp(dot(point - start, along) / dot(along, along), 0.0, 1.0);
	return length(point - start - along * ratio);
}
float readSegmentInk(vec2 point) {
	vec2 starts[7] = vec2[7](vec2(-0.4, 0.9), vec2(0.45, 0.82), vec2(0.45, -0.08), vec2(-0.4, -0.9), vec2(-0.45, -0.08), vec2(-0.45, 0.82), vec2(-0.4, 0.0));
	vec2 ends[7] = vec2[7](vec2(0.4, 0.9), vec2(0.45, 0.08), vec2(0.45, -0.82), vec2(0.4, -0.9), vec2(-0.45, -0.82), vec2(-0.45, 0.08), vec2(0.4, 0.0));
	int mask = int(segmentMask + 0.5);
	float ink = 0.0;
	for (int index = 0; index < 7; ++index) {
		float strength = ((mask >> index) & 1) == 1 ? 1.0 : 0.12;
		float distance = readSegmentDistance(point, starts[index], ends[index]);
		ink = max(ink, (1.0 - smoothstep(0.07, 0.1, distance)) * strength);
	}
	return ink;
}
`;

// 칠 획 숫자를 칠하는 표면 조각.
export const SEGMENT_SURFACE_CHUNK = `void applySurface(inout ToonSurface surface) {
	vec2 point = vec2((surface.uv.x - 0.5) * 1.6, 0.5 - surface.uv.y) * 2.2;
	float ink = readSegmentInk(point);
	surface.baseColor = mix(surface.baseColor, segmentColor, ink);
	surface.emission += toLinear(segmentColor) * ink * 1.5;
}
`;

// 바위 인스턴스를 놓는 정점 조각. (돌림의 cos, sin, 가로 크기, 세로 크기와 자리, 색)
export const ROCK_VERTEX_CHUNK = `void applyVertex(inout ToonVertex vertex) {
	float scaleAcross = instanceShape.z;
	float scaleUp = instanceShape.w;
	vertex.modelMatrix = mat4(vec4(instanceShape.x * scaleAcross, 0.0, -instanceShape.y * scaleAcross, 0.0), vec4(0.0, scaleUp, 0.0, 0.0), vec4(instanceShape.y * scaleAcross, 0.0, instanceShape.x * scaleAcross, 0.0), vec4(instanceOffset, 1.0));
	vertex.localNormal = vec3(vertex.localNormal.x / (scaleAcross * scaleAcross), vertex.localNormal.y / (scaleUp * scaleUp), vertex.localNormal.z / (scaleAcross * scaleAcross));
	vertex.color *= instanceColor;
}
`;

// 숫자마다 켜는 획. (a b c d e f g 가 비트 0 ~ 6)
const DIGIT_SEGMENT_MASKS = [0x3f, 0x06, 0x5b, 0x4f, 0x66, 0x6d, 0x7d, 0x07, 0x7f, 0x6f];

// 바위 수. (3 줄 x 9)
const ROCK_COUNT = 27;


//==============================================================================
// 도형 하나로 지은 배열.
//==============================================================================
/**
 * @param { object } geometry
 * @param { Matrix4 } matrix
 * @param { string } colorText
 * @param { object } options
 * @returns { object }
 */
function buildArrays(geometry, matrix, colorText, options) {
	const builder = new ToonMesh.MeshBuilder();
	builder.addPart(geometry, matrix, colorText, options);
	return builder.readArrays();
}

//==============================================================================
// 바둑판 64x64 RGBA.
//==============================================================================
/**
 * @returns { object } { width, height, data }
 */
function createCheckerPixels() {
	const size = 64;
	const data = new System.Uint8Array(size * size * 4);
	for (let y = 0; y < size; ++y) {
		for (let x = 0; x < size; ++x) {
			const isLight = ((x >> 3) + (y >> 3)) % 2 === 0;
			data.set(isLight ? [235, 225, 210, 255] : [120, 140, 170, 255], (y * size + x) * 4);
		}
	}
	return { width: size, height: size, data: data };
}

//==============================================================================
// 데칼 묶음 128x64 RGBA. (왼쪽 칸 고리, 오른쪽 칸 십자, 흰색에 알파)
//==============================================================================
/**
 * @returns { object } { width, height, data }
 */
function createDecalPixels() {
	const width = 128;
	const height = 64;
	const data = new System.Uint8Array(width * height * 4);
	for (let y = 0; y < height; ++y) {
		for (let x = 0; x < width; ++x) {
			const localX = (x % 64 + 0.5) / 64 - 0.5;
			const localY = (y + 0.5) / 64 - 0.5;
			let isCovered = false;
			if (x < 64) {
				const radius = System.Math.hypot(localX, localY);
				isCovered = radius > 0.2 && radius < 0.32;
			}
			else {
				isCovered = (System.Math.abs(localX) < 0.07 && System.Math.abs(localY) < 0.32) || (System.Math.abs(localY) < 0.07 && System.Math.abs(localX) < 0.32);
			}
			data.set([255, 255, 255, isCovered ? 255 : 0], (y * width + x) * 4);
		}
	}
	return { width: width, height: height, data: data };
}

//==============================================================================
// 3 수 벡터 길이를 1 로.
//==============================================================================
/**
 * @param { Array<number> } vector
 * @returns { Array<number> }
 */
function normalize(vector) {
	const length = System.Math.hypot(vector[0], vector[1], vector[2]);
	return [vector[0] / length, vector[1] / length, vector[2] / length];
}

//==============================================================================
// sRGB 를 선형으로 바꿔 세기를 곱한 색. (애버런트 readLinearColor)
//==============================================================================
/**
 * @param { Array<number> } color
 * @param { number } intensity
 * @returns { Array<number> }
 */
function readLinearColor(color, intensity) {
	return [System.Math.pow(color[0], 2.2) * intensity, System.Math.pow(color[1], 2.2) * intensity, System.Math.pow(color[2], 2.2) * intensity];
}


//==============================================================================
// 툰 확장 자리와 빛 장면. (러스트 예제 toonmaterial 과 같은 장면, 같은 값)
// - 왼쪽 판: 머티리얼의 표면 조각이 UV 로 칠 획 숫자를 그린다. (게임 고유 무늬는 조각으로 두는 자리, 숫자는 0.5 초마다 바뀜)
// - 상자: 바탕색 텍스처(바둑판)와 데칼 묶음 그림의 한 칸(고리와 십자)을 덮고 그 색으로 빛난다.
// - 고리: 그 그리기만 다른 빛 묶음(반 램버트 4 단 띠 0.3725 / 0.6471 / 0.8627 / 1.0)으로 칠한다.
// - 오른쪽 공: 둘레를 도는 점광 셋(감쇠 (1 - 거리 / 범위)^2)과 정반사, 림 빛, 채움 빛을 받는다.
// - 홀로그램 둘: 더하기 섞기와 소프트 엣지. 왼쪽은 깊이 선패스 없이(겹친 곳이 두 겹), 오른쪽은 한 덩어리로(묶음과 깊이 선패스).
// - 바닥은 비치게 두고, 그리기 줄의 불투명 앞 단계에서 바닥에 비친 모습(createReflectionMatrix, 감기는 렌더러가 뒤집음)을 어둡게(colorScale) 그린다.
// - 뒤의 바위 27 개는 영구 인스턴스 버퍼 하나(꼴: 돌림과 크기 4, 자리 3, 색 3)를 머티리얼 정점 조각이 읽어 놓는다.
//==============================================================================
export class ToonMaterialScene {
	//==============================================================================
	// 멤버 변수 목록.
	//==============================================================================
	/** @private @type { WebGL2RenderingContext } */ #webGL2RenderingContext;
	/** @private @type { ToonRenderer } */ #renderer;
	/** @private @type { object } */ #bandLightSet;
	/** @private @type { object } */ #meshes; // { floor, screen, cube, torus, sphere, hologramBall, hologramBody, rock }
	/** @private @type { object } */ #segmentMaterial;
	/** @private @type { object } */ #rockMaterial;
	/** @private @type { object } */ #rockBuffer;
	/** @private @type { WebGLTexture } */ #checkerTexture;
	/** @private @type { WebGLTexture } */ #decalTexture;
	/** @private @type { Camera3D } */ #camera;
	/** @private @type { ToonDrawQueue } */ #queue;

	//==============================================================================
	// 생성. (렌더러, 메시, 머티리얼, 인스턴스 버퍼, 텍스처)
	//==============================================================================
	/**
	 * @constructor
	 * @param { WebGL2RenderingContext } webGL2RenderingContext
	 */
	constructor(webGL2RenderingContext) {
		this.#webGL2RenderingContext = webGL2RenderingContext;
		const renderer = new ToonRenderer(webGL2RenderingContext);
		this.#renderer = renderer;
		renderer.setLight([-0.4, -1.0, -0.3], [0.9, 0.85, 0.8], [0.32, 0.36, 0.46], [0.14, 0.12, 0.11]);
		renderer.setFillLight([0.7, -0.2, 0.6], [0.12, 0.1, 0.16]);
		renderer.setRimLight([0.22, 0.28, 0.4], 3);
		renderer.setSpecular(0.35, 48);
		this.#bandLightSet = renderer.createLightSet();
		this.#bandLightSet.setLight([-0.4, -1.0, -0.3], [0.9, 0.85, 0.8], [0.32, 0.36, 0.46], [0.14, 0.12, 0.11]);
		this.#bandLightSet.setBandRamp([0.25, 0.5, 0.75], [0.3725, 0.6471, 0.8627, 1.0], true);
		const identityMatrix = Matrix4.createIdentity();
		const unlitOptions = { isUnlit: true, hasOutline: false };
		this.#meshes = {
			floor: renderer.createMesh(buildArrays(ToonMesh.createBoxGeometry(9, 0.2, 6), Matrix4.createTranslation(0, -0.1, 0), "#3a4660", { hasOutline: false })),
			screen: renderer.createMesh(buildArrays(ToonMesh.createBoxGeometry(1.6, 1.0, 0.12), identityMatrix, "#1a2230", {})),
			cube: renderer.createMesh(buildArrays(ToonMesh.createBoxGeometry(1.1, 1.1, 1.1), identityMatrix, "#ffffff", {})),
			torus: renderer.createMesh(buildArrays(ToonMesh.createTorusGeometry(0.5, 0.2, 16, 40), identityMatrix, "#e0a050", {})),
			sphere: renderer.createMesh(buildArrays(ToonMesh.createSphereGeometry(0.55, 32, 20), identityMatrix, "#d8d8e0", {})),
			hologramBall: renderer.createMesh(buildArrays(ToonMesh.createSphereGeometry(0.42, 24, 16), identityMatrix, "#ffffff", unlitOptions)),
			hologramBody: renderer.createMesh(buildArrays(ToonMesh.createCapsuleGeometry(0.28, 0.7, 8, 16), identityMatrix, "#ffffff", unlitOptions)),
			rock: renderer.createMesh(buildArrays(ToonMesh.createOctahedronGeometry(0.22), identityMatrix, "#a89880", {})),
		};
		this.#segmentMaterial = renderer.createMaterial({ name: "segment", uniformChunk: SEGMENT_CHUNK, surfaceChunk: SEGMENT_SURFACE_CHUNK });
		const rockLayout = renderer.createInstanceLayout([{ name: "instanceShape", size: 4 }, { name: "instanceOffset", size: 3 }, { name: "instanceColor", size: 3 }]);
		this.#rockMaterial = renderer.createMaterial({ name: "rock", vertexChunk: ROCK_VERTEX_CHUNK });
		const rockData = [];
		for (let row = 0; row < 3; ++row) {
			for (let column = 0; column < 9; ++column) {
				const angle = (row * 9 + column) * 0.7;
				const scaleAcross = 0.8 + ((row * 5 + column * 3) % 4) * 0.15;
				const scaleUp = 0.7 + ((row * 3 + column) % 3) * 0.3;
				const shade = 0.75 + ((row + column * 2) % 3) * 0.12;
				rockData.push(System.Math.cos(angle), System.Math.sin(angle), scaleAcross, scaleUp, -3.6 + column * 0.9, 0.2 * scaleUp, -2.3 - row * 0.45, shade, shade * 0.95, shade * 0.9);
			}
		}
		this.#rockBuffer = renderer.createInstanceBuffer(rockLayout, new System.Float32Array(rockData), ToonBufferUsage.static);
		this.#checkerTexture = renderer.createTexture(createCheckerPixels(), { isFiltered: false });
		this.#decalTexture = renderer.createTexture(createDecalPixels(), { isRepeated: false });
		this.#camera = new Camera3D();
		this.#camera.setPerspective(0.8, 0.1, 100);
		this.#camera.lookAt(Vector3.create(0, 3.6, 8.2), Vector3.create(0, 0.5, -0.4), Vector3.create(0, 1, 0));
		this.#queue = new ToonDrawQueue();
	}

	//==============================================================================
	// 한 프레임 그리기. (time 초의 자리, 기본 프레임버퍼 전체에)
	//==============================================================================
	/**
	 * @param { number } time
	 * @param { number } width
	 * @param { number } height
	 * @returns { object } 그린 수와 드로우콜.
	 */
	draw(time, width, height) {
		const webGL2RenderingContext = this.#webGL2RenderingContext;
		const renderer = this.#renderer;
		const queue = this.#queue;
		const meshes = this.#meshes;
		this.#camera.setAspectRatio(width / height);
		const pointLights = [];
		const lightColors = [[1.0, 0.35, 0.3], [0.3, 1.0, 0.45], [0.35, 0.5, 1.0]];
		for (let index = 0; index < lightColors.length; ++index) {
			const angle = time * 0.8 + index * System.Math.PI * 2 / 3;
			pointLights.push({ position: [2.6 + System.Math.cos(angle) * 1.4, 1.1, -0.2 + System.Math.sin(angle) * 1.4], color: lightColors[index], intensity: 2.2, range: 3.2, decay: 0, rangeExponent: 1, wrap: 0 });
		}
		renderer.setPointLights(pointLights);
		const digit = System.Math.floor(time * 2) % 10;
		const screenMatrix = Matrix4.createTranslation(-2.7, 0.75, 0.3);
		const cubeMatrix = Matrix4.createTranslation(-0.9, 0.55, 0.5);
		cubeMatrix.rotateY(time * 0.5);
		const torusMatrix = Matrix4.createTranslation(0.9, 0.62, 0.6);
		torusMatrix.rotateX(0.55);
		torusMatrix.rotateY(time * 0.4);
		const sphereMatrix = Matrix4.createTranslation(2.6, 0.55, -0.2);
		const segmentDraw = (program, context, kind) => {
			if (kind === "solid") {
				context.uniform1f(program.getUniformLocation("segmentMask"), DIGIT_SEGMENT_MASKS[digit]);
				context.uniform3f(program.getUniformLocation("segmentColor"), 0.35, 1.0, 0.85);
			}
		};
		const opaqueList = [
			{ mesh: meshes.screen, matrix: screenMatrix, options: { material: this.#segmentMaterial, onBeforeDraw: segmentDraw } },
			{ mesh: meshes.cube, matrix: cubeMatrix, options: { baseColorTexture: this.#checkerTexture, uvTransform: [0, 0, 2, 2], decalTexture: this.#decalTexture, decalUvTransform: [digit % 2 === 0 ? 0 : 0.5, 0, 0.5, 1], decalColor: [1.0, 0.85, 0.2], decalEmission: 0.6 } },
			{ mesh: meshes.torus, matrix: torusMatrix, options: { lightSet: this.#bandLightSet } },
			{ mesh: meshes.sphere, matrix: sphereMatrix, options: {} },
		];
		queue.clear();
		// 평면 거울: 바닥(y = 0)에 비친 불투명한 것을 불투명 앞에 어둡게. (비친 행렬은 행렬식이 음수라 렌더러가 감기를 뒤집는다)
		const reflectionMatrix = createReflectionMatrix([0, 0, 0], [0, 1, 0]);
		queue.addPass(ToonDrawStage.beforeOpaque, (passRenderer) => {
			for (const opaque of opaqueList) {
				const mirroredMatrix = reflectionMatrix.clone();
				mirroredMatrix.multiply(opaque.matrix);
				passRenderer.drawMesh(opaque.mesh, mirroredMatrix, System.Object.assign({}, opaque.options, { colorScale: 0.3, hasOutline: false }));
			}
		});
		for (const opaque of opaqueList) {
			queue.addMesh(opaque.mesh, opaque.matrix, opaque.options);
		}
		queue.addPass(ToonDrawStage.afterOpaque, (passRenderer) => {
			passRenderer.drawMeshInstanceBuffer(meshes.rock, this.#rockBuffer, ROCK_COUNT, { material: this.#rockMaterial });
		});
		queue.addMesh(meshes.floor, Matrix4.createIdentity(), { alpha: 0.72 });
		// 홀로그램 둘: 왼쪽은 깊이 선패스 없이(겹친 곳이 두 겹), 오른쪽은 한 덩어리.
		const hologramList = [{ group: 1, offsetX: -0.5, isDepthPrepassed: false }, { group: 2, offsetX: 0.7, isDepthPrepassed: true }];
		for (const hologram of hologramList) {
			const flicker = 0.85 + 0.15 * System.Math.sin(time * 9 + hologram.group);
			const options = { blendMode: ToonBlendMode.additive, softEdge: 2.5, tintColor: [0.3, 0.9, 1.0, 0.7], tintAmount: 1, hasOutline: false, group: hologram.group, isDepthPrepassed: hologram.isDepthPrepassed, alpha: flicker };
			queue.addMesh(meshes.hologramBall, Matrix4.createTranslation(hologram.offsetX, 1.55, -1.3), options);
			queue.addMesh(meshes.hologramBody, Matrix4.createTranslation(hologram.offsetX, 1.0, -1.3), options);
		}
		webGL2RenderingContext.viewport(0, 0, width, height);
		webGL2RenderingContext.clearColor(0.0627, 0.0706, 0.102, 1);
		webGL2RenderingContext.clearDepth(1);
		webGL2RenderingContext.clear(webGL2RenderingContext.COLOR_BUFFER_BIT | webGL2RenderingContext.DEPTH_BUFFER_BIT);
		queue.draw(renderer, this.#camera);
		return renderer.getFrameStatistics();
	}
}


//==============================================================================
// 애버런트 몸 셰이딩(scenerenderer3d.js 583 ~ 651)과 엔진 옵션으로 같은 값이 나오는지. (직교 카메라로 z = 0 의 판을 실수 판에 그려 CPU 셈과 견줌)
// - 엔진 쪽 바꾸기: 해와 되비친 빛(채움 빛)의 방향은 부호를 뒤집고, ÷π 는 setLightModel, 정반사 세기는 8 / (48 + 8) 배, 점광은 decay 0 과 rangeExponent 1, 빛남 배는 glowScale 에.
//==============================================================================
/**
 * @param { WebGL2RenderingContext } webGL2RenderingContext
 * @returns { object } { isSkipped, maximumError, maximumValue, isClampFree }
 */
export function verifyAberrantShading(webGL2RenderingContext) {
	if (webGL2RenderingContext.getExtension("EXT_color_buffer_float") === null) {
		return { isSkipped: true };
	}
	const size = 64;
	const sunToward = normalize([0.3, 0.8, 0.52]);
	const rimToward = normalize([-0.6, 0.2, 0.77]);
	const sunColor = readLinearColor([1.0, 0.95, 0.88], 1.4);
	const skyColor = readLinearColor([0.55, 0.62, 0.8], 0.5);
	const groundColor = readLinearColor([0.3, 0.25, 0.22], 0.5);
	const rimColor = readLinearColor([0.5, 0.6, 1.0], 0.6);
	const specular = 0.5;
	const pointLights = [{ position: [0.3, 0.2, 0.6], color: readLinearColor([1.0, 0.5, 0.3], 1.8), range: 1.4 }, { position: [-0.5, -0.4, 0.5], color: readLinearColor([0.3, 0.8, 1.0], 1.2), range: 1.2 }];
	const baseColor = [0.62, 0.55, 0.48];
	const glow = 0;
	const glowScale = 1;
	const emissionScale = 1.6;
	const renderer = new ToonRenderer(webGL2RenderingContext);
	renderer.setLight([-sunToward[0], -sunToward[1], -sunToward[2]], sunColor, skyColor, groundColor);
	renderer.setFillLight([-rimToward[0], -rimToward[1], -rimToward[2]], rimColor);
	renderer.setSpecular(specular * 8 / 56, 48);
	renderer.setLightModel({ isEnergyNormalized: true });
	renderer.setPointLights(pointLights.map((pointLight) => {
		return { position: pointLight.position, color: pointLight.color, intensity: 1, range: pointLight.range, decay: 0, rangeExponent: 1, wrap: 0 };
	}));
	renderer.setHdrOutput(true);
	const builder = new ToonMesh.MeshBuilder();
	builder.addQuad([[-1, -1, 0], [1, -1, 0], [1, 1, 0], [-1, 1, 0]], [0, 0, 1], baseColor, 0, null, false);
	const mesh = renderer.createMesh(builder.readArrays());
	const texture = webGL2RenderingContext.createTexture();
	webGL2RenderingContext.bindTexture(webGL2RenderingContext.TEXTURE_2D, texture);
	webGL2RenderingContext.texImage2D(webGL2RenderingContext.TEXTURE_2D, 0, webGL2RenderingContext.RGBA32F, size, size, 0, webGL2RenderingContext.RGBA, webGL2RenderingContext.FLOAT, null);
	const framebuffer = webGL2RenderingContext.createFramebuffer();
	webGL2RenderingContext.bindFramebuffer(webGL2RenderingContext.FRAMEBUFFER, framebuffer);
	webGL2RenderingContext.framebufferTexture2D(webGL2RenderingContext.FRAMEBUFFER, webGL2RenderingContext.COLOR_ATTACHMENT0, webGL2RenderingContext.TEXTURE_2D, texture, 0);
	const depthBuffer = webGL2RenderingContext.createRenderbuffer();
	webGL2RenderingContext.bindRenderbuffer(webGL2RenderingContext.RENDERBUFFER, depthBuffer);
	webGL2RenderingContext.renderbufferStorage(webGL2RenderingContext.RENDERBUFFER, webGL2RenderingContext.DEPTH_COMPONENT24, size, size);
	webGL2RenderingContext.framebufferRenderbuffer(webGL2RenderingContext.FRAMEBUFFER, webGL2RenderingContext.DEPTH_ATTACHMENT, webGL2RenderingContext.RENDERBUFFER, depthBuffer);
	webGL2RenderingContext.viewport(0, 0, size, size);
	webGL2RenderingContext.clearColor(0, 0, 0, 0);
	webGL2RenderingContext.clear(webGL2RenderingContext.COLOR_BUFFER_BIT | webGL2RenderingContext.DEPTH_BUFFER_BIT);
	const projectionMatrix = Matrix4.createIdentity();
	projectionMatrix.getElements()[10] = -1;
	renderer.beginFrameWithMatrices(Matrix4.createIdentity(), projectionMatrix);
	renderer.drawMesh(mesh, Matrix4.createIdentity(), { hasOutline: false, isCulled: false, glowScale: glowScale * emissionScale });
	renderer.endFrame();
	const pixels = new System.Float32Array(size * size * 4);
	webGL2RenderingContext.readPixels(0, 0, size, size, webGL2RenderingContext.RGBA, webGL2RenderingContext.FLOAT, pixels);
	webGL2RenderingContext.bindFramebuffer(webGL2RenderingContext.FRAMEBUFFER, null);
	webGL2RenderingContext.deleteFramebuffer(framebuffer);
	webGL2RenderingContext.deleteRenderbuffer(depthBuffer);
	webGL2RenderingContext.deleteTexture(texture);
	renderer.deleteMesh(mesh);
	renderer.destroy();
	// 애버런트 식을 CPU 로. (보는 쪽은 직교라 [0, 0, 1], 노멀도 [0, 0, 1])
	const albedo = [System.Math.pow(baseColor[0], 2.2), System.Math.pow(baseColor[1], 2.2), System.Math.pow(baseColor[2], 2.2)];
	const normal = [0, 0, 1];
	const dot = (first, second) => {
		return first[0] * second[0] + first[1] * second[1] + first[2] * second[2];
	};
	const halfway = normalize([sunToward[0], sunToward[1], sunToward[2] + 1]);
	const specularTerm = System.Math.pow(System.Math.max(dot(normal, halfway), 0), 48) * specular / System.Math.PI;
	let maximumError = 0;
	let maximumValue = 0;
	let isClampFree = true;
	for (let pixelY = 0; pixelY < size; pixelY += 3) {
		for (let pixelX = 0; pixelX < size; pixelX += 3) {
			const worldPosition = [(pixelX + 0.5) / size * 2 - 1, (pixelY + 0.5) / size * 2 - 1, 0];
			const irradiance = [0, 0, 0];
			for (let channel = 0; channel < 3; ++channel) {
				irradiance[channel] = sunColor[channel] * System.Math.max(dot(normal, sunToward), 0) + (groundColor[channel] * 0.5 + skyColor[channel] * 0.5) + rimColor[channel] * System.Math.max(dot(normal, rimToward), 0);
			}
			for (const pointLight of pointLights) {
				const toLight = [pointLight.position[0] - worldPosition[0], pointLight.position[1] - worldPosition[1], pointLight.position[2] - worldPosition[2]];
				const lightDistance = System.Math.max(System.Math.hypot(toLight[0], toLight[1], toLight[2]), 0.0001);
				const falloff = System.Math.min(System.Math.max(1 - lightDistance / pointLight.range, 0), 1);
				const facing = System.Math.max(dot(normal, [toLight[0] / lightDistance, toLight[1] / lightDistance, toLight[2] / lightDistance]), 0);
				for (let channel = 0; channel < 3; ++channel) {
					irradiance[channel] += pointLight.color[channel] * facing * falloff * falloff;
				}
			}
			const offset = (pixelY * size + pixelX) * 4;
			for (let channel = 0; channel < 3; ++channel) {
				const lit = albedo[channel] / System.Math.PI * irradiance[channel] + sunColor[channel] * specularTerm;
				if (lit > 1) {
					isClampFree = false;
				}
				const expected = System.Math.min(lit, 1) + albedo[channel] * glow * glowScale * emissionScale;
				maximumError = System.Math.max(maximumError, System.Math.abs(pixels[offset + channel] - expected));
				maximumValue = System.Math.max(maximumValue, expected);
			}
		}
	}
	return { isSkipped: false, maximumError: maximumError, maximumValue: maximumValue, isClampFree: isClampFree };
}
