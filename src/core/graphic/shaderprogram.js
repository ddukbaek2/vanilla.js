//==============================================================================
// 포함 모듈 목록.
//==============================================================================
import { Object } from "../../base/object.js";


//==============================================================================
// 셰이더 프로그램.
// - 버텍스/프래그먼트 셰이더의 컴파일과 링크, 로케이션 캐시를 담당.
//==============================================================================
export class ShaderProgram extends Object {
	//==============================================================================
	// 멤버 변수 목록.
	//==============================================================================
	/** @private @type { WebGL2RenderingContext } */ #webGL2RenderingContext;
	/** @private @type { WebGLProgram } */ #program;
	/** @private @type { Map<string, GLint> } */ #attributeLocations;
	/** @private @type { Map<string, WebGLUniformLocation> } */ #uniformLocations;

	//==============================================================================
	// 생성.
	//==============================================================================
	/**
	 * @constructor
	 * @param { WebGL2RenderingContext } webGL2RenderingContext
	 * @param { string } vertexShaderSource
	 * @param { string } fragmentShaderSource
	 */
	constructor(webGL2RenderingContext, vertexShaderSource, fragmentShaderSource) {
		super();

		this.#webGL2RenderingContext = webGL2RenderingContext;
		this.#attributeLocations = new Map();
		this.#uniformLocations = new Map();

		const vertexShader = this.createShader(webGL2RenderingContext.VERTEX_SHADER, vertexShaderSource);
		const fragmentShader = this.createShader(webGL2RenderingContext.FRAGMENT_SHADER, fragmentShaderSource);

		const program = webGL2RenderingContext.createProgram();
		webGL2RenderingContext.attachShader(program, vertexShader);
		webGL2RenderingContext.attachShader(program, fragmentShader);
		webGL2RenderingContext.linkProgram(program);
		if (!webGL2RenderingContext.getProgramParameter(program, webGL2RenderingContext.LINK_STATUS)) {
			const programError = webGL2RenderingContext.getProgramInfoLog(program);
			webGL2RenderingContext.deleteProgram(program);
			throw new Error(`ShaderProgram link failed: ${programError}`);
		}

		// 링크 후 셰이더 객체는 더 이상 필요 없음.
		webGL2RenderingContext.deleteShader(vertexShader);
		webGL2RenderingContext.deleteShader(fragmentShader);

		this.#program = program;
	}

	//==============================================================================
	// 셰이더 객체 생성.
	//==============================================================================
	/**
	 * @param { GLenum } shaderType
	 * @param { string } shaderSource
	 * @returns { WebGLShader }
	 */
	createShader(shaderType, shaderSource) {
		const webGL2RenderingContext = this.getWebGL2RenderingContext();
		const shader = webGL2RenderingContext.createShader(shaderType);
		webGL2RenderingContext.shaderSource(shader, shaderSource);
		webGL2RenderingContext.compileShader(shader);
		if (!webGL2RenderingContext.getShaderParameter(shader, webGL2RenderingContext.COMPILE_STATUS)) {
			const shaderError = webGL2RenderingContext.getShaderInfoLog(shader);
			webGL2RenderingContext.deleteShader(shader);
			throw new Error(`ShaderProgram compile failed: ${shaderError}`);
		}

		return shader;
	}

	//==============================================================================
	// 프로그램 사용 시작.
	//==============================================================================
	use() {
		const webGL2RenderingContext = this.getWebGL2RenderingContext();
		const program = this.getProgram();
		webGL2RenderingContext.useProgram(program);
	}

	//==============================================================================
	// 어트리뷰트 로케이션 반환. (캐시)
	//==============================================================================
	/**
	 * @param { string } attributeName
	 * @returns { GLint }
	 */
	getAttributeLocation(attributeName) {
		if (this.#attributeLocations.has(attributeName)) {
			return this.#attributeLocations.get(attributeName);
		}

		const webGL2RenderingContext = this.getWebGL2RenderingContext();
		const program = this.getProgram();
		const attributeLocation = webGL2RenderingContext.getAttribLocation(program, attributeName);
		this.#attributeLocations.set(attributeName, attributeLocation);
		return attributeLocation;
	}

	//==============================================================================
	// 유니폼 로케이션 반환. (캐시)
	//==============================================================================
	/**
	 * @param { string } uniformName
	 * @returns { WebGLUniformLocation }
	 */
	getUniformLocation(uniformName) {
		if (this.#uniformLocations.has(uniformName)) {
			return this.#uniformLocations.get(uniformName);
		}

		const webGL2RenderingContext = this.getWebGL2RenderingContext();
		const program = this.getProgram();
		const uniformLocation = webGL2RenderingContext.getUniformLocation(program, uniformName);
		this.#uniformLocations.set(uniformName, uniformLocation);
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
	// 프로그램 객체 반환.
	//==============================================================================
	/**
	 * @returns { WebGLProgram }
	 */
	getProgram() {
		return this.#program;
	}
}
