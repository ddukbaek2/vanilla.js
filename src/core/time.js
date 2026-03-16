//==============================================================================
// 포함 모듈 목록.
//==============================================================================
import { VObject } from "../base/object.js";
import { VEngine } from "./engine.js";


//==============================================================================
// 시간.
//==============================================================================
export class VTime extends VObject {
	//==============================================================================
	// 멤버 변수 목록.
	//==============================================================================
	/** @type { number } */ timestamp;
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
	 * @param { VEngine } engine 
	 */
	constructor(engine) {
		super();
		this.timestamp = 0;
		this.TimeDelta = 0.0;
		this.ElapsedTime = 0.0;
		this.FPS = 0;
		this.FramesThisSecond = 0;
		this.LastFPSTime = 0;
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
		timestamp = timestamp / 1000;

		// 최초 시간 처리.
		if (this.timestamp === 0) {
			this.timestamp = timestamp;
			this.previousCheckTime = timestamp;
		}

		// 시간 반영.
		let timeDelta = (timestamp - this.timestamp);
		this.timestamp = timestamp;
		this.time += timeDelta;
		this.timeDelta = timeDelta;

		// 프레임 계산.
		if (timestamp >= this.previousCheckTime + 1.0) {
			this.fps = this.framesThisSecond;
			this.framesThisSecond = 0;
			this.previousCheckTime = timestamp;
		}

		// 프레임 증가.
		++this.framesThisSecond;
	}
}