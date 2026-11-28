//==============================================================================
// GPU 메모리 셈.
// - 컨텍스트에서 텍스처, 렌더버퍼, 버퍼를 짓고 크기를 정하는 함수(texImage2D, texStorage2D, renderbufferStorageMultisample, bufferData 같은 것)를
//   가로채, 객체마다 바이트를 적는다. 지우면 빼고, 컨텍스트를 잃으면 모두 비운다.
// - 바이트는 형식과 크기로 셈한 이름값이다. (드라이버가 맞추는 줄 정렬, 타일 메모리, 멀티샘플 압축은 모른다. 멀티샘플 렌더버퍼는 샘플 수를 곱한다)
// - 주인은 객체를 지은 호출 스택의 위쪽 세 칸이다. (엔진 안 지은 자리를 가려내는 개발용 이름, 스택은 지을 때 한 번만 읽는다)
// - 지우지 않고 버려진 객체는 가비지 컬렉션이 올 때 FinalizationRegistry 로 뺀다. (브라우저가 그때 GL 객체를 풀어 준다)
// - 같은 컨텍스트에는 하나만 건다. (Graphic 이 짓는 자리에서 걸고, 엔진 밖에서 만든 컨텍스트는 GpuMemoryTracker.attach 로 건다)
//==============================================================================
const System = globalThis;
import { Object } from "../../base/object.js";

/**
 * @example <caption>엔진 GPU 메모리를 종류별로 읽기</caption>
 * import { Engine, EngineConfiguration, Scene } from "./vanilla.js";
 * const engine = new Engine(new EngineConfiguration());
 * engine.run(new Scene());
 * const usage = engine.readGpuMemoryUsage();
 * console.log(usage.kindTable.texture.count, usage.totalBytes);
 */


//==============================================================================
// 전역 상수 목록.
//==============================================================================
const TEXTURE_2D = 0x0DE1;
const TEXTURE_3D = 0x806F;
const TEXTURE_2D_ARRAY = 0x8C1A;
const TEXTURE_CUBE_MAP = 0x8513;
const TEXTURE_BINDING_2D = 0x8069;
const TEXTURE_BINDING_3D = 0x806A;
const TEXTURE_BINDING_2D_ARRAY = 0x8C1D;
const TEXTURE_BINDING_CUBE_MAP = 0x8514;
const RENDERBUFFER_BINDING = 0x8CA7;
const ARRAY_BUFFER = 0x8892;
const ELEMENT_ARRAY_BUFFER = 0x8893;
const PIXEL_PACK_BUFFER = 0x88EB;
const PIXEL_UNPACK_BUFFER = 0x88EC;
const UNIFORM_BUFFER = 0x8A11;
const COPY_READ_BUFFER = 0x8F36;
const COPY_WRITE_BUFFER = 0x8F37;
const TRANSFORM_FEEDBACK_BUFFER = 0x8C8E;
const ARRAY_BUFFER_BINDING = 0x8894;
const ELEMENT_ARRAY_BUFFER_BINDING = 0x8895;
const PIXEL_PACK_BUFFER_BINDING = 0x88ED;
const PIXEL_UNPACK_BUFFER_BINDING = 0x88EF;
const UNIFORM_BUFFER_BINDING = 0x8A28;
const COPY_READ_BUFFER_BINDING = 0x8F36;
const COPY_WRITE_BUFFER_BINDING = 0x8F37;
const TRANSFORM_FEEDBACK_BUFFER_BINDING = 0x8C8F;

// 대상 -> 묶음 값 열거. (지금 묶인 객체를 상태 캐시에서 읽는다)
const TEXTURE_BINDING_TABLE = new System.Map([[TEXTURE_2D, TEXTURE_BINDING_2D], [TEXTURE_3D, TEXTURE_BINDING_3D], [TEXTURE_2D_ARRAY, TEXTURE_BINDING_2D_ARRAY], [TEXTURE_CUBE_MAP, TEXTURE_BINDING_CUBE_MAP]]);
const BUFFER_BINDING_TABLE = new System.Map([
	[ARRAY_BUFFER, ARRAY_BUFFER_BINDING], [ELEMENT_ARRAY_BUFFER, ELEMENT_ARRAY_BUFFER_BINDING], [PIXEL_PACK_BUFFER, PIXEL_PACK_BUFFER_BINDING], [PIXEL_UNPACK_BUFFER, PIXEL_UNPACK_BUFFER_BINDING],
	[UNIFORM_BUFFER, UNIFORM_BUFFER_BINDING], [COPY_READ_BUFFER, COPY_READ_BUFFER_BINDING], [COPY_WRITE_BUFFER, COPY_WRITE_BUFFER_BINDING], [TRANSFORM_FEEDBACK_BUFFER, TRANSFORM_FEEDBACK_BUFFER_BINDING],
]);

// 형식 -> 화소당 바이트. (크기 있는 내부 형식)
const FORMAT_BYTE_TABLE = new System.Map([
	[0x8229, 1], [0x8F94, 1], [0x8231, 1], [0x8232, 1], [0x8D48, 1], // R8, R8_SNORM, R8I, R8UI, STENCIL_INDEX8
	[0x822B, 2], [0x8F95, 2], [0x8238, 2], [0x822D, 2], [0x8234, 2], [0x81A5, 2], [0x8D62, 2], [0x8056, 2], [0x8057, 2], // RG8, RG8_SNORM, RG8UI, R16F, R16UI, DEPTH16, RGB565, RGBA4, RGB5_A1
	[0x8051, 3], [0x8C41, 3], [0x8F96, 3], // RGB8, SRGB8, RGB8_SNORM
	[0x8058, 4], [0x8C43, 4], [0x8F97, 4], [0x8D7C, 4], [0x8D8E, 4], [0x8059, 4], [0x8C3A, 4], [0x8C3D, 4], // RGBA8, SRGB8_ALPHA8, RGBA8_SNORM, RGBA8UI, RGBA8I, RGB10_A2, R11F_G11F_B10F, RGB9_E5
	[0x822F, 4], [0x822E, 4], [0x8236, 4], [0x823A, 4], [0x81A6, 4], [0x8CAC, 4], [0x88F0, 4], // RG16F, R32F, R32UI, RG16UI, DEPTH24, DEPTH32F, DEPTH24_STENCIL8
	[0x881B, 6], // RGB16F
	[0x881A, 8], [0x8230, 8], [0x823C, 8], [0x8D76, 8], [0x8D88, 8], [0x8CAD, 8], // RGBA16F, RG32F, RG32UI, RGBA16UI, RGBA16I, DEPTH32F_STENCIL8
	[0x8815, 12], // RGB32F
	[0x8814, 16], [0x8D70, 16], [0x8D82, 16], // RGBA32F, RGBA32UI, RGBA32I
]);
const UNSIZED_FORMAT_BYTE_TABLE = new System.Map([[0x1908, 4], [0x1907, 3], [0x190A, 2], [0x1909, 1], [0x1906, 1], [0x84F9, 4]]); // RGBA, RGB, LUMINANCE_ALPHA, LUMINANCE, ALPHA, DEPTH_STENCIL
const DEPTH_COMPONENT = 0x1902;
const UNSIGNED_SHORT = 0x1403;

// 종류 이름.
/**
 * @example <caption>종류별 GPU 메모리 읽기</caption>
 * import { GpuMemoryTracker, GpuMemoryKind } from "./vanilla.js";
 * const webGL2RenderingContext = document.createElement("canvas").getContext("webgl2");
 * const gpuMemoryTracker = GpuMemoryTracker.attach(webGL2RenderingContext);
 * const usage = gpuMemoryTracker.readUsage();
 * console.log(usage.kindTable[GpuMemoryKind.renderbuffer].bytes);
 */
export const GpuMemoryKind = System.Object.freeze({
	texture: "texture", // 텍스처.
	renderbuffer: "renderbuffer", // 렌더버퍼. (멀티샘플 렌더 타겟의 색, 깊이)
	buffer: "buffer", // 버퍼. (정점, 인덱스, 인스턴스, 유니폼)
});

const HOOK_NAME = "vanillaGpuMemoryTrackerHook"; // 가로채기 함수의 이름. (주인 이름에서 이 밑의 칸부터 읽는다)
const STACK_DEPTH = 3; // 주인으로 적는 스택 칸 수.
const STACK_LIMIT = 12; // 스택을 읽을 때 한꺼번에 받는 칸 수. (이 파일 칸을 건너뛰고도 세 칸이 남게)
const trackerTable = new System.WeakMap();


//==============================================================================
// 형식 하나의 화소당 바이트.
//==============================================================================
/**
 * @param { number } internalFormat 내부 형식(렌더버퍼는 그 형식, 텍스처는 texImage2D 의 internalformat).
 * @param { number } [type] 올리는 값의 형식. (크기 없는 DEPTH_COMPONENT 일 때만 본다)
 * @returns { number } 화소당 바이트.
 */
function readFormatByteCount(internalFormat, type) {
	const sized = FORMAT_BYTE_TABLE.get(internalFormat);
	if (sized !== undefined) {
		return sized;
	}
	if (internalFormat === DEPTH_COMPONENT) {
		return type === UNSIGNED_SHORT ? 2 : 4;
	}
	const unsized = UNSIZED_FORMAT_BYTE_TABLE.get(internalFormat);
	if (unsized !== undefined) {
		return unsized;
	}
	return 4;
}

//==============================================================================
// 올리는 원본의 너비와 높이. (texImage2D 의 짧은 꼴, 이미지 / 캔버스 / 비디오 / 비트맵 / ImageData)
//==============================================================================
/**
 * @param { any } source
 * @returns { { width: number, height: number } }
 */
function readSourceSize(source) {
	if (source === null || source === undefined) {
		return { width: 0, height: 0 };
	}
	const width = source.naturalWidth ?? source.videoWidth ?? source.displayWidth ?? source.width ?? 0;
	const height = source.naturalHeight ?? source.videoHeight ?? source.displayHeight ?? source.height ?? 0;
	return { width: width, height: height };
}

//==============================================================================
// 지은 자리의 주인 이름. (이 파일과 상태 캐시를 건너뛴 위쪽 세 칸, 크롬과 사파리 스택 꼴 둘 다)
//==============================================================================
/**
 * @returns { string }
 */
function readOwnerName() {
	const previousLimit = System.Error.stackTraceLimit;
	System.Error.stackTraceLimit = STACK_LIMIT;
	const stack = new System.Error().stack;
	System.Error.stackTraceLimit = previousLimit;
	if (typeof stack !== "string") {
		return "unknown";
	}
	// 스택의 칸마다 이름과 자리를 읽는다. (크롬 "at 이름 (자리)", 사파리 "이름@자리")
	const frameList = [];
	for (const line of stack.split("\n")) {
		let name = null;
		let location = null;
		const chromeMatch = /^\s*at (?:async )?(.*?) \((.*)\)\s*$/.exec(line);
		if (chromeMatch !== null) {
			name = chromeMatch[1];
			location = chromeMatch[2];
		}
		else {
			const chromeAnonymousMatch = /^\s*at (.*)$/.exec(line);
			const safariMatch = /^(.*?)@(.*)$/.exec(line);
			if (chromeAnonymousMatch !== null) {
				name = "";
				location = chromeAnonymousMatch[1];
			}
			else if (safariMatch !== null) {
				name = safariMatch[1];
				location = safariMatch[2];
			}
		}
		if (location !== null) {
			frameList.push({ name: name, location: location });
		}
	}

	// 가로채기 함수(HOOK_NAME) 바로 밑부터가 지은 자리다. (묶음 파일 하나로 합쳐도 이름으로 가른다)
	let firstIndex = 0;
	for (let index = 0; index < frameList.length; ++index) {
		if (frameList[index].name.includes(HOOK_NAME)) {
			firstIndex = index + 1;
		}
	}
	const frameNameList = [];
	for (let index = firstIndex; index < frameList.length && frameNameList.length < STACK_DEPTH; ++index) {
		const frame = frameList[index];
		if (frame.location.includes("webglstatecache")) {
			continue;
		}
		const fileMatch = /([^/\\]+?)(?:\.js|\.mjs|\.html)?(?::\d+)*\)?$/.exec(frame.location);
		const fileName = fileMatch !== null ? fileMatch[1] : "";
		const frameName = frame.name !== "" ? frame.name : "(" + fileName + ")";
		frameNameList.push(frameName.length > 60 ? frameName.slice(0, 60) + "..." : frameName);
	}
	return frameNameList.length > 0 ? frameNameList.join(" < ") : "unknown";
}


//==============================================================================
// GPU 메모리 셈 클래스.
//==============================================================================
/**
 * @example <caption>지은 텍스처의 바이트 읽기</caption>
 * import { GpuMemoryTracker } from "./vanilla.js";
 * const webGL2RenderingContext = document.createElement("canvas").getContext("webgl2");
 * const gpuMemoryTracker = GpuMemoryTracker.attach(webGL2RenderingContext);
 * const texture = webGL2RenderingContext.createTexture();
 * webGL2RenderingContext.bindTexture(webGL2RenderingContext.TEXTURE_2D, texture);
 * webGL2RenderingContext.texStorage2D(webGL2RenderingContext.TEXTURE_2D, 1, webGL2RenderingContext.RGBA8, 16, 16);
 * console.log(gpuMemoryTracker.readUsage().kindTable.texture.bytes);
 */
export class GpuMemoryTracker extends Object {
	//==============================================================================
	// 멤버 변수 목록.
	//==============================================================================
	/** @private @type { WebGL2RenderingContext } */ #webGL2RenderingContext;
	/** @private @type { WeakMap<object, object> } */ #entryTable; // GL 객체 -> 적은 것. ({ kind, owner, bytes, levelTable, width, height, internalFormat, isMipmapGenerated })
	/** @private @type { Set<object> } */ #entrySet; // 살아 있는 적은 것 모두. (합을 낼 때 돈다)
	/** @private @type { FinalizationRegistry | null } */ #finalizationRegistry;

	//==============================================================================
	// 생성. (attach 로 건다)
	//==============================================================================
	/**
	 * @constructor
	 * @param { WebGL2RenderingContext } webGL2RenderingContext 셈할 컨텍스트.
	 */
	constructor(webGL2RenderingContext) {
		super();
		this.#webGL2RenderingContext = webGL2RenderingContext;
		this.#entryTable = new System.WeakMap();
		this.#entrySet = new System.Set();
		this.#finalizationRegistry = typeof System.FinalizationRegistry === "function" ? new System.FinalizationRegistry((entry) => {
			this.#entrySet.delete(entry);
		}) : null;
		this.installTrackers();
		const canvas = webGL2RenderingContext.canvas;
		if (canvas && typeof canvas.addEventListener === "function") {
			// 컨텍스트를 잃으면 GPU 의 객체가 모두 사라진다. (옛 객체를 나중에 지워도 빼지 않게 모두 잊는다)
			canvas.addEventListener("webglcontextlost", () => {
				this.#entrySet.clear();
				this.#entryTable = new System.WeakMap();
			});
		}
	}

	//==============================================================================
	// 컨텍스트에 셈 걸기. (없으면 만들어 건다, 같은 컨텍스트에는 하나만)
	//==============================================================================
	/**
	 * @param { WebGL2RenderingContext } webGL2RenderingContext 컨텍스트.
	 * @returns { GpuMemoryTracker } 그 컨텍스트의 GPU 메모리 셈.
	 * @example <caption>엔진 밖에서 만든 컨텍스트의 GPU 메모리 읽기</caption>
	 * import { GpuMemoryTracker } from "./vanilla.js";
	 * const webGL2RenderingContext = document.createElement("canvas").getContext("webgl2");
	 * const gpuMemoryTracker = GpuMemoryTracker.attach(webGL2RenderingContext);
	 * const texture = webGL2RenderingContext.createTexture();
	 * webGL2RenderingContext.bindTexture(webGL2RenderingContext.TEXTURE_2D, texture);
	 * webGL2RenderingContext.texStorage2D(webGL2RenderingContext.TEXTURE_2D, 1, webGL2RenderingContext.RGBA8, 64, 64);
	 * const usage = gpuMemoryTracker.readUsage();
	 * console.log(usage.totalBytes);
	 */
	static attach(webGL2RenderingContext) {
		let tracker = trackerTable.get(webGL2RenderingContext);
		if (tracker === undefined) {
			tracker = new GpuMemoryTracker(webGL2RenderingContext);
			trackerTable.set(webGL2RenderingContext, tracker);
		}
		return tracker;
	}

	//==============================================================================
	// 객체 적기.
	//==============================================================================
	/**
	 * @private
	 * @param { object | null } glObject 지은 GL 객체.
	 * @param { string } kind GpuMemoryKind 의 값.
	 */
	register(glObject, kind) {
		if (glObject === null || glObject === undefined) {
			return;
		}
		const entry = { kind: kind, owner: readOwnerName(), bytes: 0, levelTable: kind === GpuMemoryKind.texture ? new System.Map() : null, width: 0, height: 0, internalFormat: 0 };
		this.#entryTable.set(glObject, entry);
		this.#entrySet.add(entry);
		if (this.#finalizationRegistry !== null) {
			this.#finalizationRegistry.register(glObject, entry);
		}
	}

	//==============================================================================
	// 객체 빼기.
	//==============================================================================
	/**
	 * @private
	 * @param { object | null } glObject 지운 GL 객체.
	 */
	unregister(glObject) {
		if (glObject === null || glObject === undefined) {
			return;
		}
		const entry = this.#entryTable.get(glObject);
		if (entry === undefined) {
			return;
		}
		this.#entryTable.delete(glObject);
		this.#entrySet.delete(entry);
		if (this.#finalizationRegistry !== null) {
			this.#finalizationRegistry.unregister(glObject);
		}
	}

	//==============================================================================
	// 객체의 바이트 정하기. (텍스처는 대상과 단계마다 따로 적고 합한다)
	//==============================================================================
	/**
	 * @private
	 * @param { object | null | undefined } glObject GL 객체.
	 * @param { string | null } levelKey 텍스처의 대상과 단계. (null 이면 객체 하나의 바이트)
	 * @param { number } bytes 바이트.
	 */
	setBytes(glObject, levelKey, bytes) {
		if (glObject === null || glObject === undefined) {
			return;
		}
		const entry = this.#entryTable.get(glObject);
		if (entry === undefined) {
			return;
		}
		if (levelKey === null || entry.levelTable === null) {
			entry.bytes = bytes;
			return;
		}
		entry.levelTable.set(levelKey, bytes);
		let sum = 0;
		for (const levelBytes of entry.levelTable.values()) {
			sum += levelBytes;
		}
		entry.bytes = sum;
	}

	//==============================================================================
	// 지금 묶인 객체. (상태 캐시가 기억한 값, 모르면 한 번 GL 에 묻는다)
	//==============================================================================
	/**
	 * @private
	 * @param { number } bindingName 묶음 열거.
	 * @returns { object | null }
	 */
	readBound(bindingName) {
		return this.#webGL2RenderingContext.getParameter(bindingName);
	}

	//==============================================================================
	// 텍스처의 바이트 정하기. (texImage2D, texStorage2D 같은 것이 부른다)
	//==============================================================================
	/**
	 * @private
	 * @param { number } target 대상.
	 * @param { number } level 단계.
	 * @param { number } internalFormat 내부 형식.
	 * @param { number } width 너비.
	 * @param { number } height 높이.
	 * @param { number } depth 깊이. (2D 는 1)
	 * @param { number } type 올리는 값 형식.
	 */
	setTextureLevel(target, level, internalFormat, width, height, depth, type) {
		const bindingName = TEXTURE_BINDING_TABLE.get(target) ?? TEXTURE_BINDING_CUBE_MAP; // 큐브의 여섯 면 대상은 모두 큐브 묶음.
		const texture = this.readBound(bindingName);
		if (texture === null || texture === undefined) {
			return;
		}
		const entry = this.#entryTable.get(texture);
		if (entry !== undefined && level === 0) {
			entry.width = width;
			entry.height = height;
			entry.internalFormat = internalFormat;
		}
		this.setBytes(texture, target + ":" + level, width * height * depth * readFormatByteCount(internalFormat, type));
	}

	//==============================================================================
	// 가로채기 걸기.
	//==============================================================================
	/**
	 * @private
	 */
	installTrackers() {
		const gl = this.#webGL2RenderingContext;
		const tracker = this;
		const wrap = (functionName, beforeCallback, afterCallback) => {
			const originalFunction = gl[functionName];
			if (typeof originalFunction !== "function") {
				return;
			}
			gl[functionName] = function vanillaGpuMemoryTrackerHook(...argumentList) {
				if (beforeCallback !== null) {
					beforeCallback(...argumentList);
				}
				const result = originalFunction.apply(gl, argumentList);
				if (afterCallback !== null) {
					afterCallback(result, ...argumentList);
				}
				return result;
			};
		};

		// 짓기와 지우기.
		wrap("createTexture", null, (texture) => tracker.register(texture, GpuMemoryKind.texture));
		wrap("createRenderbuffer", null, (renderbuffer) => tracker.register(renderbuffer, GpuMemoryKind.renderbuffer));
		wrap("createBuffer", null, (buffer) => tracker.register(buffer, GpuMemoryKind.buffer));
		wrap("deleteTexture", (texture) => tracker.unregister(texture), null);
		wrap("deleteRenderbuffer", (renderbuffer) => tracker.unregister(renderbuffer), null);
		wrap("deleteBuffer", (buffer) => tracker.unregister(buffer), null);

		// 텍스처 크기 정하기.
		wrap("texImage2D", null, (result, target, level, internalFormat, ...rest) => {
			if (rest.length >= 6) {
				tracker.setTextureLevel(target, level, internalFormat, rest[0], rest[1], 1, rest[4]); // (target, level, internalformat, width, height, border, format, type, source)
			}
			else {
				const size = readSourceSize(rest[2]);
				tracker.setTextureLevel(target, level, internalFormat, size.width, size.height, 1, rest[1]); // (target, level, internalformat, format, type, source)
			}
		});
		wrap("texImage3D", null, (result, target, level, internalFormat, width, height, depth, border, format, type) => {
			tracker.setTextureLevel(target, level, internalFormat, width, height, depth, type);
		});
		wrap("texStorage2D", null, (result, target, levelCount, internalFormat, width, height) => {
			let levelWidth = width;
			let levelHeight = height;
			for (let level = 0; level < levelCount; ++level) {
				tracker.setTextureLevel(target, level, internalFormat, levelWidth, levelHeight, 1, 0);
				levelWidth = System.Math.max(1, levelWidth >> 1);
				levelHeight = System.Math.max(1, levelHeight >> 1);
			}
		});
		wrap("texStorage3D", null, (result, target, levelCount, internalFormat, width, height, depth) => {
			let levelWidth = width;
			let levelHeight = height;
			let levelDepth = depth;
			for (let level = 0; level < levelCount; ++level) {
				tracker.setTextureLevel(target, level, internalFormat, levelWidth, levelHeight, levelDepth, 0);
				levelWidth = System.Math.max(1, levelWidth >> 1);
				levelHeight = System.Math.max(1, levelHeight >> 1);
				if (target === TEXTURE_3D) {
					levelDepth = System.Math.max(1, levelDepth >> 1);
				}
			}
		});
		wrap("generateMipmap", null, (result, target) => {
			const bindingName = TEXTURE_BINDING_TABLE.get(target);
			if (bindingName === undefined) {
				return;
			}
			const texture = tracker.readBound(bindingName);
			const entry = texture === null || texture === undefined ? undefined : tracker.#entryTable.get(texture);
			if (entry === undefined || entry.width <= 0) {
				return;
			}
			let levelWidth = entry.width;
			let levelHeight = entry.height;
			let level = 0;
			while (levelWidth > 1 || levelHeight > 1) {
				levelWidth = System.Math.max(1, levelWidth >> 1);
				levelHeight = System.Math.max(1, levelHeight >> 1);
				++level;
				tracker.setBytes(texture, target + ":" + level, levelWidth * levelHeight * readFormatByteCount(entry.internalFormat, 0));
			}
		});

		// 렌더버퍼 크기 정하기. (멀티샘플은 샘플 수를 곱한다)
		wrap("renderbufferStorage", null, (result, target, internalFormat, width, height) => {
			tracker.setBytes(tracker.readBound(RENDERBUFFER_BINDING), null, width * height * readFormatByteCount(internalFormat, 0));
		});
		wrap("renderbufferStorageMultisample", null, (result, target, sampleCount, internalFormat, width, height) => {
			tracker.setBytes(tracker.readBound(RENDERBUFFER_BINDING), null, width * height * readFormatByteCount(internalFormat, 0) * System.Math.max(1, sampleCount));
		});

		// 버퍼 크기 정하기. (bufferSubData 는 크기가 그대로다)
		wrap("bufferData", null, (result, target, sizeOrData, usage, srcOffset, length) => {
			const bindingName = BUFFER_BINDING_TABLE.get(target);
			if (bindingName === undefined) {
				return;
			}
			let bytes = 0;
			if (typeof sizeOrData === "number") {
				bytes = sizeOrData;
			}
			else if (sizeOrData !== null && sizeOrData !== undefined) {
				if (System.ArrayBuffer.isView(sizeOrData) && srcOffset !== undefined) {
					// (target, srcData, usage, srcOffset, length) 는 srcOffset 과 length 가 원소 수다. length 0 은 끝까지.
					const elementBytes = sizeOrData.BYTES_PER_ELEMENT ?? 1;
					const elementCount = sizeOrData.byteLength / elementBytes;
					bytes = (length === undefined || length === 0 ? elementCount - srcOffset : length) * elementBytes;
				}
				else {
					bytes = sizeOrData.byteLength ?? 0;
				}
			}
			tracker.setBytes(tracker.readBound(bindingName), null, bytes);
		});
	}

	//==============================================================================
	// 지금 쓰는 GPU 메모리 읽기.
	//==============================================================================
	/**
	 * @returns { { totalBytes: number, canvasBytes: number, kindTable: object, ownerList: Array<{ owner: string, kind: string, count: number, bytes: number }> } }
	 * 합(캔버스 몫 포함), 캔버스 기본 프레임 버퍼 몫, 종류별 { count, bytes }, 주인별 몫(큰 것부터).
	 * @example <caption>종류별과 주인별 GPU 메모리 읽기</caption>
	 * import { GpuMemoryTracker } from "./vanilla.js";
	 * const webGL2RenderingContext = document.createElement("canvas").getContext("webgl2");
	 * const gpuMemoryTracker = GpuMemoryTracker.attach(webGL2RenderingContext);
	 * const usage = gpuMemoryTracker.readUsage();
	 * console.log(usage.kindTable.texture.bytes, usage.ownerList.length);
	 */
	readUsage() {
		const kindTable = {};
		for (const kind of System.Object.values(GpuMemoryKind)) {
			kindTable[kind] = { count: 0, bytes: 0 };
		}
		const ownerTable = new System.Map();
		let totalBytes = 0;
		for (const entry of this.#entrySet) {
			const kindUsage = kindTable[entry.kind];
			kindUsage.count += 1;
			kindUsage.bytes += entry.bytes;
			totalBytes += entry.bytes;
			const ownerKey = entry.kind + "|" + entry.owner;
			let ownerUsage = ownerTable.get(ownerKey);
			if (ownerUsage === undefined) {
				ownerUsage = { owner: entry.owner, kind: entry.kind, count: 0, bytes: 0 };
				ownerTable.set(ownerKey, ownerUsage);
			}
			ownerUsage.count += 1;
			ownerUsage.bytes += entry.bytes;
		}
		const ownerList = Array.from(ownerTable.values()).sort((left, right) => right.bytes - left.bytes);

		// 캔버스의 기본 프레임 버퍼. (색 4 바이트 + 깊이와 스텐실 4 바이트, 멀티샘플이면 샘플 수를 곱하고 풀어 낸 색 한 장을 더한다. 샘플 수는 드라이버 몫이라 4 로 셈한 이름값)
		const gl = this.#webGL2RenderingContext;
		let canvasBytes = 0;
		if (!gl.isContextLost()) {
			const attributes = gl.getContextAttributes();
			const pixelCount = gl.drawingBufferWidth * gl.drawingBufferHeight;
			const sampleCount = attributes !== null && attributes.antialias ? 4 : 1;
			canvasBytes = pixelCount * 8 * sampleCount + (sampleCount > 1 ? pixelCount * 4 : 0);
		}
		return { totalBytes: totalBytes + canvasBytes, canvasBytes: canvasBytes, kindTable: kindTable, ownerList: ownerList };
	}
}
