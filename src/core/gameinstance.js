//==============================================================================
// 포함 모듈 목록.
//==============================================================================
import { VObject } from "../base/object.js";
import { VVector2 } from "../base/vector2.js";
import { VEngine } from "./engine.js";
import { VRenderer } from "./renderer.js";


//==============================================================================
// 게임 인스턴스.
//==============================================================================
export class VGameInstance extends VObject
{
	//==============================================================================
	// 멤버 변수 목록.
	//==============================================================================
	/** @type { VEngine } */ #engine = null;

	//==============================================================================
	// 생성.
	//==============================================================================
	constructor(args) {
		super();
	}

	//==============================================================================
	// 초기화됨.
	//==============================================================================
	/**
	 * @param { VEngine } engine 
	 */
	initialize(engine) {
		this.#engine = engine;
	}

	//==============================================================================
	// 갱신됨.
	//==============================================================================
	/**
	 * @param { number } timeDelta 
	 */
	update(timeDelta) {

	}
	
	//==============================================================================
	// 출력됨.
	//==============================================================================
	/**
	 * @method
	 * @param { VRenderer } renderer 
	 */
	draw(renderer) {
		this.#engine.viewIdentity();
		this.#engine.gameViewIdentity();
	}

	//==============================================================================
	// 사이즈 변경됨.
	//==============================================================================
	/**
	 * @param { VEngine } engine 
	 */
	resize(engine) {

	}

	//==============================================================================
	// 엔진 반환.
	//==============================================================================
	/**
	 * @returns { VEngine }
	 */
	getEngine() {
		return this.#engine;
	}

	//==============================================================================
	// 이미지 크기 맞추기.
	//==============================================================================
	/**
	 * @param { VVector2 } targetSize 
	 * @param { VVector2 } viewSize
	 * @param { boolean } adjustWidth
	 */
	static adjustSizeFit(targetSize, viewSize, adjustWidth = true) {
		let adjustSize = VVector2.create(viewSize.y, viewSize.y);

		// 대상이 가로가 더 길 경우.
		if (adjustWidth) {
			// 대상의 가로가 뷰의 가로보다 짧으면 원본 반환.
			if (targetSize.x <= viewSize.x)
				return targetSize;

			// 가로를 뷰 크기에 맞추고, 가로의 감소된 비율을 세로에 곱함. (작은걸 큰것으로 나누어야 줄어든 비율)
			adjustSize.x = viewSize.x;
			adjustSize.y = targetSize.y * (viewSize.x / targetSize.x);	
		}
		else {
			// 대상의 세로가 뷰의 세로보다 짧으면 원본 반환.
			if (targetSize.y <= viewSize.y)
				return targetSize;

			// 세로를 뷰 크기에 맞추고, 세로의 감소된 비율을 세로에 곱함. (작은걸 큰것으로 나누어야 줄어든 비율)
			adjustSize.y = viewSize.y;
			adjustSize.x = targetSize.x * (viewSize.y / targetSize.y);		
		}

		return adjustSize;
	}

	//==============================================================================
	// 이미지 크기 맞추기.
	//==============================================================================
	/**
	 * 
	 * @param { VVector2 } targetSize 
	 * @param { VVector2 } viewSize 
	 */
	static adjustSizeFitByLong(targetSize, viewSize) {
		const adjustWidth = (targetSize.x > targetSize.y);
		const adjustSize = Game.adjustSizeFit(targetSize, viewSize, adjustWidth);
		return adjustSize;
	}
}