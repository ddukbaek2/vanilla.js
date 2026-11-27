//==============================================================================
// 포함 모듈 목록.
//==============================================================================
import { Object } from "../../base/object.js";
import { WebGLStateCache } from "./webglstatecache.js";


//==============================================================================
// 셰이더 프로그램.
// - 버텍스/프래그먼트 셰이더의 컴파일과 링크, 로케이션 캐시를 담당.
//==============================================================================
/**
 * @example <caption>셰이더를 바꿔 끼워 흑백으로 그리기</caption>
 * import { Engine, EngineConfiguration, Scene, Vector2, Rect, ShaderProgram } from "./build/vanilla.js";
 *
 * const VERTEX_SHADER_SOURCE = `#version 300 es
 * in vec2 vertexPosition;
 * in vec2 vertexTextureCoordinate;
 * uniform mat3 projectionMatrix;
 * uniform mat3 modelMatrix;
 * out vec2 fragmentTextureCoordinate;
 * void main() {
 * 	vec3 transformedPosition = projectionMatrix * (modelMatrix * vec3(vertexPosition, 1.0));
 * 	gl_Position = vec4(transformedPosition.xy, 0.0, 1.0);
 * 	fragmentTextureCoordinate = vertexTextureCoordinate;
 * }
 * `;
 * const GRAY_FRAGMENT_SHADER_SOURCE = `#version 300 es
 * precision highp float;
 * in vec2 fragmentTextureCoordinate;
 * uniform sampler2D mainTexture;
 * uniform vec4 mainColor;
 * uniform float globalAlpha;
 * out vec4 outputColor;
 * void main() {
 * 	vec4 textureColor = texture(mainTexture, fragmentTextureCoordinate);
 * 	vec3 color = textureColor.rgb * mainColor.rgb;
 * 	float gray = dot(color, vec3(0.299, 0.587, 0.114));
 * 	float alpha = textureColor.a * mainColor.a * globalAlpha;
 * 	outputColor = vec4(vec3(gray) * mainColor.a * globalAlpha, alpha);
 * }
 * `;
 *
 * class MainScene extends Scene {
 * 	initialize(engine) {
 * 		const graphic = engine.getGraphic();
 * 		const webGL2RenderingContext = graphic.getWebGL2RenderingContext();
 * 		const defaultShaderProgram = graphic.getShaderProgram();
 * 		const attributeLocationTable = {
 * 			vertexPosition: defaultShaderProgram.getAttributeLocation("vertexPosition"),
 * 			vertexTextureCoordinate: defaultShaderProgram.getAttributeLocation("vertexTextureCoordinate"),
 * 		};
 * 		this.grayShaderProgram = new ShaderProgram(webGL2RenderingContext, VERTEX_SHADER_SOURCE, GRAY_FRAGMENT_SHADER_SOURCE, attributeLocationTable);
 * 	}
 *
 * 	draw(graphic) {
 * 		super.draw(graphic);
 * 		graphic.setFillColor("#ff6600");
 * 		graphic.drawRect(Rect.create(60, 120, 200, 120));
 * 		graphic.setShaderProgramOverride(this.grayShaderProgram);
 * 		graphic.drawRect(Rect.create(380, 120, 200, 120));
 * 		graphic.setShaderProgramOverride(null);
 * 	}
 * }
 *
 * const engineConfiguration = new EngineConfiguration();
 * engineConfiguration.referenceResolutionSize = Vector2.create(640, 360);
 * const engine = new Engine(engineConfiguration);
 * engine.run(new MainScene());
 */
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
	// - 컴파일이나 링크에 실패하면 그때까지 지은 셰이더와 프로그램을 지우고 오류를 던진다.
	//==============================================================================
	/**
	 * @constructor
	 * @param { WebGL2RenderingContext } webGL2RenderingContext WebGL2 렌더링 컨텍스트.
	 * @param { string } vertexShaderSource 버텍스 셰이더 GLSL 소스.
	 * @param { string } fragmentShaderSource 프래그먼트 셰이더 GLSL 소스.
	 * @param { object | null } attributeLocationTable - 링크 전에 고정할 어트리뷰트 위치. ({ 이름: 위치 }, 다른 프로그램의 버텍스 어레이를 함께 쓸 때)
	 */
	constructor(webGL2RenderingContext, vertexShaderSource, fragmentShaderSource, attributeLocationTable = null) {
		super();

		this.#webGL2RenderingContext = webGL2RenderingContext;
		this.#attributeLocations = new Map();
		this.#uniformLocations = new Map();

		const vertexShader = this.createShader(webGL2RenderingContext.VERTEX_SHADER, vertexShaderSource);
		let fragmentShader = null;
		try {
			fragmentShader = this.createShader(webGL2RenderingContext.FRAGMENT_SHADER, fragmentShaderSource);
		}
		catch (error) {
			webGL2RenderingContext.deleteShader(vertexShader);
			throw error;
		}

		const program = webGL2RenderingContext.createProgram();
		webGL2RenderingContext.attachShader(program, vertexShader);
		webGL2RenderingContext.attachShader(program, fragmentShader);
		if (attributeLocationTable) {
			for (const attributeName in attributeLocationTable) {
				webGL2RenderingContext.bindAttribLocation(program, attributeLocationTable[attributeName], attributeName);
			}
		}
		webGL2RenderingContext.linkProgram(program);
		if (!webGL2RenderingContext.getProgramParameter(program, webGL2RenderingContext.LINK_STATUS)) {
			const programError = webGL2RenderingContext.getProgramInfoLog(program);
			webGL2RenderingContext.deleteProgram(program);
			webGL2RenderingContext.deleteShader(vertexShader);
			webGL2RenderingContext.deleteShader(fragmentShader);
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
	 * @param { GLenum } shaderType 셰이더 갈래. (VERTEX_SHADER 또는 FRAGMENT_SHADER)
	 * @param { string } shaderSource GLSL 소스.
	 * @returns { WebGLShader } 컴파일한 셰이더. (컴파일에 실패하면 오류를 던진다)
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
	// 프로그램 사용 시작. (컨텍스트의 상태 캐시가 이미 이 프로그램을 쓴다고 기억하면 다시 걸지 않는다)
	//==============================================================================
	use() {
		const webGL2RenderingContext = this.getWebGL2RenderingContext();
		const program = this.getProgram();
		const stateCache = WebGLStateCache.find(webGL2RenderingContext);
		if (stateCache !== null && stateCache.isProgramInUse(program)) {
			return;
		}
		webGL2RenderingContext.useProgram(program);
	}

	//==============================================================================
	// 어트리뷰트 로케이션 반환. (캐시)
	//==============================================================================
	/**
	 * @param { string } attributeName 어트리뷰트 이름.
	 * @returns { GLint } 어트리뷰트 위치. (없으면 -1)
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
	 * @param { string } uniformName 유니폼 이름.
	 * @returns { WebGLUniformLocation } 유니폼 위치. (없으면 null)
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
	 * @returns { WebGL2RenderingContext } 렌더링 컨텍스트.
	 */
	getWebGL2RenderingContext() {
		return this.#webGL2RenderingContext;
	}

	//==============================================================================
	// 프로그램 객체 반환.
	//==============================================================================
	/**
	 * @returns { WebGLProgram } 링크한 프로그램 객체.
	 */
	getProgram() {
		return this.#program;
	}
}
