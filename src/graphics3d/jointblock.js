//==============================================================================
// 포함 모듈 목록.
//==============================================================================
const System = globalThis;
import { JOINT_BLOCK_NAME, JOINT_BLOCK_BINDING } from "../core/graphic/shaderprogram.js";


//==============================================================================
// 뼈 행렬 유니폼 블록. (버텍스 셰이더의 jointMatrices 를 기본 블록 유니폼이 아닌 유니폼 블록으로 넘긴다)
//==============================================================================


/**
 * @example <caption>대체 스키닝 버텍스 셰이더에 뼈 행렬 블록 끼우기</caption>
 * import { JOINT_BLOCK_GLSL, JOINT_BLOCK_MAXIMUM } from "./vanilla.js";
 * const vertexShaderSource = `#version 300 es
 * layout(location = 0) in vec3 vertexPosition;
 * layout(location = 3) in uvec4 vertexJoints;
 * layout(location = 4) in vec4 vertexWeights;
 * ${JOINT_BLOCK_GLSL}
 * void main() {
 * 	mat4 skinMatrix = vertexWeights.x * jointMatrices[vertexJoints.x] + vertexWeights.y * jointMatrices[vertexJoints.y];
 * 	gl_Position = skinMatrix * vec4(vertexPosition, 1.0);
 * }`;
 * console.log(vertexShaderSource.includes("uniform JointBlock"), JOINT_BLOCK_MAXIMUM);
 */

//==============================================================================
// 전역 상수 목록.
//==============================================================================
/** 뼈 행렬 블록의 뼈 최대 수. (툰 렌더러 TOON_MAXIMUM_JOINTS 와 스키닝 렌더러가 같다) */
export const JOINT_BLOCK_MAXIMUM = 96;

// 모프 가중치 배열의 vec4 칸 수. (MORPH_TARGET_MAXIMUM 96 개를 네 개씩)
export const MORPH_WEIGHT_VECTOR_COUNT = 24;

/**
 * 버텍스 셰이더에 끼우는 뼈 행렬 블록 선언.
 * - 뼈 행렬 96 개는 vec4 384 칸이라 WebGL2 가 보장하는 최소 정점 유니폼 256 칸을 넘는다. 유니폼 블록은 따로 센다(MAX_UNIFORM_BLOCK_SIZE 최소 16384 바이트, 이 블록은 6144 바이트).
 * - 모바일에서 유니티는 스키닝 행렬을 상수 버퍼(GPU 스키닝)로, 언리얼은 뼈 버퍼를 읽어 넘기는 것과 같은 길이다.
 * - 인스턴스 이름이 없어 셰이더 본문은 jointMatrices[번호] 그대로 쓴다. 바인딩 자리는 ShaderProgram 이 링크 뒤에 JOINT_BLOCK_BINDING 으로 묶는다.
 * - SkinnedModelRenderer 에 대체 버텍스 셰이더를 줄 때는 uniform mat4 jointMatrices[96] 대신 이 선언을 끼운다.
 */
export const JOINT_BLOCK_GLSL = `layout(std140) uniform ${JOINT_BLOCK_NAME} {
	mat4 jointMatrices[${JOINT_BLOCK_MAXIMUM}];
};`;


//==============================================================================
// 뼈 행렬 블록 버퍼. (컨텍스트마다 렌더러가 하나씩 갖는다, std140 의 mat4 는 열 우선 vec4 넷이라 Float32Array 16 개가 그대로 들어간다)
//==============================================================================
export class JointBlockBuffer extends System.Object {
	/** @private @type { WebGL2RenderingContext } */ #webGL2RenderingContext;
	/** @private @type { WebGLBuffer | null } */ #buffer;
	/** @private @type { Float32Array } */ #lastValues; // 마지막으로 올린 값. (같으면 올리지 않는다)
	/** @private @type { number } */ #lastCount; // 마지막으로 올린 수. (0 이면 아직 안 올림)

	//==============================================================================
	// 생성. (버퍼 하나를 짓는다)
	//==============================================================================
	/**
	 * @param { WebGL2RenderingContext } webGL2RenderingContext WebGL2 렌더링 컨텍스트.
	 */
	constructor(webGL2RenderingContext) {
		super();
		this.#webGL2RenderingContext = webGL2RenderingContext;
		this.#buffer = webGL2RenderingContext.createBuffer();
		this.#lastValues = new System.Float32Array(JOINT_BLOCK_MAXIMUM * 16);
		this.#lastCount = 0;
		const previousBuffer = webGL2RenderingContext.getParameter(webGL2RenderingContext.UNIFORM_BUFFER_BINDING);
		webGL2RenderingContext.bindBuffer(webGL2RenderingContext.UNIFORM_BUFFER, this.#buffer);
		webGL2RenderingContext.bufferData(webGL2RenderingContext.UNIFORM_BUFFER, JOINT_BLOCK_MAXIMUM * 64, webGL2RenderingContext.DYNAMIC_DRAW);
		// 뼈대가 아닌 그리기도 프로그램이 JointBlock 을 쓰는 것으로 잡히므로(셰이더가 분기 안에서 읽어도 블록은 쓰는 것) 바인딩 자리에 버퍼가 늘 묶여 있어야 한다. (안 묶이면 그리기가 INVALID_OPERATION)
		webGL2RenderingContext.bindBufferBase(webGL2RenderingContext.UNIFORM_BUFFER, JOINT_BLOCK_BINDING, this.#buffer);
		webGL2RenderingContext.bindBuffer(webGL2RenderingContext.UNIFORM_BUFFER, previousBuffer);
	}

	//==============================================================================
	// 뼈 행렬 올리고 바인딩 자리에 묶기. (JOINT_BLOCK_MAXIMUM 개를 넘는 뒤쪽은 버린다, 같은 값이면 올리지 않고 묶기만 한다)
	//==============================================================================
	/**
	 * @param { Float32Array } values 뼈 행렬의 수. (16 의 배수)
	 */
	upload(values) {
		const webGL2RenderingContext = this.#webGL2RenderingContext;
		const count = System.Math.floor(System.Math.min(values.length, JOINT_BLOCK_MAXIMUM * 16) / 16) * 16;
		const lastValues = this.#lastValues;
		let isSame = count === this.#lastCount;
		for (let index = 0; isSame && index < count; ++index) {
			isSame = lastValues[index] === values[index];
		}
		webGL2RenderingContext.bindBufferBase(webGL2RenderingContext.UNIFORM_BUFFER, JOINT_BLOCK_BINDING, this.#buffer);
		if (isSame) {
			return;
		}
		const source = values.length === count ? values : values.subarray(0, count);
		webGL2RenderingContext.bufferSubData(webGL2RenderingContext.UNIFORM_BUFFER, 0, source);
		lastValues.set(source);
		this.#lastCount = count;
	}

	//==============================================================================
	// 지우기.
	//==============================================================================
	destroy() {
		if (this.#buffer !== null) {
			this.#webGL2RenderingContext.deleteBuffer(this.#buffer);
			this.#buffer = null;
		}
	}
}
