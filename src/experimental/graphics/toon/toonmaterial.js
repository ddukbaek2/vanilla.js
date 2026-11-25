//==============================================================================
// 포함 모듈 목록.
//==============================================================================
const System = globalThis;


//==============================================================================
// 전역 상수 목록.
//==============================================================================
// 인스턴스 꼴에 넣을 수 있는 사용자 어트리뷰트 수의 상한. (어트리뷰트 자리 13, 14, 15)
export const TOON_MAXIMUM_INSTANCE_ATTRIBUTES = 3;

// 사용자 인스턴스 어트리뷰트의 첫 자리.
export const TOON_FIRST_INSTANCE_ATTRIBUTE_LOCATION = 13;

// 인스턴스 꼴에서 엔진이 읽는 이름. (행렬 16 은 모형 행렬, 틴트 4 는 곱하는 색)
export const TOON_INSTANCE_MATRIX_NAME = "instanceMatrix";
export const TOON_INSTANCE_TINT_NAME = "instanceTint";

// 섞는 방식. (alpha 는 곧은 알파 SRC_ALPHA, premultiplied 는 미리 곱한 알파 ONE, additive 는 더하기 ONE, ONE)
export const ToonBlendMode = System.Object.freeze({
	alpha: "alpha",
	premultiplied: "premultiplied",
	additive: "additive",
});

// 인스턴스 버퍼의 쓰임. (static 은 한 번 올리고 오래 그림, dynamic 은 자주 고침)
export const ToonBufferUsage = System.Object.freeze({
	static: "static",
	dynamic: "dynamic",
});

// 머티리얼과 인스턴스 꼴마다 다른 번호를 주는 셈. (렌더러의 프로그램 캐시 열쇠)
let nextMaterialId = 1;
let nextInstanceLayoutId = 1;

// 셰이더 이름으로 쓸 수 있는 글자.
const SHADER_NAME_PATTERN = /^[A-Za-z_][A-Za-z0-9_]*$/;


//==============================================================================
// 툰 머티리얼. (ToonRenderer 의 몸 셰이더에 끼울 셰이더 조각, 게임마다의 확장 자리)
// - 엔진의 표준 기능(텍스처, 빛, 틴트, 섞기)으로 되지 않는 무늬나 연출만 조각으로 넣는다. 조각이 없는 칸은 엔진의 빈 함수가 들어간다.
// - uniformChunk: 조각 셰이더의 맨 위 칸에 들어간다. 유니폼, 상수, 함수, 정점 조각이 내보낸 in 을 적는다.
// - surfaceChunk: void applySurface(inout ToonSurface surface) 를 정의한다. 엔진이 꼭짓점 색, 텍스처, 데칼을 셈한 뒤, 틴트와 빛 전에 부른다.
//   ToonSurface { vec3 baseColor (sRGB), float alpha, vec3 emission (선형), vec3 normal (월드, 단위), float glow (꼭짓점 빛남), bool isUnlit,
//                 vec4 detail (꼭짓점 무늬 번호와 무늬 색), vec2 uv, vec3 localPosition (모형 좌표), vec3 worldPosition, vec3 viewDirection (면에서 카메라 쪽, 단위) }
// - lightChunk: void applyLight(ToonSurface surface, inout ToonLighting lighting) 를 정의한다. 엔진이 해, 바탕빛, 채움, 림, 점광, 정반사를 모은 뒤 합치기 전에 부른다.
//   ToonLighting { vec3 irradiance (바탕색에 곱할 빛), vec3 specular (더할 빛), float shadow (0 ~ 1) }
// - vertexChunk: 정점 셰이더(몸, 바깥선, 그림자 깊이 셋 모두)의 맨 위 칸에 들어가고 void applyVertex(inout ToonVertex vertex) 를 정의한다. 월드로 옮기기 전에 부른다.
//   ToonVertex { vec3 localPosition, vec3 localNormal, vec3 color, vec2 material, vec4 detail, vec2 uv, vec4 tint, mat4 modelMatrix }
//   인스턴스 꼴(ToonInstanceLayout)의 사용자 어트리뷰트는 그 이름의 in 으로 읽는다. 셋 모두에 들어가므로 몸에만 있는 out 은 쓰지 않는다. (꼭짓점 어트리뷰트 이름 대신 vertex 의 칸을 쓴다)
//   노멀은 mat3(modelMatrix) 로 옮긴다. 크기가 고르지 않으면 localNormal 을 그 크기의 제곱으로 나눠 둔다.
// - 셰이더에는 엔진의 toLinear(vec3) 와 RECIPROCAL_PI 가 있다.
// - 텍스처는 그리기의 options.textures({ 유니폼 이름: 텍스처 })로 넘긴다. 엔진이 쓰지 않는 유닛(7 부터)을 차례로 묶고 그 이름의 sampler2D 유니폼에 유닛을 넣는다.
// - 그리기마다 다른 유니폼은 options.onBeforeDraw(program, webGL2RenderingContext) 에서 쓴다. 엔진의 유니폼은 엔진이 다시 쓰므로 머티리얼의 것만 쓴다.
//==============================================================================
export class ToonMaterial {
	//==============================================================================
	// 멤버 변수 목록.
	//==============================================================================
	/** @private @type { number } */ #id;
	/** @private @type { string } */ #name;
	/** @private @type { string } */ #uniformChunk;
	/** @private @type { string } */ #surfaceChunk;
	/** @private @type { string } */ #lightChunk;
	/** @private @type { string } */ #vertexChunk;

	//==============================================================================
	// 생성.
	//==============================================================================
	/**
	 * @constructor
	 * @param { object } [chunks] - { name, uniformChunk, surfaceChunk, lightChunk, vertexChunk } (없는 칸은 빈 글)
	 */
	constructor(chunks = {}) {
		this.#id = nextMaterialId;
		nextMaterialId += 1;
		this.#name = typeof chunks.name === "string" ? chunks.name : "";
		this.#uniformChunk = typeof chunks.uniformChunk === "string" ? chunks.uniformChunk : "";
		this.#surfaceChunk = typeof chunks.surfaceChunk === "string" ? chunks.surfaceChunk : "";
		this.#lightChunk = typeof chunks.lightChunk === "string" ? chunks.lightChunk : "";
		this.#vertexChunk = typeof chunks.vertexChunk === "string" ? chunks.vertexChunk : "";
	}

	//==============================================================================
	// 번호 반환. (머티리얼마다 다르다)
	//==============================================================================
	/**
	 * @returns { number }
	 */
	getId() {
		return this.#id;
	}

	//==============================================================================
	// 이름 반환. (알림 글에 쓴다)
	//==============================================================================
	/**
	 * @returns { string }
	 */
	getName() {
		return this.#name;
	}

	//==============================================================================
	// 유니폼 조각 반환.
	//==============================================================================
	/**
	 * @returns { string }
	 */
	getUniformChunk() {
		return this.#uniformChunk;
	}

	//==============================================================================
	// 표면 조각 반환.
	//==============================================================================
	/**
	 * @returns { string }
	 */
	getSurfaceChunk() {
		return this.#surfaceChunk;
	}

	//==============================================================================
	// 빛 조각 반환.
	//==============================================================================
	/**
	 * @returns { string }
	 */
	getLightChunk() {
		return this.#lightChunk;
	}

	//==============================================================================
	// 정점 조각 반환.
	//==============================================================================
	/**
	 * @returns { string }
	 */
	getVertexChunk() {
		return this.#vertexChunk;
	}
}


//==============================================================================
// 인스턴스 꼴. (인스턴스 하나의 어트리뷰트 차례, ToonRenderer.createInstanceBuffer 와 drawMeshInstanceBuffer 가 쓴다)
// - 어트리뷰트마다 { name, size }. 이름이 instanceMatrix(16) 면 모형 행렬, instanceTint(4) 면 곱하는 색으로 엔진이 읽는다.
// - 그 밖의 이름은 사용자 어트리뷰트다. TOON_MAXIMUM_INSTANCE_ATTRIBUTES 개까지, 크기 1 ~ 4. 정점 조각이 그 이름의 in 으로 읽는다. (자리 13 부터)
// - instanceMatrix 가 없으면 모형 행렬은 단위 행렬이다. 정점 조각이 vertex.modelMatrix 를 지어 넣는다. (자리, 돌림, 크기를 몇 수로만 담을 때)
// - instanceTint 가 없으면 틴트는 1 이다.
//==============================================================================
export class ToonInstanceLayout {
	//==============================================================================
	// 멤버 변수 목록.
	//==============================================================================
	/** @private @type { number } */ #id;
	/** @private @type { Array<object> } */ #attributes; // { name, size, offset (수 단위), location (사용자 어트리뷰트만, 아니면 -1) }
	/** @private @type { number } */ #floatCount;
	/** @private @type { boolean } */ #hasMatrix;
	/** @private @type { boolean } */ #hasTint;

	//==============================================================================
	// 생성. (이름이 겹치거나, 크기가 맞지 않거나, 사용자 어트리뷰트가 너무 많으면 던진다)
	//==============================================================================
	/**
	 * @constructor
	 * @param { Array<object> } attributes - { name, size } 의 배열.
	 */
	constructor(attributes) {
		this.#id = nextInstanceLayoutId;
		nextInstanceLayoutId += 1;
		this.#attributes = [];
		this.#floatCount = 0;
		this.#hasMatrix = false;
		this.#hasTint = false;
		const names = new System.Set();
		let customCount = 0;
		for (const attribute of attributes) {
			const name = attribute.name;
			const size = attribute.size;
			if (typeof name !== "string" || !SHADER_NAME_PATTERN.test(name) || names.has(name)) {
				throw new System.Error(`인스턴스 어트리뷰트 이름이 맞지 않습니다: ${name}`);
			}
			names.add(name);
			let location = -1;
			if (name === TOON_INSTANCE_MATRIX_NAME) {
				if (size !== 16) {
					throw new System.Error("instanceMatrix 의 크기는 16 입니다.");
				}
				this.#hasMatrix = true;
			}
			else if (name === TOON_INSTANCE_TINT_NAME) {
				if (size !== 4) {
					throw new System.Error("instanceTint 의 크기는 4 입니다.");
				}
				this.#hasTint = true;
			}
			else {
				if (!System.Number.isInteger(size) || size < 1 || size > 4) {
					throw new System.Error(`인스턴스 어트리뷰트 ${name} 의 크기는 1 ~ 4 입니다.`);
				}
				if (customCount >= TOON_MAXIMUM_INSTANCE_ATTRIBUTES) {
					throw new System.Error(`사용자 인스턴스 어트리뷰트는 ${TOON_MAXIMUM_INSTANCE_ATTRIBUTES} 개까지입니다.`);
				}
				location = TOON_FIRST_INSTANCE_ATTRIBUTE_LOCATION + customCount;
				customCount += 1;
			}
			this.#attributes.push({ name: name, size: size, offset: this.#floatCount, location: location });
			this.#floatCount += size;
		}
	}

	//==============================================================================
	// 번호 반환. (꼴마다 다르다)
	//==============================================================================
	/**
	 * @returns { number }
	 */
	getId() {
		return this.#id;
	}

	//==============================================================================
	// 어트리뷰트 목록 반환.
	//==============================================================================
	/**
	 * @returns { Array<object> } { name, size, offset, location }
	 */
	getAttributes() {
		return this.#attributes;
	}

	//==============================================================================
	// 인스턴스 하나의 수 개수.
	//==============================================================================
	/**
	 * @returns { number }
	 */
	getFloatCount() {
		return this.#floatCount;
	}

	//==============================================================================
	// 모형 행렬이 있는지.
	//==============================================================================
	/**
	 * @returns { boolean }
	 */
	hasMatrix() {
		return this.#hasMatrix;
	}

	//==============================================================================
	// 틴트가 있는지.
	//==============================================================================
	/**
	 * @returns { boolean }
	 */
	hasTint() {
		return this.#hasTint;
	}

	//==============================================================================
	// 사용자 어트리뷰트의 셰이더 선언. (in float / vec2 / vec3 / vec4 이름;)
	//==============================================================================
	/**
	 * @returns { string }
	 */
	readDeclarationSource() {
		const typeNames = ["", "float", "vec2", "vec3", "vec4"];
		let source = "";
		for (const attribute of this.#attributes) {
			if (attribute.location < 0) {
				continue;
			}
			source += `in ${typeNames[attribute.size]} ${attribute.name};\n`;
		}
		return source;
	}
}
