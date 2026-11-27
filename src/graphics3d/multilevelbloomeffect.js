//==============================================================================
// 포함 모듈 목록.
//==============================================================================
const System = globalThis;
import { Object } from "../base/object.js";
import { RenderTarget } from "./rendertarget.js";
import { FullscreenPass } from "../core/fullscreenpass.js";


//==============================================================================
// 전역 상수 목록.
//==============================================================================
// 밝은 몫 뽑기. (반 크기로 줄이며 원본 네 점을 고르게, 밝기는 세 채널 가운데 가장 큰 값, 문턱 둘레는 부드러운 무릎)
const EXTRACT_FRAGMENTSHADER_SOURCE = `#version 300 es
precision highp float;
in vec2 fragmentTextureCoordinate;
uniform sampler2D sourceTexture;
uniform vec2 sourceTexel;
uniform float threshold;
uniform float knee;
out vec4 outputColor;
vec3 readSource(vec2 offset) {
	return max(texture(sourceTexture, fragmentTextureCoordinate + sourceTexel * offset).rgb, vec3(0.0));
}
void main() {
	vec3 color = (readSource(vec2(-0.5, -0.5)) + readSource(vec2(0.5, -0.5)) + readSource(vec2(-0.5, 0.5)) + readSource(vec2(0.5, 0.5))) * 0.25;
	float brightness = max(color.r, max(color.g, color.b));
	float soft = clamp(brightness - threshold + knee, 0.0, 2.0 * knee);
	soft = soft * soft / (4.0 * knee + 0.00001);
	float contribution = max(soft, brightness - threshold) / max(brightness, 0.00001);
	outputColor = vec4(color * contribution, 1.0);
}
`;

// 반으로 줄이기. (가운데 넷과 네 귀를 섞는 이중 거르개)
const DOWNSAMPLE_FRAGMENTSHADER_SOURCE = `#version 300 es
precision highp float;
in vec2 fragmentTextureCoordinate;
uniform sampler2D sourceTexture;
uniform vec2 sourceTexel;
out vec4 outputColor;
void main() {
	vec3 color = texture(sourceTexture, fragmentTextureCoordinate).rgb * 4.0;
	color += texture(sourceTexture, fragmentTextureCoordinate + sourceTexel * vec2(-1.0, -1.0)).rgb;
	color += texture(sourceTexture, fragmentTextureCoordinate + sourceTexel * vec2(1.0, -1.0)).rgb;
	color += texture(sourceTexture, fragmentTextureCoordinate + sourceTexel * vec2(-1.0, 1.0)).rgb;
	color += texture(sourceTexture, fragmentTextureCoordinate + sourceTexel * vec2(1.0, 1.0)).rgb;
	outputColor = vec4(color / 8.0, 1.0);
}
`;

// 두 배로 키우기. (천막 꼴 아홉 점, 더하기 섞기로 위 단에 얹는다)
const UPSAMPLE_FRAGMENTSHADER_SOURCE = `#version 300 es
precision highp float;
in vec2 fragmentTextureCoordinate;
uniform sampler2D sourceTexture;
uniform vec2 sourceTexel;
out vec4 outputColor;
void main() {
	vec2 offset = sourceTexel;
	vec3 color = texture(sourceTexture, fragmentTextureCoordinate).rgb * 4.0;
	color += (texture(sourceTexture, fragmentTextureCoordinate + vec2(-offset.x, 0.0)).rgb + texture(sourceTexture, fragmentTextureCoordinate + vec2(offset.x, 0.0)).rgb + texture(sourceTexture, fragmentTextureCoordinate + vec2(0.0, -offset.y)).rgb + texture(sourceTexture, fragmentTextureCoordinate + vec2(0.0, offset.y)).rgb) * 2.0;
	color += texture(sourceTexture, fragmentTextureCoordinate + vec2(-offset.x, -offset.y)).rgb + texture(sourceTexture, fragmentTextureCoordinate + vec2(offset.x, -offset.y)).rgb + texture(sourceTexture, fragmentTextureCoordinate + vec2(-offset.x, offset.y)).rgb + texture(sourceTexture, fragmentTextureCoordinate + vec2(offset.x, offset.y)).rgb;
	outputColor = vec4(color / 16.0, 1.0);
}
`;


//==============================================================================
// 다단 블룸 이펙트. (밝은 몫을 반 크기로 뽑아 반씩 줄여 가며 흐리고, 거꾸로 두 배씩 키우며 위 단에 더한다)
// - 단 하나는 앞 단의 반 크기다. 첫 단(씬의 반 크기)이 결과다. (getResultTexture)
// - 뽑기: 원본 네 점의 평균에서 밝기(세 채널 가운데 가장 큰 값)가 문턱을 넘는 몫. 문턱 둘레 무릎 폭만큼은 부드럽게 들어온다. (setThreshold(문턱, 무릎))
// - 줄이기는 가운데 넷과 네 귀(대각 한 칸)를 섞는 이중 거르개, 키우기는 천막 꼴 아홉 점이다.
// - 판은 useFloatColor 면 RGBA16F 라 1 을 넘는 밝은 값이 그대로 흐려진다. (HDR 씬에 쓴다, RGBA8 이면 1 에서 잘린다)
// - 사용: resize(씬 너비, 높이) → render(씬 텍스처) → getResultTexture() 를 합성 패스에서 세기를 곱해 더한다.
// - 부수 효과: 깊이 시험과 섞기를 끄고, TEXTURE0 을 활성으로, 프레임버퍼 바인드가 바뀐다. 섞기 함수는 앞의 것으로 돌린다.
//==============================================================================
/**
 * @example <caption>HDR 씬 텍스처에서 다단 블룸 뽑기</caption>
 * import { MultiLevelBloomEffect, RenderTarget } from "./build/vanilla.js";
 *
 * const width = 640;
 * const height = 360;
 * const canvas = document.createElement("canvas");
 * const webGL2RenderingContext = canvas.getContext("webgl2");
 * const sceneRenderTarget = new RenderTarget(webGL2RenderingContext, width, height, true, { useFloatColor: true });
 * sceneRenderTarget.bind();
 * webGL2RenderingContext.clearColor(2.0, 1.5, 0.5, 1.0);
 * webGL2RenderingContext.clear(webGL2RenderingContext.COLOR_BUFFER_BIT | webGL2RenderingContext.DEPTH_BUFFER_BIT);
 *
 * const multiLevelBloomEffect = new MultiLevelBloomEffect(webGL2RenderingContext, 5, true);
 * multiLevelBloomEffect.resize(width, height);
 * multiLevelBloomEffect.setThreshold(1.0, 0.5);
 * const sceneColorTexture = sceneRenderTarget.getColorTexture();
 * multiLevelBloomEffect.render(sceneColorTexture);
 * const bloomTexture = multiLevelBloomEffect.getResultTexture();
 * const levelCount = multiLevelBloomEffect.getLevelCount();
 * console.log(levelCount, bloomTexture !== null);
 * multiLevelBloomEffect.destroy();
 * sceneRenderTarget.destroy();
 */
export class MultiLevelBloomEffect extends Object {
	//==============================================================================
	// 멤버 변수 목록.
	//==============================================================================
	/** @private @type { WebGL2RenderingContext } */ #webGL2RenderingContext;
	/** @private @type { FullscreenPass } */ #extractPass;
	/** @private @type { FullscreenPass } */ #downsamplePass;
	/** @private @type { FullscreenPass } */ #upsamplePass;
	/** @private @type { Array<RenderTarget> } */ #levelRenderTargetList; // 단마다의 판. (첫 단이 씬의 반 크기)
	/** @private @type { number } */ #levelCount;
	/** @private @type { boolean } */ #useFloatColor;
	/** @private @type { number } */ #threshold; // 뽑는 문턱. (밝기)
	/** @private @type { number } */ #knee; // 문턱 둘레의 부드러운 폭.
	/** @private @type { number } */ #sceneWidth;
	/** @private @type { number } */ #sceneHeight;

	//==============================================================================
	// 생성. (단 수, 실수 판인지)
	//==============================================================================
	/**
	 * @constructor
	 * @param { WebGL2RenderingContext } webGL2RenderingContext WebGL2 렌더링 컨텍스트.
	 * @param { number } [levelCount] 기본 5.
	 * @param { boolean } [useFloatColor] 기본 true.
	 */
	constructor(webGL2RenderingContext, levelCount = 5, useFloatColor = true) {
		super();

		this.#webGL2RenderingContext = webGL2RenderingContext;
		this.#extractPass = new FullscreenPass(webGL2RenderingContext, EXTRACT_FRAGMENTSHADER_SOURCE);
		this.#downsamplePass = new FullscreenPass(webGL2RenderingContext, DOWNSAMPLE_FRAGMENTSHADER_SOURCE);
		this.#upsamplePass = new FullscreenPass(webGL2RenderingContext, UPSAMPLE_FRAGMENTSHADER_SOURCE);
		this.#levelRenderTargetList = [];
		this.#levelCount = System.Math.max(1, System.Math.floor(levelCount));
		this.#useFloatColor = useFloatColor;
		this.#threshold = 1;
		this.#knee = 0.25;
		this.#sceneWidth = 2;
		this.#sceneHeight = 2;
		this.createLevels();
	}

	//==============================================================================
	// 단마다의 판 다시 짓기. (씬 크기와 단 수로)
	//==============================================================================
	createLevels() {
		this.destroyLevels();
		const webGL2RenderingContext = this.getWebGL2RenderingContext();
		const levelRenderTargetList = [];
		let levelWidth = this.#sceneWidth;
		let levelHeight = this.#sceneHeight;
		for (let levelIndex = 0; levelIndex < this.#levelCount; ++levelIndex) {
			levelWidth = System.Math.max(1, System.Math.floor(levelWidth / 2));
			levelHeight = System.Math.max(1, System.Math.floor(levelHeight / 2));
			levelRenderTargetList.push(new RenderTarget(webGL2RenderingContext, levelWidth, levelHeight, false, { useFloatColor: this.#useFloatColor }));
		}
		this.#levelRenderTargetList = levelRenderTargetList;
	}

	//==============================================================================
	// 단마다의 판 지우기.
	//==============================================================================
	destroyLevels() {
		for (const levelRenderTarget of this.#levelRenderTargetList) {
			levelRenderTarget.destroy();
		}
		this.#levelRenderTargetList = [];
	}

	//==============================================================================
	// 크기 변경. (씬 해상도 기준, 같으면 그대로)
	//==============================================================================
	/**
	 * @param { number } sceneWidth 씬 가로 크기. (픽셀, 1 밑은 1, 첫 단은 그 반)
	 * @param { number } sceneHeight 씬 세로 크기. (픽셀, 1 밑은 1, 첫 단은 그 반)
	 */
	resize(sceneWidth, sceneHeight) {
		const safeWidth = System.Math.max(1, sceneWidth);
		const safeHeight = System.Math.max(1, sceneHeight);
		if (safeWidth === this.#sceneWidth && safeHeight === this.#sceneHeight) {
			return;
		}
		this.#sceneWidth = safeWidth;
		this.#sceneHeight = safeHeight;
		this.createLevels();
	}

	//==============================================================================
	// 단 수 설정. (1 이상, 같으면 그대로)
	//==============================================================================
	/**
	 * @param { number } levelCount 단 수. (소수는 버리고 1 밑은 1)
	 */
	setLevelCount(levelCount) {
		const safeLevelCount = System.Math.max(1, System.Math.floor(levelCount));
		if (safeLevelCount === this.#levelCount) {
			return;
		}
		this.#levelCount = safeLevelCount;
		this.createLevels();
	}

	//==============================================================================
	// 단 수 반환.
	//==============================================================================
	/**
	 * @returns { number } 단 수.
	 */
	getLevelCount() {
		return this.#levelCount;
	}

	//==============================================================================
	// 실수 판 사용 여부 반환.
	//==============================================================================
	/**
	 * @returns { boolean } 단마다의 판이 RGBA16F 면 참.
	 */
	getUseFloatColor() {
		return this.#useFloatColor;
	}

	//==============================================================================
	// 뽑는 문턱 설정. (밝기, 무릎은 문턱 둘레의 부드러운 폭, 0 이면 딱 자름)
	//==============================================================================
	/**
	 * @param { number } threshold 뽑는 문턱 밝기. (세 채널 가운데 가장 큰 값, 0 밑은 0, 기본 1)
	 * @param { number } knee 문턱 둘레의 부드러운 폭. (0 밑은 0, 기본 0.25)
	 */
	setThreshold(threshold, knee) {
		this.#threshold = System.Math.max(0, threshold);
		this.#knee = System.Math.max(0, knee);
	}

	//==============================================================================
	// 블룸 렌더링. (호출 후 결과는 getResultTexture())
	//==============================================================================
	/**
	 * @param { WebGLTexture } sceneColorTexture 밝은 몫을 뽑을 씬 컬러 텍스처.
	 */
	render(sceneColorTexture) {
		const levelRenderTargetList = this.#levelRenderTargetList;
		const levelCount = levelRenderTargetList.length;
		if (levelCount === 0) {
			return;
		}
		const webGL2RenderingContext = this.getWebGL2RenderingContext();
		webGL2RenderingContext.disable(webGL2RenderingContext.DEPTH_TEST);
		webGL2RenderingContext.disable(webGL2RenderingContext.BLEND);
		webGL2RenderingContext.activeTexture(webGL2RenderingContext.TEXTURE0);

		// 1. 밝은 몫을 반 크기로 뽑기. (씬 → 첫 단)
		const extractPass = this.#extractPass;
		const firstRenderTarget = levelRenderTargetList[0];
		firstRenderTarget.bind();
		extractPass.useProgram();
		webGL2RenderingContext.uniform1i(extractPass.getUniformLocation("sourceTexture"), 0);
		webGL2RenderingContext.uniform2f(extractPass.getUniformLocation("sourceTexel"), 1 / this.#sceneWidth, 1 / this.#sceneHeight);
		webGL2RenderingContext.uniform1f(extractPass.getUniformLocation("threshold"), this.#threshold);
		webGL2RenderingContext.uniform1f(extractPass.getUniformLocation("knee"), this.#knee);
		webGL2RenderingContext.bindTexture(webGL2RenderingContext.TEXTURE_2D, sceneColorTexture);
		extractPass.draw();

		// 2. 반씩 줄이기.
		const downsamplePass = this.#downsamplePass;
		downsamplePass.useProgram();
		webGL2RenderingContext.uniform1i(downsamplePass.getUniformLocation("sourceTexture"), 0);
		const downsampleTexelLocation = downsamplePass.getUniformLocation("sourceTexel");
		for (let levelIndex = 1; levelIndex < levelCount; ++levelIndex) {
			const sourceRenderTarget = levelRenderTargetList[levelIndex - 1];
			const targetRenderTarget = levelRenderTargetList[levelIndex];
			targetRenderTarget.bind();
			webGL2RenderingContext.uniform2f(downsampleTexelLocation, 1 / sourceRenderTarget.getWidth(), 1 / sourceRenderTarget.getHeight());
			const sourceTexture = sourceRenderTarget.getColorTexture(0);
			webGL2RenderingContext.bindTexture(webGL2RenderingContext.TEXTURE_2D, sourceTexture);
			downsamplePass.draw();
		}

		// 3. 거꾸로 두 배씩 키우며 위 단에 더하기.
		const blendSourceRGB = webGL2RenderingContext.getParameter(webGL2RenderingContext.BLEND_SRC_RGB);
		const blendDestinationRGB = webGL2RenderingContext.getParameter(webGL2RenderingContext.BLEND_DST_RGB);
		const blendSourceAlpha = webGL2RenderingContext.getParameter(webGL2RenderingContext.BLEND_SRC_ALPHA);
		const blendDestinationAlpha = webGL2RenderingContext.getParameter(webGL2RenderingContext.BLEND_DST_ALPHA);
		const upsamplePass = this.#upsamplePass;
		upsamplePass.useProgram();
		webGL2RenderingContext.uniform1i(upsamplePass.getUniformLocation("sourceTexture"), 0);
		const upsampleTexelLocation = upsamplePass.getUniformLocation("sourceTexel");
		webGL2RenderingContext.enable(webGL2RenderingContext.BLEND);
		webGL2RenderingContext.blendFunc(webGL2RenderingContext.ONE, webGL2RenderingContext.ONE);
		for (let levelIndex = levelCount - 1; levelIndex > 0; --levelIndex) {
			const sourceRenderTarget = levelRenderTargetList[levelIndex];
			const targetRenderTarget = levelRenderTargetList[levelIndex - 1];
			targetRenderTarget.bind();
			webGL2RenderingContext.uniform2f(upsampleTexelLocation, 1 / sourceRenderTarget.getWidth(), 1 / sourceRenderTarget.getHeight());
			const sourceTexture = sourceRenderTarget.getColorTexture(0);
			webGL2RenderingContext.bindTexture(webGL2RenderingContext.TEXTURE_2D, sourceTexture);
			upsamplePass.draw();
		}
		webGL2RenderingContext.disable(webGL2RenderingContext.BLEND);
		webGL2RenderingContext.blendFuncSeparate(blendSourceRGB, blendDestinationRGB, blendSourceAlpha, blendDestinationAlpha);
	}

	//==============================================================================
	// 결과 텍스처 반환. (render() 이후, 첫 단)
	//==============================================================================
	/**
	 * @returns { WebGLTexture | null } 첫 단(씬의 반 크기)의 컬러 텍스처. (단이 없으면 null)
	 */
	getResultTexture() {
		const levelRenderTargetList = this.#levelRenderTargetList;
		if (levelRenderTargetList.length === 0) {
			return null;
		}
		const firstRenderTarget = levelRenderTargetList[0];
		return firstRenderTarget.getColorTexture(0);
	}

	//==============================================================================
	// 파괴. (GL 리소스 해제)
	//==============================================================================
	/**
	 * @override
	 */
	destroy() {
		this.destroyLevels();
		this.#extractPass.destroy();
		this.#downsamplePass.destroy();
		this.#upsamplePass.destroy();
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
}
