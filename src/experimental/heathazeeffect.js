//==============================================================================
// 포함 모듈 목록.
//==============================================================================
const System = globalThis;
import { Vector2 } from "../base/vector2.js";
import { Graphic } from "../core/graphic.js";
import { WorldNode } from "../core/node/worldnode.js";


//==============================================================================
// 전역 상수 목록.
//==============================================================================
const PARTICLE_FLOATS_PER_VERTEX = 8; // Graphic 의 정점 색 쿼드 정점 하나의 값 수. (x, y, u, v, r, g, b, a)


//==============================================================================
// 아지랑이 효과 노드.
// - 이 노드가 그려지기 전까지의 캔버스 내용을 가져와서 일렁이는 효과를 줍니다.
// - 따라서 씬의 가장 마지막(맨 위)에 추가되어야 효과가 보입니다.
// - 내용 크기(contentSize)와 피봇을 쓰므로 WorldNode 를 상속한다. (Canvas2D 시절에는 TransformNode 였지만 그때도 WorldNode 의 함수를 불렀다)
// - WebGL Graphic 에서는 묶음을 먼저 그린 뒤, 노드 영역의 화면 바운딩 박스(드로잉 버퍼 픽셀)를 copyTexSubImage2D 로 텍스처에 떠 오고,
//   줄마다 쿼드 한 장씩 정점 색 쿼드(drawColoredQuads)로 사인 곡선만큼 옮겨 그린다. (러스트 vanilla-engine 과 같은 방식)
// - 영역이 화면 밖으로 나가면 화면 가장자리 픽셀을 늘인다. (CLAMP_TO_EDGE)
// - 떠 온 텍스처는 GL 자원이라 다 쓰면 destroy() 를 부른다.
//==============================================================================
export class HeatHazeEffect extends WorldNode {
	//==============================================================================
	// 멤버 변수 목록.
	//==============================================================================
	/** @private @type { number } */ #timer;
	/** @private @type { number } */ #speed;      // 흔들리는 속도.
	/** @private @type { number } */ #amplitude;  // 흔들리는 폭 (강도).
	/** @private @type { number } */ #frequency;  // 흔들리는 빈도 (물결의 촘촘함).
	/** @private @type { WebGL2RenderingContext | null } */ #webGL2RenderingContext; // 떠 온 텍스처를 만든 컨텍스트.
	/** @private @type { WebGLTexture | null } */ #captureTexture; // 화면을 떠 온 텍스처.
	/** @private @type { number } */ #captureTextureWidth;
	/** @private @type { number } */ #captureTextureHeight;

	//==============================================================================
	// 생성.
	//==============================================================================
	/**
	 * @constructor
	 */
	constructor() {
		super();
		
		this.#timer = 0;
		this.#speed = 2.0;
		this.#amplitude = 3.0;
		this.#frequency = 0.05;
		this.#webGL2RenderingContext = null;
		this.#captureTexture = null;
		this.#captureTextureWidth = 0;
		this.#captureTextureHeight = 0;
		this.setContentSize(Vector2.create(300, 300));
	}

	//==============================================================================
	// 갱신.
	//==============================================================================
	/**
	 * @param { number } timeDelta 
	 */
	tick(timeDelta) {
		super.tick(timeDelta);
		const speed = this.getSpeed();
		this.#timer += timeDelta * speed;
	}

	//==============================================================================
	// 출력.
	//==============================================================================
	/**
	 * @param { Graphic } graphic 
	 */
	draw(graphic) {
		// 노드 자체가 활성화 상태가 아니면 그리지 않음.
		if (!this.isActive()) {
			return;
		}

		const contentSize = this.getContentSize();

		// 영역 크기가 없다면 그리지 않음.
		if (contentSize.x <= 0 || contentSize.y <= 0) {
			return;
		}

		// 앞서 그린 것이 화면에 다 나가야 떠 올 수 있다. (묶어 그리기로 쌓인 것을 먼저 그린다)
		graphic.flushSpriteBatch();

		// 화면상의 절대 좌표 영역(바운딩 박스)을 가져와 캡처 범위로 사용합니다. (지금 변환으로 옮긴 드로잉 버퍼 픽셀, 왼쪽 위 원점)
		const transformMatrix = graphic.getTransformMatrix();
		const matrixA = transformMatrix.a;
		const matrixB = transformMatrix.b;
		const matrixC = transformMatrix.c;
		const matrixD = transformMatrix.d;
		const matrixE = transformMatrix.e;
		const matrixF = transformMatrix.f;
		const cornerXList = [matrixE, matrixA * contentSize.x + matrixE, matrixC * contentSize.y + matrixE, matrixA * contentSize.x + matrixC * contentSize.y + matrixE];
		const cornerYList = [matrixF, matrixB * contentSize.x + matrixF, matrixD * contentSize.y + matrixF, matrixB * contentSize.x + matrixD * contentSize.y + matrixF];
		const minimumX = System.Math.min(cornerXList[0], cornerXList[1], cornerXList[2], cornerXList[3]);
		const maximumX = System.Math.max(cornerXList[0], cornerXList[1], cornerXList[2], cornerXList[3]);
		const minimumY = System.Math.min(cornerYList[0], cornerYList[1], cornerYList[2], cornerYList[3]);
		const maximumY = System.Math.max(cornerYList[0], cornerYList[1], cornerYList[2], cornerYList[3]);
		const boundsHeight = maximumY - minimumY;

		// 화면 안으로 자른 복사 영역.
		const webGL2RenderingContext = graphic.getWebGL2RenderingContext();
		const bufferWidth = webGL2RenderingContext.drawingBufferWidth;
		const bufferHeight = webGL2RenderingContext.drawingBufferHeight;
		const regionX = System.Math.max(0, System.Math.floor(minimumX));
		const regionY = System.Math.max(0, System.Math.floor(minimumY));
		const regionRight = System.Math.min(bufferWidth, System.Math.ceil(maximumX));
		const regionBottom = System.Math.min(bufferHeight, System.Math.ceil(maximumY));
		const regionWidth = regionRight - regionX;
		const regionHeight = regionBottom - regionY;
		if (maximumX - minimumX > 0 && boundsHeight > 0 && regionWidth > 0 && regionHeight > 0) {
			// 현재까지 그려진 캔버스 자체를 소스로 사용.
			// 떠 오기. (GL 은 아래가 0 이라 텍스처의 0 줄이 영역의 아래쪽이다)
			const captureTexture = this.ensureCaptureTexture(graphic, regionWidth, regionHeight);
			graphic.bindTexture(captureTexture);
			webGL2RenderingContext.copyTexSubImage2D(webGL2RenderingContext.TEXTURE_2D, 0, 0, 0, regionX, bufferHeight - regionBottom, regionWidth, regionHeight);

			// 성능을 위해 영역 내의 한 줄씩 잘라서 사인 곡선에 맞춰 좌우로 흔듭니다. (줄마다 쿼드 한 장, 줄 높이는 한 단위)
			const rowCount = System.Math.max(1, System.Math.ceil(contentSize.y));
			const rowHeight = contentSize.y / rowCount;
			const amplitude = this.getAmplitude();
			const frequency = this.getFrequency();
			const leftU = (minimumX - regionX) / regionWidth;
			const rightU = (maximumX - regionX) / regionWidth;
			const vertexData = graphic.getParticleVertexData(rowCount * 6 * PARTICLE_FLOATS_PER_VERTEX);
			let floatOffset = 0;
			const writeVertex = (x, y, u, v) => {
				vertexData[floatOffset++] = x;
				vertexData[floatOffset++] = y;
				vertexData[floatOffset++] = u;
				vertexData[floatOffset++] = v;
				vertexData[floatOffset++] = 1;
				vertexData[floatOffset++] = 1;
				vertexData[floatOffset++] = 1;
				vertexData[floatOffset++] = 1;
			};
			for (let rowIndex = 0; rowIndex < rowCount; ++rowIndex) {
				const topY = rowIndex * rowHeight;
				const bottomY = topY + rowHeight;
				const offsetX = System.Math.sin(this.#timer + (topY * frequency)) * amplitude;

				// 소스: 화면에 이미 그려진 바운딩 박스의 같은 높이 줄. 대상: 노드의 로컬 공간. (Sprite 처럼 변환이 이미 걸려 있으므로 0 부터)
				const sourceTopY = minimumY + (topY / contentSize.y) * boundsHeight;
				const sourceBottomY = minimumY + (bottomY / contentSize.y) * boundsHeight;
				const topV = 1 - (sourceTopY - regionY) / regionHeight;
				const bottomV = 1 - (sourceBottomY - regionY) / regionHeight;
				const leftX = offsetX;
				const rightX = offsetX + contentSize.x;
				writeVertex(leftX, topY, leftU, topV);
				writeVertex(rightX, topY, rightU, topV);
				writeVertex(leftX, bottomY, leftU, bottomV);
				writeVertex(leftX, bottomY, leftU, bottomV);
				writeVertex(rightX, topY, rightU, topV);
				writeVertex(rightX, bottomY, rightU, bottomV);
			}
			graphic.drawColoredQuads(floatOffset / PARTICLE_FLOATS_PER_VERTEX, captureTexture);
		}

		// 자식 노드가 있다면 마저 그립니다.
		super.draw(graphic);
	}

	//==============================================================================
	// 떠 올 텍스처 준비. (크기가 바뀌면 다시 잡는다, 화면과 같은 RGB8)
	//==============================================================================
	/**
	 * @param { Graphic } graphic
	 * @param { number } width
	 * @param { number } height
	 * @returns { WebGLTexture }
	 */
	ensureCaptureTexture(graphic, width, height) {
		const webGL2RenderingContext = graphic.getWebGL2RenderingContext();
		const captureTexture = this.#captureTexture;
		if (captureTexture !== null) {
			if (this.#webGL2RenderingContext === webGL2RenderingContext && this.#captureTextureWidth === width && this.#captureTextureHeight === height) {
				return captureTexture;
			}
			this.destroyCaptureTexture();
		}
		const texture = webGL2RenderingContext.createTexture();
		graphic.bindTexture(texture);
		webGL2RenderingContext.texImage2D(webGL2RenderingContext.TEXTURE_2D, 0, webGL2RenderingContext.RGB8, width, height, 0, webGL2RenderingContext.RGB, webGL2RenderingContext.UNSIGNED_BYTE, null);
		webGL2RenderingContext.texParameteri(webGL2RenderingContext.TEXTURE_2D, webGL2RenderingContext.TEXTURE_MIN_FILTER, webGL2RenderingContext.LINEAR);
		webGL2RenderingContext.texParameteri(webGL2RenderingContext.TEXTURE_2D, webGL2RenderingContext.TEXTURE_MAG_FILTER, webGL2RenderingContext.LINEAR);
		webGL2RenderingContext.texParameteri(webGL2RenderingContext.TEXTURE_2D, webGL2RenderingContext.TEXTURE_WRAP_S, webGL2RenderingContext.CLAMP_TO_EDGE);
		webGL2RenderingContext.texParameteri(webGL2RenderingContext.TEXTURE_2D, webGL2RenderingContext.TEXTURE_WRAP_T, webGL2RenderingContext.CLAMP_TO_EDGE);
		this.#webGL2RenderingContext = webGL2RenderingContext;
		this.#captureTexture = texture;
		this.#captureTextureWidth = width;
		this.#captureTextureHeight = height;
		return texture;
	}

	//==============================================================================
	// 떠 온 텍스처 지우기.
	//==============================================================================
	destroyCaptureTexture() {
		const captureTexture = this.#captureTexture;
		const webGL2RenderingContext = this.#webGL2RenderingContext;
		if (captureTexture !== null && webGL2RenderingContext !== null) {
			webGL2RenderingContext.deleteTexture(captureTexture);
		}
		this.#captureTexture = null;
		this.#captureTextureWidth = 0;
		this.#captureTextureHeight = 0;
	}

	//==============================================================================
	// 파괴. (떠 온 텍스처를 지운다)
	//==============================================================================
	destroy() {
		this.destroyCaptureTexture();
		super.destroy();
	}

	//==============================================================================
	// 속도 설정.
	//==============================================================================
	/**
	 * @param { number } value 
	 */
	setSpeed(value) { 
		this.#speed = value; 
	}

	//==============================================================================
	// 속도 반환.
	//==============================================================================
	/**
	 * @returns { number } 
	 */
	getSpeed() { 
		return this.#speed; 
	}

	//==============================================================================
	// 강도 설정.
	//==============================================================================
	/**
	 * @param { number } value 
	 */
	setAmplitude(value) { 
		this.#amplitude = value; 
	}

	//==============================================================================
	// 강도 반환.
	//==============================================================================
	/**
	 * @returns { number } 
	 */
	getAmplitude() { 
		return this.#amplitude; 
	}

	//==============================================================================
	// 빈도 설정.
	//==============================================================================
	/**
	 * @param { number } value 
	 */
	setFrequency(value) { 
		this.#frequency = value; 
	}

	//==============================================================================
	// 빈도 반환.
	//==============================================================================
	/**
	 * @returns { number } 
	 */
	getFrequency() { 
		return this.#frequency; 
	}
}