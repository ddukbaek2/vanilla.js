//==============================================================================
// 포함 모듈 목록.
//==============================================================================
const System = globalThis;


//==============================================================================
// 셰이더 미리 링크.
// - ShaderProgram 은 링크하자마자 결과를 물어 주 스레드가 링크가 끝날 때까지 멈춘다. 셰이더 여럿을 처음 그릴 때 한꺼번에 지으면 그 프레임이 멈칫한다.
// - 켤 때(로고, 로딩 동안) 같은 소스를 KHR_parallel_shader_compile 로 뒤에서 링크해 두면 브라우저의 프로그램 캐시에 남아, 나중에 ShaderProgram 이 같은 소스를 지을 때 금방 끝난다.
// - 확장이 없으면 아무것도 하지 않는다. (확장 없이 링크를 걸어 두면 그 뒤의 그리기 명령이 링크를 기다려 오히려 멈출 수 있다)
// - 링크 결과는 묻지 않고, 다 링크되면 프로그램과 셰이더를 지운다. (캐시는 남는다, 소스가 틀려도 여기서는 오류를 내지 않고 그릴 때의 ShaderProgram 이 알린다)
// - 그리기 상태(묶인 프로그램, 버퍼, 텍스처)는 건드리지 않는다.
// - 사용: new ShaderWarmer(webGL2RenderingContext, [{ vertexShader, fragmentShader, attributeLocationTable }]) 뒤 매 프레임 update().
//   어트리뷰트 위치는 ShaderProgram 에 넘길 것과 같게 줘야 캐시에 걸린다.
//==============================================================================
export class ShaderWarmer {
	//==============================================================================
	// 멤버 변수 목록.
	//==============================================================================
	/** @private @type { WebGL2RenderingContext } */ #webGL2RenderingContext;
	/** @private @type { object | null } */ #parallelExtension; // KHR_parallel_shader_compile. (없으면 null)
	/** @private @type { Array<object> } */ #pendingPrograms; // 링크 중인 것. ({ program, vertexShader, fragmentShader })

	//==============================================================================
	// 생성. (확장이 있으면 소스를 모두 컴파일하고 링크를 걸어 둔다)
	//==============================================================================
	/**
	 * @constructor
	 * @param { WebGL2RenderingContext } webGL2RenderingContext
	 * @param { Array<object> } programSources - { vertexShader, fragmentShader, attributeLocationTable } 의 배열. (먼저 쓸 것부터)
	 */
	constructor(webGL2RenderingContext, programSources) {
		this.#webGL2RenderingContext = webGL2RenderingContext;
		this.#parallelExtension = webGL2RenderingContext.getExtension("KHR_parallel_shader_compile");
		this.#pendingPrograms = [];
		if (this.getParallelExtension() === null) {
			return;
		}
		for (const programSource of programSources) {
			const pendingProgram = this.linkProgram(programSource);
			this.#pendingPrograms.push(pendingProgram);
		}
	}

	//==============================================================================
	// 하나를 컴파일하고 링크 걸기. (ShaderProgram 과 같은 차례, 어트리뷰트 위치도 같게 묶어야 캐시에 걸린다)
	//==============================================================================
	/**
	 * @param { object } programSource - { vertexShader, fragmentShader, attributeLocationTable }
	 * @returns { object } { program, vertexShader, fragmentShader }
	 */
	linkProgram(programSource) {
		const webGL2RenderingContext = this.getWebGL2RenderingContext();
		const vertexShaderSource = programSource.vertexShader;
		const fragmentShaderSource = programSource.fragmentShader;
		const vertexShader = webGL2RenderingContext.createShader(webGL2RenderingContext.VERTEX_SHADER);
		webGL2RenderingContext.shaderSource(vertexShader, vertexShaderSource);
		webGL2RenderingContext.compileShader(vertexShader);
		const fragmentShader = webGL2RenderingContext.createShader(webGL2RenderingContext.FRAGMENT_SHADER);
		webGL2RenderingContext.shaderSource(fragmentShader, fragmentShaderSource);
		webGL2RenderingContext.compileShader(fragmentShader);
		const program = webGL2RenderingContext.createProgram();
		webGL2RenderingContext.attachShader(program, vertexShader);
		webGL2RenderingContext.attachShader(program, fragmentShader);
		const attributeLocationTable = programSource.attributeLocationTable;
		if (attributeLocationTable !== null && attributeLocationTable !== undefined) {
			for (const attributeName in attributeLocationTable) {
				const attributeLocation = attributeLocationTable[attributeName];
				webGL2RenderingContext.bindAttribLocation(program, attributeLocation, attributeName);
			}
		}
		webGL2RenderingContext.linkProgram(program);
		return { program: program, vertexShader: vertexShader, fragmentShader: fragmentShader };
	}

	//==============================================================================
	// 매 프레임. (링크가 끝난 것을 지운다, 끝났는지 묻는 것은 기다리지 않는다)
	//==============================================================================
	update() {
		if (this.#pendingPrograms.length === 0) {
			return;
		}
		const webGL2RenderingContext = this.getWebGL2RenderingContext();
		const parallelExtension = this.getParallelExtension();
		const completionStatus = parallelExtension.COMPLETION_STATUS_KHR;
		const pendingPrograms = this.#pendingPrograms;
		this.#pendingPrograms = pendingPrograms.filter((pendingProgram) => {
			const program = pendingProgram.program;
			const vertexShader = pendingProgram.vertexShader;
			const fragmentShader = pendingProgram.fragmentShader;
			const isCompleted = webGL2RenderingContext.getProgramParameter(program, completionStatus) === true;
			if (!isCompleted) {
				return true;
			}
			webGL2RenderingContext.deleteProgram(program);
			webGL2RenderingContext.deleteShader(vertexShader);
			webGL2RenderingContext.deleteShader(fragmentShader);
			return false;
		});
	}

	//==============================================================================
	// 다 링크했는지 반환. (확장이 없어 하지 않았으면 처음부터 true)
	//==============================================================================
	/**
	 * @returns { boolean }
	 */
	isFinished() {
		return this.#pendingPrograms.length === 0;
	}

	//==============================================================================
	// 확장을 쓸 수 있는지 반환. (false 면 미리 링크를 하지 않는다)
	//==============================================================================
	/**
	 * @returns { boolean }
	 */
	isSupported() {
		return this.getParallelExtension() !== null;
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
	// 병렬 링크 확장 반환. (없으면 null)
	//==============================================================================
	/**
	 * @returns { object | null }
	 */
	getParallelExtension() {
		return this.#parallelExtension;
	}
}
