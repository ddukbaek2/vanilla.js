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
// 한 모형이 쓰는 뼈대 수의 상한. (셰이더의 유니폼 배열 크기)
export const TOON_MAXIMUM_JOINTS = 32;

// 어트리뷰트 자리. (모든 프로그램이 같은 자리를 써서 버텍스 어레이 하나를 함께 쓴다)
export const TOON_ATTRIBUTE_LOCATIONS = System.Object.freeze({
	vertexPosition: 0,
	vertexNormal: 1,
	vertexColor: 2,
	vertexMaterial: 3,
	vertexDetail: 4,
	vertexJoints: 5,
	vertexWeights: 6,
});

// 꼭짓점을 본으로 움직이는 셰이더 조각. (뼈대가 없으면 그대로)
const SKIN_SHADER_CHUNK = `in vec4 vertexJoints;
in vec4 vertexWeights;
uniform mat4 jointMatrices[${TOON_MAXIMUM_JOINTS}];
uniform float skinned;
mat4 readSkinMatrix() {
	if (skinned < 0.5) {
		return mat4(1.0);
	}
	return jointMatrices[int(vertexJoints.x)] * vertexWeights.x + jointMatrices[int(vertexJoints.y)] * vertexWeights.y + jointMatrices[int(vertexJoints.z)] * vertexWeights.z + jointMatrices[int(vertexJoints.w)] * vertexWeights.w;
}
`;

// 몸을 그리는 셰이더.
const SOLID_VERTEX_SHADER = `#version 300 es
in vec3 vertexPosition;
in vec3 vertexNormal;
in vec3 vertexColor;
in vec2 vertexMaterial;
in vec4 vertexDetail;
${SKIN_SHADER_CHUNK}
uniform mat4 viewProjectionMatrix;
uniform mat4 modelMatrix;
out vec3 worldNormal;
out vec3 surfaceColor;
out vec2 surfaceMaterial;
void main() {
	mat4 skinMatrix = readSkinMatrix();
	vec4 position = modelMatrix * skinMatrix * vec4(vertexPosition, 1.0);
	worldNormal = normalize(mat3(modelMatrix) * mat3(skinMatrix) * vertexNormal);
	surfaceColor = vertexColor;
	surfaceMaterial = vertexMaterial;
	gl_Position = viewProjectionMatrix * position;
}
`;
const SOLID_FRAGMENT_SHADER = `#version 300 es
precision highp float;
in vec3 worldNormal;
in vec3 surfaceColor;
in vec2 surfaceMaterial;
uniform vec3 sunDirection;
uniform vec3 sunColor;
uniform vec3 skyColor;
uniform vec3 groundColor;
uniform float bandCount;
uniform vec4 tintColor;
uniform float alpha;
out vec4 fragmentColor;
vec3 toLinear(vec3 color) {
	return pow(color, vec3(2.2));
}
vec3 toDisplay(vec3 color) {
	return pow(clamp(color, 0.0, 1.0), vec3(1.0 / 2.2));
}
void main() {
	vec3 albedo = toLinear(surfaceColor) * toLinear(tintColor.rgb);
	float glow = surfaceMaterial.x;
	float unlit = surfaceMaterial.y;
	if (unlit > 0.5) {
		fragmentColor = vec4(toDisplay(albedo * (1.0 + glow)), alpha * tintColor.a);
		return;
	}
	vec3 normal = normalize(worldNormal);
	float facing = max(dot(normal, -normalize(sunDirection)), 0.0);
	if (bandCount > 0.5) {
		facing = floor(facing * bandCount + 0.5) / bandCount;
	}
	float upward = normal.y * 0.5 + 0.5;
	vec3 ambient = mix(groundColor, skyColor, upward);
	vec3 lit = albedo * (ambient + sunColor * facing) + albedo * glow;
	fragmentColor = vec4(toDisplay(lit), alpha * tintColor.a);
}
`;

// 바깥선 껍데기를 그리는 셰이더. (껍데기는 뒷면만 그려 몸 둘레에 테로 보인다)
const OUTLINE_VERTEX_SHADER = `#version 300 es
in vec3 vertexPosition;
${SKIN_SHADER_CHUNK}
uniform mat4 viewProjectionMatrix;
uniform mat4 modelMatrix;
void main() {
	mat4 skinMatrix = readSkinMatrix();
	gl_Position = viewProjectionMatrix * modelMatrix * skinMatrix * vec4(vertexPosition, 1.0);
}
`;
const OUTLINE_FRAGMENT_SHADER = `#version 300 es
precision highp float;
uniform vec4 outlineColor;
uniform float alpha;
out vec4 fragmentColor;
void main() {
	fragmentColor = vec4(outlineColor.rgb, outlineColor.a * alpha);
}
`;


//==============================================================================
// 툰 렌더러. (ToonMesh 의 MeshBuilder 배열이나 ToonGlb 로 읽은 모형을 한 색 재질과 바깥선으로 그린다)
// - 빛: 해(방향과 색)를 받는 면과, 하늘색과 땅색을 노멀의 위아래로 섞은 바탕빛. bandCount 를 주면 해를 받는 정도를 그만큼의 칸으로 끊어 셀 셰이딩이 된다.
// - 재질: 꼭짓점의 빛남(더해 밝힘)과 빛을 받지 않음. 모형마다 틴트 색(곱함)과 불투명도를 준다.
// - 바깥선: MeshBuilder 가 지은 껍데기를 뒷면만 그린다. 껍데기를 몸보다 먼저 그려도 깊이로 몸이 덮는다.
// - 뼈대: ToonGlb.writeSkinPose 가 셈한 본 행렬을 drawMesh 에 넘긴다. (TOON_MAXIMUM_JOINTS 까지)
// - 사용: createMesh(arrays) → 매 프레임 beginFrame(viewProjectionMatrix) → drawMesh(mesh, modelMatrix, options) → endFrame() → 다 쓰면 deleteMesh.
//   beginFrame 이 그 앞의 그리기 상태(섞기, 깊이, 면 가리기, 프로그램, 버텍스 어레이)를 적어 두고 깊이 시험과 면 가리기를 켜며, endFrame 이 적어 둔 상태로 돌린다. (엔진 2D 그리기 사이에 끼울 때, 그 전에 Graphic.flushSpriteBatch)
//==============================================================================
export class ToonRenderer {
	//==============================================================================
	// 멤버 변수 목록.
	//==============================================================================
	/** @private @type { WebGL2RenderingContext } */ #webGL2RenderingContext;
	/** @private @type { ShaderProgram } */ #solidProgram;
	/** @private @type { ShaderProgram } */ #outlineProgram;
	/** @private @type { Float32Array } */ #viewProjectionElements; // 이번 프레임의 보기와 투영.
	/** @private @type { Array<number> } */ #sunDirection; // 해가 비추는 쪽. (해에서 나오는 방향)
	/** @private @type { Array<number> } */ #sunColor;
	/** @private @type { Array<number> } */ #skyColor;
	/** @private @type { Array<number> } */ #groundColor;
	/** @private @type { number } */ #bandCount; // 셀 셰이딩 칸 수. (0 이면 부드럽게)
	/** @private @type { Array<number> } */ #outlineColor; // 바깥선 색. (sRGB, 알파)
	/** @private @type { object | null } */ #savedState; // beginFrame 앞의 그리기 상태. (endFrame 이 돌린다)

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
		const identityMatrix = Matrix4.createIdentity();
		const identityElements = identityMatrix.getElements();
		this.#viewProjectionElements = new System.Float32Array(identityElements);
		this.#sunDirection = [-0.4, -1.0, -0.3];
		this.#sunColor = [0.9, 0.85, 0.8];
		this.#skyColor = [0.45, 0.5, 0.6];
		this.#groundColor = [0.2, 0.18, 0.16];
		this.#bandCount = 0;
		this.#outlineColor = [0.05, 0.05, 0.08, 1];
		this.#savedState = null;
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
		];
	}

	//==============================================================================
	// 모형 올리기. (MeshBuilder.readArrays 나 ToonGlb.readGlbArrays 의 결과, 몸이 비면 null)
	//==============================================================================
	/**
	 * @param { object } arrays
	 * @returns { object | null } { bodyVertexArray, bodyIndexCount, outlineVertexArray, outlineIndexCount, buffers, skeleton }
	 */
	createMesh(arrays) {
		if (arrays.indexData.length === 0) {
			return null;
		}
		const webGL2RenderingContext = this.getWebGL2RenderingContext();
		const buffers = [];
		const isSkinned = arrays.skinData !== undefined && arrays.skinData !== null && arrays.skinData.length > 0;

		// 몸.
		const bodyVertexArray = webGL2RenderingContext.createVertexArray();
		webGL2RenderingContext.bindVertexArray(bodyVertexArray);
		const vertexBuffer = this.createArrayBuffer(arrays.vertexData);
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
			const location = attributeLayout[0];
			const size = attributeLayout[1];
			const offset = attributeLayout[2];
			webGL2RenderingContext.enableVertexAttribArray(location);
			webGL2RenderingContext.vertexAttribPointer(location, size, webGL2RenderingContext.FLOAT, false, stride, offset);
		}
		if (isSkinned) {
			const skinBuffer = this.createSkinAttributes(arrays.skinData);
			buffers.push(skinBuffer);
		}
		const bodyIndexBuffer = this.createIndexBuffer(arrays.indexData);
		buffers.push(bodyIndexBuffer);

		// 바깥선 껍데기. (자리만)
		let outlineVertexArray = null;
		let outlineIndexCount = 0;
		const outlineIndexData = arrays.outlineIndexData;
		if (outlineIndexData !== undefined && outlineIndexData !== null && outlineIndexData.length > 0) {
			outlineVertexArray = webGL2RenderingContext.createVertexArray();
			webGL2RenderingContext.bindVertexArray(outlineVertexArray);
			const outlineBuffer = this.createArrayBuffer(arrays.outlineVertexData);
			buffers.push(outlineBuffer);
			webGL2RenderingContext.enableVertexAttribArray(TOON_ATTRIBUTE_LOCATIONS.vertexPosition);
			webGL2RenderingContext.vertexAttribPointer(TOON_ATTRIBUTE_LOCATIONS.vertexPosition, 3, webGL2RenderingContext.FLOAT, false, 12, 0);
			const outlineSkinData = arrays.outlineSkinData;
			if (isSkinned && outlineSkinData !== undefined && outlineSkinData.length > 0) {
				const outlineSkinBuffer = this.createSkinAttributes(outlineSkinData);
				buffers.push(outlineSkinBuffer);
			}
			const outlineIndexBuffer = this.createIndexBuffer(outlineIndexData);
			buffers.push(outlineIndexBuffer);
			outlineIndexCount = outlineIndexData.length;
		}
		webGL2RenderingContext.bindVertexArray(null);
		const skeleton = isSkinned && arrays.skeleton !== undefined ? arrays.skeleton : null;
		return {
			bodyVertexArray: bodyVertexArray,
			bodyIndexCount: arrays.indexData.length,
			outlineVertexArray: outlineVertexArray,
			outlineIndexCount: outlineIndexCount,
			buffers: buffers,
			isSkinned: isSkinned,
			skeleton: skeleton,
		};
	}

	//==============================================================================
	// 꼭짓점 버퍼 만들기.
	//==============================================================================
	/**
	 * @param { Float32Array } data
	 * @returns { WebGLBuffer }
	 */
	createArrayBuffer(data) {
		const webGL2RenderingContext = this.getWebGL2RenderingContext();
		const buffer = webGL2RenderingContext.createBuffer();
		webGL2RenderingContext.bindBuffer(webGL2RenderingContext.ARRAY_BUFFER, buffer);
		webGL2RenderingContext.bufferData(webGL2RenderingContext.ARRAY_BUFFER, data, webGL2RenderingContext.STATIC_DRAW);
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
	 * @param { Float32Array } skinData - 꼭짓점마다 뼈대 번호 넷과 무게 넷.
	 * @returns { WebGLBuffer }
	 */
	createSkinAttributes(skinData) {
		const webGL2RenderingContext = this.getWebGL2RenderingContext();
		const stride = SKIN_FLOAT_COUNT * 4;
		const skinBuffer = this.createArrayBuffer(skinData);
		webGL2RenderingContext.enableVertexAttribArray(TOON_ATTRIBUTE_LOCATIONS.vertexJoints);
		webGL2RenderingContext.vertexAttribPointer(TOON_ATTRIBUTE_LOCATIONS.vertexJoints, 4, webGL2RenderingContext.FLOAT, false, stride, 0);
		webGL2RenderingContext.enableVertexAttribArray(TOON_ATTRIBUTE_LOCATIONS.vertexWeights);
		webGL2RenderingContext.vertexAttribPointer(TOON_ATTRIBUTE_LOCATIONS.vertexWeights, 4, webGL2RenderingContext.FLOAT, false, stride, 16);
		return skinBuffer;
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
	// 프레임 시작. (보기와 투영을 정하고 깊이 시험과 면 가리기를 켠다, 깊이를 비우는 것은 부르는 쪽이 정한다)
	//==============================================================================
	/**
	 * @param { Matrix4 } viewProjectionMatrix
	 */
	beginFrame(viewProjectionMatrix) {
		const webGL2RenderingContext = this.getWebGL2RenderingContext();
		const elements = viewProjectionMatrix.getElements();
		this.#viewProjectionElements.set(elements);
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
		};
		webGL2RenderingContext.disable(webGL2RenderingContext.BLEND);
		webGL2RenderingContext.enable(webGL2RenderingContext.DEPTH_TEST);
		webGL2RenderingContext.depthFunc(webGL2RenderingContext.LEQUAL);
		webGL2RenderingContext.depthMask(true);
		webGL2RenderingContext.enable(webGL2RenderingContext.CULL_FACE);
		webGL2RenderingContext.frontFace(webGL2RenderingContext.CCW);
	}

	//==============================================================================
	// 모형 하나 그리기.
	//==============================================================================
	/**
	 * @param { object } mesh - createMesh 의 결과.
	 * @param { Matrix4 } modelMatrix
	 * @param { object } [options] - { tintColor [r, g, b, a] sRGB, alpha, jointMatrices Float32Array, hasOutline (기본 true) }
	 */
	drawMesh(mesh, modelMatrix, options = {}) {
		if (mesh === null) {
			return;
		}
		const webGL2RenderingContext = this.getWebGL2RenderingContext();
		const modelElements = modelMatrix.getElements();
		const tintColor = options.tintColor !== undefined ? options.tintColor : [1, 1, 1, 1];
		const alpha = options.alpha !== undefined ? options.alpha : 1;
		const jointMatrices = options.jointMatrices !== undefined ? options.jointMatrices : null;
		const isSkinned = mesh.isSkinned && jointMatrices !== null;
		const hasOutline = options.hasOutline !== false && mesh.outlineVertexArray !== null;
		const isTransparent = alpha < 1 || tintColor[3] < 1;
		if (isTransparent) {
			webGL2RenderingContext.enable(webGL2RenderingContext.BLEND);
			webGL2RenderingContext.blendFunc(webGL2RenderingContext.SRC_ALPHA, webGL2RenderingContext.ONE_MINUS_SRC_ALPHA);
		}

		// 바깥선. (껍데기의 뒷면만)
		if (hasOutline) {
			const outlineProgram = this.getOutlineProgram();
			outlineProgram.use();
			this.uploadCommonUniforms(outlineProgram, modelElements, isSkinned, jointMatrices);
			const outlineColor = this.#outlineColor;
			webGL2RenderingContext.uniform4f(outlineProgram.getUniformLocation("outlineColor"), outlineColor[0], outlineColor[1], outlineColor[2], outlineColor[3]);
			webGL2RenderingContext.uniform1f(outlineProgram.getUniformLocation("alpha"), alpha);
			webGL2RenderingContext.cullFace(webGL2RenderingContext.FRONT);
			webGL2RenderingContext.bindVertexArray(mesh.outlineVertexArray);
			webGL2RenderingContext.drawElements(webGL2RenderingContext.TRIANGLES, mesh.outlineIndexCount, webGL2RenderingContext.UNSIGNED_INT, 0);
		}

		// 몸.
		const solidProgram = this.getSolidProgram();
		solidProgram.use();
		this.uploadCommonUniforms(solidProgram, modelElements, isSkinned, jointMatrices);
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
		webGL2RenderingContext.cullFace(webGL2RenderingContext.BACK);
		webGL2RenderingContext.bindVertexArray(mesh.bodyVertexArray);
		webGL2RenderingContext.drawElements(webGL2RenderingContext.TRIANGLES, mesh.bodyIndexCount, webGL2RenderingContext.UNSIGNED_INT, 0);
		if (isTransparent) {
			webGL2RenderingContext.disable(webGL2RenderingContext.BLEND);
		}
	}

	//==============================================================================
	// 두 프로그램이 함께 쓰는 유니폼 올리기. (보기와 투영, 모형 행렬, 뼈대)
	//==============================================================================
	/**
	 * @param { ShaderProgram } shaderProgram
	 * @param { Float32Array } modelElements
	 * @param { boolean } isSkinned
	 * @param { Float32Array | null } jointMatrices
	 */
	uploadCommonUniforms(shaderProgram, modelElements, isSkinned, jointMatrices) {
		const webGL2RenderingContext = this.getWebGL2RenderingContext();
		webGL2RenderingContext.uniformMatrix4fv(shaderProgram.getUniformLocation("viewProjectionMatrix"), false, this.#viewProjectionElements);
		webGL2RenderingContext.uniformMatrix4fv(shaderProgram.getUniformLocation("modelMatrix"), false, modelElements);
		webGL2RenderingContext.uniform1f(shaderProgram.getUniformLocation("skinned"), isSkinned ? 1 : 0);
		if (isSkinned) {
			const jointFloatCount = System.Math.min(jointMatrices.length, TOON_MAXIMUM_JOINTS * 16);
			const jointValues = jointMatrices.length === jointFloatCount ? jointMatrices : jointMatrices.subarray(0, jointFloatCount);
			webGL2RenderingContext.uniformMatrix4fv(shaderProgram.getUniformLocation("jointMatrices"), false, jointValues);
		}
	}

	//==============================================================================
	// 프레임 끝. (엔진 2D 그리기가 쓰는 상태로 돌린다)
	//==============================================================================
	endFrame() {
		const webGL2RenderingContext = this.getWebGL2RenderingContext();
		const savedState = this.#savedState;
		webGL2RenderingContext.cullFace(webGL2RenderingContext.BACK);
		if (savedState === null) {
			return;
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
	// 빛 설정. (해가 비추는 방향, 해의 색, 하늘색, 땅색, 모두 선형 색 0 ~)
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
}
