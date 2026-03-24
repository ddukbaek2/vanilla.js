//==============================================================================
// 포함 모듈 목록.
//==============================================================================
import { Object } from "../base/object.js";
import { Engine } from "./engine.js";


//==============================================================================
// 시간 매니저.
//==============================================================================
export class TimeManager extends Object {
	//==============================================================================
	// 멤버 변수 목록.
	//==============================================================================
	/** @type { number } */ realtimeSinceStartup;
	/** @type { number } */ timeDelta;
	/** @type { number } */ time;
	/** @type { number } */ fps;
	/** @type { number } */ framesThisSecond;
	/** @type { number } */ previousCheckTime;

	//==============================================================================
	// 생성.
	//==============================================================================
	/**
	 * @constructor
	 * @param { Engine } engine 
	 */
	constructor(engine) {
		super();
		this.realtimeSinceStartup = 0;
		this.timeDelta = 0.0;
		this.time = 0.0;
		this.fps = 0;
		this.framesThisSecond = 0;
		this.previousCheckTime = 0;
	}

	//==============================================================================
	// 갱신.
	//==============================================================================
	/**
	 * @public
	 * @method
	 * @param { number } timestamp
	 */
	update(timestamp) {
		// timestamp: 현재 웹페이지의 생명주기가 시작된 후부터 경과된 시간. (밀리초)
		// 이를 초 단위로 변환해서 사용함.
		const realtimeSinceStartup = timestamp * 0.001;

		// 최초 시간 처리.
		if (this.realtimeSinceStartup === 0) {
			this.realtimeSinceStartup = realtimeSinceStartup;
			this.previousCheckTime = realtimeSinceStartup;
		}

		// 시간 반영.
		const timeDelta = (realtimeSinceStartup - this.realtimeSinceStartup);
		this.realtimeSinceStartup = realtimeSinceStartup;
		this.time += timeDelta;
		this.timeDelta = timeDelta;

		// 프레임 계산.
		if (realtimeSinceStartup >= this.previousCheckTime + 1.0) {
			this.fps = this.framesThisSecond;
			this.framesThisSecond = 0;
			this.previousCheckTime = realtimeSinceStartup;
		}

		// 프레임 증가.
		++this.framesThisSecond;
	}
}