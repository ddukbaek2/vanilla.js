//==============================================================================
// 포함 모듈 목록.
//==============================================================================
const System = globalThis;
import { Matrix4 } from "../../../base/matrix4.js";
import { ShaderProgram } from "../../../core/graphic/shaderprogram.js";
import { VERTEX_FLOAT_COUNT, SKIN_FLOAT_COUNT } from "./meshbuilder.js";


//==============================================================================
// 전역 상수 목록.
//==============================================================================
// 한 모형이 쓰는 뼈대 수의 상한. (셰이더의 유니폼 배열 크기, 엔진 SkinnedModelRenderer 와 같은 96)
export const TOON_MAXIMUM_JOINTS = 96;

// 인스턴스 하나의 수 개수. (행렬 16, 틴트 4)
export const TOON_INSTANCE_FLOAT_COUNT = 20;

// 그림자 텍스처를 묶는 유닛.
const SHADOW_TEXTURE_UNIT = 3;

// 어트리뷰트 자리. (모든 프로그램이 같은 자리를 쓴다)
export const TOON_ATTRIBUTE_LOCATIONS = System.Object.freeze({
	vertexPosition: 0,
	vertexNormal: 1,
	vertexColor: 2,
	vertexMaterial: 3,
	vertexDetail: 4,
	vertexJoints: 5,
	vertexWeights: 6,
	instanceMatrix0: 7,
	instanceMatrix1: 8,
	instanceMatrix2: 9,
	instanceMatrix3: 10,
	instanceTint: 11,
});

// 꼭짓점을 본으로 움직이고 인스턴스 행렬을 고르는 셰이더 조각.
const VERTEX_COMMON_CHUNK = `in vec4 vertexJoints;
in vec4 vertexWeights;
in vec4 instanceMatrix0;
in vec4 instanceMatrix1;
in vec4 instanceMatrix2;
in vec4 instanceMatrix3;
in vec4 instanceTint;
uniform mat4 jointMatrices[${TOON_MAXIMUM_JOINTS}];
uniform float skinned;
uniform float instanced;
uniform mat4 viewProjectionMatrix;
uniform mat4 modelMatrix;
mat4 readSkinMatrix() {
	if (skinned < 0.5) {
		return mat4(1.0);
	}
	return jointMatrices[int(vertexJoints.x)] * vertexWeights.x + jointMatrices[int(vertexJoints.y)] * vertexWeights.y + jointMatrices[int(vertexJoints.z)] * vertexWeights.z + jointMatrices[int(vertexJoints.w)] * vertexWeights.w;
}
mat4 readModelMatrix() {
	if (instanced < 0.5) {
		return modelMatrix;
	}
	return mat4(instanceMatrix0, instanceMatrix1, instanceMatrix2, instanceMatrix3);
}
vec4 readInstanceTint() {
	if (instanced < 0.5) {
		return vec4(1.0);
	}
	return instanceTint;
}
`;

// 몸을 그리는 셰이더.
const SOLID_VERTEX_SHADER = `#version 300 es
in vec3 vertexPosition;
in vec3 vertexNormal;
in vec3 vertexColor;
in vec2 vertexMaterial;
in vec4 vertexDetail;
${VERTEX_COMMON_CHUNK}
uniform mat4 lightViewProjectionMatrix;
out vec3 worldNormal;
out vec3 surfaceColor;
out vec2 surfaceMaterial;
out vec4 surfaceTint;
out vec4 lightSpacePosition;
void main() {
	mat4 skinMatrix = readSkinMatrix();
	mat4 objectMatrix = readModelMatrix();
	vec4 position = objectMatrix * skinMatrix * vec4(vertexPosition, 1.0);
	worldNormal = normalize(mat3(objectMatrix) * mat3(skinMatrix) * vertexNormal);
	surfaceColor = vertexColor;
	surfaceMaterial = vertexMaterial;
	surfaceTint = readInstanceTint();
	lightSpacePosition = lightViewProjectionMatrix * vec4(position.xyz + worldNormal * 0.02, 1.0);
	gl_Position = viewProjectionMatrix * position;
}
`;
const SOLID_FRAGMENT_SHADER = `#version 300 es
precision highp float;
precision highp sampler2DShadow;
in vec3 worldNormal;
in vec3 surfaceColor;
in vec2 surfaceMaterial;
in vec4 surfaceTint;
in vec4 lightSpacePosition;
uniform vec3 sunDirection;
uniform vec3 sunColor;
uniform vec3 skyColor;
uniform vec3 groundColor;
uniform float bandCount;
uniform vec4 tintColor;
uniform float alpha;
uniform float hdrOutput;
uniform float shadowEnabled;
uniform float shadowStrength;
uniform float shadowTexelSize;
uniform sampler2DShadow shadowTexture;
out vec4 fragmentColor;
vec3 toLinear(vec3 color) {
	return pow(color, vec3(2.2));
}
vec3 toOutput(vec3 color) {
	if (hdrOutput > 0.5) {
		return max(color, vec3(0.0));
	}
	return pow(clamp(color, 0.0, 1.0), vec3(1.0 / 2.2));
}
float readShadow() {
	if (shadowEnabled < 0.5) {
		return 1.0;
	}
	vec3 projected = lightSpacePosition.xyz / lightSpacePosition.w * 0.5 + 0.5;
	if (projected.x < 0.0 || projected.x > 1.0 || projected.y < 0.0 || projected.y > 1.0 || projected.z > 1.0) {
		return 1.0;
	}
	float lit = 0.0;
	for (int offsetY = -1; offsetY <= 1; ++offsetY) {
		for (int offsetX = -1; offsetX <= 1; ++offsetX) {
			lit += texture(shadowTexture, vec3(projected.xy + vec2(float(offsetX), float(offsetY)) * shadowTexelSize, projected.z - 0.0015));
		}
	}
	return mix(1.0, lit / 9.0, shadowStrength);
}
void main() {
	vec4 tint = tintColor * surfaceTint;
	vec3 albedo = toLinear(surfaceColor) * toLinear(tint.rgb);
	float glow = surfaceMaterial.x;
	float unlit = surfaceMaterial.y;
	float outputAlpha = alpha * tint.a;
	if (unlit > 0.5) {
		fragmentColor = vec4(toOutput(albedo * (1.0 + glow)), outputAlpha);
		return;
	}
	vec3 normal = normalize(worldNormal);
	float facing = max(dot(normal, -normalize(sunDirection)), 0.0) * readShadow();
	if (bandCount > 0.5) {
		facing = floor(facing * bandCount + 0.5) / bandCount;
	}
	float upward = normal.y * 0.5 + 0.5;
	vec3 ambient = mix(groundColor, skyColor, upward);
	vec3 lit = albedo * (ambient + sunColor * facing) + albedo * glow;
	fragmentColor = vec4(toOutput(lit), outputAlpha);
}
`;

// 바깥선 껍데기를 그리는 셰이더. (껍데기는 뒷면만 그려 몸 둘레에 테로 보인다)
const OUTLINE_VERTEX_SHADER = `#version 300 es
in vec3 vertexPosition;
${VERTEX_COMMON_CHUNK}
out float outlineTint;
void main() {
	mat4 skinMatrix = readSkinMatrix();
	outlineTint = readInstanceTint().a;
	gl_Position = viewProjectionMatrix * readModelMatrix() * skinMatrix * vec4(vertexPosition, 1.0);
}
`;
const OUTLINE_FRAGMENT_SHADER = `#version 300 es
precision highp float;
in float outlineTint;
uniform vec4 outlineColor;
uniform float alpha;
uniform float hdrOutput;
out vec4 fragmentColor;
void main() {
	vec3 color = hdrOutput > 0.5 ? pow(outlineColor.rgb, vec3(2.2)) : outlineColor.rgb;
	fragmentColor = vec4(color, outlineColor.a * alpha * outlineTint);
}
`;

// 그림자 깊이를 그리는 셰이더.
const DEPTH_VERTEX_SHADER = `#version 300 es
in vec3 vertexPosition;
${VERTEX_COMMON_CHUNK}
void main() {
	gl_Position = viewProjectionMatrix * readModelMatrix() * readSkinMatrix() * vec4(vertexPosition, 1.0);
}
`;
const DEPTH_FRAGMENT_SHADER = `#version 300 es
precision highp float;
void main() {
}
`;


//==============================================================================
// 보기와 투영 행렬에서 절두체의 면 여섯. (ax + by + cz + d >= 0 이 안쪽, 정규화)
//==============================================================================
/**
 * @param { Matrix4 } matrix
 * @returns { Array<Array<number>> }
 */
export function extractFrustumPlanes(matrix) {
	const elements = matrix.getElements();
	const readRow = (rowIndex) => {
		return [elements[rowIndex], elements[4 + rowIndex], elements[8 + rowIndex], elements[12 + rowIndex]];
	};
	const row0 = readRow(0);
	const row1 = readRow(1);
	const row2 = readRow(2);
	const row3 = readRow(3);
	const combine = (first, second, sign) => {
		return [first[0] + second[0] * sign, first[1] + second[1] * sign, first[2] + second[2] * sign, first[3] + second[3] * sign];
	};
	const planes = [combine(row3, row0, 1), combine(row3, row0, -1), combine(row3, row1, 1), combine(row3, row1, -1), combine(row3, row2, 1), combine(row3, row2, -1)];
	for (const plane of planes) {
		const length = System.Math.hypot(plane[0], plane[1], plane[2]);
		if (length > 0) {
			plane[0] /= length;
			plane[1] /= length;
			plane[2] /= length;
			plane[3] /= length;
		}
	}
	return planes;
}


//==============================================================================
// 행렬의 가장 큰 크기. (세 축 길이 가운데 큰 것)
//==============================================================================
/**
 * @param { Float32Array } elements
 * @returns { number }
 */
function readMaximumScale(elements) {
	const scaleX = System.Math.hypot(elements[0], elements[1], elements[2]);
	const scaleY = System.Math.hypot(elements[4], elements[5], elements[6]);
	const scaleZ = System.Math.hypot(elements[8], elements[9], elements[10]);
	return System.Math.max(scaleX, scaleY, scaleZ);
}


//==============================================================================
// 꼭짓점 배열의 경계 구. (stride 마다 앞 셋이 자리, 가운데는 상자의 가운데)
//==============================================================================
/**
 * @param { Float32Array } positions
 * @param { number } stride
 * @returns { object } { center, radius }
 */
function readBoundingSphere(positions, stride) {
	const minimum = [System.Infinity, System.Infinity, System.Infinity];
	const maximum = [-System.Infinity, -System.Infinity, -System.Infinity];
	for (let offset = 0; offset + 3 <= positions.length; offset += stride) {
		for (let axis = 0; axis < 3; ++axis) {
			minimum[axis] = System.Math.min(minimum[axis], positions[offset + axis]);
			maximum[axis] = System.Math.max(maximum[axis], positions[offset + axis]);
		}
	}
	if (minimum[0] > maximum[0]) {
		return { center: [0, 0, 0], radius: 0 };
	}
	const center = [(minimum[0] + maximum[0]) * 0.5, (minimum[1] + maximum[1]) * 0.5, (minimum[2] + maximum[2]) * 0.5];
	let radius = 0;
	for (let offset = 0; offset + 3 <= positions.length; offset += stride) {
		radius = System.Math.max(radius, System.Math.hypot(positions[offset] - center[0], positions[offset + 1] - center[1], positions[offset + 2] - center[2]));
	}
	return { center: center, radius: radius };
}


//==============================================================================
// 툰 렌더러. (ToonMesh 와 ToonGlb 의 배열을 한 색 재질과 바깥선으로 그린다)
// - 빛: 해(방향과 색)를 받는 면과, 하늘색과 땅색을 노멀의 위아래로 섞은 바탕빛. setBandCount 로 칸 수를 주면 셀 셰이딩이 된다.
// - 재질: 꼭짓점의 빛남(더해 밝힘)과 빛을 받지 않음. 모형마다 틴트 색(곱함)과 불투명도를 준다.
// - 바깥선: MeshBuilder 가 지은 껍데기를 뒷면만 그린다.
// - 뼈대: writeSkinPose 가 셈한 본 행렬을 drawMesh 에 넘긴다. (TOON_MAXIMUM_JOINTS 까지)
// - GPU 인스턴싱: drawMeshInstanced 로 같은 모형 여럿을 인스턴스마다 행렬과 틴트로 한 번에 그린다. (몸과 바깥선 모두)
// - 화면 밖 거르기: 모형의 경계 구를 보기와 투영의 절두체에 대어 밖이면 그리지 않는다. (인스턴스는 하나씩 걸러 남은 것만 올린다)
// - 그림자: ShadowMap 에 beginShadowPass 와 drawMesh 로 드리우고, setShadow 로 받는다. (3x3 PCF)
//   그림자를 받지 않을 때도 그림자 유닛에 1x1 비교 깊이 텍스처를 묶는다. (sampler2DShadow 유닛에 깊이 텍스처가 없으면 맥 드라이버가 알리고, 색 텍스처가 묶여 있으면 WebGL 이 그리기를 거부한다)
// - HDR: setHdrOutput(true) 면 감마를 걸지 않은 선형 색을 낸다. 실수 렌더 타겟(ToonPostProcess)에 그리고 블룸과 톤매핑으로 마무리한다.
// - 사용: createMesh(arrays) → 매 프레임 beginFrame(보기와 투영) → drawMesh / drawMeshInstanced → endFrame() → 다 쓰면 deleteMesh.
//   beginFrame 이 앞의 그리기 상태(섞기, 깊이, 면 가리기, 프로그램, 버텍스 어레이)를 적어 두고 깊이 시험과 면 가리기를 켜며, endFrame 이 적어 둔 상태로 돌린다.
//   (엔진 2D 그리기 사이에 끼울 때, 그 전에 Graphic.flushSpriteBatch)
// - readProgramSources 로 ShaderWarmer 에 넘길 소스를 준다.
// - 노드 사각형 안에 그리기: setScreenRect(x, y, 너비, 높이) 를 주면 beginFrame 이 보기와 투영의 클립 공간을 그 사각형으로 옮기고 가위로 밖을 자른다.
//   사각형은 beginFrame 때의 뷰포트(보통 드로잉 버퍼 전체) 안의 픽셀이고 왼쪽 위가 원점이다. (2D 노드의 draw 에서 graphic.getTransformMatrix 로 셈한 자리)
//   화면 밖 거르기는 옮기기 전의 절두체로 한다. endFrame 이 가위를 푼다. 카메라의 가로 세로 비는 사각형의 비로 맞춘다. (Camera3D.setAspectRatio)
// - beginFrameWithCamera(Camera3D) 는 카메라의 보기와 투영으로 beginFrame 을 부른다. 2D 표시(Camera3D.projectToView)와 같은 카메라를 쓴다.
// - drawMeshOutline 은 바깥선 껍데기만 그린다. (ToonDrawQueue 가 불투명한 몸을 다 그린 뒤 바깥선을 몰아 그릴 때, 그린 수는 세지 않는다)
//==============================================================================
export class ToonRenderer {
	//==============================================================================
	// 멤버 변수 목록.
	//==============================================================================
	/** @private @type { WebGL2RenderingContext } */ #webGL2RenderingContext;
	/** @private @type { ShaderProgram } */ #solidProgram;
	/** @private @type { ShaderProgram } */ #outlineProgram;
	/** @private @type { ShaderProgram } */ #depthProgram;
	/** @private @type { WebGLTexture } */ #emptyShadowTexture; // 그림자를 받지 않을 때 그림자 유닛에 묶는 1x1 비교 깊이 텍스처. (깊이 1 이라 늘 빛을 받음)
	/** @private @type { Float32Array } */ #viewProjectionElements; // 이번 프레임의 보기와 투영.
	/** @private @type { Array<Array<number>> } */ #frustumPlanes; // 절두체의 면 여섯.
	/** @private @type { Array<number> } */ #sunDirection; // 해가 비추는 쪽. (해에서 나오는 방향)
	/** @private @type { Array<number> } */ #sunColor;
	/** @private @type { Array<number> } */ #skyColor;
	/** @private @type { Array<number> } */ #groundColor;
	/** @private @type { number } */ #bandCount; // 셀 셰이딩 칸 수. (0 이면 부드럽게)
	/** @private @type { Array<number> } */ #outlineColor; // 바깥선 색. (sRGB, 알파)
	/** @private @type { boolean } */ #isHdrOutput; // 선형 색을 낼지.
	/** @private @type { object | null } */ #shadowInput; // 받을 그림자. ({ depthTexture, lightViewProjectionMatrix, resolution, strength })
	/** @private @type { boolean } */ #isShadowPass; // 그림자 깊이 패스 중인지.
	/** @private @type { object | null } */ #savedState; // 앞의 그리기 상태. (끝이 돌린다)
	/** @private @type { Float32Array } */ #instanceData; // 인스턴스 올리기 칸. (모자라면 늘린다)
	/** @private @type { object } */ #frameStatistics; // 한 프레임의 그린 수와 거른 수와 드로우콜.
	/** @private @type { object | null } */ #screenRect; // 그릴 화면 사각형. ({ x, y, width, height } 뷰포트 픽셀, 왼쪽 위 원점, null 이면 뷰포트 전체)
	/** @private @type { boolean } */ #isScissorApplied; // beginFrame 이 가위를 켰는지.

	//==============================================================================
	// 생성.
	//==============================================================================
	/**
	 * @constructor
	 * @param { WebGL2RenderingContext } webGL2RenderingContext
	 */
	constructor(webGL2RenderingContext) {
		this.#webGL2RenderingContext = webGL2RenderingContext;
		this.#solidProgram = new ShaderProgram(webGL2RenderingContext, SOLID_VERTEX_SHADER, SOLID_FRAGMENT_SHADER, TOON_ATTRIBUTE_LOCATIONS);
		this.#outlineProgram = new ShaderProgram(webGL2RenderingContext, OUTLINE_VERTEX_SHADER, OUTLINE_FRAGMENT_SHADER, TOON_ATTRIBUTE_LOCATIONS);
		this.#depthProgram = new ShaderProgram(webGL2RenderingContext, DEPTH_VERTEX_SHADER, DEPTH_FRAGMENT_SHADER, TOON_ATTRIBUTE_LOCATIONS);
		this.#emptyShadowTexture = this.createEmptyShadowTexture();
		const identityMatrix = Matrix4.createIdentity();
		this.#viewProjectionElements = new System.Float32Array(identityMatrix.getElements());
		this.#frustumPlanes = extractFrustumPlanes(identityMatrix);
		this.#sunDirection = [-0.4, -1.0, -0.3];
		this.#sunColor = [0.9, 0.85, 0.8];
		this.#skyColor = [0.45, 0.5, 0.6];
		this.#groundColor = [0.2, 0.18, 0.16];
		this.#bandCount = 0;
		this.#outlineColor = [0.05, 0.05, 0.08, 1];
		this.#isHdrOutput = false;
		this.#shadowInput = null;
		this.#isShadowPass = false;
		this.#savedState = null;
		this.#instanceData = new System.Float32Array(TOON_INSTANCE_FLOAT_COUNT * 64);
		this.#frameStatistics = { drawCallCount: 0, drawnObjectCount: 0, culledObjectCount: 0 };
		this.#screenRect = null;
		this.#isScissorApplied = false;
	}

	//==============================================================================
	// 셰이더 소스 반환. (ShaderWarmer 로 미리 링크할 때)
	//==============================================================================
	/**
	 * @static
	 * @returns { Array<object> } { vertexShader, fragmentShader, attributeLocationTable } 의 배열.
	 */
	static readProgramSources() {
		return [
			{ vertexShader: SOLID_VERTEX_SHADER, fragmentShader: SOLID_FRAGMENT_SHADER, attributeLocationTable: TOON_ATTRIBUTE_LOCATIONS },
			{ vertexShader: OUTLINE_VERTEX_SHADER, fragmentShader: OUTLINE_FRAGMENT_SHADER, attributeLocationTable: TOON_ATTRIBUTE_LOCATIONS },
			{ vertexShader: DEPTH_VERTEX_SHADER, fragmentShader: DEPTH_FRAGMENT_SHADER, attributeLocationTable: TOON_ATTRIBUTE_LOCATIONS },
		];
	}

	//==============================================================================
	// 모형 올리기. (MeshBuilder.readArrays 나 ToonGlb.readGlbArrays 의 결과, 몸이 비면 null)
	//==============================================================================
	/**
	 * @param { object } arrays
	 * @returns { object | null }
	 */
	createMesh(arrays) {
		if (arrays.indexData.length === 0) {
			return null;
		}
		const webGL2RenderingContext = this.getWebGL2RenderingContext();
		const buffers = [];
		const isSkinned = arrays.skinData !== undefined && arrays.skinData !== null && arrays.skinData.length > 0;
		const boundingSphere = readBoundingSphere(arrays.vertexData, VERTEX_FLOAT_COUNT);
		const boundingRadius = isSkinned ? boundingSphere.radius * 1.5 : boundingSphere.radius;

		// 인스턴스 버퍼. (보통 그리기에서도 인스턴스 어트리뷰트가 켜져 있으므로 한 인스턴스 분량을 늘 채워 둔다)
		const defaultInstance = new System.Float32Array(TOON_INSTANCE_FLOAT_COUNT);
		defaultInstance.set(Matrix4.createIdentity().getElements(), 0);
		defaultInstance.set([1, 1, 1, 1], 16);
		const instanceBuffer = this.createArrayBuffer(defaultInstance, webGL2RenderingContext.DYNAMIC_DRAW);

		// 몸.
		const bodyVertexArray = webGL2RenderingContext.createVertexArray();
		webGL2RenderingContext.bindVertexArray(bodyVertexArray);
		const vertexBuffer = this.createArrayBuffer(arrays.vertexData, webGL2RenderingContext.STATIC_DRAW);
		buffers.push(vertexBuffer);
		const stride = VERTEX_FLOAT_COUNT * 4;
		const attributeLayouts = [
			[TOON_ATTRIBUTE_LOCATIONS.vertexPosition, 3, 0],
			[TOON_ATTRIBUTE_LOCATIONS.vertexNormal, 3, 12],
			[TOON_ATTRIBUTE_LOCATIONS.vertexColor, 3, 24],
			[TOON_ATTRIBUTE_LOCATIONS.vertexMaterial, 2, 36],
			[TOON_ATTRIBUTE_LOCATIONS.vertexDetail, 4, 44],
		];
		for (const attributeLayout of attributeLayouts) {
			webGL2RenderingContext.enableVertexAttribArray(attributeLayout[0]);
			webGL2RenderingContext.vertexAttribPointer(attributeLayout[0], attributeLayout[1], webGL2RenderingContext.FLOAT, false, stride, attributeLayout[2]);
		}
		if (isSkinned) {
			const skinBuffer = this.createSkinAttributes(arrays.skinData);
			buffers.push(skinBuffer);
		}
		this.attachInstanceAttributes(instanceBuffer);
		const bodyIndexBuffer = this.createIndexBuffer(arrays.indexData);
		buffers.push(bodyIndexBuffer);

		// 바깥선 껍데기. (자리만)
		let outlineVertexArray = null;
		let outlineIndexCount = 0;
		const outlineIndexData = arrays.outlineIndexData;
		if (outlineIndexData !== undefined && outlineIndexData !== null && outlineIndexData.length > 0) {
			outlineVertexArray = webGL2RenderingContext.createVertexArray();
			webGL2RenderingContext.bindVertexArray(outlineVertexArray);
			const outlineBuffer = this.createArrayBuffer(arrays.outlineVertexData, webGL2RenderingContext.STATIC_DRAW);
			buffers.push(outlineBuffer);
			webGL2RenderingContext.enableVertexAttribArray(TOON_ATTRIBUTE_LOCATIONS.vertexPosition);
			webGL2RenderingContext.vertexAttribPointer(TOON_ATTRIBUTE_LOCATIONS.vertexPosition, 3, webGL2RenderingContext.FLOAT, false, 12, 0);
			const outlineSkinData = arrays.outlineSkinData;
			if (isSkinned && outlineSkinData !== undefined && outlineSkinData.length > 0) {
				const outlineSkinBuffer = this.createSkinAttributes(outlineSkinData);
				buffers.push(outlineSkinBuffer);
			}
			this.attachInstanceAttributes(instanceBuffer);
			const outlineIndexBuffer = this.createIndexBuffer(outlineIndexData);
			buffers.push(outlineIndexBuffer);
			outlineIndexCount = outlineIndexData.length;
		}
		webGL2RenderingContext.bindVertexArray(null);
		buffers.push(instanceBuffer);
		return {
			bodyVertexArray: bodyVertexArray,
			bodyIndexCount: arrays.indexData.length,
			outlineVertexArray: outlineVertexArray,
			outlineIndexCount: outlineIndexCount,
			instanceBuffer: instanceBuffer,
			buffers: buffers,
			isSkinned: isSkinned,
			boundingCenter: boundingSphere.center,
			boundingRadius: boundingRadius,
		};
	}

	//==============================================================================
	// 꼭짓점 버퍼 만들기.
	//==============================================================================
	/**
	 * @param { Float32Array } data
	 * @param { number } usage
	 * @returns { WebGLBuffer }
	 */
	createArrayBuffer(data, usage) {
		const webGL2RenderingContext = this.getWebGL2RenderingContext();
		const buffer = webGL2RenderingContext.createBuffer();
		webGL2RenderingContext.bindBuffer(webGL2RenderingContext.ARRAY_BUFFER, buffer);
		webGL2RenderingContext.bufferData(webGL2RenderingContext.ARRAY_BUFFER, data, usage);
		return buffer;
	}

	//==============================================================================
	// 번호 버퍼 만들기. (지금 묶인 버텍스 어레이에 붙는다)
	//==============================================================================
	/**
	 * @param { Uint32Array } data
	 * @returns { WebGLBuffer }
	 */
	createIndexBuffer(data) {
		const webGL2RenderingContext = this.getWebGL2RenderingContext();
		const buffer = webGL2RenderingContext.createBuffer();
		webGL2RenderingContext.bindBuffer(webGL2RenderingContext.ELEMENT_ARRAY_BUFFER, buffer);
		webGL2RenderingContext.bufferData(webGL2RenderingContext.ELEMENT_ARRAY_BUFFER, data, webGL2RenderingContext.STATIC_DRAW);
		return buffer;
	}

	//==============================================================================
	// 뼈대 번호와 무게의 버퍼. (지금 묶인 버텍스 어레이에 어트리뷰트로 붙인다)
	//==============================================================================
	/**
	 * @param { Float32Array } skinData
	 * @returns { WebGLBuffer }
	 */
	createSkinAttributes(skinData) {
		const webGL2RenderingContext = this.getWebGL2RenderingContext();
		const stride = SKIN_FLOAT_COUNT * 4;
		const skinBuffer = this.createArrayBuffer(skinData, webGL2RenderingContext.STATIC_DRAW);
		webGL2RenderingContext.enableVertexAttribArray(TOON_ATTRIBUTE_LOCATIONS.vertexJoints);
		webGL2RenderingContext.vertexAttribPointer(TOON_ATTRIBUTE_LOCATIONS.vertexJoints, 4, webGL2RenderingContext.FLOAT, false, stride, 0);
		webGL2RenderingContext.enableVertexAttribArray(TOON_ATTRIBUTE_LOCATIONS.vertexWeights);
		webGL2RenderingContext.vertexAttribPointer(TOON_ATTRIBUTE_LOCATIONS.vertexWeights, 4, webGL2RenderingContext.FLOAT, false, stride, 16);
		return skinBuffer;
	}

	//==============================================================================
	// 인스턴스 버퍼를 지금 묶인 버텍스 어레이의 인스턴스 어트리뷰트로. (행렬 네 줄, 틴트, 인스턴스마다 하나씩)
	//==============================================================================
	/**
	 * @param { WebGLBuffer } instanceBuffer
	 */
	attachInstanceAttributes(instanceBuffer) {
		const webGL2RenderingContext = this.getWebGL2RenderingContext();
		const stride = TOON_INSTANCE_FLOAT_COUNT * 4;
		webGL2RenderingContext.bindBuffer(webGL2RenderingContext.ARRAY_BUFFER, instanceBuffer);
		for (let columnIndex = 0; columnIndex < 5; ++columnIndex) {
			const location = TOON_ATTRIBUTE_LOCATIONS.instanceMatrix0 + columnIndex;
			webGL2RenderingContext.enableVertexAttribArray(location);
			webGL2RenderingContext.vertexAttribPointer(location, 4, webGL2RenderingContext.FLOAT, false, stride, columnIndex * 16);
			webGL2RenderingContext.vertexAttribDivisor(location, 1);
		}
	}

	//==============================================================================
	// 빈 그림자 텍스처 짓기. (1x1 깊이 1, 비교 샘플링)
	//==============================================================================
	/**
	 * @returns { WebGLTexture }
	 */
	createEmptyShadowTexture() {
		const webGL2RenderingContext = this.getWebGL2RenderingContext();
		const texture = webGL2RenderingContext.createTexture();
		webGL2RenderingContext.activeTexture(webGL2RenderingContext.TEXTURE0 + SHADOW_TEXTURE_UNIT);
		webGL2RenderingContext.bindTexture(webGL2RenderingContext.TEXTURE_2D, texture);
		webGL2RenderingContext.texImage2D(webGL2RenderingContext.TEXTURE_2D, 0, webGL2RenderingContext.DEPTH_COMPONENT24, 1, 1, 0, webGL2RenderingContext.DEPTH_COMPONENT, webGL2RenderingContext.UNSIGNED_INT, new System.Uint32Array([0xffffffff]));
		webGL2RenderingContext.texParameteri(webGL2RenderingContext.TEXTURE_2D, webGL2RenderingContext.TEXTURE_MIN_FILTER, webGL2RenderingContext.NEAREST);
		webGL2RenderingContext.texParameteri(webGL2RenderingContext.TEXTURE_2D, webGL2RenderingContext.TEXTURE_MAG_FILTER, webGL2RenderingContext.NEAREST);
		webGL2RenderingContext.texParameteri(webGL2RenderingContext.TEXTURE_2D, webGL2RenderingContext.TEXTURE_WRAP_S, webGL2RenderingContext.CLAMP_TO_EDGE);
		webGL2RenderingContext.texParameteri(webGL2RenderingContext.TEXTURE_2D, webGL2RenderingContext.TEXTURE_WRAP_T, webGL2RenderingContext.CLAMP_TO_EDGE);
		webGL2RenderingContext.texParameteri(webGL2RenderingContext.TEXTURE_2D, webGL2RenderingContext.TEXTURE_COMPARE_MODE, webGL2RenderingContext.COMPARE_REF_TO_TEXTURE);
		webGL2RenderingContext.texParameteri(webGL2RenderingContext.TEXTURE_2D, webGL2RenderingContext.TEXTURE_COMPARE_FUNC, webGL2RenderingContext.LEQUAL);
		webGL2RenderingContext.bindTexture(webGL2RenderingContext.TEXTURE_2D, null);
		webGL2RenderingContext.activeTexture(webGL2RenderingContext.TEXTURE0);
		return texture;
	}

	//==============================================================================
	// 렌더러 지우기. (세 프로그램과 빈 그림자 텍스처, 모형은 deleteMesh 로 따로)
	//==============================================================================
	destroy() {
		const webGL2RenderingContext = this.getWebGL2RenderingContext();
		webGL2RenderingContext.deleteProgram(this.#solidProgram.getProgram());
		webGL2RenderingContext.deleteProgram(this.#outlineProgram.getProgram());
		webGL2RenderingContext.deleteProgram(this.#depthProgram.getProgram());
		webGL2RenderingContext.deleteTexture(this.#emptyShadowTexture);
	}

	//==============================================================================
	// 모형 지우기.
	//==============================================================================
	/**
	 * @param { object | null } mesh
	 */
	deleteMesh(mesh) {
		if (mesh === null) {
			return;
		}
		const webGL2RenderingContext = this.getWebGL2RenderingContext();
		webGL2RenderingContext.deleteVertexArray(mesh.bodyVertexArray);
		if (mesh.outlineVertexArray !== null) {
			webGL2RenderingContext.deleteVertexArray(mesh.outlineVertexArray);
		}
		for (const buffer of mesh.buffers) {
			webGL2RenderingContext.deleteBuffer(buffer);
		}
	}

	//==============================================================================
	// 그리기 전의 상태 적어 두기.
	//==============================================================================
	saveState() {
		const webGL2RenderingContext = this.getWebGL2RenderingContext();
		this.#savedState = {
			isBlendEnabled: webGL2RenderingContext.isEnabled(webGL2RenderingContext.BLEND),
			isDepthTestEnabled: webGL2RenderingContext.isEnabled(webGL2RenderingContext.DEPTH_TEST),
			isCullFaceEnabled: webGL2RenderingContext.isEnabled(webGL2RenderingContext.CULL_FACE),
			depthMask: webGL2RenderingContext.getParameter(webGL2RenderingContext.DEPTH_WRITEMASK),
			blendSourceRGB: webGL2RenderingContext.getParameter(webGL2RenderingContext.BLEND_SRC_RGB),
			blendDestinationRGB: webGL2RenderingContext.getParameter(webGL2RenderingContext.BLEND_DST_RGB),
			blendSourceAlpha: webGL2RenderingContext.getParameter(webGL2RenderingContext.BLEND_SRC_ALPHA),
			blendDestinationAlpha: webGL2RenderingContext.getParameter(webGL2RenderingContext.BLEND_DST_ALPHA),
			program: webGL2RenderingContext.getParameter(webGL2RenderingContext.CURRENT_PROGRAM),
			vertexArray: webGL2RenderingContext.getParameter(webGL2RenderingContext.VERTEX_ARRAY_BINDING),
			viewport: webGL2RenderingContext.getParameter(webGL2RenderingContext.VIEWPORT),
			framebuffer: webGL2RenderingContext.getParameter(webGL2RenderingContext.FRAMEBUFFER_BINDING),
		};
	}

	//==============================================================================
	// 적어 둔 상태로 돌리기.
	//==============================================================================
	/**
	 * @param { boolean } isFramebufferRestored - 프레임버퍼와 뷰포트도 돌릴지.
	 */
	restoreState(isFramebufferRestored) {
		const webGL2RenderingContext = this.getWebGL2RenderingContext();
		const savedState = this.#savedState;
		webGL2RenderingContext.cullFace(webGL2RenderingContext.BACK);
		if (savedState === null) {
			return;
		}
		if (isFramebufferRestored) {
			const viewport = savedState.viewport;
			webGL2RenderingContext.bindFramebuffer(webGL2RenderingContext.FRAMEBUFFER, savedState.framebuffer);
			webGL2RenderingContext.viewport(viewport[0], viewport[1], viewport[2], viewport[3]);
		}
		webGL2RenderingContext.bindVertexArray(savedState.vertexArray);
		webGL2RenderingContext.useProgram(savedState.program);
		webGL2RenderingContext.depthMask(savedState.depthMask);
		webGL2RenderingContext.blendFuncSeparate(savedState.blendSourceRGB, savedState.blendDestinationRGB, savedState.blendSourceAlpha, savedState.blendDestinationAlpha);
		this.applyCapability(webGL2RenderingContext.BLEND, savedState.isBlendEnabled);
		this.applyCapability(webGL2RenderingContext.DEPTH_TEST, savedState.isDepthTestEnabled);
		this.applyCapability(webGL2RenderingContext.CULL_FACE, savedState.isCullFaceEnabled);
		this.#savedState = null;
	}

	//==============================================================================
	// 그리기 기능 켜고 끄기.
	//==============================================================================
	/**
	 * @param { GLenum } capability
	 * @param { boolean } isEnabled
	 */
	applyCapability(capability, isEnabled) {
		const webGL2RenderingContext = this.getWebGL2RenderingContext();
		if (isEnabled) {
			webGL2RenderingContext.enable(capability);
		}
		else {
			webGL2RenderingContext.disable(capability);
		}
	}

	//==============================================================================
	// 프레임 시작. (보기와 투영과 절두체를 정하고, 앞의 상태를 적어 둔 뒤 깊이 시험과 면 가리기를 켠다, 깊이를 비우는 것은 부르는 쪽이 정한다)
	//==============================================================================
	/**
	 * @param { Matrix4 } viewProjectionMatrix
	 */
	beginFrame(viewProjectionMatrix) {
		const webGL2RenderingContext = this.getWebGL2RenderingContext();
		this.#viewProjectionElements.set(viewProjectionMatrix.getElements());
		this.#frustumPlanes = extractFrustumPlanes(viewProjectionMatrix);
		this.#frameStatistics = { drawCallCount: 0, drawnObjectCount: 0, culledObjectCount: 0 };
		this.#isShadowPass = false;
		this.saveState();
		this.applyScreenRect();
		webGL2RenderingContext.disable(webGL2RenderingContext.BLEND);
		webGL2RenderingContext.enable(webGL2RenderingContext.DEPTH_TEST);
		webGL2RenderingContext.depthFunc(webGL2RenderingContext.LEQUAL);
		webGL2RenderingContext.depthMask(true);
		webGL2RenderingContext.enable(webGL2RenderingContext.CULL_FACE);
		webGL2RenderingContext.frontFace(webGL2RenderingContext.CCW);
	}

	//==============================================================================
	// 프레임 끝. (적어 둔 상태로 돌린다)
	//==============================================================================
	endFrame() {
		this.releaseScreenRect();
		this.restoreState(false);
	}

	//==============================================================================
	// 카메라로 프레임 시작. (Camera3D 의 보기와 투영으로 beginFrame)
	//==============================================================================
	/**
	 * @param { object } camera - Camera3D
	 */
	beginFrameWithCamera(camera) {
		const viewProjectionMatrix = camera.getViewProjectionMatrix();
		this.beginFrame(viewProjectionMatrix);
	}

	//==============================================================================
	// 그릴 화면 사각형 설정. (뷰포트 픽셀, 왼쪽 위 원점, 다음 beginFrame 부터)
	//==============================================================================
	/**
	 * @param { number } x
	 * @param { number } y
	 * @param { number } width
	 * @param { number } height
	 */
	setScreenRect(x, y, width, height) {
		this.#screenRect = { x: x, y: y, width: System.Math.max(0, width), height: System.Math.max(0, height) };
	}

	//==============================================================================
	// 그릴 화면 사각형 풀기. (뷰포트 전체에 그림)
	//==============================================================================
	clearScreenRect() {
		this.#screenRect = null;
	}

	//==============================================================================
	// 그릴 화면 사각형 반환. (없으면 null)
	//==============================================================================
	/**
	 * @returns { object | null } { x, y, width, height }
	 */
	getScreenRect() {
		return this.#screenRect;
	}

	//==============================================================================
	// 화면 사각형 걸기. (beginFrame 이 상태를 적은 뒤, 클립 x, y 에 사각형의 비를 곱하고 자리를 더한 뒤 가위를 켠다)
	//==============================================================================
	applyScreenRect() {
		const screenRect = this.#screenRect;
		const savedState = this.#savedState;
		if (screenRect === null || savedState === null) {
			return;
		}
		const viewport = savedState.viewport;
		const viewportWidth = System.Math.max(1, viewport[2]);
		const viewportHeight = System.Math.max(1, viewport[3]);
		const scaleX = screenRect.width / viewportWidth;
		const scaleY = screenRect.height / viewportHeight;
		const offsetX = (screenRect.x * 2 + screenRect.width) / viewportWidth - 1;
		const offsetY = 1 - (screenRect.y * 2 + screenRect.height) / viewportHeight;
		const elements = this.#viewProjectionElements;
		for (let columnIndex = 0; columnIndex < 4; ++columnIndex) {
			const clipW = elements[columnIndex * 4 + 3];
			elements[columnIndex * 4] = elements[columnIndex * 4] * scaleX + clipW * offsetX;
			elements[columnIndex * 4 + 1] = elements[columnIndex * 4 + 1] * scaleY + clipW * offsetY;
		}
		const webGL2RenderingContext = this.getWebGL2RenderingContext();
		const scissorLeft = System.Math.floor(screenRect.x);
		const scissorBottom = System.Math.floor(viewportHeight - screenRect.y - screenRect.height);
		const scissorRight = System.Math.ceil(screenRect.x + screenRect.width);
		const scissorTop = System.Math.ceil(viewportHeight - screenRect.y);
		webGL2RenderingContext.enable(webGL2RenderingContext.SCISSOR_TEST);
		webGL2RenderingContext.scissor(viewport[0] + scissorLeft, viewport[1] + scissorBottom, scissorRight - scissorLeft, scissorTop - scissorBottom);
		this.#isScissorApplied = true;
	}

	//==============================================================================
	// 화면 사각형의 가위 풀기. (applyScreenRect 가 켰을 때만)
	//==============================================================================
	releaseScreenRect() {
		if (!this.#isScissorApplied) {
			return;
		}
		const webGL2RenderingContext = this.getWebGL2RenderingContext();
		webGL2RenderingContext.disable(webGL2RenderingContext.SCISSOR_TEST);
		this.#isScissorApplied = false;
	}

	//==============================================================================
	// 그림자 깊이 패스 시작. (ShadowMap 의 프레임버퍼에 빛의 보기와 투영으로, 앞의 프레임버퍼와 뷰포트는 endShadowPass 가 돌린다)
	//==============================================================================
	/**
	 * @param { object } shadowMap - ShadowMap
	 */
	beginShadowPass(shadowMap) {
		const webGL2RenderingContext = this.getWebGL2RenderingContext();
		this.saveState();
		const lightViewProjectionMatrix = shadowMap.getLightViewProjectionMatrix();
		this.#viewProjectionElements.set(lightViewProjectionMatrix.getElements());
		this.#frustumPlanes = extractFrustumPlanes(lightViewProjectionMatrix);
		this.#isShadowPass = true;
		shadowMap.beginRender();
		webGL2RenderingContext.disable(webGL2RenderingContext.BLEND);
		webGL2RenderingContext.depthFunc(webGL2RenderingContext.LEQUAL);
		webGL2RenderingContext.enable(webGL2RenderingContext.CULL_FACE);
		webGL2RenderingContext.cullFace(webGL2RenderingContext.BACK);
	}

	//==============================================================================
	// 그림자 깊이 패스 끝. (프레임버퍼와 뷰포트와 상태를 돌린다)
	//==============================================================================
	endShadowPass() {
		this.#isShadowPass = false;
		this.restoreState(true);
	}

	//==============================================================================
	// 경계 구가 절두체 안에 드는지. (모형 행렬로 옮긴 가운데, 가장 큰 크기를 곱한 반지름)
	//==============================================================================
	/**
	 * @param { object } mesh
	 * @param { Float32Array } modelElements
	 * @returns { boolean }
	 */
	isVisible(mesh, modelElements) {
		const center = mesh.boundingCenter;
		const centerX = modelElements[0] * center[0] + modelElements[4] * center[1] + modelElements[8] * center[2] + modelElements[12];
		const centerY = modelElements[1] * center[0] + modelElements[5] * center[1] + modelElements[9] * center[2] + modelElements[13];
		const centerZ = modelElements[2] * center[0] + modelElements[6] * center[1] + modelElements[10] * center[2] + modelElements[14];
		const radius = mesh.boundingRadius * readMaximumScale(modelElements);
		for (const plane of this.#frustumPlanes) {
			if (plane[0] * centerX + plane[1] * centerY + plane[2] * centerZ + plane[3] < -radius) {
				return false;
			}
		}
		return true;
	}

	//==============================================================================
	// 모형 하나 그리기. (그림자 패스면 깊이만, 화면 밖이면 건너뛴다)
	//==============================================================================
	/**
	 * @param { object } mesh - createMesh 의 결과.
	 * @param { Matrix4 } modelMatrix
	 * @param { object } [options] - { tintColor [r, g, b, a] sRGB, alpha, jointMatrices Float32Array, hasOutline (기본 true), isCulled (기본 true) }
	 */
	drawMesh(mesh, modelMatrix, options = {}) {
		if (mesh === null) {
			return;
		}
		const modelElements = modelMatrix.getElements();
		const isCulled = options.isCulled !== false;
		if (isCulled && !this.isVisible(mesh, modelElements)) {
			this.#frameStatistics.culledObjectCount += 1;
			return;
		}
		this.#frameStatistics.drawnObjectCount += 1;
		this.drawWithCount(mesh, modelElements, 0, options);
	}

	//==============================================================================
	// 같은 모형 여럿을 한 번에 그리기. (GPU 인스턴싱, 화면 밖 인스턴스는 걸러 남은 것만 올린다, 뼈대 모형은 같은 자세)
	//==============================================================================
	/**
	 * @param { object } mesh
	 * @param { Array<object> } instances - { modelMatrix: Matrix4, tintColor: [r, g, b, a] } 의 배열.
	 * @param { object } [options]
	 */
	drawMeshInstanced(mesh, instances, options = {}) {
		if (mesh === null) {
			return;
		}
		const webGL2RenderingContext = this.getWebGL2RenderingContext();
		const isCulled = options.isCulled !== false;
		if (this.#instanceData.length < instances.length * TOON_INSTANCE_FLOAT_COUNT) {
			this.#instanceData = new System.Float32Array(instances.length * TOON_INSTANCE_FLOAT_COUNT);
		}
		const instanceData = this.#instanceData;
		let instanceCount = 0;
		for (const instance of instances) {
			const modelElements = instance.modelMatrix.getElements();
			if (isCulled && !this.isVisible(mesh, modelElements)) {
				this.#frameStatistics.culledObjectCount += 1;
				continue;
			}
			const offset = instanceCount * TOON_INSTANCE_FLOAT_COUNT;
			instanceData.set(modelElements, offset);
			const tintColor = instance.tintColor !== undefined ? instance.tintColor : [1, 1, 1, 1];
			instanceData[offset + 16] = tintColor[0];
			instanceData[offset + 17] = tintColor[1];
			instanceData[offset + 18] = tintColor[2];
			instanceData[offset + 19] = tintColor[3];
			instanceCount += 1;
		}
		this.#frameStatistics.drawnObjectCount += instanceCount;
		if (instanceCount === 0) {
			return;
		}
		webGL2RenderingContext.bindBuffer(webGL2RenderingContext.ARRAY_BUFFER, mesh.instanceBuffer);
		webGL2RenderingContext.bufferData(webGL2RenderingContext.ARRAY_BUFFER, instanceData.subarray(0, instanceCount * TOON_INSTANCE_FLOAT_COUNT), webGL2RenderingContext.DYNAMIC_DRAW);
		const identityElements = Matrix4.createIdentity().getElements();
		this.drawWithCount(mesh, identityElements, instanceCount, options);
	}

	//==============================================================================
	// 모형 하나의 바깥선만 그리기. (거르지도 세지도 않는다, 껍데기가 없거나 hasOutline 이 false 면 그리지 않는다)
	//==============================================================================
	/**
	 * @param { object } mesh
	 * @param { Matrix4 } modelMatrix
	 * @param { object } [options] - drawMesh 와 같다.
	 */
	drawMeshOutline(mesh, modelMatrix, options = {}) {
		if (mesh === null || mesh.outlineVertexArray === null || options.hasOutline === false || this.#isShadowPass) {
			return;
		}
		const outlineOptions = System.Object.assign({}, options, { isBodyDrawn: false });
		this.drawWithCount(mesh, modelMatrix.getElements(), 0, outlineOptions);
	}

	//==============================================================================
	// 그리기 본체. (instanceCount 가 0 이면 보통, 아니면 인스턴스로)
	//==============================================================================
	/**
	 * @param { object } mesh
	 * @param { Float32Array } modelElements
	 * @param { number } instanceCount
	 * @param { object } options
	 */
	drawWithCount(mesh, modelElements, instanceCount, options) {
		const webGL2RenderingContext = this.getWebGL2RenderingContext();
		const jointMatrices = options.jointMatrices !== undefined ? options.jointMatrices : null;
		const isSkinned = mesh.isSkinned && jointMatrices !== null;
		const isInstanced = instanceCount > 0;
		const drawElements = (indexCount) => {
			if (isInstanced) {
				webGL2RenderingContext.drawElementsInstanced(webGL2RenderingContext.TRIANGLES, indexCount, webGL2RenderingContext.UNSIGNED_INT, 0, instanceCount);
			}
			else {
				webGL2RenderingContext.drawElements(webGL2RenderingContext.TRIANGLES, indexCount, webGL2RenderingContext.UNSIGNED_INT, 0);
			}
			this.#frameStatistics.drawCallCount += 1;
		};

		// 그림자 패스. (몸의 깊이만)
		if (this.#isShadowPass) {
			const depthProgram = this.getDepthProgram();
			depthProgram.use();
			this.uploadCommonUniforms(depthProgram, modelElements, isSkinned, isInstanced, jointMatrices);
			webGL2RenderingContext.bindVertexArray(mesh.bodyVertexArray);
			drawElements(mesh.bodyIndexCount);
			return;
		}

		const tintColor = options.tintColor !== undefined ? options.tintColor : [1, 1, 1, 1];
		const alpha = options.alpha !== undefined ? options.alpha : 1;
		const hasOutline = options.hasOutline !== false && mesh.outlineVertexArray !== null;
		const isTransparent = alpha < 1 || tintColor[3] < 1;
		const hdrOutput = this.#isHdrOutput ? 1 : 0;
		if (isTransparent) {
			webGL2RenderingContext.enable(webGL2RenderingContext.BLEND);
			webGL2RenderingContext.blendFunc(webGL2RenderingContext.SRC_ALPHA, webGL2RenderingContext.ONE_MINUS_SRC_ALPHA);
		}

		// 바깥선. (껍데기의 뒷면만)
		if (hasOutline) {
			const outlineProgram = this.getOutlineProgram();
			outlineProgram.use();
			this.uploadCommonUniforms(outlineProgram, modelElements, isSkinned, isInstanced, jointMatrices);
			const outlineColor = this.#outlineColor;
			webGL2RenderingContext.uniform4f(outlineProgram.getUniformLocation("outlineColor"), outlineColor[0], outlineColor[1], outlineColor[2], outlineColor[3]);
			webGL2RenderingContext.uniform1f(outlineProgram.getUniformLocation("alpha"), alpha);
			webGL2RenderingContext.uniform1f(outlineProgram.getUniformLocation("hdrOutput"), hdrOutput);
			webGL2RenderingContext.cullFace(webGL2RenderingContext.FRONT);
			webGL2RenderingContext.bindVertexArray(mesh.outlineVertexArray);
			drawElements(mesh.outlineIndexCount);
		}
		if (options.isBodyDrawn === false) {
			if (isTransparent) {
				webGL2RenderingContext.disable(webGL2RenderingContext.BLEND);
			}
			return;
		}

		// 몸.
		const solidProgram = this.getSolidProgram();
		solidProgram.use();
		this.uploadCommonUniforms(solidProgram, modelElements, isSkinned, isInstanced, jointMatrices);
		const sunDirection = this.#sunDirection;
		const sunColor = this.#sunColor;
		const skyColor = this.#skyColor;
		const groundColor = this.#groundColor;
		webGL2RenderingContext.uniform3f(solidProgram.getUniformLocation("sunDirection"), sunDirection[0], sunDirection[1], sunDirection[2]);
		webGL2RenderingContext.uniform3f(solidProgram.getUniformLocation("sunColor"), sunColor[0], sunColor[1], sunColor[2]);
		webGL2RenderingContext.uniform3f(solidProgram.getUniformLocation("skyColor"), skyColor[0], skyColor[1], skyColor[2]);
		webGL2RenderingContext.uniform3f(solidProgram.getUniformLocation("groundColor"), groundColor[0], groundColor[1], groundColor[2]);
		webGL2RenderingContext.uniform1f(solidProgram.getUniformLocation("bandCount"), this.#bandCount);
		webGL2RenderingContext.uniform4f(solidProgram.getUniformLocation("tintColor"), tintColor[0], tintColor[1], tintColor[2], tintColor[3]);
		webGL2RenderingContext.uniform1f(solidProgram.getUniformLocation("alpha"), alpha);
		webGL2RenderingContext.uniform1f(solidProgram.getUniformLocation("hdrOutput"), hdrOutput);
		webGL2RenderingContext.uniform1i(solidProgram.getUniformLocation("shadowTexture"), SHADOW_TEXTURE_UNIT);
		const shadowInput = this.#shadowInput;
		if (shadowInput !== null) {
			webGL2RenderingContext.activeTexture(webGL2RenderingContext.TEXTURE0 + SHADOW_TEXTURE_UNIT);
			webGL2RenderingContext.bindTexture(webGL2RenderingContext.TEXTURE_2D, shadowInput.depthTexture);
			webGL2RenderingContext.activeTexture(webGL2RenderingContext.TEXTURE0);
			webGL2RenderingContext.uniform1f(solidProgram.getUniformLocation("shadowEnabled"), 1);
			webGL2RenderingContext.uniform1f(solidProgram.getUniformLocation("shadowStrength"), shadowInput.strength);
			webGL2RenderingContext.uniform1f(solidProgram.getUniformLocation("shadowTexelSize"), 1 / System.Math.max(1, shadowInput.resolution));
			webGL2RenderingContext.uniformMatrix4fv(solidProgram.getUniformLocation("lightViewProjectionMatrix"), false, shadowInput.lightViewProjectionMatrix.getElements());
		}
		else {
			webGL2RenderingContext.activeTexture(webGL2RenderingContext.TEXTURE0 + SHADOW_TEXTURE_UNIT);
			webGL2RenderingContext.bindTexture(webGL2RenderingContext.TEXTURE_2D, this.#emptyShadowTexture);
			webGL2RenderingContext.activeTexture(webGL2RenderingContext.TEXTURE0);
			webGL2RenderingContext.uniform1f(solidProgram.getUniformLocation("shadowEnabled"), 0);
		}
		webGL2RenderingContext.cullFace(webGL2RenderingContext.BACK);
		webGL2RenderingContext.bindVertexArray(mesh.bodyVertexArray);
		drawElements(mesh.bodyIndexCount);
		if (isTransparent) {
			webGL2RenderingContext.disable(webGL2RenderingContext.BLEND);
		}
	}

	//==============================================================================
	// 세 프로그램이 함께 쓰는 유니폼 올리기. (보기와 투영, 모형 행렬, 뼈대, 인스턴싱)
	//==============================================================================
	/**
	 * @param { ShaderProgram } shaderProgram
	 * @param { Float32Array } modelElements
	 * @param { boolean } isSkinned
	 * @param { boolean } isInstanced
	 * @param { Float32Array | null } jointMatrices
	 */
	uploadCommonUniforms(shaderProgram, modelElements, isSkinned, isInstanced, jointMatrices) {
		const webGL2RenderingContext = this.getWebGL2RenderingContext();
		webGL2RenderingContext.uniformMatrix4fv(shaderProgram.getUniformLocation("viewProjectionMatrix"), false, this.#viewProjectionElements);
		webGL2RenderingContext.uniformMatrix4fv(shaderProgram.getUniformLocation("modelMatrix"), false, modelElements);
		webGL2RenderingContext.uniform1f(shaderProgram.getUniformLocation("instanced"), isInstanced ? 1 : 0);
		webGL2RenderingContext.uniform1f(shaderProgram.getUniformLocation("skinned"), isSkinned ? 1 : 0);
		if (isSkinned) {
			const jointFloatCount = System.Math.floor(System.Math.min(jointMatrices.length, TOON_MAXIMUM_JOINTS * 16) / 16) * 16;
			const jointValues = jointMatrices.length === jointFloatCount ? jointMatrices : jointMatrices.subarray(0, jointFloatCount);
			webGL2RenderingContext.uniformMatrix4fv(shaderProgram.getUniformLocation("jointMatrices"), false, jointValues);
		}
	}

	//==============================================================================
	// 빛 설정. (해가 비추는 방향, 해의 색, 하늘색, 땅색, 모두 선형 색 0 ~, HDR 이면 1 을 넘어도 된다)
	//==============================================================================
	/**
	 * @param { Array<number> } sunDirection
	 * @param { Array<number> } sunColor
	 * @param { Array<number> } skyColor
	 * @param { Array<number> } groundColor
	 */
	setLight(sunDirection, sunColor, skyColor, groundColor) {
		this.#sunDirection = sunDirection.slice();
		this.#sunColor = sunColor.slice();
		this.#skyColor = skyColor.slice();
		this.#groundColor = groundColor.slice();
	}

	//==============================================================================
	// 해가 비추는 방향 반환. (ShadowMap.updateLightMatrix 에 넘긴다)
	//==============================================================================
	/**
	 * @returns { Array<number> }
	 */
	getSunDirection() {
		return this.#sunDirection;
	}

	//==============================================================================
	// 셀 셰이딩 칸 수 설정. (0 이면 부드럽게)
	//==============================================================================
	/**
	 * @param { number } bandCount
	 */
	setBandCount(bandCount) {
		this.#bandCount = System.Math.max(0, System.Math.floor(bandCount));
	}

	//==============================================================================
	// 바깥선 색 설정. (sRGB 0 ~ 1 과 알파)
	//==============================================================================
	/**
	 * @param { Array<number> } outlineColor - [r, g, b, a]
	 */
	setOutlineColor(outlineColor) {
		this.#outlineColor = outlineColor.slice();
	}

	//==============================================================================
	// HDR 출력 설정. (true 면 감마를 걸지 않은 선형 색을 낸다)
	//==============================================================================
	/**
	 * @param { boolean } isHdrOutput
	 */
	setHdrOutput(isHdrOutput) {
		this.#isHdrOutput = isHdrOutput;
	}

	//==============================================================================
	// 받을 그림자 설정. (ShadowMap 이나 null, 세기 0 ~ 1)
	//==============================================================================
	/**
	 * @param { object | null } shadowMap - ShadowMap
	 * @param { number } strength
	 */
	setShadow(shadowMap, strength = 0.6) {
		if (shadowMap === null) {
			this.#shadowInput = null;
			return;
		}
		this.#shadowInput = { depthTexture: shadowMap.getDepthTexture(), lightViewProjectionMatrix: shadowMap.getLightViewProjectionMatrix(), resolution: shadowMap.getResolution(), strength: strength };
	}

	//==============================================================================
	// 이번 프레임의 그린 수와 거른 수와 드로우콜.
	//==============================================================================
	/**
	 * @returns { object } { drawCallCount, drawnObjectCount, culledObjectCount }
	 */
	getFrameStatistics() {
		return this.#frameStatistics;
	}

	//==============================================================================
	// 렌더링 컨텍스트 반환.
	//==============================================================================
	/**
	 * @returns { WebGL2RenderingContext }
	 */
	getWebGL2RenderingContext() {
		return this.#webGL2RenderingContext;
	}

	//==============================================================================
	// 몸 프로그램 반환.
	//==============================================================================
	/**
	 * @returns { ShaderProgram }
	 */
	getSolidProgram() {
		return this.#solidProgram;
	}

	//==============================================================================
	// 바깥선 프로그램 반환.
	//==============================================================================
	/**
	 * @returns { ShaderProgram }
	 */
	getOutlineProgram() {
		return this.#outlineProgram;
	}

	//==============================================================================
	// 그림자 깊이 프로그램 반환.
	//==============================================================================
	/**
	 * @returns { ShaderProgram }
	 */
	getDepthProgram() {
		return this.#depthProgram;
	}
}
