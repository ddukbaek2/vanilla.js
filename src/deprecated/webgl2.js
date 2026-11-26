//==============================================================================
// 포함 모듈 목록.
//==============================================================================
const System = globalThis;
import { Color } from "../../base/color.js";
import { Rect } from "../../base/rect.js";
import { Engine } from "../../core/engine.js";
import { Object } from "../base/object.js";
import { Vector2 } from "../base/vector2.js";


//==============================================================================
// 전역 상수 목록.
//==============================================================================
const EXAMPLE_VERTEXSHADER = `
#version 300 es
in vec2 a_position;
void main() {
	gl_Position = vec4(a_position, 0.0, 1.0);
}
`;
const EXAMPLE_FRAGMENTSHADER = `
#version 300 es
precision highp float;
out vec4 outColor;

void main() {
	outColor = vec4(1.0, 0.5, 0.0, 1.0); // 주황색
}
`;

//==============================================================================
// WebGL2. (OpenGL es 3.0)
// - 지오메트리셰이더, 컴퓨트셰이더는 지원하지 않음.
//==============================================================================
export class WebGL2 extends Object {
	//==============================================================================
	// 멤버 변수 목록.
	//==============================================================================
	/** @private @type { WebGL2RenderingContext } */ #canvasRenderingContext;

	//==============================================================================
	// 생성.
	//==============================================================================
	/**
	 * @constructor
	 * @param { CanvasElement } canvas 
	 */
	constructor(canvas) {
        super();

        const canvasRenderingContext = canvas.getContext("webgl2"); // WebGL2RenderingContext
		if (!canvasRenderingContext) {
			throw new Error("WebGL2 Not Supported.");
		}

		this.#canvasRenderingContext = canvasRenderingContext;
	}

	//==============================================================================
	// 버텍스 셰이더 객체 생성.
	//==============================================================================
	/**
	 * @param { string } source
	 * @returns { WebGLShader | null }
	 */
	createVertexShader(source) {
		const canvasRanderingContext = this.getCanvasRenderingContext();
		if (canvasRanderingContext) {
			const shader = canvasRanderingContext.createShader(canvasRanderingContext.VERTEX_SHADER);
			canvasRanderingContext.shaderSource(shader, source);
			canvasRanderingContext.compileShader(shader);
			if (!canvasRanderingContext.getShaderParameter(shader, canvasRanderingContext.COMPILE_STATUS)) {
				const shaderError = canvasRanderingContext.getShaderInfoLog(shader);
				this.destroyShader(shader);
				throw new Error(shaderError);
			}

			return shader;
		}
		return null;
	}

	//==============================================================================
	// 프래그먼트 셰이더 객체 생성.
	//==============================================================================
	/**
	 * @param { string } source
	 * @returns { WebGLShader | null }
	 */
	createFragmentShader(source) {
		const canvasRanderingContext = this.getCanvasRenderingContext();
		if (canvasRanderingContext) {
			const shader = canvasRanderingContext.createShader(canvasRanderingContext.FRAGMENT_SHADER);
			canvasRanderingContext.shaderSource(shader, source);
			canvasRanderingContext.compileShader(shader);
			if (!canvasRanderingContext.getShaderParameter(shader, canvasRanderingContext.COMPILE_STATUS)) {
				const shaderError = canvasRanderingContext.getShaderInfoLog(shader);
				this.destroyShader(shader);
				throw new Error(shaderError);
			}

			return shader;
		}
		return null;
	}

	//==============================================================================
	// 셰이더 객체 파괴.
	//==============================================================================
	/**
	 * @param { WebGLShader } shader
	 */
	destroyShader(shader) {
		const canvasRanderingContext = this.getCanvasRenderingContext();
		if (canvasRanderingContext) {
			canvasRanderingContext.deleteShader(shader);
		}		
	}

	//==============================================================================
	// 프로그램 객체 생성.
	//==============================================================================
	/**
	 * @param { WebGLShader } vertexShader
	 * @param { WebGLShader } fragmentShader
	 * @returns { WebGLProgram | null }
	 */
	createProgram(vertexShader, fragmentShader) {
		const canvasRanderingContext = this.getCanvasRenderingContext();
		if (canvasRanderingContext) {
			const program = canvasRanderingContext.createProgram();
			canvasRanderingContext.attachShader(program, vertexShader);
			canvasRanderingContext.attachShader(program, fragmentShader);
			canvasRanderingContext.linkProgram(program);

			if (!canvasRanderingContext.getProgramParameter(program, canvasRanderingContext.LINK_STATUS)) {
				const programError = canvasRanderingContext.getProgramInfoLog(program);
				throw new Error(programError);
			}

			return program;
		}

		return null;
	}

	//==============================================================================
	// 버텍스 어레이 객체 생성.
	//==============================================================================
	/**
	 * @returns { WebGLVertexArrayObject | null }
	 */
	createVertexArray() {
		const canvasRanderingContext = this.getCanvasRenderingContext();
		if (canvasRanderingContext) {
			const vertexArray = canvasRanderingContext.createVertexArray();
			return vertexArray;
		}

		return null;
	}

	//==============================================================================
	// 버텍스 버퍼 객체 생성.
	//==============================================================================
	/**
	 * @returns { WebGLBuffer | null }
	 */
	createVertexBuffer() {
		const canvasRanderingContext = this.getCanvasRenderingContext();
		if (canvasRanderingContext) {
			const vertexBuffer = canvasRanderingContext.createBuffer();
			return vertexBuffer;
		}

		return null;
	}

	//==============================================================================
	// 지정 색상으로 화면 칠하고 백버퍼 비우기.
	//==============================================================================
	/**
	 * @param { Color | null } color 
	 */
	clear(color) {
		const canvasRanderingContext = this.getCanvasRenderingContext();
		if (canvasRanderingContext) {
			if (color !== undefined && color !== null) {
				canvasRanderingContext.clearColor(color.red, color.green, color.blue, color.alpha);
			}

			canvasRanderingContext.clear(canvasRanderingContext.COLOR_BUFFER_BIT);
		}		
	}

	//==============================================================================
	// 뷰포트 설정.
	//==============================================================================
	/**
	 * @param { Rect } rect 
	 */
	viewport(rect) {
		const canvasRanderingContext = this.getCanvasRenderingContext();
		if (canvasRanderingContext) {
			canvasRanderingContext.viewport(rect.position.x, rect.position.y, rect.size.x, rect.size.y);
		}		
	}

	//==============================================================================
	// 출력 구조 테스트.
	//==============================================================================
	/**
	 * @param { Engine } engine 
	 */
	test(engine) {
		const canvasRanderingContext = this.getCanvasRenderingContext();
		if (canvasRanderingContext) {

			// 셰이더 설정.
			const vertexShader = this.createVertexShader(EXAMPLE_VERTEXSHADER);
			const fragmentShader = this.createFragmentShader(EXAMPLE_FRAGMENTSHADER);
			const program = this.createProgram(vertexShader, fragmentShader);

			// 버텍스 어레이 설정. (렌더링 데이터 처리 설정)
			const vertexArray = this.createVertexArray();
			canvasRanderingContext.bindVertexArray(vertexArray);

			// 버텍스 버퍼 설정. (렌더링 데이터)
			const vertices = new Float32Array([
				0.0, 0.5,
				-0.5, -0.5,
				0.5, -0.5,
			]);
			const vertexBuffer = this.createVertexBuffer();
			canvasRanderingContext.bindBuffer(canvasRanderingContext.ARRAY_BUFFER, vertexBuffer);
			canvasRanderingContext.bufferData(canvasRanderingContext.ARRAY_BUFFER, vertices, canvasRanderingContext.STATIC_DRAW);
			const attributeLocation = canvasRanderingContext.getAttribLocation(program, "a_position");
			canvasRanderingContext.enableVertexAttribArray(attributeLocation);
			canvasRanderingContext.vertexAttribPointer(attributeLocation, 2, canvasRanderingContext.FLOAT, false, 0, 0);
			canvasRanderingContext.bindVertexArray(null);

			// 출력.
			const draw = () => {
				const viewManager = engine.getViewManager();
				const canvasNativeSize = viewManager.getCanvasNativeSize();

				// 화면 비우기.
				this.viewport(Rect.create(0, 0, canvasNativeSize.x, canvasNativeSize.y));
				this.clear(Color.white());

				// 출력.
				canvasRanderingContext.useProgram(program);
				canvasRanderingContext.bindVertexArray(vertexArray);
				canvasRanderingContext.drawArrays(canvasRanderingContext.TRIANGLES, 0, 3);

				// 호출 요청.
				System.window.requestAnimationFrame(draw.bind(this));
			}

			// 호출 요청.
			System.window.requestAnimationFrame(draw.bind(this));
		}
	}
    
	//==============================================================================
	// 캔버스 렌더링 컨텍스트 반환.
	//==============================================================================
    /**
     * @returns { WebGL2RenderingContext }
     */
    getCanvasRenderingContext() {
        return this.#canvasRenderingContext;
    }
}