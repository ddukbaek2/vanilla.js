//==============================================================================
// 포함 모듈 목록.
//==============================================================================
import { VObject } from "../base/object.js";
import { VVector2 } from "../base/vector2.js";
import { VRect } from "../base/rect.js";
import { VEngine } from "./engine.js";


//==============================================================================
// 뷰 인스턴스.
//==============================================================================
export class VView extends VObject {
	//==============================================================================
	// 멤버 변수 목록.
	//==============================================================================
	/** @public @type { number } */ devicePixelRatio;
	/** @public @type { number } */ scale;
	/** @public @type { VVector2 } */ resolution; // 원하는 영역.
	/** @public @type { VVector2 } */ screen; // 전체 화면 영역.
	/** @public @type { VRect } */ view; // 보여지는 실제 영역.


	//==============================================================================
	// 생성.
	//==============================================================================
	/**
	 * @constructor
	 * @param { VEngine } engine 
	 */
	constructor(engine) {
		super();
		this.devicePixelRatio = 1;
		this.scale = 1;
		this.resolution = VVector2.zero();
		this.screen = VVector2.zero();
		this.view = VRect.zero();
	}
	
	//==============================================================================
	// 갱신.
	//==============================================================================
	update() {

	}

	//==============================================================================
	// 대상 좌표가 클라이언트 영역 안에 존재하는지 여부.
	//==============================================================================
	/**
	 * @public
	 * @method
	 * @param { number } touchX
	 * @param { number } touchY 
	 */
	isInsideView(touchX, touchY) {
		return (
			touchX >= this.view.position.x &&
			touchX <= this.view.position.x + this.view.size.x &&
			touchY >= this.view.position.y &&
			touchY <= this.view.position.y + this.view.size.y
		);
	}
}