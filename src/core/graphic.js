//==============================================================================
// 포함 모듈 목록.
//==============================================================================
const System = globalThis;
import { Object } from "../base/object.js";
import { Node } from "../base/node.js";
import { Rect } from "../base/rect.js";
import { Vector2 } from "../base/vector2.js";
import { Engine } from "./engine.js";
import { Color } from "../base/color.js";
import { TransformNode } from "./node/transformnode.js";
import { TransformMatrix } from "../base/transformmatrix.js";
import { ShaderProgram } from "./graphic/shaderprogram.js";
import { ImageTextureCache } from "./graphic/imagetexturecache.js";
import { TextStringTextureCache } from "./graphic/textstringtexturecache.js";
import * as Math from "../base/math.js";


//==============================================================================
// 전역 상수 목록.
//==============================================================================
// 버텍스 셰이더. (픽셀 좌표 → 클립 좌표)
const VERTEXSHADER_SOURCE = `#version 300 es
in vec2 vertexPosition;
in vec2 vertexTextureCoordinate;
uniform mat3 projectionMatrix;
uniform mat3 modelMatrix;
out vec2 fragmentTextureCoordinate;
void main() {
	vec3 transformedPosition = projectionMatrix * (modelMatrix * vec3(vertexPosition, 1.0));
	gl_Position = vec4(transformedPosition.xy, 0.0, 1.0);
	fragmentTextureCoordinate = vertexTextureCoordinate;
}
`;

// 프래그먼트 셰이더. (프리멀티플라이드 알파 출력)
// - 단색 도형은 1x1 흰색 텍스처를 바인드해 같은 경로로 처리한다.
// - tintColor 는 이미지 실루엣(알파) 안쪽에만 색을 덮는 틴트. (alpha 0 이면 비활성)
const FRAGMENTSHADER_SOURCE = `#version 300 es
precision highp float;
in vec2 fragmentTextureCoordinate;
uniform sampler2D mainTexture;
uniform vec4 mainColor;
uniform vec4 tintColor;
uniform float globalAlpha;
out vec4 outputColor;
void main() {
	vec4 textureColor = texture(mainTexture, fragmentTextureCoordinate);
	vec3 tintedColor = mix(textureColor.rgb, tintColor.rgb * textureColor.a, tintColor.a);
	float finalAlpha = textureColor.a * mainColor.a * globalAlpha;
	vec3 finalColor = tintedColor * mainColor.rgb * mainColor.a * globalAlpha;
	outputColor = vec4(finalColor, finalAlpha);
}
`;

// 버텍스 1개당 float 수. (x, y, u, v)
// 파티클 배치 버텍스 셰이더. (정점마다 색을 실어 한 번의 드로우로 수백 개를 그린다)
const PARTICLE_VERTEXSHADER_SOURCE = `#version 300 es
in vec2 vertexPosition;
in vec2 vertexTextureCoordinate;
in vec4 vertexColor;
uniform mat3 projectionMatrix;
uniform mat3 modelMatrix;
out vec2 fragmentTextureCoordinate;
out vec4 fragmentColor;
void main() {
	vec3 transformedPosition = projectionMatrix * (modelMatrix * vec3(vertexPosition, 1.0));
	gl_Position = vec4(transformedPosition.xy, 0.0, 1.0);
	fragmentTextureCoordinate = vertexTextureCoordinate;
	fragmentColor = vertexColor;
}
`;

// 파티클 배치 프래그먼트 셰이더. (프리멀티플라이드 알파 출력)
const PARTICLE_FRAGMENTSHADER_SOURCE = `#version 300 es
precision highp float;
in vec2 fragmentTextureCoordinate;
in vec4 fragmentColor;
uniform sampler2D mainTexture;
uniform float globalAlpha;
out vec4 outputColor;
void main() {
	vec4 textureColor = texture(mainTexture, fragmentTextureCoordinate);
	float finalAlpha = textureColor.a * fragmentColor.a * globalAlpha;
	vec3 finalColor = textureColor.rgb * fragmentColor.rgb * fragmentColor.a * globalAlpha;
	outputColor = vec4(finalColor, finalAlpha);
}
`;

const FLOATS_PER_VERTEX = 4;
const PARTICLE_FLOATS_PER_VERTEX = 8; // x, y, u, v, r, g, b, a
const PARTICLE_VERTEX_CAPACITY = 8192;

// 스크래치 버텍스 버퍼 용량. (버텍스 수)
const VERTEX_CAPACITY = 4096;

// 라운드 사각형 / 원의 코너 아크 분할 수.
const CORNER_SEGMENT_COUNT = 8;

// 텍스트 베이크 스케일 상한. (과도한 확대 굽기 방지)
const MAXIMUM_TEXT_BAKE_SCALE = 8;


//==============================================================================
// 색상 값을 Color 인스턴스로 변환.
// - Color / "#rrggbb(aa)" / "rgb(a)(...)" 지원. 그 외는 흰색.
//==============================================================================
/**
 * @param { Color | string } colorValue
 * @returns { Color }
 */
function parseColorValue(colorValue) {
	if (colorValue instanceof Color) {
		return colorValue.clone();
	}
	if (typeof colorValue === "string") {
		const trimmedColorString = colorValue.trim().toLowerCase();
		if (trimmedColorString.startsWith("#")) {
			return Color.createFromHEX(trimmedColorString);
		}
		if (trimmedColorString.startsWith("rgb")) {
			return Color.createFromRGBA(trimmedColorString);
		}
	}
	return Color.white();
}


//==============================================================================
// 그래픽.
// - Canvas 의 WebGL2 렌더링 컨텍스트를 통해 출력하는 렌더러.
// - Canvas2D 시절의 좌표계(좌상 원점, 픽셀 단위)와 상태 모델(변환/알파 스택)을
//   그대로 재현한다. 모든 드로우는 drawVertices() 한 지점으로 수렴한다.
//==============================================================================
export class Graphic extends Object {
	//==============================================================================
	// 멤버 변수 목록.
	//==============================================================================
	/** @private @type { HTMLCanvasElement } */ #canvas;
	/** @private @type { WebGL2RenderingContext } */ #webGL2RenderingContext;
	/** @private @type { boolean } */ #isForceGizmosVisible;
	/** @private @type { boolean } */ #isImageSmoothingEnabled;
	/** @private @type { string } */ #imageSmoothingQuality;
	/** @private @type { ShaderProgram } */ #shaderProgram;
	/** @private @type { ShaderProgram | null } */ #shaderProgramOverride; // 드로우에 잠시 바꿔 끼우는 프로그램. (ShaderSprite 등)
	/** @private @type { WebGLVertexArrayObject } */ #vertexArray;
	/** @private @type { WebGLBuffer } */ #vertexBuffer;
	/** @private @type { Float32Array } */ #vertexData;
	/** @private @type { WebGLTexture } */ #whiteTexture;
	/** @private @type { ShaderProgram | null } */ #particleShaderProgram; // 파티클 배치 전용. (지연 생성)
	/** @private @type { WebGLVertexArrayObject | null } */ #particleVertexArray;
	/** @private @type { WebGLBuffer | null } */ #particleVertexBuffer;
	/** @private @type { Float32Array | null } */ #particleVertexData;
	/** @private @type { WebGLTexture | null } */ #softDiscTexture; // 부드러운 원 스프라이트. (지연 생성)
	/** @private @type { ImageTextureCache } */ #imageTextureCache;
	/** @private @type { TextStringTextureCache } */ #textStringTextureCache;
	/** @private @type { TransformMatrix } */ #transformMatrix;
	/** @private @type { object[] } */ #stateStack;
	/** @private @type { number } */ #globalAlpha;
	/** @private @type { string } */ #blendMode;
	/** @private @type { Map<string, number[]> } */ #blendFunctionTable;
	/** @private @type { Set<string> } */ #warnedBlendModes;
	/** @private @type { Color } */ #fillColor;
	/** @private @type { Color } */ #strokeColor;
	/** @private @type { Color } */ #whiteColor;
	/** @private @type { Color | null } */ #imageTintColor;
	/** @private @type { string } */ #fontString;
	/** @private @type { string } */ #textAlign;
	/** @private @type { string } */ #textBaseline;
	/** @private @type { object[] } */ #clipStack;
	/** @private @type { Float32Array } */ #projectionMatrixArray;
	/** @private @type { Float32Array } */ #modelMatrixArray;
	/** @private @type { number } */ #appliedViewportWidth;
	/** @private @type { number } */ #appliedViewportHeight;

	//==============================================================================
	// 생성.
	//==============================================================================
	/**
	 * @constructor
	 * @param { HTMLCanvasElement } canvas
	 */
	constructor(canvas) {
		super();

		const webGL2RenderingContext = canvas.getContext("webgl2", { alpha: false, stencil: true, premultipliedAlpha: true }); // WebGL2RenderingContext
		if (!webGL2RenderingContext) {
			throw new Error("WebGL2 Not Supported.");
		}

		this.#canvas = canvas;
		this.#webGL2RenderingContext = webGL2RenderingContext;
		this.#isForceGizmosVisible = false;
		this.#isImageSmoothingEnabled = true;
		this.#imageSmoothingQuality = "high";

		// 셰이더 프로그램.
		this.#shaderProgram = new ShaderProgram(webGL2RenderingContext, VERTEXSHADER_SOURCE, FRAGMENTSHADER_SOURCE);
		this.#shaderProgramOverride = null;

		// 버텍스 어레이 / 버텍스 버퍼. (스트리밍, 인터리브 x/y/u/v)
		this.#vertexData = new Float32Array(VERTEX_CAPACITY * FLOATS_PER_VERTEX);
		this.#vertexArray = webGL2RenderingContext.createVertexArray();
		this.#vertexBuffer = webGL2RenderingContext.createBuffer();
		webGL2RenderingContext.bindVertexArray(this.#vertexArray);
		webGL2RenderingContext.bindBuffer(webGL2RenderingContext.ARRAY_BUFFER, this.#vertexBuffer);
		webGL2RenderingContext.bufferData(webGL2RenderingContext.ARRAY_BUFFER, this.#vertexData.byteLength, webGL2RenderingContext.DYNAMIC_DRAW);
		const shaderProgram = this.getShaderProgram();
		const vertexPositionLocation = shaderProgram.getAttributeLocation("vertexPosition");
		const vertexTextureCoordinateLocation = shaderProgram.getAttributeLocation("vertexTextureCoordinate");
		const strideBytes = FLOATS_PER_VERTEX * 4;
		webGL2RenderingContext.enableVertexAttribArray(vertexPositionLocation);
		webGL2RenderingContext.vertexAttribPointer(vertexPositionLocation, 2, webGL2RenderingContext.FLOAT, false, strideBytes, 0);
		webGL2RenderingContext.enableVertexAttribArray(vertexTextureCoordinateLocation);
		webGL2RenderingContext.vertexAttribPointer(vertexTextureCoordinateLocation, 2, webGL2RenderingContext.FLOAT, false, strideBytes, 8);
		webGL2RenderingContext.bindVertexArray(null);

		// 단색 도형용 1x1 흰색 텍스처.
		this.#whiteTexture = webGL2RenderingContext.createTexture();
		webGL2RenderingContext.bindTexture(webGL2RenderingContext.TEXTURE_2D, this.#whiteTexture);
		const whitePixel = new Uint8Array([255, 255, 255, 255]);
		webGL2RenderingContext.texImage2D(webGL2RenderingContext.TEXTURE_2D, 0, webGL2RenderingContext.RGBA, 1, 1, 0, webGL2RenderingContext.RGBA, webGL2RenderingContext.UNSIGNED_BYTE, whitePixel);
		webGL2RenderingContext.texParameteri(webGL2RenderingContext.TEXTURE_2D, webGL2RenderingContext.TEXTURE_MIN_FILTER, webGL2RenderingContext.NEAREST);
		webGL2RenderingContext.texParameteri(webGL2RenderingContext.TEXTURE_2D, webGL2RenderingContext.TEXTURE_MAG_FILTER, webGL2RenderingContext.NEAREST);

		// 파티클 배치 자원. (처음 쓸 때 만든다)
		this.#particleShaderProgram = null;
		this.#particleVertexArray = null;
		this.#particleVertexBuffer = null;
		this.#particleVertexData = null;
		this.#softDiscTexture = null;

		// 캐시.
		this.#imageTextureCache = new ImageTextureCache(webGL2RenderingContext);
		this.#textStringTextureCache = new TextStringTextureCache(webGL2RenderingContext);

		// 상태.
		this.#transformMatrix = new TransformMatrix();
		this.#stateStack = [];
		this.#globalAlpha = 1.0;
		this.#blendMode = "source-over";
		this.#warnedBlendModes = new Set();
		this.#fillColor = Color.black();
		this.#strokeColor = Color.black();
		this.#whiteColor = Color.white();
		this.#imageTintColor = null;
		this.#fontString = "10px sans-serif";
		this.#textAlign = "start";
		this.#textBaseline = "alphabetic";
		this.#clipStack = [];
		this.#projectionMatrixArray = new Float32Array(9);
		this.#modelMatrixArray = new Float32Array(9);
		this.#appliedViewportWidth = 0;
		this.#appliedViewportHeight = 0;

		// 블렌드 함수 매핑 테이블. (프리멀티플라이드 알파 기준)
		// - 고정 블렌딩으로 재현 가능한 모드만 등록. 그 외는 source-over 폴백.
		// - 추후 셰이더 기반 블렌드를 추가할 때 이 테이블이 확장 지점이 된다.
		this.#blendFunctionTable = new Map([
			["source-over", [webGL2RenderingContext.ONE, webGL2RenderingContext.ONE_MINUS_SRC_ALPHA]],
			["lighter", [webGL2RenderingContext.ONE, webGL2RenderingContext.ONE]],
			["multiply", [webGL2RenderingContext.DST_COLOR, webGL2RenderingContext.ONE_MINUS_SRC_ALPHA]],
			["screen", [webGL2RenderingContext.ONE, webGL2RenderingContext.ONE_MINUS_SRC_COLOR]],
			["destination-over", [webGL2RenderingContext.ONE_MINUS_DST_ALPHA, webGL2RenderingContext.ONE]],
			["destination-out", [webGL2RenderingContext.ZERO, webGL2RenderingContext.ONE_MINUS_SRC_ALPHA]],
			["source-in", [webGL2RenderingContext.DST_ALPHA, webGL2RenderingContext.ZERO]],
			["destination-in", [webGL2RenderingContext.ZERO, webGL2RenderingContext.SRC_ALPHA]],
			["copy", [webGL2RenderingContext.ONE, webGL2RenderingContext.ZERO]],
		]);

		// 고정 렌더 상태.
		webGL2RenderingContext.enable(webGL2RenderingContext.BLEND);
		webGL2RenderingContext.blendFunc(webGL2RenderingContext.ONE, webGL2RenderingContext.ONE_MINUS_SRC_ALPHA);
		webGL2RenderingContext.disable(webGL2RenderingContext.DEPTH_TEST);
		webGL2RenderingContext.disable(webGL2RenderingContext.CULL_FACE);

		// 텍스처 유닛 고정.
		shaderProgram.use();
		const mainTextureLocation = shaderProgram.getUniformLocation("mainTexture");
		webGL2RenderingContext.uniform1i(mainTextureLocation, 0);
		webGL2RenderingContext.activeTexture(webGL2RenderingContext.TEXTURE0);
	}

	//==============================================================================
	// 설정 반영. (매 프레임 시작 시 엔진이 호출)
	// - 캔버스 크기 변화 감지 및 뷰포트/프로젝션 갱신.
	// - 프레임 시작 기준 상태로 리셋.
	//==============================================================================
	/**
	 * @param { Engine } engine
	 */
	applySettings(engine) {
		const webGL2RenderingContext = this.getWebGL2RenderingContext();
		this.#shaderProgramOverride = null;
		const shaderProgram = this.getShaderProgram();

		// 뷰포트/프로젝션 갱신.
		const drawingBufferWidth = webGL2RenderingContext.drawingBufferWidth;
		const drawingBufferHeight = webGL2RenderingContext.drawingBufferHeight;
		if (drawingBufferWidth !== this.#appliedViewportWidth || drawingBufferHeight !== this.#appliedViewportHeight) {
			webGL2RenderingContext.viewport(0, 0, drawingBufferWidth, drawingBufferHeight);
			this.#projectionMatrixArray[0] = 2 / drawingBufferWidth;
			this.#projectionMatrixArray[1] = 0;
			this.#projectionMatrixArray[2] = 0;
			this.#projectionMatrixArray[3] = 0;
			this.#projectionMatrixArray[4] = -2 / drawingBufferHeight;
			this.#projectionMatrixArray[5] = 0;
			this.#projectionMatrixArray[6] = -1;
			this.#projectionMatrixArray[7] = 1;
			this.#projectionMatrixArray[8] = 1;
			this.#appliedViewportWidth = drawingBufferWidth;
			this.#appliedViewportHeight = drawingBufferHeight;
		}

		// 프로그램/버퍼 바인딩 및 프로젝션 업로드.
		shaderProgram.use();
		webGL2RenderingContext.bindVertexArray(this.getVertexArray());
		webGL2RenderingContext.bindBuffer(webGL2RenderingContext.ARRAY_BUFFER, this.getVertexBuffer());
		const projectionMatrixLocation = shaderProgram.getUniformLocation("projectionMatrix");
		webGL2RenderingContext.uniformMatrix3fv(projectionMatrixLocation, false, this.#projectionMatrixArray);

		// 프레임 시작 기준 상태로 리셋.
		this.#stateStack.length = 0;
		this.#transformMatrix.setIdentity();
		this.#globalAlpha = 1.0;
		this.#imageTintColor = null;
		this.setBlendMode("source-over");

		// 클리핑 상태 리셋. (비정상 종료로 스택이 남아 있어도 복구)
		if (this.#clipStack.length > 0) {
			this.#clipStack.length = 0;
			webGL2RenderingContext.disable(webGL2RenderingContext.STENCIL_TEST);
		}
		webGL2RenderingContext.clearStencil(0);
		webGL2RenderingContext.clear(webGL2RenderingContext.STENCIL_BUFFER_BIT);
	}

	//==============================================================================
	// 이미지 스무딩 활성화 여부 설정.
	// - 도트(픽셀) 스프라이트 게임은 false 로 설정해 선명하게 렌더링.
	//==============================================================================
	/**
	 * @param { boolean } value
	 */
	setImageSmoothingEnabled(value) {
		this.#isImageSmoothingEnabled = value;
	}

	//==============================================================================
	// 이미지 스무딩 활성화 여부 반환.
	//==============================================================================
	/**
	 * @returns { boolean }
	 */
	isImageSmoothingEnabled() {
		return this.#isImageSmoothingEnabled;
	}

	//==============================================================================
	// 이미지 스무딩 퀄리티 설정. ("low", "medium", "high")
	// - WebGL2 에서는 LINEAR/NEAREST 이분법이라 보관만 한다.
	//==============================================================================
	/**
	 * @param { string } value
	 */
	setImageSmoothingQuality(value) {
		this.#imageSmoothingQuality = value;
	}

	//==============================================================================
	// 모든 기즈모 강제 표시 설정.
	//==============================================================================
	/**
	 * @param { boolean } isForceGizmosVisible
	 */
	setForceGizmosVisible(isForceGizmosVisible) {
		this.#isForceGizmosVisible = isForceGizmosVisible;
	}

	//==============================================================================
	// 모든 기즈모 강제 표시 여부 반환.
	//==============================================================================
	/**
	 * @returns { boolean }
	 */
	isForceGizmosVisible() {
		return this.#isForceGizmosVisible;
	}

	//==============================================================================
	// 상태 저장. (변환/알파/블렌드/색상/폰트/틴트 — Canvas2D save 대응)
	//==============================================================================
	pushState() {
		const stateSnapshot = {
			transformMatrix: this.#transformMatrix.clone(),
			globalAlpha: this.#globalAlpha,
			blendMode: this.#blendMode,
			fillColor: this.#fillColor,
			strokeColor: this.#strokeColor,
			imageTintColor: this.#imageTintColor,
			fontString: this.#fontString,
			textAlign: this.#textAlign,
			textBaseline: this.#textBaseline,
		};
		this.#stateStack.push(stateSnapshot);
	}

	//==============================================================================
	// 상태 복원. (Canvas2D restore 대응)
	//==============================================================================
	popState() {
		const stateSnapshot = this.#stateStack.pop();
		if (!stateSnapshot) {
			return;
		}

		this.#transformMatrix = stateSnapshot.transformMatrix;
		this.#globalAlpha = stateSnapshot.globalAlpha;
		this.#fillColor = stateSnapshot.fillColor;
		this.#strokeColor = stateSnapshot.strokeColor;
		this.#imageTintColor = stateSnapshot.imageTintColor;
		this.#fontString = stateSnapshot.fontString;
		this.#textAlign = stateSnapshot.textAlign;
		this.#textBaseline = stateSnapshot.textBaseline;
		if (this.#blendMode !== stateSnapshot.blendMode) {
			this.setBlendMode(stateSnapshot.blendMode);
		}
	}

	//==============================================================================
	// 이동 변환 누적.
	//==============================================================================
	/**
	 * @param { number } x
	 * @param { number } y
	 */
	translate(x, y) {
		this.#transformMatrix.translate(x, y);
	}

	//==============================================================================
	// 회전 변환 누적.
	//==============================================================================
	/**
	 * @param { number } radian
	 */
	rotate(radian) {
		this.#transformMatrix.rotate(radian);
	}

	//==============================================================================
	// 크기 변환 누적.
	//==============================================================================
	/**
	 * @param { number } x
	 * @param { number } y
	 */
	scale(x, y) {
		this.#transformMatrix.scale(x, y);
	}

	//==============================================================================
	// 변환 행렬 직접 설정. (Canvas2D setTransform(a, b, c, d, e, f) 대응)
	//==============================================================================
	/**
	 * @param { number } a
	 * @param { number } b
	 * @param { number } c
	 * @param { number } d
	 * @param { number } e
	 * @param { number } f
	 */
	setTransform(a, b, c, d, e, f) {
		this.#transformMatrix.setTransform(a, b, c, d, e, f);
	}

	//==============================================================================
	// 변환 행렬 초기화.
	//==============================================================================
	resetTransform() {
		this.#transformMatrix.setIdentity();
	}

	//==============================================================================
	// 현재 변환 행렬 반환.
	//==============================================================================
	/**
	 * @returns { TransformMatrix }
	 */
	getTransformMatrix() {
		return this.#transformMatrix;
	}

	//==============================================================================
	// 전역 투명도 설정.
	//==============================================================================
	/**
	 * @param { number } value
	 */
	setGlobalAlpha(value) {
		this.#globalAlpha = Math.clamp01(value);
	}

	//==============================================================================
	// 전역 투명도 반환.
	//==============================================================================
	/**
	 * @returns { number }
	 */
	getGlobalAlpha() {
		return this.#globalAlpha;
	}

	//==============================================================================
	// 전역 투명도 곱셈 누적. (노드 트리의 투명도 상속용)
	//==============================================================================
	/**
	 * @param { number } value
	 */
	multiplyGlobalAlpha(value) {
		this.#globalAlpha = Math.clamp01(this.#globalAlpha * value);
	}

	//==============================================================================
	// 블렌드 모드 설정. (SpriteBlendMode 문자열 수용)
	// - 고정 블렌딩으로 재현 불가능한 모드는 source-over 로 폴백.
	//==============================================================================
	/**
	 * @param { string } blendMode
	 */
	setBlendMode(blendMode) {
		const webGL2RenderingContext = this.getWebGL2RenderingContext();
		let blendFunction = this.#blendFunctionTable.get(blendMode);
		if (!blendFunction) {
			if (!this.#warnedBlendModes.has(blendMode)) {
				this.#warnedBlendModes.add(blendMode);
				console.warn(`Graphic: unsupported blend mode "${blendMode}" — falling back to "source-over".`);
			}
			blendFunction = this.#blendFunctionTable.get("source-over");
		}

		this.#blendMode = blendMode;
		webGL2RenderingContext.blendFunc(blendFunction[0], blendFunction[1]);
	}

	//==============================================================================
	// 블렌드 모드 반환.
	//==============================================================================
	/**
	 * @returns { string }
	 */
	getBlendMode() {
		return this.#blendMode;
	}

	//==============================================================================
	// 이미지 틴트 색상 설정. (null 이면 해제)
	// - 이미지 실루엣(알파) 안쪽에만 tint.alpha 비율로 색을 덮는다.
	//==============================================================================
	/**
	 * @param { Color | null } color
	 */
	setImageTintColor(color) {
		if (color instanceof Color) {
			this.#imageTintColor = color.clone();
		}
		else {
			this.#imageTintColor = null;
		}
	}

	//==============================================================================
	// 이미지 틴트 색상 반환.
	//==============================================================================
	/**
	 * @returns { Color | null }
	 */
	getImageTintColor() {
		return this.#imageTintColor;
	}

	//==============================================================================
	// 색상 설정.
	//==============================================================================
	/**
	 * @param { Color | string } color
	 */
	setFillColor(color) {
		if (color) {
			this.#fillColor = parseColorValue(color);
		}
	}

	//==============================================================================
	// 채우기 색상 반환.
	//==============================================================================
	/**
	 * @returns { Color }
	 */
	getFillColor() {
		return this.#fillColor;
	}

	//==============================================================================
	// 색상 설정.
	//==============================================================================
	/**
	 * @param { Color | string } color
	 */
	setStrokeColor(color) {
		if (color) {
			this.#strokeColor = parseColorValue(color);
		}
	}

	//==============================================================================
	// 선 색상 반환.
	//==============================================================================
	/**
	 * @returns { Color }
	 */
	getStrokeColor() {
		return this.#strokeColor;
	}

	//==============================================================================
	// 버텍스 데이터에 쿼드(삼각형 2개, 버텍스 6개) 기록.
	// - 기록 후의 오프셋(플로트 단위)을 반환.
	//==============================================================================
	/**
	 * @param { number } offset
	 * @param { number } leftX
	 * @param { number } topY
	 * @param { number } rightX
	 * @param { number } bottomY
	 * @param { number } leftU
	 * @param { number } topV
	 * @param { number } rightU
	 * @param { number } bottomV
	 * @returns { number }
	 */
	writeQuad(offset, leftX, topY, rightX, bottomY, leftU, topV, rightU, bottomV) {
		const vertexData = this.getVertexData();
		vertexData[offset++] = leftX;
		vertexData[offset++] = topY;
		vertexData[offset++] = leftU;
		vertexData[offset++] = topV;
		vertexData[offset++] = rightX;
		vertexData[offset++] = topY;
		vertexData[offset++] = rightU;
		vertexData[offset++] = topV;
		vertexData[offset++] = leftX;
		vertexData[offset++] = bottomY;
		vertexData[offset++] = leftU;
		vertexData[offset++] = bottomV;
		vertexData[offset++] = leftX;
		vertexData[offset++] = bottomY;
		vertexData[offset++] = leftU;
		vertexData[offset++] = bottomV;
		vertexData[offset++] = rightX;
		vertexData[offset++] = topY;
		vertexData[offset++] = rightU;
		vertexData[offset++] = topV;
		vertexData[offset++] = rightX;
		vertexData[offset++] = bottomY;
		vertexData[offset++] = rightU;
		vertexData[offset++] = bottomV;
		return offset;
	}

	//==============================================================================
	// 기록된 버텍스 출력. (모든 드로우가 수렴하는 단일 지점 — 추후 배칭 삽입 지점)
	//==============================================================================
	/**
	 * @param { number } vertexCount
	 * @param { WebGLTexture } texture
	 * @param { Color } color
	 */
	drawVertices(vertexCount, texture, color) {
		if (vertexCount <= 0) {
			return;
		}

		const webGL2RenderingContext = this.getWebGL2RenderingContext();
		const shaderProgram = this.getShaderProgram();

		// 버텍스 업로드. bufferSubData 로 덮어쓰지 않고, 쓸 만큼만 새 저장소를 잡으며 올린다. (고아 처리)
		// 드로우 콜마다 같은 버퍼를 오프셋 0 부터 덮어쓰면 GPU 가 지난 콜의 데이터를 아직 읽는 중이라,
		// 사파리(ANGLE → Metal)는 콜마다 CPU 를 세워 GPU 가 끝나기를 기다린다. 드로우 콜 45 · 정점 1000 남짓에도
		// 아이폰 10 fps · 맥 22 fps 가 나오고 크롬만 멀쩡한 증상이 이것이다. (크롬은 드라이버가 알아서 복사해 넘긴다)
		// bufferData 는 부를 때마다 새 저장소를 만들어 지난 콜과 겹치지 않고, 브라우저가 저장소를 돌려쓰므로 할당 비용은 작다.
		const vertexData = this.getVertexData();
		webGL2RenderingContext.bufferData(webGL2RenderingContext.ARRAY_BUFFER, vertexData, webGL2RenderingContext.DYNAMIC_DRAW, 0, vertexCount * FLOATS_PER_VERTEX);

		// 유니폼 업로드.
		this.#transformMatrix.writeToFloat32Array(this.#modelMatrixArray);
		const modelMatrixLocation = shaderProgram.getUniformLocation("modelMatrix");
		webGL2RenderingContext.uniformMatrix3fv(modelMatrixLocation, false, this.#modelMatrixArray);
		const mainColorLocation = shaderProgram.getUniformLocation("mainColor");
		webGL2RenderingContext.uniform4f(mainColorLocation, color.red, color.green, color.blue, color.alpha);
		const tintColorLocation = shaderProgram.getUniformLocation("tintColor");
		const imageTintColor = this.getImageTintColor();
		if (imageTintColor) {
			webGL2RenderingContext.uniform4f(tintColorLocation, imageTintColor.red, imageTintColor.green, imageTintColor.blue, imageTintColor.alpha);
		}
		else {
			webGL2RenderingContext.uniform4f(tintColorLocation, 0, 0, 0, 0);
		}
		const globalAlphaLocation = shaderProgram.getUniformLocation("globalAlpha");
		webGL2RenderingContext.uniform1f(globalAlphaLocation, this.getGlobalAlpha());

		// 텍스처 바인드 및 출력.
		webGL2RenderingContext.bindTexture(webGL2RenderingContext.TEXTURE_2D, texture);
		webGL2RenderingContext.drawArrays(webGL2RenderingContext.TRIANGLES, 0, vertexCount);
	}

	//==============================================================================
	// 파티클 배치 자원 준비. (셰이더 / 버텍스 어레이 / 부드러운 원 텍스처)
	//==============================================================================
	/**
	 * @private
	 */
	ensureParticleBatchResources() {
		if (this.#particleShaderProgram) {
			return;
		}
		const webGL2RenderingContext = this.getWebGL2RenderingContext();
		this.#particleShaderProgram = new ShaderProgram(webGL2RenderingContext, PARTICLE_VERTEXSHADER_SOURCE, PARTICLE_FRAGMENTSHADER_SOURCE);
		this.#particleVertexData = new Float32Array(PARTICLE_VERTEX_CAPACITY * PARTICLE_FLOATS_PER_VERTEX);
		this.#particleVertexArray = webGL2RenderingContext.createVertexArray();
		this.#particleVertexBuffer = webGL2RenderingContext.createBuffer();
		webGL2RenderingContext.bindVertexArray(this.#particleVertexArray);
		webGL2RenderingContext.bindBuffer(webGL2RenderingContext.ARRAY_BUFFER, this.#particleVertexBuffer);
		webGL2RenderingContext.bufferData(webGL2RenderingContext.ARRAY_BUFFER, this.#particleVertexData.byteLength, webGL2RenderingContext.DYNAMIC_DRAW);
		const positionLocation = this.#particleShaderProgram.getAttributeLocation("vertexPosition");
		const textureCoordinateLocation = this.#particleShaderProgram.getAttributeLocation("vertexTextureCoordinate");
		const colorLocation = this.#particleShaderProgram.getAttributeLocation("vertexColor");
		const strideBytes = PARTICLE_FLOATS_PER_VERTEX * 4;
		webGL2RenderingContext.enableVertexAttribArray(positionLocation);
		webGL2RenderingContext.vertexAttribPointer(positionLocation, 2, webGL2RenderingContext.FLOAT, false, strideBytes, 0);
		webGL2RenderingContext.enableVertexAttribArray(textureCoordinateLocation);
		webGL2RenderingContext.vertexAttribPointer(textureCoordinateLocation, 2, webGL2RenderingContext.FLOAT, false, strideBytes, 8);
		webGL2RenderingContext.enableVertexAttribArray(colorLocation);
		webGL2RenderingContext.vertexAttribPointer(colorLocation, 4, webGL2RenderingContext.FLOAT, false, strideBytes, 16);
		webGL2RenderingContext.bindVertexArray(null);
		this.#particleShaderProgram.use();
		const mainTextureLocation = this.#particleShaderProgram.getUniformLocation("mainTexture");
		webGL2RenderingContext.uniform1i(mainTextureLocation, 0);
		this.getShaderProgram().use();
		webGL2RenderingContext.bindBuffer(webGL2RenderingContext.ARRAY_BUFFER, this.#vertexBuffer);
	}

	//==============================================================================
	// 파티클 배치 버텍스 배열 반환. (필요 시 증설 — x, y, u, v, r, g, b, a 인터리브)
	//==============================================================================
	/**
	 * @param { number } minimumFloatCount
	 * @returns { Float32Array }
	 */
	getParticleVertexData(minimumFloatCount) {
		this.ensureParticleBatchResources();
		if (this.#particleVertexData.length < minimumFloatCount) {
			let nextLength = this.#particleVertexData.length;
			while (nextLength < minimumFloatCount) {
				nextLength *= 2;
			}
			this.#particleVertexData = new Float32Array(nextLength);
			const webGL2RenderingContext = this.getWebGL2RenderingContext();
			webGL2RenderingContext.bindBuffer(webGL2RenderingContext.ARRAY_BUFFER, this.#particleVertexBuffer);
			webGL2RenderingContext.bufferData(webGL2RenderingContext.ARRAY_BUFFER, this.#particleVertexData.byteLength, webGL2RenderingContext.DYNAMIC_DRAW);
			webGL2RenderingContext.bindBuffer(webGL2RenderingContext.ARRAY_BUFFER, this.#vertexBuffer);
		}
		return this.#particleVertexData;
	}

	//==============================================================================
	// 파티클 배치 출력. (getParticleVertexData 에 채운 정점을 한 번에 그린다)
	//==============================================================================
	/**
	 * @param { number } vertexCount
	 * @param { WebGLTexture } texture
	 */
	drawColoredQuads(vertexCount, texture) {
		if (vertexCount <= 0) {
			return;
		}
		this.ensureParticleBatchResources();
		const webGL2RenderingContext = this.getWebGL2RenderingContext();

		this.#particleShaderProgram.use();
		webGL2RenderingContext.bindVertexArray(this.#particleVertexArray);
		webGL2RenderingContext.bindBuffer(webGL2RenderingContext.ARRAY_BUFFER, this.#particleVertexBuffer);
		// drawVertices 와 같은 까닭으로 bufferSubData 대신 bufferData 로 새 저장소를 잡으며 올린다. (사파리 드로우 콜 동기 대기)
		webGL2RenderingContext.bufferData(webGL2RenderingContext.ARRAY_BUFFER, this.#particleVertexData, webGL2RenderingContext.DYNAMIC_DRAW, 0, vertexCount * PARTICLE_FLOATS_PER_VERTEX);

		const projectionMatrixLocation = this.#particleShaderProgram.getUniformLocation("projectionMatrix");
		webGL2RenderingContext.uniformMatrix3fv(projectionMatrixLocation, false, this.#projectionMatrixArray);
		this.#transformMatrix.writeToFloat32Array(this.#modelMatrixArray);
		const modelMatrixLocation = this.#particleShaderProgram.getUniformLocation("modelMatrix");
		webGL2RenderingContext.uniformMatrix3fv(modelMatrixLocation, false, this.#modelMatrixArray);
		const globalAlphaLocation = this.#particleShaderProgram.getUniformLocation("globalAlpha");
		webGL2RenderingContext.uniform1f(globalAlphaLocation, this.getGlobalAlpha());

		webGL2RenderingContext.bindTexture(webGL2RenderingContext.TEXTURE_2D, texture);
		webGL2RenderingContext.drawArrays(webGL2RenderingContext.TRIANGLES, 0, vertexCount);

		// 기본 경로 상태 복원.
		this.getShaderProgram().use();
		webGL2RenderingContext.bindVertexArray(this.getVertexArray());
		webGL2RenderingContext.bindBuffer(webGL2RenderingContext.ARRAY_BUFFER, this.#vertexBuffer);
	}

	//==============================================================================
	// 부드러운 원 텍스처 반환. (가장자리가 잦아드는 64x64 원 — 파티클 기본 스프라이트)
	//==============================================================================
	/**
	 * @returns { WebGLTexture }
	 */
	getSoftDiscTexture() {
		if (this.#softDiscTexture) {
			return this.#softDiscTexture;
		}
		const webGL2RenderingContext = this.getWebGL2RenderingContext();
		const textureSize = 64;
		const pixels = new System.Uint8Array(textureSize * textureSize * 4);
		const halfSize = textureSize * 0.5;
		for (let pixelY = 0; pixelY < textureSize; ++pixelY) {
			for (let pixelX = 0; pixelX < textureSize; ++pixelX) {
				const deltaX = (pixelX + 0.5 - halfSize) / halfSize;
				const deltaY = (pixelY + 0.5 - halfSize) / halfSize;
				const distance = Math.sqrt(deltaX * deltaX + deltaY * deltaY);

				// 중심은 꽉 차고 가장자리에서 부드럽게 사라진다.
				let alphaRatio = 1 - (distance - 0.7) / 0.3;
				alphaRatio = Math.max(0, Math.min(1, alphaRatio));
				alphaRatio = alphaRatio * alphaRatio * (3 - 2 * alphaRatio);
				const byteValue = Math.round(alphaRatio * 255);
				const pixelOffset = (pixelY * textureSize + pixelX) * 4;
				pixels[pixelOffset] = byteValue;
				pixels[pixelOffset + 1] = byteValue;
				pixels[pixelOffset + 2] = byteValue;
				pixels[pixelOffset + 3] = byteValue;
			}
		}
		this.#softDiscTexture = webGL2RenderingContext.createTexture();
		webGL2RenderingContext.bindTexture(webGL2RenderingContext.TEXTURE_2D, this.#softDiscTexture);
		webGL2RenderingContext.texImage2D(webGL2RenderingContext.TEXTURE_2D, 0, webGL2RenderingContext.RGBA, textureSize, textureSize, 0, webGL2RenderingContext.RGBA, webGL2RenderingContext.UNSIGNED_BYTE, pixels);
		webGL2RenderingContext.texParameteri(webGL2RenderingContext.TEXTURE_2D, webGL2RenderingContext.TEXTURE_MIN_FILTER, webGL2RenderingContext.LINEAR);
		webGL2RenderingContext.texParameteri(webGL2RenderingContext.TEXTURE_2D, webGL2RenderingContext.TEXTURE_MAG_FILTER, webGL2RenderingContext.LINEAR);
		webGL2RenderingContext.texParameteri(webGL2RenderingContext.TEXTURE_2D, webGL2RenderingContext.TEXTURE_WRAP_S, webGL2RenderingContext.CLAMP_TO_EDGE);
		webGL2RenderingContext.texParameteri(webGL2RenderingContext.TEXTURE_2D, webGL2RenderingContext.TEXTURE_WRAP_T, webGL2RenderingContext.CLAMP_TO_EDGE);
		return this.#softDiscTexture;
	}

	//==============================================================================
	// 선 출력.
	// - setStrokeColor()
	//==============================================================================
	/**
	 * @param { Vector2[] } positions
	 */
	drawLine(positions, size = 1) {
		this.drawPolyline(positions, size, false);
	}

	//==============================================================================
	// 닫힌 선 출력. (마지막 점과 첫 점을 잇는 루프)
	// - setStrokeColor()
	//==============================================================================
	/**
	 * @param { Vector2[] } positions
	 */
	drawLineLoop(positions, size = 1) {
		this.drawPolyline(positions, size, true);
	}

	//==============================================================================
	// 폴리라인 출력. (세그먼트별 두께 확장 쿼드)
	// - 내부 조인트는 반두께 연장으로 이음새를 메운다.
	//==============================================================================
	/**
	 * @param { Vector2[] } positions
	 * @param { number } size
	 * @param { boolean } isClosed
	 */
	drawPolyline(positions, size, isClosed) {
		if (!positions || positions.length < 2) {
			return;
		}

		const halfSize = size / 2;
		const vertexData = this.getVertexData();
		const segmentCount = isClosed ? positions.length : positions.length - 1;
		let offset = 0;
		let vertexCount = 0;
		for (let segmentIndex = 0; segmentIndex < segmentCount; ++segmentIndex) {
			const startPosition = positions[segmentIndex];
			const endPosition = positions[(segmentIndex + 1) % positions.length];
			const deltaX = endPosition.x - startPosition.x;
			const deltaY = endPosition.y - startPosition.y;
			const length = Math.sqrt(deltaX * deltaX + deltaY * deltaY);
			if (length <= 0) {
				continue;
			}

			const directionX = deltaX / length;
			const directionY = deltaY / length;
			const normalX = -directionY * halfSize;
			const normalY = directionX * halfSize;

			// 내부 조인트 이음새 메움. (열린 선의 양 끝은 연장하지 않음)
			const hasStartJoint = isClosed || segmentIndex > 0;
			const hasEndJoint = isClosed || segmentIndex < segmentCount - 1;
			const startExtension = hasStartJoint ? halfSize : 0;
			const endExtension = hasEndJoint ? halfSize : 0;
			const extendedStartX = startPosition.x - directionX * startExtension;
			const extendedStartY = startPosition.y - directionY * startExtension;
			const extendedEndX = endPosition.x + directionX * endExtension;
			const extendedEndY = endPosition.y + directionY * endExtension;

			// 쿼드(삼각형 2개) 기록.
			if ((vertexCount + 6) * FLOATS_PER_VERTEX > vertexData.length) {
				break;
			}
			vertexData[offset++] = extendedStartX + normalX;
			vertexData[offset++] = extendedStartY + normalY;
			vertexData[offset++] = 0.5;
			vertexData[offset++] = 0.5;
			vertexData[offset++] = extendedEndX + normalX;
			vertexData[offset++] = extendedEndY + normalY;
			vertexData[offset++] = 0.5;
			vertexData[offset++] = 0.5;
			vertexData[offset++] = extendedStartX - normalX;
			vertexData[offset++] = extendedStartY - normalY;
			vertexData[offset++] = 0.5;
			vertexData[offset++] = 0.5;
			vertexData[offset++] = extendedStartX - normalX;
			vertexData[offset++] = extendedStartY - normalY;
			vertexData[offset++] = 0.5;
			vertexData[offset++] = 0.5;
			vertexData[offset++] = extendedEndX + normalX;
			vertexData[offset++] = extendedEndY + normalY;
			vertexData[offset++] = 0.5;
			vertexData[offset++] = 0.5;
			vertexData[offset++] = extendedEndX - normalX;
			vertexData[offset++] = extendedEndY - normalY;
			vertexData[offset++] = 0.5;
			vertexData[offset++] = 0.5;
			vertexCount += 6;
		}

		const strokeColor = this.getStrokeColor();
		this.drawVertices(vertexCount, this.getWhiteTexture(), strokeColor);
	}

	//==============================================================================
	// 사각형 출력.
	// - setFillColor()
	//==============================================================================
	/**
	 * @param { Rect } rect
	 */
	drawRect(rect) {
		const leftX = rect.position.x;
		const topY = rect.position.y;
		const rightX = leftX + rect.size.x;
		const bottomY = topY + rect.size.y;
		const vertexCountOffset = this.writeQuad(0, leftX, topY, rightX, bottomY, 0.5, 0.5, 0.5, 0.5);
		const fillColor = this.getFillColor();
		this.drawVertices(vertexCountOffset / FLOATS_PER_VERTEX, this.getWhiteTexture(), fillColor);
	}

	//==============================================================================
	// 사각형 외곽선 출력. (Canvas2D strokeRect 대응 — 선 중심이 경계선 위)
	// - setStrokeColor()
	//==============================================================================
	/**
	 * @param { Rect } rect
	 * @param { number } lineWidth
	 */
	drawStrokeRect(rect, lineWidth = 1) {
		const leftX = rect.position.x;
		const topY = rect.position.y;
		const rightX = leftX + rect.size.x;
		const bottomY = topY + rect.size.y;
		const positions = [
			Vector2.create(leftX, topY),
			Vector2.create(rightX, topY),
			Vector2.create(rightX, bottomY),
			Vector2.create(leftX, bottomY),
		];
		this.drawLineLoop(positions, lineWidth);
	}

	//==============================================================================
	// 라운드 사각형 경로 좌표 목록 생성. (시계 방향, 볼록 다각형)
	//==============================================================================
	/**
	 * @param { Rect } rect
	 * @param { number } roundSize
	 * @returns { Vector2[] }
	 */
	buildRoundRectPositions(rect, roundSize) {
		const leftX = rect.position.x;
		const topY = rect.position.y;
		const rightX = leftX + rect.size.x;
		const bottomY = topY + rect.size.y;
		const clampedRoundSize = Math.min(roundSize, Math.min(Math.abs(rect.size.x), Math.abs(rect.size.y)) / 2);

		// 코너 중심 4개. (우상 → 우하 → 좌하 → 좌상)
		const cornerCenters = [
			{ x: rightX - clampedRoundSize, y: topY + clampedRoundSize, startRadian: -Math.PI / 2 },
			{ x: rightX - clampedRoundSize, y: bottomY - clampedRoundSize, startRadian: 0 },
			{ x: leftX + clampedRoundSize, y: bottomY - clampedRoundSize, startRadian: Math.PI / 2 },
			{ x: leftX + clampedRoundSize, y: topY + clampedRoundSize, startRadian: Math.PI },
		];

		const positions = [];
		for (const cornerCenter of cornerCenters) {
			for (let segmentIndex = 0; segmentIndex <= CORNER_SEGMENT_COUNT; ++segmentIndex) {
				const radian = cornerCenter.startRadian + (Math.PI / 2) * (segmentIndex / CORNER_SEGMENT_COUNT);
				const positionX = cornerCenter.x + Math.cos(radian) * clampedRoundSize;
				const positionY = cornerCenter.y + Math.sin(radian) * clampedRoundSize;
				positions.push(Vector2.create(positionX, positionY));
			}
		}
		return positions;
	}

	//==============================================================================
	// 볼록 다각형 채움 출력. (첫 점 기준 팬 분할)
	//==============================================================================
	/**
	 * @param { Vector2[] } positions
	 * @param { Color } color
	 */
	drawConvexPolygon(positions, color) {
		if (!positions || positions.length < 3) {
			return;
		}

		const vertexData = this.getVertexData();
		let offset = 0;
		let vertexCount = 0;
		const firstPosition = positions[0];
		for (let positionIndex = 1; positionIndex < positions.length - 1; ++positionIndex) {
			if ((vertexCount + 3) * FLOATS_PER_VERTEX > vertexData.length) {
				break;
			}
			const secondPosition = positions[positionIndex];
			const thirdPosition = positions[positionIndex + 1];
			vertexData[offset++] = firstPosition.x;
			vertexData[offset++] = firstPosition.y;
			vertexData[offset++] = 0.5;
			vertexData[offset++] = 0.5;
			vertexData[offset++] = secondPosition.x;
			vertexData[offset++] = secondPosition.y;
			vertexData[offset++] = 0.5;
			vertexData[offset++] = 0.5;
			vertexData[offset++] = thirdPosition.x;
			vertexData[offset++] = thirdPosition.y;
			vertexData[offset++] = 0.5;
			vertexData[offset++] = 0.5;
			vertexCount += 3;
		}

		this.drawVertices(vertexCount, this.getWhiteTexture(), color);
	}

	//==============================================================================
	// 라운드 사각형 출력.
	// - setFillColor()
	//==============================================================================
	/**
	 * @param { Rect } rect
	 * @param { number } roundSize
	 */
	drawRoundRect(rect, roundSize) {
		if (roundSize > 0) {
			const positions = this.buildRoundRectPositions(rect, roundSize);
			const fillColor = this.getFillColor();
			this.drawConvexPolygon(positions, fillColor);
		}
		else {
			this.drawRect(rect);
		}
	}

	//==============================================================================
	// 라운드 사각형 외곽선 출력.
	// - setStrokeColor()
	//==============================================================================
	/**
	 * @param { Rect } rect
	 * @param { number } roundSize
	 * @param { number } lineWidth
	 */
	drawStrokeRoundRect(rect, roundSize, lineWidth = 1) {
		if (roundSize > 0) {
			const positions = this.buildRoundRectPositions(rect, roundSize);
			this.drawLineLoop(positions, lineWidth);
		}
		else {
			this.drawStrokeRect(rect, lineWidth);
		}
	}

	//==============================================================================
	// 원 출력.
	// - setFillColor()
	//==============================================================================
	/**
	 * @param { Vector2 } center
	 * @param { number } radius
	 */
	drawCircle(center, radius) {
		if (radius <= 0) {
			return;
		}

		// 화면상 크기에 비례한 분할 수. (16 ~ 64)
		const maximumScale = this.#transformMatrix.getMaximumScale();
		const segmentCount = Math.clamp(Math.ceil(radius * maximumScale * 0.5), 16, 64);
		const positions = [];
		for (let segmentIndex = 0; segmentIndex < segmentCount; ++segmentIndex) {
			const radian = (Math.PI * 2) * (segmentIndex / segmentCount);
			const positionX = center.x + Math.cos(radian) * radius;
			const positionY = center.y + Math.sin(radian) * radius;
			positions.push(Vector2.create(positionX, positionY));
		}

		const fillColor = this.getFillColor();
		this.drawConvexPolygon(positions, fillColor);
	}

	//==============================================================================
	// 원 외곽선 출력.
	// - setStrokeColor()
	//==============================================================================
	/**
	 * @param { Vector2 } center
	 * @param { number } radius
	 * @param { number } lineWidth
	 */
	drawStrokeCircle(center, radius, lineWidth = 1) {
		if (radius <= 0) {
			return;
		}

		// 화면상 크기에 비례한 분할 수. (16 ~ 64)
		const maximumScale = this.#transformMatrix.getMaximumScale();
		const segmentCount = Math.clamp(Math.ceil(radius * maximumScale * 0.5), 16, 64);
		const positions = [];
		for (let segmentIndex = 0; segmentIndex < segmentCount; ++segmentIndex) {
			const radian = (Math.PI * 2) * (segmentIndex / segmentCount);
			const positionX = center.x + Math.cos(radian) * radius;
			const positionY = center.y + Math.sin(radian) * radius;
			positions.push(Vector2.create(positionX, positionY));
		}

		this.drawLineLoop(positions, lineWidth);
	}

	//==============================================================================
	// 이미지 출력.
	// - setFillColor() Not Supported.
	//==============================================================================
	/**
	 * @param { HTMLImageElement | HTMLCanvasElement } image
	 * @param { Vector2 } position
	 * @param { Vector2 } contentSize
	 */
	drawImage(image, position, contentSize) {
		if (image === null || image === undefined){
			throw new Error("image is null");
		}

		this.drawImageWithSourceAndDestination(image,
			0, 0, image.width, image.height,
			position.x, position.y, contentSize.x, contentSize.y);
	}

	//==============================================================================
	// 이미지의 일부만 출력.
	// - setFillColor() Not Supported.
	//==============================================================================
	/**
	 * @param { HTMLImageElement | HTMLCanvasElement } image
	 * @param { Vector2 } position
	 * @param { Vector2 } contentSize
	 * @param { Rect } imageRect
	 */
	drawImageWithImageRect(image, position, contentSize, imageRect) {
		if (image === null || image === undefined){
			throw new Error("image is null");
		}

		if (imageRect === null || imageRect === undefined || imageRect.equals(Rect.zero())) {
			imageRect = Rect.create(0, 0, image.width, image.height);
		}

		this.drawImageWithSourceAndDestination(image,
			imageRect.position.x, imageRect.position.y, imageRect.size.x, imageRect.size.y,
			position.x, position.y, contentSize.x, contentSize.y);
	}

	//==============================================================================
	// 이미지의 소스 영역을 지정 영역에 출력. (Canvas2D drawImage 9인자 대응)
	//==============================================================================
	/**
	 * @param { HTMLImageElement | HTMLCanvasElement } image
	 * @param { number } sourceX
	 * @param { number } sourceY
	 * @param { number } sourceWidth
	 * @param { number } sourceHeight
	 * @param { number } destinationX
	 * @param { number } destinationY
	 * @param { number } destinationWidth
	 * @param { number } destinationHeight
	 */
	drawImageWithSourceAndDestination(image, sourceX, sourceY, sourceWidth, sourceHeight, destinationX, destinationY, destinationWidth, destinationHeight) {
		const imageTextureCache = this.getImageTextureCache();
		const isImageSmoothingEnabled = this.isImageSmoothingEnabled();
		const texture = imageTextureCache.getTexture(image, isImageSmoothingEnabled);
		if (!texture) {
			return;
		}

		const imageWidth = image.width;
		const imageHeight = image.height;
		const leftU = sourceX / imageWidth;
		const topV = sourceY / imageHeight;
		const rightU = (sourceX + sourceWidth) / imageWidth;
		const bottomV = (sourceY + sourceHeight) / imageHeight;
		const vertexCountOffset = this.writeQuad(0,
			destinationX, destinationY,
			destinationX + destinationWidth, destinationY + destinationHeight,
			leftU, topV, rightU, bottomV);
		const whiteColor = this.getWhiteColor();
		this.drawVertices(vertexCountOffset / FLOATS_PER_VERTEX, texture, whiteColor);
	}

	//==============================================================================
	// 이미지 나인패치 출력.
	// - setFillColor() Not Supported.
	//==============================================================================
	/**
	 * @static
	 * @param { HTMLImageElement | HTMLCanvasElement } image
	 * @param { Vector2 } position
	 * @param { Vector2 } size
	 * @param { Rect } nineSlice
	 */
	drawImageWithNineSlice(image, position, size, nineSlice) {
		const sw = image.width;
		const sh = image.height;
		const dx = Math.floor(position.x);
		const dy = Math.floor(position.y);
		const left = nineSlice.position.x;
		const top = nineSlice.position.y;
		const right = nineSlice.size.x;
		const bottom = nineSlice.size.y;

		// 최소 사이즈 제한 적용.
		const dw = Math.max(Math.ceil(size.x), left + right);
		const dh = Math.max(Math.ceil(size.y), top + bottom);

		const hasHorizontal = left > 0 || right > 0;
		const hasVertical = top > 0 || bottom > 0;

		if (hasHorizontal && hasVertical) {
			// 가로세로 다 쪼개기.
			const centerSrcW = sw - left - right;
			const centerSrcH = sh - top - bottom;
			const centerDstW = dw - left - right;
			const centerDstH = dh - top - bottom;

			// 위쪽.
			this.drawImageWithSourceAndDestination(image, 0, 0, left, top, dx, dy, left + 1, top + 1);
			this.drawImageWithSourceAndDestination(image, left, 0, centerSrcW, top, dx + left, dy, centerDstW + 1, top + 1);
			this.drawImageWithSourceAndDestination(image, sw - right, 0, right, top, dx + dw - right, dy, right, top + 1);

			// 가운데쪽.
			this.drawImageWithSourceAndDestination(image, 0, top, left, centerSrcH, dx, dy + top, left + 1, centerDstH + 1);
			this.drawImageWithSourceAndDestination(image, left, top, centerSrcW, centerSrcH, dx + left, dy + top, centerDstW + 1, centerDstH + 1);
			this.drawImageWithSourceAndDestination(image, sw - right, top, right, centerSrcH, dx + dw - right, dy + top, right, centerDstH + 1);

			// 아래쪽.
			this.drawImageWithSourceAndDestination(image, 0, sh - bottom, left, bottom, dx, dy + dh - bottom, left + 1, bottom);
			this.drawImageWithSourceAndDestination(image, left, sh - bottom, centerSrcW, bottom, dx + left, dy + dh - bottom, centerDstW + 1, bottom);
			this.drawImageWithSourceAndDestination(image, sw - right, sh - bottom, right, bottom, dx + dw - right, dy + dh - bottom, right, bottom);
		}
		else if (hasHorizontal) {
			// 가로만 쪼개기.
			const centerSrcW = sw - left - right;
			const centerDstW = dw - left - right;

			this.drawImageWithSourceAndDestination(image, 0, 0, left, sh, dx, dy, left + 1, dh);
			this.drawImageWithSourceAndDestination(image, left, 0, centerSrcW, sh, dx + left, dy, centerDstW + 1, dh);
			this.drawImageWithSourceAndDestination(image, sw - right, 0, right, sh, dx + dw - right, dy, right, dh);
		}
		else if (hasVertical) {
			// 세로만 쪼개기.
			const centerSrcH = sh - top - bottom;
			const centerDstH = dh - top - bottom;

			this.drawImageWithSourceAndDestination(image, 0, 0, sw, top, dx, dy, dw, top + 1);
			this.drawImageWithSourceAndDestination(image, 0, top, sw, centerSrcH, dx, dy + top, dw, centerDstH + 1);
			this.drawImageWithSourceAndDestination(image, 0, sh - bottom, sw, bottom, dx, dy + dh - bottom, dw, bottom);
		}
		else {
			// 쪼개기 없음.
			this.drawImageWithSourceAndDestination(image, 0, 0, sw, sh, dx, dy, dw, dh);
		}
	}

	//==============================================================================
	// 폰트 문자열 설정. (Canvas2D font 대응, 예: "16px DOSGothic")
	//==============================================================================
	/**
	 * @param { string } fontString
	 */
	setFontString(fontString) {
		if (fontString) {
			this.#fontString = fontString;
		}
	}

	//==============================================================================
	// 폰트 문자열 반환.
	//==============================================================================
	/**
	 * @returns { string }
	 */
	getFontString() {
		return this.#fontString;
	}

	//==============================================================================
	// 텍스트 가로 정렬 설정. ("left" | "center" | "right" | "start" | "end")
	//==============================================================================
	/**
	 * @param { string } textAlign
	 */
	setTextAlign(textAlign) {
		if (textAlign) {
			this.#textAlign = textAlign;
		}
	}

	//==============================================================================
	// 텍스트 가로 정렬 반환.
	//==============================================================================
	/**
	 * @returns { string }
	 */
	getTextAlign() {
		return this.#textAlign;
	}

	//==============================================================================
	// 텍스트 베이스라인 설정. ("top" | "hanging" | "middle" | "alphabetic" | "ideographic" | "bottom")
	//==============================================================================
	/**
	 * @param { string } textBaseline
	 */
	setTextBaseline(textBaseline) {
		if (textBaseline) {
			this.#textBaseline = textBaseline;
		}
	}

	//==============================================================================
	// 텍스트 베이스라인 반환.
	//==============================================================================
	/**
	 * @returns { string }
	 */
	getTextBaseline() {
		return this.#textBaseline;
	}

	//==============================================================================
	// 문자열 측정. (현재 폰트 기준, Canvas2D measureText 대응)
	//==============================================================================
	/**
	 * @param { string } text
	 * @returns { TextMetrics }
	 */
	measureText(text) {
		const textStringTextureCache = this.getTextStringTextureCache();
		const fontString = this.getFontString();
		return textStringTextureCache.measureText(fontString, text);
	}

	//==============================================================================
	// 텍스트 베이크 스케일 계산. (현재 변환 행렬 기반, 0.25 단위 양자화)
	//==============================================================================
	/**
	 * @returns { number }
	 */
	calculateTextBakeScale(){
		const maximumScale = this.#transformMatrix.getMaximumScale();
		const quantizedScale = Math.round(maximumScale * 4) / 4;
		return Math.clamp(quantizedScale, 0.25, MAXIMUM_TEXT_BAKE_SCALE);
	}

	//==============================================================================
	// 문자열 텍스처 엔트리를 정렬/베이스라인에 맞춰 쿼드로 출력.
	//==============================================================================
	/**
	 * @param { object } entry
	 * @param { number } x
	 * @param { number } y
	 * @param { Color | null } color - 흰색으로 구운 글자에 곱할 색. (null 이면 흰색 그대로)
	 */
	drawTextEntry(entry, x, y, color = null) {
		// 가로 정렬 오프셋.
		const textAlign = this.getTextAlign();
		let alignOffset = 0;
		if (textAlign === "center") {
			alignOffset = -entry.advanceWidth / 2;
		}
		else if (textAlign === "right" || textAlign === "end") {
			alignOffset = -entry.advanceWidth;
		}

		// 요청 베이스라인 → 알파벳 베이스라인 오프셋.
		const textBaseline = this.getTextBaseline();
		let baselineOffset = 0;
		if (textBaseline === "top") {
			baselineOffset = entry.fontAscent;
		}
		else if (textBaseline === "hanging") {
			baselineOffset = entry.fontAscent * 0.8;
		}
		else if (textBaseline === "middle") {
			baselineOffset = (entry.fontAscent - entry.fontDescent) / 2;
		}
		else if (textBaseline === "ideographic" || textBaseline === "bottom") {
			baselineOffset = -entry.fontDescent;
		}

		const quadX = x + alignOffset - entry.penOffsetX;
		const quadY = y + baselineOffset - entry.baselineOffsetY;
		const vertexCountOffset = this.writeQuad(0,
			quadX, quadY,
			quadX + entry.quadWidth, quadY + entry.quadHeight,
			0, 0, 1, 1);
		const whiteColor = this.getWhiteColor();
		this.drawVertices(vertexCountOffset / FLOATS_PER_VERTEX, entry.texture, color ? color : whiteColor);
	}

	//==============================================================================
	// 텍스트 채움 출력. (Canvas2D fillText 대응)
	// - setFillColor() / setFontString() / setTextAlign() / setTextBaseline()
	//==============================================================================
	/**
	 * @param { string } text
	 * @param { number } x
	 * @param { number } y
	 */
	drawFillText(text, x, y) {
		if (!text) {
			return;
		}

		// 글자는 흰색으로 굽고 그릴 때 색을 곱한다. (색이 바뀌어도 다시 굽지 않는다 — 틴트 전환 / 색 애니메이션)
		const textStringTextureCache = this.getTextStringTextureCache();
		const fontString = this.getFontString();
		const fillColor = this.getFillColor();
		const bakeScale = this.calculateTextBakeScale();
		const entry = textStringTextureCache.getEntry("fill", text, fontString, "#ffffff", 0, bakeScale);
		if (!entry) {
			return;
		}

		this.drawTextEntry(entry, x, y, fillColor);
	}

	//==============================================================================
	// 텍스트 외곽선 출력. (Canvas2D strokeText 대응)
	// - setStrokeColor() / setFontString() / setTextAlign() / setTextBaseline()
	//==============================================================================
	/**
	 * @param { string } text
	 * @param { number } x
	 * @param { number } y
	 * @param { number } lineWidth
	 */
	drawStrokeText(text, x, y, lineWidth = 1) {
		if (!text) {
			return;
		}

		const textStringTextureCache = this.getTextStringTextureCache();
		const fontString = this.getFontString();
		const strokeColor = this.getStrokeColor();
		const bakeScale = this.calculateTextBakeScale();
		const entry = textStringTextureCache.getEntry("stroke", text, fontString, "#ffffff", lineWidth, bakeScale);
		if (!entry) {
			return;
		}

		this.drawTextEntry(entry, x, y, strokeColor);
	}

	//==============================================================================
	// 노드 출력.
	//==============================================================================
	/**
	 * @param { TransformNode } node
	 */
	drawNode(node) {
		if (node === null || node == undefined || !node.isActive()) {
			return;
		}

		try {
			node.pushTransform(this);
			node.draw(this);

			const isForceGizmosVisible = this.isForceGizmosVisible();
			const isGizmoVisible = isForceGizmosVisible || node.isGizmoVisible();
			if (isGizmoVisible) {
				node.drawGizmos(this);
			}
			node.popTransform(this);
		}
		catch (error) {
			throw error;
		}
	}

	//==============================================================================
	// 출력 영역 제한 시작.
	// - 스텐실 버퍼 기반이라 회전/스케일이 걸린 영역도 정확히 잘린다.
	//==============================================================================
	/**
	 * @type { Rect } rect
	 */
	beginClipRect(rect) {
		// 상태 저장. (Canvas2D save 대응)
		this.pushState();

		const webGL2RenderingContext = this.getWebGL2RenderingContext();
		const previousClipDepth = this.#clipStack.length;
		this.#clipStack.push({
			rect: rect.clone(),
			transformMatrix: this.#transformMatrix.clone(),
		});

		if (previousClipDepth === 0) {
			webGL2RenderingContext.enable(webGL2RenderingContext.STENCIL_TEST);
		}

		// 스텐실에 클립 영역 기록. (색상 출력 없이 INCR)
		webGL2RenderingContext.colorMask(false, false, false, false);
		webGL2RenderingContext.stencilFunc(webGL2RenderingContext.ALWAYS, 0, 0xFF);
		webGL2RenderingContext.stencilOp(webGL2RenderingContext.KEEP, webGL2RenderingContext.KEEP, webGL2RenderingContext.INCR);
		this.drawRect(rect);
		webGL2RenderingContext.colorMask(true, true, true, true);
		webGL2RenderingContext.stencilOp(webGL2RenderingContext.KEEP, webGL2RenderingContext.KEEP, webGL2RenderingContext.KEEP);
		webGL2RenderingContext.stencilFunc(webGL2RenderingContext.EQUAL, previousClipDepth + 1, 0xFF);
	}

	//==============================================================================
	// 출력 영역 제한 종료.
	//==============================================================================
	endClipRect() {
		const clipEntry = this.#clipStack.pop();
		if (!clipEntry) {
			return;
		}

		const webGL2RenderingContext = this.getWebGL2RenderingContext();

		// 기록 시점의 변환 행렬로 같은 영역을 DECR 해 스텐실 원복.
		// (begin 과 end 사이에 변환이 바뀌었을 수 있으므로 스냅샷 사용)
		this.#transformMatrix = clipEntry.transformMatrix;
		webGL2RenderingContext.colorMask(false, false, false, false);
		webGL2RenderingContext.stencilFunc(webGL2RenderingContext.ALWAYS, 0, 0xFF);
		webGL2RenderingContext.stencilOp(webGL2RenderingContext.KEEP, webGL2RenderingContext.KEEP, webGL2RenderingContext.DECR);
		this.drawRect(clipEntry.rect);
		webGL2RenderingContext.colorMask(true, true, true, true);
		webGL2RenderingContext.stencilOp(webGL2RenderingContext.KEEP, webGL2RenderingContext.KEEP, webGL2RenderingContext.KEEP);

		const clipDepth = this.#clipStack.length;
		if (clipDepth === 0) {
			webGL2RenderingContext.disable(webGL2RenderingContext.STENCIL_TEST);
		}
		else {
			webGL2RenderingContext.stencilFunc(webGL2RenderingContext.EQUAL, clipDepth, 0xFF);
		}

		// 상태 복원. (Canvas2D restore 대응)
		this.popState();
	}

	//==============================================================================
	// 캔버스 반환.
	//==============================================================================
	/**
	 * @returns { HTMLCanvasElement }
	 */
	getCanvas() {
		return this.#canvas;
	}

	//==============================================================================
	// WebGL2 렌더링 컨텍스트 반환.
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
		if (this.#shaderProgramOverride) {
			return this.#shaderProgramOverride;
		}
		return this.#shaderProgram;
	}

	//==============================================================================
	// 셰이더 프로그램 바꿔 끼우기. (null 이면 기본 프로그램으로 복귀)
	// - 기본 프로그램과 같은 어트리뷰트 위치 / 유니폼 이름(projectionMatrix, modelMatrix, mainColor, tintColor, globalAlpha, mainTexture)을 갖춰야 한다.
	//==============================================================================
	/**
	 * @param { ShaderProgram | null } shaderProgram
	 */
	setShaderProgramOverride(shaderProgram) {
		this.#shaderProgramOverride = shaderProgram;
		const webGL2RenderingContext = this.getWebGL2RenderingContext();
		const activeShaderProgram = this.getShaderProgram();
		activeShaderProgram.use();
		const projectionMatrixLocation = activeShaderProgram.getUniformLocation("projectionMatrix");
		webGL2RenderingContext.uniformMatrix3fv(projectionMatrixLocation, false, this.#projectionMatrixArray);
		const mainTextureLocation = activeShaderProgram.getUniformLocation("mainTexture");
		webGL2RenderingContext.uniform1i(mainTextureLocation, 0);
	}

	//==============================================================================
	// 렌더 상태 복구. (외부 WebGL 패스가 프로그램 / 버텍스 어레이 / 뷰포트를 바꾼 뒤 Graphic 출력을 이어갈 때)
	//==============================================================================
	restoreRenderState() {
		const webGL2RenderingContext = this.getWebGL2RenderingContext();
		webGL2RenderingContext.viewport(0, 0, this.#appliedViewportWidth, this.#appliedViewportHeight);
		const shaderProgram = this.getShaderProgram();
		shaderProgram.use();
		webGL2RenderingContext.bindVertexArray(this.getVertexArray());
		webGL2RenderingContext.bindBuffer(webGL2RenderingContext.ARRAY_BUFFER, this.getVertexBuffer());
		const projectionMatrixLocation = shaderProgram.getUniformLocation("projectionMatrix");
		webGL2RenderingContext.uniformMatrix3fv(projectionMatrixLocation, false, this.#projectionMatrixArray);
		const mainTextureLocation = shaderProgram.getUniformLocation("mainTexture");
		webGL2RenderingContext.uniform1i(mainTextureLocation, 0);
		webGL2RenderingContext.activeTexture(webGL2RenderingContext.TEXTURE0);
		webGL2RenderingContext.enable(webGL2RenderingContext.BLEND);
		webGL2RenderingContext.disable(webGL2RenderingContext.DEPTH_TEST);
		webGL2RenderingContext.disable(webGL2RenderingContext.CULL_FACE);
		const blendMode = this.getBlendMode();
		this.setBlendMode(blendMode);
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

	//==============================================================================
	// 버텍스 버퍼 반환.
	//==============================================================================
	/**
	 * @returns { WebGLBuffer }
	 */
	getVertexBuffer() {
		return this.#vertexBuffer;
	}

	//==============================================================================
	// 스크래치 버텍스 데이터 반환.
	//==============================================================================
	/**
	 * @returns { Float32Array }
	 */
	getVertexData() {
		return this.#vertexData;
	}

	//==============================================================================
	// 흰색 텍스처 반환. (단색 도형용)
	//==============================================================================
	/**
	 * @returns { WebGLTexture }
	 */
	getWhiteTexture() {
		return this.#whiteTexture;
	}

	//==============================================================================
	// 흰색 색상 반환. (이미지/텍스트 출력용 기본 색상)
	//==============================================================================
	/**
	 * @returns { Color }
	 */
	getWhiteColor() {
		return this.#whiteColor;
	}

	//==============================================================================
	// 이미지 텍스처 캐시 반환.
	//==============================================================================
	/**
	 * @returns { ImageTextureCache }
	 */
	getImageTextureCache() {
		return this.#imageTextureCache;
	}

	//==============================================================================
	// 문자열 텍스처 캐시 반환.
	//==============================================================================
	/**
	 * @returns { TextStringTextureCache }
	 */
	getTextStringTextureCache() {
		return this.#textStringTextureCache;
	}
}
