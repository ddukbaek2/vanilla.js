//==============================================================================
// 포함 모듈 목록.
//==============================================================================
import { VObject } from "../base/object.js";
import { VVector2 } from "../base/vector2.js";


//==============================================================================
// 뷰 인스턴스.
//==============================================================================
export class VView extends VObject {
	//==============================================================================
	// 멤버 변수 목록.
	//==============================================================================
	ScreenWidth = 0;
	ScreenHeight = 0;
	devicePixelRatio = 1;
	X = 0;
	Y = 0;
	width = 0;
	height = 0;
	Scale = 1;

	/** @type { VVector2 } */ Screen = null;
	/** @type { VVector2 } */ View = null;
	/** @type { VVector2 } */ Local = null;
	

	//==============================================================================
	// 생성.
	//==============================================================================
	constructor(args) {
		super();

		this.Screen = VVector2.zero();
		this.view = VVector2.zero();
		this.Local = VVector2.zero();

		this.ScreenWidth = 0;
		this.ScreenHeight = 0;
		this.devicePixelRatio = 1;
		this.X = 0;
		this.Y = 0;
		this.width = 0;
		this.height = 0;
		this.Scale = 1;
	}
}