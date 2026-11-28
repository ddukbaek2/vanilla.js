//==============================================================================
// 포함 모듈 목록.
//==============================================================================
const System = globalThis;
import { Object } from "../../base/object.js";
import { WebGLStateCache } from "./webglstatecache.js";


//==============================================================================
// 셰이더 짓기 실패 알리기. (엔진이 짓는 프로그램이 실패해 건너뛰기로 할 때 부른다)
// - 컨텍스트를 이미 잃은 뒤의 실패는 셰이더 탓이 아니다. 알리지 않고 거짓을 돌려, 부른 쪽이 실패를 기억하지 않고 되살린 뒤 다시 짓게 한다.
// - 그 밖의 실패는 엔진 오류 길(addGraphicErrorListener)로 { kind, name, error } 를 한 번 알리고 참을 돌려 기억하게 한다.
//==============================================================================
/**
 * @param { WebGL2RenderingContext } webGL2RenderingContext 프로그램을 짓던 컨텍스트.
 * @param { string } name 짓지 못한 것의 이름.
 * @param { unknown } error 던져진 오류.
 * @returns { boolean } 셰이더 탓이라 실패를 기억해도 되면 참. (컨텍스트를 잃은 탓이면 거짓)
 */
export function reportShaderBuildFailure(webGL2RenderingContext, name, error) {
	if (webGL2RenderingContext.isContextLost()) {
		return false;
	}
	const engine = System.vanillaEngine;
	if (engine !== undefined && engine !== null && typeof engine.dispatchGraphicError === "function") {
		engine.dispatchGraphicError({ kind: "shaderBuildFailed", name: name, error: error });
	}
	return true;
}


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
	/** @private @type { WebGLShader | null } */ #pendingVertexShader; // 짓기를 맡긴 채 아직 끝내지 않은 셰이더. (맡기지 않았거나 끝냈으면 null)
	/** @private @type { WebGLShader | null } */ #pendingFragmentShader;
	/** @private @type { boolean } */ #isBuildCompleted; // 맡긴 짓기가 끝났다고 한 번 확인했는지. (끝남은 되돌지 않으니 다시 묻지 않는다)

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
	 * @param { boolean } [isDeferred] - true 면 컴파일과 링크를 맡기기만 하고 결과는 확인하지 않는다. (기본 false, finishBuild 를 불러야 쓸 수 있다)
	 */
	constructor(webGL2RenderingContext, vertexShaderSource, fragmentShaderSource, attributeLocationTable = null, isDeferred = false) {
		super();

		this.#webGL2RenderingContext = webGL2RenderingContext;
		this.#attributeLocations = new Map();
		this.#uniformLocations = new Map();
		this.#pendingVertexShader = null;
		this.#pendingFragmentShader = null;
		this.#isBuildCompleted = false;

		if (isDeferred) {
			const vertexShader = webGL2RenderingContext.createShader(webGL2RenderingContext.VERTEX_SHADER);
			webGL2RenderingContext.shaderSource(vertexShader, vertexShaderSource);
			webGL2RenderingContext.compileShader(vertexShader);
			const fragmentShader = webGL2RenderingContext.createShader(webGL2RenderingContext.FRAGMENT_SHADER);
			webGL2RenderingContext.shaderSource(fragmentShader, fragmentShaderSource);
			webGL2RenderingContext.compileShader(fragmentShader);
			const program = webGL2RenderingContext.createProgram();
			webGL2RenderingContext.attachShader(program, vertexShader);
			webGL2RenderingContext.attachShader(program, fragmentShader);
			if (attributeLocationTable) {
				for (const attributeName in attributeLocationTable) {
					webGL2RenderingContext.bindAttribLocation(program, attributeLocationTable[attributeName], attributeName);
				}
			}
			webGL2RenderingContext.linkProgram(program);
			this.#pendingVertexShader = vertexShader;
			this.#pendingFragmentShader = fragmentShader;
			this.#program = program;
			return;
		}

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
	// 병렬 셰이더 컴파일 확장이 있는지. (KHR_parallel_shader_compile, 있으면 컴파일과 링크를 맡기고 주 스레드를 막지 않고 끝을 물을 수 있다)
	//==============================================================================
	/**
	 * @param { WebGL2RenderingContext } webGL2RenderingContext WebGL2 렌더링 컨텍스트.
	 * @returns { boolean } 있으면 true.
	 */
	static isParallelCompileSupported(webGL2RenderingContext) {
		return webGL2RenderingContext.getExtension("KHR_parallel_shader_compile") !== null;
	}

	//==============================================================================
	// 맡긴 짓기가 끝났는지. (맡기지 않았거나 이미 끝냈으면 true, 확장이 없으면 true, 물을 뿐 주 스레드를 막지 않는다)
	//==============================================================================
	/**
	 * @returns { boolean } 끝났으면 true. (true 여도 finishBuild 로 결과를 확인해야 쓴다)
	 */
	isBuildComplete() {
		if (this.#pendingVertexShader === null) {
			return true;
		}
		const webGL2RenderingContext = this.getWebGL2RenderingContext();
		const extension = webGL2RenderingContext.getExtension("KHR_parallel_shader_compile");
		if (extension === null) {
			return true;
		}
		if (this.#isBuildCompleted) {
			return true;
		}
		// 끝남을 묻는 일은 GPU 프로세스와 오가는 일이라 끝난 것은 다시 묻지 않는다.
		this.#isBuildCompleted = webGL2RenderingContext.getProgramParameter(this.#program, extension.COMPLETION_STATUS_KHR) === true;
		return this.#isBuildCompleted;
	}

	//==============================================================================
	// 맡긴 짓기 끝내기. (컴파일과 링크 결과를 확인한다, 안 끝났으면 끝날 때까지 기다린다, 맡기지 않았거나 이미 끝냈으면 아무것도 하지 않는다)
	// - 실패하면 셰이더와 프로그램을 지우고 오류를 던진다. (생성자와 같은 글)
	//==============================================================================
	finishBuild() {
		const vertexShader = this.#pendingVertexShader;
		if (vertexShader === null) {
			return;
		}
		const fragmentShader = this.#pendingFragmentShader;
		this.#pendingVertexShader = null;
		this.#pendingFragmentShader = null;
		const webGL2RenderingContext = this.getWebGL2RenderingContext();
		const program = this.#program;
		let errorMessage = null;
		if (!webGL2RenderingContext.getShaderParameter(vertexShader, webGL2RenderingContext.COMPILE_STATUS)) {
			errorMessage = `ShaderProgram compile failed: ${webGL2RenderingContext.getShaderInfoLog(vertexShader)}`;
		}
		else if (!webGL2RenderingContext.getShaderParameter(fragmentShader, webGL2RenderingContext.COMPILE_STATUS)) {
			errorMessage = `ShaderProgram compile failed: ${webGL2RenderingContext.getShaderInfoLog(fragmentShader)}`;
		}
		else if (!webGL2RenderingContext.getProgramParameter(program, webGL2RenderingContext.LINK_STATUS)) {
			errorMessage = `ShaderProgram link failed: ${webGL2RenderingContext.getProgramInfoLog(program)}`;
		}
		webGL2RenderingContext.deleteShader(vertexShader);
		webGL2RenderingContext.deleteShader(fragmentShader);
		if (errorMessage !== null) {
			webGL2RenderingContext.deleteProgram(program);
			throw new Error(errorMessage);
		}
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
	useProgram() {
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
