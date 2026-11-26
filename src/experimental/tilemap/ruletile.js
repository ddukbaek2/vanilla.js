//==============================================================================
// 포함 모듈 목록.
//==============================================================================
const System = globalThis;
import { Object } from "../../base/object.js";
import { Tilemap } from "./tilemap.js";
import { TilemapLayer } from "./tilemaplayer.js";


//==============================================================================
// 자동 타일. (룰 타일)
// - 초안: 0.4.0 뒤 기능, API 가 바뀔 수 있다.
// - 유니티 2D Tilemap Extras 의 RuleTile 과 같은 규칙이다. 규칙마다 둘레 8 칸의 조건(상관없음, 같은 자동 타일, 다른 것)과 놓을 타일 값을 두고,
//   위에서부터 처음 맞는 규칙의 타일을 놓는다. 맞는 것이 없으면 기본 타일이다.
// - 규칙의 변환: 고정, 돌리기(조건을 시계 방향 90 도씩 돌려 보고 맞으면 타일도 그만큼 돌린다), 좌우 거울, 상하 거울, 둘 다.
//   차례는 유니티와 같다. (고정을 먼저, 돌리기는 90, 180, 270, 둘 다 거울은 좌우상하, 좌우, 상하)
// - 칸에는 타일 값만 든다. 어느 칸이 이 자동 타일인지는 gid 가 기본 타일이나 규칙 타일 가운데 하나인지로 본다.
// - 둘레는 정사각 격자의 8 칸이다. (아이소는 같은 칸 셈이라 그대로 쓴다, 육각 둘레는 범위 밖)
//==============================================================================
/**
 * @example <caption>길 자동 타일 (끝, 곧은 길, 모퉁이, 세 갈래, 네 갈래)</caption>
 * import { Experimental } from "./build/vanilla.js";
 *
 * const { RuleTile, RuleTileNeighbor, RuleTileTransform, TilemapLayer } = Experimental;
 * const any = RuleTileNeighbor.any;
 * const same = RuleTileNeighbor.this;
 * const other = RuleTileNeighbor.notThis;
 * const roadTile = new RuleTile(20);
 * roadTile.addRule([any, same, any, same, same, any, same, any], 25, RuleTileTransform.fixed);
 * roadTile.addRule([any, other, any, same, same, any, same, any], 24, RuleTileTransform.rotated);
 * roadTile.addRule([any, other, any, same, same, any, other, any], 22, RuleTileTransform.rotated);
 * roadTile.addRule([any, other, any, other, same, any, same, any], 23, RuleTileTransform.rotated);
 * roadTile.addRule([any, other, any, other, same, any, other, any], 21, RuleTileTransform.rotated);
 *
 * const layer = new TilemapLayer("road");
 * roadTile.paint(layer, 0, 0);
 * roadTile.paint(layer, 1, 0);
 * roadTile.paint(layer, 2, 0);
 * roadTile.paint(layer, 1, 1);
 * console.log(layer.getTile(0, 0), layer.getTile(1, 0), layer.getTile(2, 0), layer.getTile(1, 1));
 */


//==============================================================================
// 둘레 칸 조건. (유니티 RuleTile.TilingRuleOutput.Neighbor)
//==============================================================================
export const RuleTileNeighbor = {
	any: "any", // 상관없음.
	this: "this", // 같은 자동 타일이어야 한다.
	notThis: "not-this", // 같은 자동 타일이 아니어야 한다. (빈 칸 포함)
};


//==============================================================================
// 규칙 변환. (유니티 RuleTile.TilingRuleOutput.Transform)
//==============================================================================
export const RuleTileTransform = {
	fixed: "fixed", // 그대로만 본다.
	rotated: "rotated", // 시계 방향 90 도씩 돌려 본다.
	mirrorX: "mirror-x", // 좌우 거울로도 본다.
	mirrorY: "mirror-y", // 상하 거울로도 본다.
	mirrorXY: "mirror-xy", // 좌우, 상하, 둘 다 거울로도 본다.
};


//==============================================================================
// 둘레 8 칸의 열, 행 차이. (왼쪽 위, 위, 오른쪽 위, 왼쪽, 오른쪽, 왼쪽 아래, 아래, 오른쪽 아래, 화면 아래가 + 행)
//==============================================================================
const NEIGHBOR_OFFSETS = [-1, -1, 0, -1, 1, -1, -1, 0, 1, 0, -1, 1, 0, 1, 1, 1];


//==============================================================================
// 자동 타일 규칙 하나.
//==============================================================================
/**
 * @example <caption>오른쪽에 같은 타일이 있을 때의 규칙</caption>
 * import { Experimental } from "./build/vanilla.js";
 *
 * const { RuleTileRule, RuleTileNeighbor, RuleTileTransform } = Experimental;
 * const any = RuleTileNeighbor.any;
 * const rule = new RuleTileRule([any, any, any, any, RuleTileNeighbor.this, any, any, any], 7, RuleTileTransform.mirrorX);
 * console.log(rule.neighbors.length, rule.tile, rule.transform);
 */
export class RuleTileRule {
	//==============================================================================
	// 멤버 변수 목록.
	//==============================================================================
	/** @type { string[] } */ neighbors; // 둘레 8 칸 조건. (RuleTileNeighbor, 왼쪽 위, 위, 오른쪽 위, 왼쪽, 오른쪽, 왼쪽 아래, 아래, 오른쪽 아래)
	/** @type { number } */ tile; // 맞으면 놓을 타일 값. (뒤집기 비트를 포함한 gid)
	/** @type { string } */ transform; // 변환. (RuleTileTransform)

	//==============================================================================
	// 생성.
	//==============================================================================
	/**
	 * @param { string[] } neighbors 둘레 8 칸 조건. (모자란 칸은 상관없음, 복사해 둔다)
	 * @param { number } tile 맞으면 놓을 타일 값.
	 * @param { string } transform 변환. (RuleTileTransform, 기본 "fixed")
	 */
	constructor(neighbors, tile, transform = RuleTileTransform.fixed) {
		this.neighbors = [];
		for (let neighborIndex = 0; neighborIndex < 8; ++neighborIndex) {
			const neighbor = neighborIndex < neighbors.length ? neighbors[neighborIndex] : RuleTileNeighbor.any;
			this.neighbors.push(neighbor);
		}
		this.tile = tile >>> 0;
		this.transform = transform;
	}
}


//==============================================================================
// 자동 타일.
//==============================================================================
/**
 * @example <caption>둘레를 직접 물어 고를 타일 셈하기</caption>
 * import { Experimental } from "./build/vanilla.js";
 *
 * const { RuleTile, RuleTileNeighbor, RuleTileTransform } = Experimental;
 * const any = RuleTileNeighbor.any;
 * const wallTile = new RuleTile(1);
 * wallTile.addRule([any, any, any, any, RuleTileNeighbor.this, any, any, any], 2, RuleTileTransform.mirrorX);
 * const isWall = (column, row) => row === 0 && column >= 0 && column <= 1;
 * console.log(wallTile.resolveTile(isWall, 0, 0), wallTile.resolveTile(isWall, 1, 0) >>> 0);
 */
export class RuleTile extends Object {
	//==============================================================================
	// 멤버 변수 목록.
	//==============================================================================
	/** @private @type { number } */ #defaultTile; // 맞는 규칙이 없을 때 놓을 타일 값.
	/** @private @type { RuleTileRule[] } */ #rules; // 규칙 목록. (위에서부터 본다)

	//==============================================================================
	// 생성.
	//==============================================================================
	/**
	 * @param { number } defaultTile 맞는 규칙이 없을 때 놓을 타일 값. (gid)
	 */
	constructor(defaultTile) {
		super();
		this.#defaultTile = defaultTile >>> 0;
		this.#rules = [];
	}

	//==============================================================================
	// 기본 타일 설정.
	//==============================================================================
	/**
	 * @param { number } defaultTile 타일 값.
	 */
	setDefaultTile(defaultTile) {
		this.#defaultTile = defaultTile >>> 0;
	}

	//==============================================================================
	// 기본 타일 반환.
	//==============================================================================
	/**
	 * @returns { number } 타일 값.
	 */
	getDefaultTile() {
		return this.#defaultTile;
	}

	//==============================================================================
	// 규칙 더하기. (맨 뒤에, 앞의 규칙이 먼저 맞는다)
	//==============================================================================
	/**
	 * @param { string[] } neighbors 둘레 8 칸 조건. (RuleTileNeighbor)
	 * @param { number } tile 맞으면 놓을 타일 값.
	 * @param { string } transform 변환. (RuleTileTransform, 기본 "fixed")
	 * @returns { RuleTileRule } 더한 규칙.
	 */
	addRule(neighbors, tile, transform = RuleTileTransform.fixed) {
		const rule = new RuleTileRule(neighbors, tile, transform);
		const rules = this.getRules();
		rules.push(rule);
		return rule;
	}

	//==============================================================================
	// 규칙 목록 반환.
	//==============================================================================
	/**
	 * @returns { RuleTileRule[] } 규칙. (위에서부터 보는 차례)
	 */
	getRules() {
		return this.#rules;
	}

	//==============================================================================
	// 타일 값이 이 자동 타일인지. (gid 가 기본 타일이나 규칙 타일 가운데 하나면 참)
	//==============================================================================
	/**
	 * @param { number } tile 타일 값. (뒤집기 비트는 보지 않는다)
	 * @returns { boolean } 이 자동 타일이면 참.
	 */
	isMember(tile) {
		const tileId = Tilemap.readTileId(tile);
		if (tileId === 0) {
			return false;
		}
		const defaultTile = this.getDefaultTile();
		const defaultTileId = Tilemap.readTileId(defaultTile);
		if (tileId === defaultTileId) {
			return true;
		}
		const rules = this.getRules();
		for (const rule of rules) {
			const ruleTileId = Tilemap.readTileId(rule.tile);
			if (tileId === ruleTileId) {
				return true;
			}
		}
		return false;
	}

	//==============================================================================
	// 둘레에 맞는 타일 값 셈하기.
	//==============================================================================
	/**
	 * @param { Function } isThisHandler (column, row) => boolean, 그 칸이 이 자동 타일이면 참.
	 * @param { number } column 열.
	 * @param { number } row 행.
	 * @returns { number } 놓을 타일 값. (규칙의 변환을 건 값, 맞는 것이 없으면 기본 타일)
	 */
	resolveTile(isThisHandler, column, row) {
		const rules = this.getRules();
		for (const rule of rules) {
			if (this.matchRule(rule, isThisHandler, column, row, 0, false, false)) {
				return rule.tile;
			}
			switch (rule.transform) {
				case RuleTileTransform.rotated: {
						for (let turnCount = 1; turnCount < 4; ++turnCount) {
							if (this.matchRule(rule, isThisHandler, column, row, turnCount, false, false)) {
								return Tilemap.rotateTile(rule.tile, turnCount);
							}
						}
						break;
					}
				case RuleTileTransform.mirrorXY: {
						if (this.matchRule(rule, isThisHandler, column, row, 0, true, true)) {
							const horizontalTile = Tilemap.flipTileHorizontally(rule.tile);
							return Tilemap.flipTileVertically(horizontalTile);
						}
						if (this.matchRule(rule, isThisHandler, column, row, 0, true, false)) {
							return Tilemap.flipTileHorizontally(rule.tile);
						}
						if (this.matchRule(rule, isThisHandler, column, row, 0, false, true)) {
							return Tilemap.flipTileVertically(rule.tile);
						}
						break;
					}
				case RuleTileTransform.mirrorX: {
						if (this.matchRule(rule, isThisHandler, column, row, 0, true, false)) {
							return Tilemap.flipTileHorizontally(rule.tile);
						}
						break;
					}
				case RuleTileTransform.mirrorY: {
						if (this.matchRule(rule, isThisHandler, column, row, 0, false, true)) {
							return Tilemap.flipTileVertically(rule.tile);
						}
						break;
					}
				default: {
						break;
					}
			}
		}
		return this.getDefaultTile();
	}

	//==============================================================================
	// 규칙 하나가 둘레에 맞는지. (조건을 시계 방향으로 돌리거나 거울로 비춘 자리에서 본다)
	//==============================================================================
	/**
	 * @private
	 * @param { RuleTileRule } rule
	 * @param { Function } isThisHandler
	 * @param { number } column
	 * @param { number } row
	 * @param { number } clockwiseQuarterTurnCount
	 * @param { boolean } isMirrorX
	 * @param { boolean } isMirrorY
	 * @returns { boolean }
	 */
	matchRule(rule, isThisHandler, column, row, clockwiseQuarterTurnCount, isMirrorX, isMirrorY) {
		for (let neighborIndex = 0; neighborIndex < 8; ++neighborIndex) {
			const neighbor = rule.neighbors[neighborIndex];
			if (neighbor === RuleTileNeighbor.any) {
				continue;
			}
			let offsetColumn = NEIGHBOR_OFFSETS[neighborIndex * 2];
			let offsetRow = NEIGHBOR_OFFSETS[neighborIndex * 2 + 1];
			for (let turnIndex = 0; turnIndex < clockwiseQuarterTurnCount; ++turnIndex) {
				// 화면 기준 시계 방향 90 도. (오른쪽 → 아래)
				const turnedColumn = -offsetRow;
				offsetRow = offsetColumn;
				offsetColumn = turnedColumn;
			}
			if (isMirrorX) {
				offsetColumn = -offsetColumn;
			}
			if (isMirrorY) {
				offsetRow = -offsetRow;
			}
			const isThis = isThisHandler(column + offsetColumn, row + offsetRow);
			if (neighbor === RuleTileNeighbor.this && !isThis) {
				return false;
			}
			if (neighbor === RuleTileNeighbor.notThis && isThis) {
				return false;
			}
		}
		return true;
	}

	//==============================================================================
	// 층의 칸 하나를 둘레에 맞게 다시 고르기. (이 자동 타일인 칸만 고친다)
	//==============================================================================
	/**
	 * @param { TilemapLayer } layer 층.
	 * @param { number } column 열.
	 * @param { number } row 행.
	 */
	refresh(layer, column, row) {
		const tile = layer.getTile(column, row);
		if (!this.isMember(tile)) {
			return;
		}
		const isThisHandler = (neighborColumn, neighborRow) => {
			const neighborTile = layer.getTile(neighborColumn, neighborRow);
			return this.isMember(neighborTile);
		};
		const resolvedTile = this.resolveTile(isThisHandler, column, row);
		layer.setTile(column, row, resolvedTile);
	}

	//==============================================================================
	// 층의 칸에 이 자동 타일 칠하기. (그 칸과 둘레 8 칸을 다시 고른다)
	//==============================================================================
	/**
	 * @param { TilemapLayer } layer 층.
	 * @param { number } column 열.
	 * @param { number } row 행.
	 */
	paint(layer, column, row) {
		const defaultTile = this.getDefaultTile();
		layer.setTile(column, row, defaultTile);
		this.refreshAround(layer, column, row);
	}

	//==============================================================================
	// 층의 칸 지우기. (둘레 8 칸을 다시 고른다)
	//==============================================================================
	/**
	 * @param { TilemapLayer } layer 층.
	 * @param { number } column 열.
	 * @param { number } row 행.
	 */
	erase(layer, column, row) {
		layer.setTile(column, row, 0);
		this.refreshAround(layer, column, row);
	}

	//==============================================================================
	// 칸과 둘레 8 칸 다시 고르기.
	//==============================================================================
	/**
	 * @param { TilemapLayer } layer 층.
	 * @param { number } column 열.
	 * @param { number } row 행.
	 */
	refreshAround(layer, column, row) {
		for (let rowOffset = -1; rowOffset <= 1; ++rowOffset) {
			for (let columnOffset = -1; columnOffset <= 1; ++columnOffset) {
				this.refresh(layer, column + columnOffset, row + rowOffset);
			}
		}
	}
}
