//==============================================================================
// WebGL 상태 캐시.
// - 컨텍스트의 상태를 바꾸는 함수(bindFramebuffer, viewport, scissor, enable, clearColor, blendFunc, useProgram, bindTexture 같은 것)를
//   컨텍스트 객체에서 가로채, 바뀐 값을 스스로 기억한다. getParameter, isEnabled 는 기억한 값으로 답하고 GL 에 묻지 않는다.
// - 사파리(WebKit)는 getParameter, isEnabled 가 GPU 프로세스까지 다녀오는 동기 호출이라, 그리는 중에 상태를 읽으면 프레임마다 시간이 든다.
//   (크롬의 GPU 명령 버퍼 클라이언트가 상태를 기억해 읽기에 답하는 것과 같은 꼴. 엔진, 3D 모듈, 게임 코드가 같은 컨텍스트를 쓰므로 모두 함께 빨라진다)
// - 모르는 값(처음, reset 뒤, 검사하지 못한 인자를 받은 뒤)은 다음에 읽을 때 GL 에 한 번 묻고 기억한다.
// - 기억하지 않는 값(스텐실 함수, 버퍼 묶음 같은 것)은 GL 에 그대로 묻는다. 바뀌지 않는 한도 값(MAX_SAMPLES 같은 것)은 한 번 묻고 기억한다.
// - 프로토타입 함수를 직접 부르는 것(WebGL2RenderingContext.prototype.viewport.call 같은 것)처럼 가로채지 못한 길로 상태를 바꾸면 reset 을 부른다.
//   (Graphic.resetGLStateCache) 컨텍스트를 잃거나 되살리면 스스로 잊는다.
//==============================================================================
const System = globalThis;
import { Object } from "../../base/object.js";


//==============================================================================
// 상수 목록. (WebGL2 열거 값)
//==============================================================================
const FRAMEBUFFER = 0x8D40;
const READ_FRAMEBUFFER = 0x8CA8;
const DRAW_FRAMEBUFFER = 0x8CA9;
const FRAMEBUFFER_BINDING = 0x8CA6; // DRAW_FRAMEBUFFER_BINDING 과 같은 값.
const READ_FRAMEBUFFER_BINDING = 0x8CAA;
const VIEWPORT = 0x0BA2;
const SCISSOR_BOX = 0x0C10;
const COLOR_CLEAR_VALUE = 0x0C22;
const COLOR_WRITEMASK = 0x0C23;
const BLEND_SRC_RGB = 0x80C9;
const BLEND_DST_RGB = 0x80C8;
const BLEND_SRC_ALPHA = 0x80CB;
const BLEND_DST_ALPHA = 0x80CA;
const BLEND_EQUATION_RGB = 0x8009;
const BLEND_EQUATION_ALPHA = 0x883D;
const DEPTH_WRITEMASK = 0x0B72;
const DEPTH_FUNC = 0x0B74;
const FRONT_FACE = 0x0B46;
const CULL_FACE_MODE = 0x0B45;
const CURRENT_PROGRAM = 0x8B8D;
const VERTEX_ARRAY_BINDING = 0x85B5;
const ACTIVE_TEXTURE = 0x84E0;
const LINK_STATUS = 0x8B82;
const TEXTURE0 = 0x84C0;
const MAX_COMBINED_TEXTURE_IMAGE_UNITS = 0x8B4D;
const MAX_VIEWPORT_DIMS = 0x0D3A;
const UNPACK_FLIP_Y_WEBGL = 0x9240;
const UNPACK_PREMULTIPLY_ALPHA_WEBGL = 0x9241;
const UNPACK_COLORSPACE_CONVERSION_WEBGL = 0x9243;
const BROWSER_DEFAULT_WEBGL = 0x9244;
const PACK_ALIGNMENT = 0x0D05;
const UNPACK_ALIGNMENT = 0x0CF5;

// 텍스처 대상과 그 묶음 이름. (차례가 칸 번호)
const TEXTURE_TARGET_LIST = [0x0DE1, 0x8513, 0x806F, 0x8C1A]; // TEXTURE_2D, TEXTURE_CUBE_MAP, TEXTURE_3D, TEXTURE_2D_ARRAY
const TEXTURE_BINDING_LIST = [0x8069, 0x8514, 0x806A, 0x8C1D]; // TEXTURE_BINDING_2D, _CUBE_MAP, _3D, _2D_ARRAY

// 켜고 끄는 기능 가운데 기억하는 것. (WebGL2 의 enable, disable 이 받는 것 모두)
const CAPABILITY_SET = new System.Set([
	0x0BE2, // BLEND
	0x0B44, // CULL_FACE
	0x0B71, // DEPTH_TEST
	0x0BD0, // DITHER
	0x8037, // POLYGON_OFFSET_FILL
	0x809E, // SAMPLE_ALPHA_TO_COVERAGE
	0x80A0, // SAMPLE_COVERAGE
	0x0C11, // SCISSOR_TEST
	0x0B90, // STENCIL_TEST
	0x8C89, // RASTERIZER_DISCARD
]);

// 섞기 인자로 받는 값.
const BLEND_FACTOR_SET = new System.Set([0, 1, 0x0300, 0x0301, 0x0302, 0x0303, 0x0304, 0x0305, 0x0306, 0x0307, 0x0308, 0x8001, 0x8002, 0x8003, 0x8004]);
const CONSTANT_COLOR_FACTOR_SET = new System.Set([0x8001, 0x8002]); // CONSTANT_COLOR, ONE_MINUS_CONSTANT_COLOR
const CONSTANT_ALPHA_FACTOR_SET = new System.Set([0x8003, 0x8004]); // CONSTANT_ALPHA, ONE_MINUS_CONSTANT_ALPHA
const SOURCE_ALPHA_SATURATE = 0x0308;
// 섞기 식으로 받는 값. (FUNC_ADD, FUNC_SUBTRACT, FUNC_REVERSE_SUBTRACT, MIN, MAX)
const BLEND_EQUATION_SET = new System.Set([0x8006, 0x800A, 0x800B, 0x8007, 0x8008]);

// 바뀌지 않는 한도 값과 문자열. (처음 읽을 때 한 번 묻고 기억한다. 확장의 값은 확장을 켜기 전에 null 이라 null 은 기억하지 않는다)
const CONSTANT_PARAMETER_SET = new System.Set([
	0x0D33, // MAX_TEXTURE_SIZE
	0x851C, // MAX_CUBE_MAP_TEXTURE_SIZE
	0x8073, // MAX_3D_TEXTURE_SIZE
	0x88FF, // MAX_ARRAY_TEXTURE_LAYERS
	0x84E8, // MAX_RENDERBUFFER_SIZE
	0x8D57, // MAX_SAMPLES
	0x0D3A, // MAX_VIEWPORT_DIMS
	0x8872, // MAX_TEXTURE_IMAGE_UNITS
	0x8B4C, // MAX_VERTEX_TEXTURE_IMAGE_UNITS
	0x8B4D, // MAX_COMBINED_TEXTURE_IMAGE_UNITS
	0x8869, // MAX_VERTEX_ATTRIBS
	0x8DFB, // MAX_VERTEX_UNIFORM_VECTORS
	0x8DFD, // MAX_FRAGMENT_UNIFORM_VECTORS
	0x8DFC, // MAX_VARYING_VECTORS
	0x8824, // MAX_DRAW_BUFFERS
	0x8CDF, // MAX_COLOR_ATTACHMENTS
	0x8A2F, // MAX_UNIFORM_BUFFER_BINDINGS
	0x8A30, // MAX_UNIFORM_BLOCK_SIZE
	0x846E, // ALIASED_LINE_WIDTH_RANGE
	0x846D, // ALIASED_POINT_SIZE_RANGE
	0x84FF, // MAX_TEXTURE_MAX_ANISOTROPY_EXT
	0x1F00, // VENDOR
	0x1F01, // RENDERER
	0x1F02, // VERSION
	0x8B8C, // SHADING_LANGUAGE_VERSION
	0x9245, // UNMASKED_VENDOR_WEBGL
	0x9246, // UNMASKED_RENDERER_WEBGL
]);

// 컨텍스트마다 하나. (같은 컨텍스트에 두 번 걸지 않는다)
const stateCacheTable = new System.WeakMap();


//==============================================================================
// 값 하나 베끼기. (getParameter 가 돌려주는 배열은 부를 때마다 새것이므로 같게 새것을 준다)
//==============================================================================
/**
 * @param { any } value
 * @returns { any }
 */
function copyParameterValue(value) {
	if (System.ArrayBuffer.isView(value)) {
		return value.slice();
	}
	if (System.Array.isArray(value)) {
		return value.slice();
	}
	return value;
}


//==============================================================================
// WebGL 상태 캐시.
//==============================================================================
/**
 * @example <caption>엔진의 상태 캐시로 지금 프레임 버퍼와 뷰포트 읽기</caption>
 * import { Engine, EngineConfiguration, Scene, Vector2 } from "./build/vanilla.js";
 *
 * class MainScene extends Scene {
 * 	draw(graphic) {
 * 		super.draw(graphic);
 * 		const webGL2RenderingContext = graphic.getWebGL2RenderingContext();
 * 		const framebuffer = webGL2RenderingContext.getParameter(webGL2RenderingContext.FRAMEBUFFER_BINDING);
 * 		const viewport = graphic.getCurrentViewport();
 * 		console.log(framebuffer, viewport.width, viewport.height);
 * 	}
 * }
 *
 * const engineConfiguration = new EngineConfiguration();
 * engineConfiguration.referenceResolutionSize = Vector2.create(640, 360);
 * const engine = new Engine(engineConfiguration);
 * engine.run(new MainScene());
 */
export class WebGLStateCache extends Object {
	//==============================================================================
	// 멤버 변수 목록. (undefined 는 모른다는 뜻)
	//==============================================================================
	/** @private @type { WebGL2RenderingContext } */ #webGL2RenderingContext; // 상태를 기억할 컨텍스트.
	/** @private @type { Function } */ #originalGetParameter; // 가로채기 전의 getParameter.
	/** @private @type { Function } */ #originalIsEnabled; // 가로채기 전의 isEnabled.
	/** @private @type { WebGLFramebuffer | null | undefined } */ #drawFramebuffer; // 그리는 프레임 버퍼. (null 이면 캔버스)
	/** @private @type { WebGLFramebuffer | null | undefined } */ #readFramebuffer; // 읽는 프레임 버퍼. (null 이면 캔버스)
	/** @private @type { Int32Array | undefined } */ #viewport; // 뷰포트. (x, y, 너비, 높이)
	/** @private @type { Int32Array | undefined } */ #scissorBox; // 가위 상자. (x, y, 너비, 높이)
	/** @private @type { Float32Array | undefined } */ #clearColor; // 비우기 색. (r, g, b, a)
	/** @private @type { boolean[] | undefined } */ #colorWriteMask; // 색 쓰기 가림. (r, g, b, a)
	/** @private @type { number[] | undefined } */ #blendFactors; // 섞기 인자. (소스 RGB, 대상 RGB, 소스 알파, 대상 알파)
	/** @private @type { number[] | undefined } */ #blendEquations; // 섞기 식. (RGB, 알파)
	/** @private @type { boolean | undefined } */ #depthWriteMask; // 깊이 쓰기.
	/** @private @type { number | undefined } */ #depthFunction; // 깊이 견주기.
	/** @private @type { number | undefined } */ #frontFace; // 앞면 감김 방향.
	/** @private @type { number | undefined } */ #cullFaceMode; // 가리는 면.
	/** @private @type { WebGLProgram | null | undefined } */ #program; // 쓰는 프로그램.
	/** @private @type { WebGLVertexArrayObject | null | undefined } */ #vertexArray; // 묶은 버텍스 어레이. (null 이면 기본)
	/** @private @type { number | undefined } */ #activeTexture; // 활성 텍스처 유닛. (TEXTURE0 + 번호)
	/** @private @type { Map<number, WebGLTexture | null> } */ #textureBindingTable; // 유닛과 대상마다 묶은 텍스처. (키 유닛 * 4 + 대상 칸, 없으면 모른다)
	/** @private @type { Map<number, boolean> } */ #capabilityTable; // 켜고 끈 기능. (없으면 모른다)
	/** @private @type { Map<number, any> } */ #pixelStoreTable; // pixelStorei 값. (없으면 모른다)
	/** @private @type { Map<number, any> } */ #constantParameterTable; // 바뀌지 않는 한도 값.
	/** @private @type { WeakMap<WebGLTexture, number> } */ #textureTargetTable; // 텍스처마다 처음 묶은 대상 칸. (다른 대상으로 묶으면 GL 이 무시한다)
	/** @private @type { WeakMap<WebGLProgram, boolean> } */ #programLinkStatusTable; // 프로그램마다 알아낸 링크 결과. (링크에 실패한 프로그램은 쓰게 해도 GL 이 무시한다)
	/** @private @type { WeakSet<object> } */ #deletedObjectSet; // 지운 프레임 버퍼, 텍스처, 버텍스 어레이, 프로그램. (묶으면 GL 이 무시한다)

	//==============================================================================
	// 생성.
	//==============================================================================
	/**
	 * @constructor
	 * @param { WebGL2RenderingContext } webGL2RenderingContext 상태를 기억할 컨텍스트. (상태 함수를 이 객체에서 가로챈다)
	 */
	constructor(webGL2RenderingContext) {
		super();
		this.#webGL2RenderingContext = webGL2RenderingContext;
		this.#textureBindingTable = new System.Map();
		this.#capabilityTable = new System.Map();
		this.#pixelStoreTable = new System.Map();
		this.#constantParameterTable = new System.Map();
		this.#textureTargetTable = new System.WeakMap();
		this.#programLinkStatusTable = new System.WeakMap();
		this.#deletedObjectSet = new System.WeakSet();
		this.#originalGetParameter = webGL2RenderingContext.getParameter;
		this.#originalIsEnabled = webGL2RenderingContext.isEnabled;
		this.reset();
		this.installTrackers();

		// 컨텍스트를 잃으면 기억한 GL 상태를 잊는다. (되살리면 GL 상태가 처음으로 돌아가므로 그때도 잊는다)
		// 엔진은 컨텍스트를 되살리지 않는다. (preventDefault 를 하지 않아 webglcontextrestored 가 오지 않는다, 게임이 되살려도 엔진 자원은 다시 짓지 않는다, Graphic 생성자 참고)
		const canvas = webGL2RenderingContext.canvas;
		if (canvas && typeof canvas.addEventListener === "function") {
			const contextChangeCallback = () => {
				this.reset();
			};
			canvas.addEventListener("webglcontextlost", contextChangeCallback);
			canvas.addEventListener("webglcontextrestored", contextChangeCallback);
		}
	}

	//==============================================================================
	// 컨텍스트의 상태 캐시 얻기. (없으면 만들어 건다, 같은 컨텍스트에는 하나만)
	//==============================================================================
	/**
	 * @param { WebGL2RenderingContext } webGL2RenderingContext 컨텍스트.
	 * @returns { WebGLStateCache } 그 컨텍스트의 상태 캐시.
	 */
	static attach(webGL2RenderingContext) {
		let stateCache = stateCacheTable.get(webGL2RenderingContext);
		if (stateCache === undefined) {
			stateCache = new WebGLStateCache(webGL2RenderingContext);
			stateCacheTable.set(webGL2RenderingContext, stateCache);
		}
		return stateCache;
	}

	//==============================================================================
	// 기억 모두 잊기. (다음에 읽을 때 GL 에 한 번씩 묻는다)
	// - 가로채지 못한 길로 GL 상태를 바꾼 뒤 부른다. 바뀌지 않는 한도 값은 그대로 둔다.
	//==============================================================================
	reset() {
		this.#drawFramebuffer = undefined;
		this.#readFramebuffer = undefined;
		this.#viewport = undefined;
		this.#scissorBox = undefined;
		this.#clearColor = undefined;
		this.#colorWriteMask = undefined;
		this.#blendFactors = undefined;
		this.#blendEquations = undefined;
		this.#depthWriteMask = undefined;
		this.#depthFunction = undefined;
		this.#frontFace = undefined;
		this.#cullFaceMode = undefined;
		this.#program = undefined;
		this.#vertexArray = undefined;
		this.#activeTexture = undefined;
		this.#textureBindingTable.clear();
		this.#capabilityTable.clear();
		this.#pixelStoreTable.clear();
	}

	//==============================================================================
	// GL 에 직접 묻기. (기억하지 않는 값, 모르는 값을 채울 때)
	//==============================================================================
	/**
	 * @private
	 * @param { number } parameterName 물을 값. (getParameter 의 열거 값)
	 * @returns { any }
	 */
	queryParameter(parameterName) {
		return this.#originalGetParameter.call(this.#webGL2RenderingContext, parameterName);
	}

	//==============================================================================
	// 모르는 값을 GL 에서 채워도 되는지. (컨텍스트를 잃은 동안 읽은 null 은 기억하지 않는다)
	//==============================================================================
	/**
	 * @private
	 * @returns { boolean }
	 */
	canRemember() {
		const webGL2RenderingContext = this.#webGL2RenderingContext;
		return typeof webGL2RenderingContext.isContextLost !== "function" || !webGL2RenderingContext.isContextLost();
	}

	//==============================================================================
	// 바뀌지 않는 한도 값 읽기. (처음에 한 번 묻는다)
	//==============================================================================
	/**
	 * @private
	 * @param { number } parameterName 물을 값.
	 * @returns { any }
	 */
	readConstantParameter(parameterName) {
		if (this.#constantParameterTable.has(parameterName)) {
			return this.#constantParameterTable.get(parameterName);
		}
		const value = this.queryParameter(parameterName);
		if (value !== null && this.canRemember()) {
			this.#constantParameterTable.set(parameterName, value);
		}
		return value;
	}

	//==============================================================================
	// 그리는 프레임 버퍼 반환. (null 이면 캔버스)
	//==============================================================================
	/**
	 * @returns { WebGLFramebuffer | null } 지금 그리는 프레임 버퍼. (null 이면 캔버스의 기본 프레임 버퍼)
	 */
	getDrawFramebuffer() {
		if (this.#drawFramebuffer === undefined) {
			const framebuffer = this.queryParameter(FRAMEBUFFER_BINDING);
			if (!this.canRemember()) {
				return framebuffer;
			}
			this.#drawFramebuffer = framebuffer;
		}
		return this.#drawFramebuffer;
	}

	//==============================================================================
	// 읽는 프레임 버퍼 반환. (null 이면 캔버스)
	//==============================================================================
	/**
	 * @returns { WebGLFramebuffer | null } 지금 읽는 프레임 버퍼. (null 이면 캔버스의 기본 프레임 버퍼)
	 */
	getReadFramebuffer() {
		if (this.#readFramebuffer === undefined) {
			const framebuffer = this.queryParameter(READ_FRAMEBUFFER_BINDING);
			if (!this.canRemember()) {
				return framebuffer;
			}
			this.#readFramebuffer = framebuffer;
		}
		return this.#readFramebuffer;
	}

	//==============================================================================
	// 뷰포트 반환. (새 배열, 픽셀, 왼쪽 아래가 원점)
	//==============================================================================
	/**
	 * @returns { Int32Array } 뷰포트. ([x, y, 너비, 높이], 부를 때마다 새 배열)
	 */
	getViewport() {
		return copyParameterValue(this.readViewport());
	}

	//==============================================================================
	// 뷰포트 읽기. (기억한 배열 그대로, 바꾸지 않는다)
	//==============================================================================
	/**
	 * @private
	 * @returns { Int32Array }
	 */
	readViewport() {
		if (this.#viewport === undefined) {
			const viewport = this.queryParameter(VIEWPORT);
			if (!this.canRemember()) {
				return viewport;
			}
			this.#viewport = viewport;
		}
		return this.#viewport;
	}

	//==============================================================================
	// 기억한 값 하나 읽기. (모르면 GL 에 묻고 기억한다)
	//==============================================================================
	/**
	 * @private
	 * @param { number } parameterName 읽을 값.
	 * @returns { any } 기억한 값. (기억하지 않는 값이면 undefined 가 아닌 GL 의 답)
	 */
	readTrackedParameter(parameterName) {
		switch (parameterName) {
			case FRAMEBUFFER_BINDING:
				return this.getDrawFramebuffer();
			case READ_FRAMEBUFFER_BINDING:
				return this.getReadFramebuffer();
			case VIEWPORT:
				return this.readViewport();
			case SCISSOR_BOX:
				if (this.#scissorBox === undefined) {
					return this.rememberParameter(parameterName, (value) => { this.#scissorBox = value; });
				}
				return this.#scissorBox;
			case COLOR_CLEAR_VALUE:
				if (this.#clearColor === undefined) {
					return this.rememberParameter(parameterName, (value) => { this.#clearColor = value; });
				}
				return this.#clearColor;
			case COLOR_WRITEMASK:
				if (this.#colorWriteMask === undefined) {
					return this.rememberParameter(parameterName, (value) => { this.#colorWriteMask = value; });
				}
				return this.#colorWriteMask;
			case BLEND_SRC_RGB:
			case BLEND_DST_RGB:
			case BLEND_SRC_ALPHA:
			case BLEND_DST_ALPHA: {
				if (this.#blendFactors === undefined) {
					const blendFactors = [this.queryParameter(BLEND_SRC_RGB), this.queryParameter(BLEND_DST_RGB), this.queryParameter(BLEND_SRC_ALPHA), this.queryParameter(BLEND_DST_ALPHA)];
					if (!this.canRemember()) {
						return null;
					}
					this.#blendFactors = blendFactors;
				}
				const blendFactorIndex = parameterName === BLEND_SRC_RGB ? 0 : parameterName === BLEND_DST_RGB ? 1 : parameterName === BLEND_SRC_ALPHA ? 2 : 3;
				return this.#blendFactors[blendFactorIndex];
			}
			case BLEND_EQUATION_RGB:
			case BLEND_EQUATION_ALPHA: {
				if (this.#blendEquations === undefined) {
					const blendEquations = [this.queryParameter(BLEND_EQUATION_RGB), this.queryParameter(BLEND_EQUATION_ALPHA)];
					if (!this.canRemember()) {
						return null;
					}
					this.#blendEquations = blendEquations;
				}
				return this.#blendEquations[parameterName === BLEND_EQUATION_RGB ? 0 : 1];
			}
			case DEPTH_WRITEMASK:
				if (this.#depthWriteMask === undefined) {
					return this.rememberParameter(parameterName, (value) => { this.#depthWriteMask = value; });
				}
				return this.#depthWriteMask;
			case DEPTH_FUNC:
				if (this.#depthFunction === undefined) {
					return this.rememberParameter(parameterName, (value) => { this.#depthFunction = value; });
				}
				return this.#depthFunction;
			case FRONT_FACE:
				if (this.#frontFace === undefined) {
					return this.rememberParameter(parameterName, (value) => { this.#frontFace = value; });
				}
				return this.#frontFace;
			case CULL_FACE_MODE:
				if (this.#cullFaceMode === undefined) {
					return this.rememberParameter(parameterName, (value) => { this.#cullFaceMode = value; });
				}
				return this.#cullFaceMode;
			case CURRENT_PROGRAM:
				if (this.#program === undefined) {
					return this.rememberParameter(parameterName, (value) => { this.#program = value; });
				}
				return this.#program;
			case VERTEX_ARRAY_BINDING:
				if (this.#vertexArray === undefined) {
					return this.rememberParameter(parameterName, (value) => { this.#vertexArray = value; });
				}
				return this.#vertexArray;
			case ACTIVE_TEXTURE:
				return this.readActiveTexture();
			case UNPACK_FLIP_Y_WEBGL:
			case UNPACK_PREMULTIPLY_ALPHA_WEBGL:
			case UNPACK_COLORSPACE_CONVERSION_WEBGL:
			case PACK_ALIGNMENT:
			case UNPACK_ALIGNMENT:
				if (!this.#pixelStoreTable.has(parameterName)) {
					return this.rememberParameter(parameterName, (value) => { this.#pixelStoreTable.set(parameterName, value); });
				}
				return this.#pixelStoreTable.get(parameterName);
			default: {
				const textureTargetIndex = TEXTURE_BINDING_LIST.indexOf(parameterName);
				if (textureTargetIndex >= 0) {
					return this.readTextureBinding(textureTargetIndex);
				}
				if (CONSTANT_PARAMETER_SET.has(parameterName)) {
					return this.readConstantParameter(parameterName);
				}
				return this.queryParameter(parameterName);
			}
		}
	}

	//==============================================================================
	// GL 에 묻고 기억하기. (컨텍스트를 잃었으면 기억하지 않는다)
	//==============================================================================
	/**
	 * @private
	 * @param { number } parameterName 물을 값.
	 * @param { Function } rememberCallback (value) => void
	 * @returns { any } GL 의 답.
	 */
	rememberParameter(parameterName, rememberCallback) {
		const value = this.queryParameter(parameterName);
		if (this.canRemember()) {
			rememberCallback(value);
		}
		return value;
	}

	//==============================================================================
	// 활성 텍스처 유닛 읽기.
	//==============================================================================
	/**
	 * @private
	 * @returns { number } TEXTURE0 + 유닛 번호.
	 */
	readActiveTexture() {
		if (this.#activeTexture === undefined) {
			return this.rememberParameter(ACTIVE_TEXTURE, (value) => { this.#activeTexture = value; });
		}
		return this.#activeTexture;
	}

	//==============================================================================
	// 활성 유닛에 묶은 텍스처 읽기.
	//==============================================================================
	/**
	 * @private
	 * @param { number } textureTargetIndex 대상 칸. (TEXTURE_TARGET_LIST 의 차례)
	 * @returns { WebGLTexture | null }
	 */
	readTextureBinding(textureTargetIndex) {
		const textureUnit = this.readActiveTexture() - TEXTURE0;
		const key = textureUnit * 4 + textureTargetIndex;
		if (!this.#textureBindingTable.has(key)) {
			return this.rememberParameter(TEXTURE_BINDING_LIST[textureTargetIndex], (value) => { this.#textureBindingTable.set(key, value); });
		}
		return this.#textureBindingTable.get(key);
	}

	//==============================================================================
	// getParameter 대신 답하기. (기억한 값이면 GL 에 묻지 않는다, 배열은 새것)
	//==============================================================================
	/**
	 * @param { number } parameterName 읽을 값. (getParameter 의 열거 값)
	 * @returns { any } getParameter 와 같은 꼴의 값.
	 */
	getParameter(parameterName) {
		// 컨텍스트를 잃은 동안은 GL 처럼 null 을 준다.
		if (!this.canRemember()) {
			return this.queryParameter(parameterName);
		}
		return copyParameterValue(this.readTrackedParameter(parameterName));
	}

	//==============================================================================
	// isEnabled 대신 답하기. (기억한 기능이면 GL 에 묻지 않는다)
	//==============================================================================
	/**
	 * @param { number } capability 기능. (BLEND, DEPTH_TEST 같은 것)
	 * @returns { boolean } 켜져 있으면 참.
	 */
	isEnabled(capability) {
		if (!CAPABILITY_SET.has(capability) || !this.canRemember()) {
			return this.#originalIsEnabled.call(this.#webGL2RenderingContext, capability);
		}
		if (!this.#capabilityTable.has(capability)) {
			const isEnabled = this.#originalIsEnabled.call(this.#webGL2RenderingContext, capability);
			if (this.canRemember()) {
				this.#capabilityTable.set(capability, isEnabled);
			}
			return isEnabled;
		}
		return this.#capabilityTable.get(capability);
	}

	//==============================================================================
	// 쓰는 프로그램이 이것인지. (기억한 값과 견주어 같은 값을 다시 거는 호출을 건너뛸 때 쓴다)
	// - 기억한 값이 주어진 것과 같을 때만 참이다. 모르는 값(처음, reset 뒤, 검사하지 못한 인자를 받은 뒤)이면 거짓이라 부르는 쪽이 GL 에 다시 건다.
	// - GL 에 묻지 않는다. (컨텍스트를 잃거나 되살리면 기억을 잊으므로 거짓이 된다, 잃은 동안 건너뛴 호출은 GL 도 무시한다)
	//==============================================================================
	/**
	 * @param { WebGLProgram | null } program 견줄 프로그램.
	 * @returns { boolean } 지금 쓰는 프로그램이 이것이라고 기억하면 참.
	 */
	isProgramInUse(program) {
		return this.#program !== undefined && this.#program === program;
	}

	//==============================================================================
	// 묶은 버텍스 어레이가 이것인지. (모르면 거짓)
	//==============================================================================
	/**
	 * @param { WebGLVertexArrayObject | null } vertexArray 견줄 버텍스 어레이. (null 이면 기본)
	 * @returns { boolean } 묶은 버텍스 어레이가 이것이라고 기억하면 참.
	 */
	isVertexArrayBound(vertexArray) {
		return this.#vertexArray !== undefined && this.#vertexArray === vertexArray;
	}

	//==============================================================================
	// 활성 텍스처 유닛이 이것인지. (모르면 거짓)
	//==============================================================================
	/**
	 * @param { number } textureUnit 견줄 유닛. (TEXTURE0 + 번호)
	 * @returns { boolean } 활성 텍스처 유닛이 이것이라고 기억하면 참.
	 */
	isActiveTexture(textureUnit) {
		return this.#activeTexture !== undefined && this.#activeTexture === textureUnit;
	}

	//==============================================================================
	// 유닛의 대상에 묶인 텍스처가 이것인지. (모르면 거짓)
	//==============================================================================
	/**
	 * @param { number } textureUnit 유닛. (TEXTURE0 + 번호)
	 * @param { number } target 텍스처 대상. (TEXTURE_2D, TEXTURE_CUBE_MAP, TEXTURE_3D, TEXTURE_2D_ARRAY)
	 * @param { WebGLTexture | null } texture 견줄 텍스처.
	 * @returns { boolean } 그 유닛의 그 대상에 이 텍스처가 묶였다고 기억하면 참.
	 */
	isTextureBound(textureUnit, target, texture) {
		const textureTargetIndex = TEXTURE_TARGET_LIST.indexOf(target);
		if (textureTargetIndex < 0) {
			return false;
		}
		const key = (textureUnit - TEXTURE0) * 4 + textureTargetIndex;
		return this.#textureBindingTable.has(key) && this.#textureBindingTable.get(key) === texture;
	}

	//==============================================================================
	// 앞면 감김 방향이 이것인지. (모르면 거짓)
	//==============================================================================
	/**
	 * @param { number } mode 견줄 감김 방향. (CW, CCW)
	 * @returns { boolean } 앞면 감김 방향이 이것이라고 기억하면 참.
	 */
	isFrontFace(mode) {
		return this.#frontFace !== undefined && this.#frontFace === mode;
	}

	//==============================================================================
	// 가리는 면이 이것인지. (모르면 거짓)
	//==============================================================================
	/**
	 * @param { number } mode 견줄 가리는 면. (FRONT, BACK, FRONT_AND_BACK)
	 * @returns { boolean } 가리는 면이 이것이라고 기억하면 참.
	 */
	isCullFace(mode) {
		return this.#cullFaceMode !== undefined && this.#cullFaceMode === mode;
	}

	//==============================================================================
	// 컨텍스트에 걸린 상태 캐시 찾기. (걸지 않는다, 없으면 null)
	//==============================================================================
	/**
	 * @param { WebGL2RenderingContext } webGL2RenderingContext 컨텍스트.
	 * @returns { WebGLStateCache | null } 그 컨텍스트의 상태 캐시. (attach 를 부른 적이 없으면 null)
	 */
	static find(webGL2RenderingContext) {
		const stateCache = stateCacheTable.get(webGL2RenderingContext);
		return stateCache !== undefined ? stateCache : null;
	}

	//==============================================================================
	// 컨텍스트의 상태 함수 가로채기. (원래 함수를 부른 뒤 바뀐 값을 기억한다)
	// - 원래 함수가 던지면(인자 꼴이 틀림) 기억을 바꾸지 않는다.
	// - 검사하지 못한 인자는 그 값을 모른다로 두어, 다음에 읽을 때 GL 에 묻는다. (GL 이 오류로 무시했을 수 있다)
	//==============================================================================
	/**
	 * @private
	 */
	installTrackers() {
		const webGL2RenderingContext = this.#webGL2RenderingContext;
		// 인자 수(WebIDL 의 필수 인자 수, 함수의 length)에 맞춘 함수로 감싸 부를 때마다 배열을 만들지 않는다.
		// 인자가 모자라면 원래 함수에 그대로 넘겨 원래처럼 던지게 한다.
		const wrap = (functionName, afterCallback) => {
			const originalFunction = webGL2RenderingContext[functionName];
			if (typeof originalFunction !== "function") {
				return;
			}
			let trackedFunction = null;
			switch (originalFunction.length) {
				case 1:
					trackedFunction = function (first) {
						if (arguments.length < 1) {
							return originalFunction.apply(webGL2RenderingContext, arguments);
						}
						const result = originalFunction.call(webGL2RenderingContext, first);
						afterCallback(first);
						return result;
					};
					break;
				case 2:
					trackedFunction = function (first, second) {
						if (arguments.length < 2) {
							return originalFunction.apply(webGL2RenderingContext, arguments);
						}
						const result = originalFunction.call(webGL2RenderingContext, first, second);
						afterCallback(first, second);
						return result;
					};
					break;
				case 4:
					trackedFunction = function (first, second, third, fourth) {
						if (arguments.length < 4) {
							return originalFunction.apply(webGL2RenderingContext, arguments);
						}
						const result = originalFunction.call(webGL2RenderingContext, first, second, third, fourth);
						afterCallback(first, second, third, fourth);
						return result;
					};
					break;
				default:
					trackedFunction = function (...argumentList) {
						const result = originalFunction.apply(webGL2RenderingContext, argumentList);
						afterCallback(...argumentList);
						return result;
					};
					break;
			}
			webGL2RenderingContext[functionName] = trackedFunction;
		};

		const originalGetParameter = this.#originalGetParameter;
		const originalIsEnabled = this.#originalIsEnabled;
		const stateCache = this;
		webGL2RenderingContext.getParameter = function (parameterName) {
			if (arguments.length < 1) {
				return originalGetParameter.apply(webGL2RenderingContext, arguments);
			}
			return stateCache.getParameter(parameterName);
		};
		webGL2RenderingContext.isEnabled = function (capability) {
			if (arguments.length < 1) {
				return originalIsEnabled.apply(webGL2RenderingContext, arguments);
			}
			return stateCache.isEnabled(capability);
		};

		// 프레임 버퍼.
		wrap("bindFramebuffer", (target, framebufferOrUndefined) => {
			const framebuffer = framebufferOrUndefined === undefined ? null : framebufferOrUndefined; // WebIDL 은 undefined 를 null 로 받는다.
			if (framebuffer !== null && (!(framebuffer instanceof System.Object) || this.#deletedObjectSet.has(framebuffer))) {
				this.#drawFramebuffer = undefined;
				this.#readFramebuffer = undefined;
				return;
			}
			if (target === FRAMEBUFFER) {
				this.#drawFramebuffer = framebuffer;
				this.#readFramebuffer = framebuffer;
			}
			else if (target === DRAW_FRAMEBUFFER) {
				this.#drawFramebuffer = framebuffer;
			}
			else if (target === READ_FRAMEBUFFER) {
				this.#readFramebuffer = framebuffer;
			}
		});
		wrap("deleteFramebuffer", (framebuffer) => {
			// 묶인 것을 지우면 GL 이 캔버스로 되돌린다.
			if (framebuffer === null || framebuffer === undefined) {
				return;
			}
			this.#deletedObjectSet.add(framebuffer);
			if (this.#drawFramebuffer === framebuffer) {
				this.#drawFramebuffer = null;
			}
			if (this.#readFramebuffer === framebuffer) {
				this.#readFramebuffer = null;
			}
		});

		// 뷰포트와 가위. (너비나 높이가 음수면 GL 이 무시한다, 뷰포트 크기는 한도에 맞춰 줄인다)
		wrap("viewport", (x, y, width, height) => {
			const viewportWidth = width | 0;
			const viewportHeight = height | 0;
			if (viewportWidth < 0 || viewportHeight < 0) {
				return;
			}
			const maximumViewportSize = this.readConstantParameter(MAX_VIEWPORT_DIMS);
			if (!maximumViewportSize) {
				this.#viewport = undefined;
				return;
			}
			this.#viewport = System.Int32Array.of(x | 0, y | 0, System.Math.min(viewportWidth, maximumViewportSize[0]), System.Math.min(viewportHeight, maximumViewportSize[1]));
		});
		wrap("scissor", (x, y, width, height) => {
			const scissorWidth = width | 0;
			const scissorHeight = height | 0;
			if (scissorWidth < 0 || scissorHeight < 0) {
				return;
			}
			this.#scissorBox = System.Int32Array.of(x | 0, y | 0, scissorWidth, scissorHeight);
		});

		// 켜고 끄기.
		wrap("enable", (capability) => {
			if (CAPABILITY_SET.has(capability)) {
				this.#capabilityTable.set(capability, true);
			}
		});
		wrap("disable", (capability) => {
			if (CAPABILITY_SET.has(capability)) {
				this.#capabilityTable.set(capability, false);
			}
		});

		// 비우기 색과 색 쓰기. (WebGL2 는 비우기 색을 0 ~ 1 로 자르지 않고 그대로 기억한다)
		wrap("clearColor", (red, green, blue, alpha) => {
			this.#clearColor = System.Float32Array.of(red, green, blue, alpha);
		});
		wrap("colorMask", (red, green, blue, alpha) => {
			this.#colorWriteMask = [!!red, !!green, !!blue, !!alpha];
		});

		// 섞기.
		const isBlendFactorPairValid = (sourceFactor, destinationFactor) => {
			if (!BLEND_FACTOR_SET.has(sourceFactor) || !BLEND_FACTOR_SET.has(destinationFactor)) {
				return false;
			}
			// WebGL 은 상수 색과 상수 알파를 소스와 대상에 섞어 쓰지 못하게 한다. (INVALID_OPERATION)
			if ((CONSTANT_COLOR_FACTOR_SET.has(sourceFactor) && CONSTANT_ALPHA_FACTOR_SET.has(destinationFactor)) || (CONSTANT_ALPHA_FACTOR_SET.has(sourceFactor) && CONSTANT_COLOR_FACTOR_SET.has(destinationFactor))) {
				return false;
			}
			// 대상 인자의 SRC_ALPHA_SATURATE 는 판마다 받는지가 달라 모른다로 둔다.
			return destinationFactor !== SOURCE_ALPHA_SATURATE;
		};
		wrap("blendFunc", (sourceFactor, destinationFactor) => {
			if (!isBlendFactorPairValid(sourceFactor, destinationFactor)) {
				this.#blendFactors = undefined;
				return;
			}
			this.#blendFactors = [sourceFactor, destinationFactor, sourceFactor, destinationFactor];
		});
		wrap("blendFuncSeparate", (sourceRGB, destinationRGB, sourceAlpha, destinationAlpha) => {
			if (!isBlendFactorPairValid(sourceRGB, destinationRGB) || !isBlendFactorPairValid(sourceAlpha, destinationAlpha)) {
				this.#blendFactors = undefined;
				return;
			}
			this.#blendFactors = [sourceRGB, destinationRGB, sourceAlpha, destinationAlpha];
		});
		wrap("blendEquation", (mode) => {
			if (!BLEND_EQUATION_SET.has(mode)) {
				this.#blendEquations = undefined;
				return;
			}
			this.#blendEquations = [mode, mode];
		});
		wrap("blendEquationSeparate", (modeRGB, modeAlpha) => {
			if (!BLEND_EQUATION_SET.has(modeRGB) || !BLEND_EQUATION_SET.has(modeAlpha)) {
				this.#blendEquations = undefined;
				return;
			}
			this.#blendEquations = [modeRGB, modeAlpha];
		});

		// 깊이와 면.
		wrap("depthMask", (flag) => {
			this.#depthWriteMask = !!flag;
		});
		wrap("depthFunc", (depthFunction) => {
			// NEVER(0x0200) ~ ALWAYS(0x0207)
			this.#depthFunction = depthFunction >= 0x0200 && depthFunction <= 0x0207 ? depthFunction : undefined;
		});
		wrap("frontFace", (mode) => {
			// CW(0x0900), CCW(0x0901)
			this.#frontFace = mode === 0x0900 || mode === 0x0901 ? mode : undefined;
		});
		wrap("cullFace", (mode) => {
			// FRONT(0x0404), BACK(0x0405), FRONT_AND_BACK(0x0408)
			this.#cullFaceMode = mode === 0x0404 || mode === 0x0405 || mode === 0x0408 ? mode : undefined;
		});

		// 프로그램과 버텍스 어레이. (링크에 실패한 프로그램을 쓰게 하면 GL 이 무시하므로, 링크 결과를 모를 때는 다음에 읽을 때 묻는다)
		wrap("useProgram", (programOrUndefined) => {
			const program = programOrUndefined === undefined ? null : programOrUndefined;
			this.#program = program === null || (program instanceof System.Object && this.#programLinkStatusTable.get(program) === true) ? program : undefined;
		});
		wrap("linkProgram", (program) => {
			// 다시 링크하면 결과를 다시 알아내야 한다.
			if (program instanceof System.Object) {
				this.#programLinkStatusTable.delete(program);
			}
		});
		wrap("deleteProgram", (program) => {
			// 쓰는 중인 프로그램은 지워도 계속 쓰이고, 다시 쓰게 하면 GL 이 무시한다.
			if (program instanceof System.Object) {
				this.#programLinkStatusTable.set(program, false);
			}
		});
		const originalGetProgramParameter = webGL2RenderingContext.getProgramParameter;
		if (typeof originalGetProgramParameter === "function") {
			// 링크 결과를 묻는 것(엔진의 ShaderProgram 이 링크 뒤에 묻는다)을 보고 기억한다.
			webGL2RenderingContext.getProgramParameter = (program, parameterName) => {
				const value = originalGetProgramParameter.call(webGL2RenderingContext, program, parameterName);
				if (parameterName === LINK_STATUS && typeof value === "boolean" && program instanceof System.Object && this.#programLinkStatusTable.get(program) !== false) {
					this.#programLinkStatusTable.set(program, value);
				}
				return value;
			};
		}
		wrap("bindVertexArray", (vertexArrayOrUndefined) => {
			const vertexArray = vertexArrayOrUndefined === undefined ? null : vertexArrayOrUndefined;
			this.#vertexArray = vertexArray === null || (vertexArray instanceof System.Object && !this.#deletedObjectSet.has(vertexArray)) ? vertexArray : undefined;
		});
		wrap("deleteVertexArray", (vertexArray) => {
			if (vertexArray === null || vertexArray === undefined) {
				return;
			}
			this.#deletedObjectSet.add(vertexArray);
			if (this.#vertexArray === vertexArray) {
				this.#vertexArray = null;
			}
		});

		// 텍스처.
		wrap("activeTexture", (textureUnit) => {
			const maximumTextureUnitCount = this.readConstantParameter(MAX_COMBINED_TEXTURE_IMAGE_UNITS);
			if (typeof maximumTextureUnitCount !== "number" || textureUnit < TEXTURE0 || textureUnit >= TEXTURE0 + maximumTextureUnitCount) {
				this.#activeTexture = undefined;
				return;
			}
			this.#activeTexture = textureUnit;
		});
		wrap("bindTexture", (target, textureOrUndefined) => {
			const texture = textureOrUndefined === undefined ? null : textureOrUndefined;
			const textureTargetIndex = TEXTURE_TARGET_LIST.indexOf(target);
			if (textureTargetIndex < 0) {
				return;
			}
			const activeTexture = this.#activeTexture;
			if (activeTexture === undefined) {
				// 유닛을 모르면 그 대상의 기억을 모두 잊는다.
				this.forgetTextureTarget(textureTargetIndex);
				return;
			}
			const key = (activeTexture - TEXTURE0) * 4 + textureTargetIndex;
			if (texture === null) {
				this.#textureBindingTable.set(key, null);
				return;
			}
			if (!(texture instanceof System.Object) || this.#deletedObjectSet.has(texture)) {
				this.#textureBindingTable.delete(key);
				return;
			}
			// 텍스처는 처음 묶은 대상에만 묶인다. (다른 대상으로 묶으면 GL 이 무시한다)
			const textureTarget = this.#textureTargetTable.get(texture);
			if (textureTarget === undefined) {
				this.#textureTargetTable.set(texture, textureTargetIndex);
			}
			else if (textureTarget !== textureTargetIndex) {
				return;
			}
			this.#textureBindingTable.set(key, texture);
		});
		wrap("deleteTexture", (texture) => {
			// 묶인 것을 지우면 GL 이 그 유닛에서 풀어 준다.
			if (texture === null || texture === undefined) {
				return;
			}
			this.#deletedObjectSet.add(texture);
			for (const [key, boundTexture] of this.#textureBindingTable) {
				if (boundTexture === texture) {
					this.#textureBindingTable.set(key, null);
				}
			}
		});

		// 픽셀 올리기와 읽기 설정.
		wrap("pixelStorei", (parameterName, parameterValue) => {
			const value = parameterValue | 0;
			switch (parameterName) {
				case UNPACK_FLIP_Y_WEBGL:
				case UNPACK_PREMULTIPLY_ALPHA_WEBGL:
					this.#pixelStoreTable.set(parameterName, value !== 0);
					break;
				case UNPACK_COLORSPACE_CONVERSION_WEBGL:
					if (value === 0 || value === BROWSER_DEFAULT_WEBGL) {
						this.#pixelStoreTable.set(parameterName, value);
					}
					else {
						this.#pixelStoreTable.delete(parameterName);
					}
					break;
				case PACK_ALIGNMENT:
				case UNPACK_ALIGNMENT:
					if (value === 1 || value === 2 || value === 4 || value === 8) {
						this.#pixelStoreTable.set(parameterName, value);
					}
					else {
						this.#pixelStoreTable.delete(parameterName);
					}
					break;
				default:
					break;
			}
		});
	}

	//==============================================================================
	// 한 대상의 텍스처 묶음 기억을 모든 유닛에서 잊기.
	//==============================================================================
	/**
	 * @private
	 * @param { number } textureTargetIndex 대상 칸.
	 */
	forgetTextureTarget(textureTargetIndex) {
		for (const key of [...this.#textureBindingTable.keys()]) {
			if (key % 4 === textureTargetIndex) {
				this.#textureBindingTable.delete(key);
			}
		}
	}
}
