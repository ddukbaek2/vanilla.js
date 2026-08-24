//==============================================================================
// 포함 모듈 목록.
//==============================================================================
const System = globalThis;
import { Object } from "../../base/object.js";
import { ShaderProgram } from "../../core/graphic/shaderprogram.js";


//==============================================================================
// 전역 상수 목록.
//==============================================================================
// 풀스크린 삼각형 버텍스 셰이더. (gl_VertexID 사용 — 버텍스 버퍼 불필요)
// - fragmentCoordinate: 클립 좌표(-1..1), fragmentTextureCoordinate: 텍스처 좌표(0..1).
const FULLSCREEN_VERTEXSHADER_SOURCE = `#version 300 es
out vec2 fragmentCoordinate;
out vec2 fragmentTextureCoordinate;
void main() {
	vec2 positions[3] = vec2[3](vec2(-1.0, -1.0), vec2(3.0, -1.0), vec2(-1.0, 3.0));
	vec2 position = positions[gl_VertexID];
	fragmentCoordinate = position;
	fragmentTextureCoordinate = position * 0.5 + 0.5;
	gl_Position = vec4(position, 0.999, 1.0);
}
`;


//==============================================================================
// 풀스크린 패스. (화면 전체를 덮는 삼각형 1개 + 프래그먼트 셰이더)
// - 배경 / 포스트 프로세싱 등 화면 단위 효과의 기본 단위.
//==============================================================================
export class FullscreenPass extends Object {
	//==============================================================================
	// 멤버 변수 목록.
	//==============================================================================
	/** @private @type { WebGL2RenderingContext } */ #webGL2RenderingContext;
	/** @private @type { ShaderProgram } */ #shaderProgram;
	/** @private @type { WebGLVertexArrayObject } */ #vertexArray;

	//==============================================================================
	// 생성.
	//==============================================================================
	/**
	 * @constructor
	 * @param { WebGL2RenderingContext } webGL2RenderingContext
	 * @param { string } fragmentShaderSource
	 */
	constructor(webGL2RenderingContext, fragmentShaderSource) {
		super();

		this.#webGL2RenderingContext = webGL2RenderingContext;
		this.#shaderProgram = new ShaderProgram(webGL2RenderingContext, FULLSCREEN_VERTEXSHADER_SOURCE.trim(), fragmentShaderSource.trim());
		this.#vertexArray = webGL2RenderingContext.createVertexArray();
	}

	//==============================================================================
	// 패스 사용 시작. (프로그램 + 빈 버텍스 어레이 바인드)
	//==============================================================================
	use() {
		const webGL2RenderingContext = this.getWebGL2RenderingContext();
		const shaderProgram = this.getShaderProgram();
		shaderProgram.use();
		const vertexArray = this.getVertexArray();
		webGL2RenderingContext.bindVertexArray(vertexArray);
	}

	//==============================================================================
	// 출력. (use() 와 유니폼 설정 이후 호출)
	//==============================================================================
	draw() {
		const webGL2RenderingContext = this.getWebGL2RenderingContext();
		webGL2RenderingContext.drawArrays(webGL2RenderingContext.TRIANGLES, 0, 3);
	}

	//==============================================================================
	// 유니폼 로케이션 반환. (캐시)
	//==============================================================================
	/**
	 * @param { string } uniformName
	 * @returns { WebGLUniformLocation }
	 */
	getUniformLocation(uniformName) {
		const shaderProgram = this.getShaderProgram();
		const uniformLocation = shaderProgram.getUniformLocation(uniformName);
		return uniformLocation;
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
	// 셰이더 프로그램 반환.
	//==============================================================================
	/**
	 * @returns { ShaderProgram }
	 */
	getShaderProgram() {
		return this.#shaderProgram;
	}

	//==============================================================================
	// 버텍스 어레이 반환.
	//==============================================================================
	/**
	 * @returns { WebGLVertexArrayObject }
	 */
	getVertexArray() {
		return this.#vertexArray;
	}
}
