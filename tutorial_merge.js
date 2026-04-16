//==============================================================================
// 포함 모듈 목록.
//==============================================================================
const System = globalThis;
import * as Math from "./src/base/math.js";
import { Object } from "./src/base/object.js";
import { Vector2 as Vec2 } from "./src/base/vector2.js";
import { Rect } from "./src/base/rect.js";
import { Colors } from "./src/base/colors.js";
import { Pivot } from "./src/base/pivot.js";
import { Engine, EngineConfiguration } from "./src/core/engine.js";
import { Graphic } from "./src/core/graphic.js";
import { Scene } from "./src/core/scene.js";
import { Tween } from "./src/core/tween.js";
import { Enum } from "./src/base/identifier.js";
import { ViewScaleMode } from "./src/core/viewmanager.js";
import { WorldNode } from "./src/core/node/worldnode.js";


//==============================================================================
// 전역 상수 목록.
//==============================================================================
const GRID_COLUMNS = 7;
const GRID_ROWS = 7;
const CELL_SIZE = 100;
const BOARD_X = 50;
const BOARD_Y = 200;
const JELLY_SPAWN_TIME = 2.0;


//==============================================================================
// 게임 상태.
//==============================================================================
const GameState = {
	ready: Enum.begin(),
	playing: Enum.auto(),
};


//==============================================================================
// 젤리 색상.
//==============================================================================
const JellyColors = [
	"#4488ff",
	"#44cc44",
	"#ff88aa",
	"#9944cc",
	"#ff4444",
	"#ffcc00",
];


//==============================================================================
// 젤리.
//==============================================================================
class Jelly extends Object {
	//==============================================================================
	// 멤버 변수 목록.
	//==============================================================================
	/** @type { number } */ id;
	/** @type { WorldNode } */ node;
	/** @type { Vec2 } */ point;
	/** @type { number } */ type;
	/** @type { number } */ level;
	/** @type { boolean } */ isAnimating;

	//==============================================================================
	// 생성.
	//==============================================================================
	constructor(type, level) {
		super();
		this.id = this.getInstanceId();
		this.node = new WorldNode();
		this.node.setPivot(Pivot.middleCenter);
		this.node.setContentSize(Vec2.create(CELL_SIZE, CELL_SIZE));
		this.point = Vec2.zero();
		this.type = type;
		this.level = level;
		this.isAnimating = false;
	}
}


//==============================================================================
// 튜토리얼 - 결합 퍼즐 게임 (백업용).
//==============================================================================
class TutorialMerge extends Scene {
	//==============================================================================
	// 멤버 변수 목록.
	//==============================================================================
	/** @type { number } */ #gameState;
	/** @type { Array<Array<Jelly|null>> } */ #grid;
	/** @type { Jelly[] } */ #jellies;
	/** @type { number } */ #score;
	/** @type { number } */ #spawnTime;
	/** @type { Jelly } */ #draggedJelly;
	/** @type { Vec2 } */ #dragOffset;
	/** @type { Vec2 } */ #startButtonPosition;
	/** @type { Vec2 } */ #startButtonSize;
	/** @type { number } */ #boardX;
	/** @type { number } */ #boardY;
	/** @type { number } */ #cellSize;
	/** @type { boolean } */ #isDragging;

	//==============================================================================
	// 초기화.
	//==============================================================================
	/**
	 * @param { Engine } engine
	 */
	initialize(engine) {
		super.initialize(engine);

		const viewManager = engine.getViewManager();
		viewManager.setViewScaleMode(ViewScaleMode.stretchHeight);
		const viewSize = viewManager.getViewSize();

		this.#startButtonPosition = viewSize.multiply(0.5).add(Vec2.create(0, 400));
		this.#startButtonSize = Vec2.create(244, 92);

		this.reset();
	}

	//==============================================================================
	// 재시작.
	//==============================================================================
	reset() {
		this.#grid = System.Array(GRID_COLUMNS).fill(null).map(() => System.Array(GRID_ROWS).fill(null));
		this.#jellies = [];
		this.#score = 0;
		this.#gameState = GameState.ready;
		this.#spawnTime = JELLY_SPAWN_TIME;
		this.#draggedJelly = null;
		this.#dragOffset = Vec2.zero();
		this.#isDragging = false;

		this.#boardX = BOARD_X + 20;
		this.#boardY = BOARD_Y + 20;
		this.#cellSize = CELL_SIZE - 6;
	}

	//==============================================================================
	// 갱신.
	//==============================================================================
	/**
	 * @param { number } timeDelta
	 */
	tick(timeDelta) {
		super.tick(timeDelta);
		const engine = this.getEngine();
		const inputManager = engine.getInputManager();
		const viewInputPosition = inputManager.getViewInputPosition();

		switch (this.#gameState) {
			case GameState.ready: {
				const halfButtonSizeX = this.#startButtonSize.x * 0.5;
				const halfButtonSizeY = this.#startButtonSize.y * 0.5;
				const buttonLeft = this.#startButtonPosition.x - halfButtonSizeX;
				const buttonRight = this.#startButtonPosition.x + halfButtonSizeX;
				const buttonTop = this.#startButtonPosition.y - halfButtonSizeY;
				const buttonBottom = this.#startButtonPosition.y + halfButtonSizeY;
				const isInsideButton = viewInputPosition.x >= buttonLeft && viewInputPosition.x <= buttonRight && viewInputPosition.y >= buttonTop && viewInputPosition.y <= buttonBottom;
				if (inputManager.isTouchPressed() && isInsideButton) {
					this.#gameState = GameState.playing;
					for (let i = 0; i < 5; ++i) {
						this.createRandomJelly();
					}
				}
				break;
			}

			case GameState.playing: {
				this.#spawnTime -= timeDelta;
				if (this.#spawnTime <= 0 && !this.#isDragging) {
					this.createRandomJelly();
					this.#spawnTime = JELLY_SPAWN_TIME;
				}

				// 터치 시작.
				if (inputManager.isTouchPressed()) {
					const jelly = this.getJellyAtPoint(viewInputPosition);
					if (jelly) {
						this.#draggedJelly = jelly;
						this.#dragOffset = viewInputPosition.subtract(jelly.node.getPosition());
						this.#grid[jelly.point.x][jelly.point.y] = null;
						this.#isDragging = true;
					}
				}

				// 터치 드래그.
				if (inputManager.isTouchMoved() && this.#draggedJelly) {
					const newPosition = viewInputPosition.subtract(this.#dragOffset);
					this.#draggedJelly.node.setPosition(newPosition);
				}

				// 터치 종료.
				if (inputManager.isTouchReleased() && this.#draggedJelly) {
					const releasedJelly = this.#draggedJelly;
					this.#draggedJelly = null;
					this.#isDragging = false;

					const targetPoint = this.getGridPoint(viewInputPosition);
					const targetJelly = targetPoint ? this.#grid[targetPoint.x][targetPoint.y] : null;

					// 결합.
					if (targetJelly &&
						targetJelly.id !== releasedJelly.id &&
						targetJelly.type === releasedJelly.type &&
						targetJelly.level === releasedJelly.level
					) {
						this.#jellies = this.#jellies.filter(j => j.id !== releasedJelly.id);

						++targetJelly.level;

						const finalScaleValue = 0.5 + (targetJelly.level * 0.1);
						targetJelly.node.setScale(Vec2.zero());
						targetJelly.isAnimating = true;

						const tween = new Tween({ scale: 0 })
							.to({ scale: finalScaleValue }, 0.4)
							.easing(Tween.easingFunction.back.out)
							.setUpdate(v => {
								targetJelly.node.setScale(Vec2.one().multiply(v.scale));
							})
							.setComplete(() => {
								targetJelly.isAnimating = false;
							});
						this.startTween(tween);
						this.#score += targetJelly.level * 10;
					}
					// 이동.
					else if (targetPoint && !targetJelly) {
						releasedJelly.point.set(targetPoint.x, targetPoint.y);
						this.#grid[targetPoint.x][targetPoint.y] = releasedJelly;
						const newPosition = this.gridToWorldPosition(releasedJelly.point);

						releasedJelly.isAnimating = true;

						const startPosition = releasedJelly.node.getPosition();
						const tween = new Tween({ x: startPosition.x, y: startPosition.y })
							.to({ x: newPosition.x, y: newPosition.y }, 0.2)
							.easing(Tween.easingFunction.back.out)
							.setUpdate(v => {
								releasedJelly.node.setPosition(Vec2.create(v.x, v.y));
							})
							.setComplete(() => {
								releasedJelly.isAnimating = false;
							});
						this.startTween(tween);
					}
					// 돌아가기.
					else {
						if (releasedJelly && releasedJelly.point) {
							this.#grid[releasedJelly.point.x][releasedJelly.point.y] = releasedJelly;
							const originalPosition = this.gridToWorldPosition(releasedJelly.point);

							releasedJelly.isAnimating = true;

							const startPosition = releasedJelly.node.getPosition();
							const tween = new Tween({ x: startPosition.x, y: startPosition.y })
								.to({ x: originalPosition.x, y: originalPosition.y }, 0.3)
								.easing(Tween.easingFunction.back.out)
								.setUpdate(v => {
									releasedJelly.node.setPosition(Vec2.create(v.x, v.y));
								})
								.setComplete(() => {
									releasedJelly.isAnimating = false;
								});
							this.startTween(tween);
						}
					}
				}
				break;
			}
		}
	}

	//==============================================================================
	// 출력.
	//==============================================================================
	/**
	 * @param { Graphic } graphic
	 */
	draw(graphic) {
		super.draw(graphic);

		const engine = this.getEngine();
		const canvasRenderingContext = graphic.getCanvasRenderingContext();
		const viewManager = engine.getViewManager();
		const canvasNativeSize = viewManager.getCanvasNativeSize();
		const viewSize = viewManager.getViewSize();

		// 전체 화면 칠하기.
		viewManager.applyCanvasNativeRect(canvasRenderingContext);
		canvasRenderingContext.fillStyle = Colors.darkVanilla;
		graphic.drawRect(Rect.create(0, 0, canvasNativeSize.x, canvasNativeSize.y));

		// 게임 영역 칠하기.
		viewManager.applyViewRect(canvasRenderingContext);
		canvasRenderingContext.fillStyle = "#2a2a3a";
		canvasRenderingContext.fillRect(0, 0, viewSize.x, viewSize.y);

		// 보드판 출력.
		const boardWidth = GRID_COLUMNS * CELL_SIZE;
		const boardHeight = GRID_ROWS * CELL_SIZE;
		canvasRenderingContext.fillStyle = "#3a3a5a";
		canvasRenderingContext.fillRect(BOARD_X, BOARD_Y, boardWidth, boardHeight);

		// 보드판 각 칸 출력.
		canvasRenderingContext.strokeStyle = "#555577";
		canvasRenderingContext.lineWidth = 2;
		for (let y = 0; y < GRID_ROWS; ++y) {
			for (let x = 0; x < GRID_COLUMNS; ++x) {
				const rectX = BOARD_X + x * CELL_SIZE;
				const rectY = BOARD_Y + y * CELL_SIZE;
				canvasRenderingContext.strokeRect(rectX, rectY, CELL_SIZE, CELL_SIZE);
			}
		}

		// 젤리 목록 출력.
		for (const jelly of this.#jellies) {
			if (jelly !== this.#draggedJelly) {
				this.drawJelly(canvasRenderingContext, jelly);
			}
		}

		// 드래그 중인 젤리 출력.
		if (this.#draggedJelly) {
			this.drawJelly(canvasRenderingContext, this.#draggedJelly);
		}

		// 점수 출력.
		canvasRenderingContext.fillStyle = "#ffffff";
		canvasRenderingContext.font = "bold 36px sans-serif";
		canvasRenderingContext.textAlign = "left";
		canvasRenderingContext.textBaseline = "top";
		canvasRenderingContext.fillText("Score: " + this.#score, 20, 20);

		// 상태 출력.
		if (this.#gameState === GameState.ready) {

			// 딤드 출력.
			canvasRenderingContext.fillStyle = "rgba(0, 0, 0, 0.5)";
			canvasRenderingContext.fillRect(0, 0, viewSize.x, viewSize.y);

			// 시작 버튼 출력.
			const buttonX = this.#startButtonPosition.x - this.#startButtonSize.x * 0.5;
			const buttonY = this.#startButtonPosition.y - this.#startButtonSize.y * 0.5;
			canvasRenderingContext.fillStyle = "#5588ff";
			canvasRenderingContext.fillRect(buttonX, buttonY, this.#startButtonSize.x, this.#startButtonSize.y);
			canvasRenderingContext.fillStyle = "#ffffff";
			canvasRenderingContext.font = "bold 40px sans-serif";
			canvasRenderingContext.textAlign = "center";
			canvasRenderingContext.textBaseline = "middle";
			canvasRenderingContext.fillText("START", this.#startButtonPosition.x, this.#startButtonPosition.y);
		}
	}

	//==============================================================================
	// 젤리 출력.
	//==============================================================================
	/**
	 * @param { CanvasRenderingContext2D } canvasRenderingContext
	 * @param { Jelly } jelly
	 */
	drawJelly(canvasRenderingContext, jelly) {
		const jellyPosition = jelly.node.getPosition();
		const jellyScale = jelly.node.getScale();
		const jellyRadius = (this.#cellSize * jellyScale.x) * 0.5;

		canvasRenderingContext.beginPath();
		canvasRenderingContext.arc(jellyPosition.x, jellyPosition.y, jellyRadius, 0, System.Math.PI * 2);
		canvasRenderingContext.fillStyle = JellyColors[jelly.type];
		canvasRenderingContext.fill();
		canvasRenderingContext.strokeStyle = "#ffffff";
		canvasRenderingContext.lineWidth = 3;
		canvasRenderingContext.stroke();

		canvasRenderingContext.fillStyle = "#ffffff";
		canvasRenderingContext.font = "bold " + System.Math.round(30 * jellyScale.x) + "px sans-serif";
		canvasRenderingContext.textAlign = "center";
		canvasRenderingContext.textBaseline = "middle";
		canvasRenderingContext.fillText(jelly.level.toString(), jellyPosition.x, jellyPosition.y);
	}

	//==============================================================================
	// 랜덤한 젤리 생성.
	//==============================================================================
	/**
	 * @returns { Jelly }
	 */
	createRandomJelly() {
		const emptyCells = [];
		for (let x = 0; x < GRID_COLUMNS; ++x) {
			for (let y = 0; y < GRID_ROWS; ++y) {
				if (!this.#grid[x][y]) {
					emptyCells.push(Vec2.create(x, y));
				}
			}
		}

		if (emptyCells.length === 0) {
			return;
		}

		const point = emptyCells[Math.floor(Math.random() * emptyCells.length)];
		const type = Math.floor(Math.random() * JellyColors.length);
		const level = 1;

		const jelly = new Jelly(type, level);
		jelly.point = point;
		jelly.node.setPosition(this.gridToWorldPosition(point));

		const finalScaleValue = 0.5 + (level * 0.1);
		jelly.node.setScale(Vec2.zero());
		jelly.isAnimating = true;

		const tween = new Tween({ scale: 0 })
			.to({ scale: finalScaleValue }, 0.4)
			.easing(Tween.easingFunction.back.out)
			.setUpdate(v => {
				jelly.node.setScale(Vec2.one().multiply(v.scale));
			})
			.setComplete(() => {
				jelly.isAnimating = false;
			});
		this.startTween(tween);

		this.#grid[point.x][point.y] = jelly;
		this.#jellies.push(jelly);
	}

	//==============================================================================
	// 대상 위치에 출력 중인 젤리 반환.
	//==============================================================================
	/**
	 * @param { Vec2 } viewPosition
	 * @returns { Jelly }
	 */
	getJellyAtPoint(viewPosition) {
		for (let i = this.#jellies.length - 1; i >= 0; --i) {
			const jelly = this.#jellies[i];
			if (jelly.isAnimating) {
				continue;
			}
			const jellyPosition = jelly.node.getPosition();
			const jellyScale = jelly.node.getScale();
			const jellyHalfSize = (this.#cellSize * jellyScale.x) * 0.5;
			const isInside = viewPosition.x >= jellyPosition.x - jellyHalfSize &&
				viewPosition.x <= jellyPosition.x + jellyHalfSize &&
				viewPosition.y >= jellyPosition.y - jellyHalfSize &&
				viewPosition.y <= jellyPosition.y + jellyHalfSize;
			if (isInside) {
				return jelly;
			}
		}
		return null;
	}

	//==============================================================================
	// 대상 위치에서 제일 가까운 그리드 위치 인덱스 반환.
	//==============================================================================
	/**
	 * @param { Vec2 } viewPosition
	 * @returns { Vec2 }
	 */
	getGridPoint(viewPosition) {
		const x = Math.floor((viewPosition.x - this.#boardX) / this.#cellSize);
		const y = Math.floor((viewPosition.y - this.#boardY) / this.#cellSize);

		if (x >= 0 && x < GRID_COLUMNS && y >= 0 && y < GRID_ROWS) {
			return Vec2.create(x, y);
		}
		return null;
	}

	//==============================================================================
	// 그리드 위치 인덱스에 해당하는 월드 위치를 반환.
	//==============================================================================
	/**
	 * @param { Vec2 } gridPoint
	 * @returns { Vec2 }
	 */
	gridToWorldPosition(gridPoint) {
		return Vec2.create(
			this.#boardX + (gridPoint.x * this.#cellSize) + (this.#cellSize / 2),
			this.#boardY + (gridPoint.y * this.#cellSize) + (this.#cellSize / 2)
		);
	}
}


// 캔버스 생성.
let canvas = document.getElementById("tutorial");
if (canvas === null) {
	canvas = document.createElement("canvas");
	canvas.id = "tutorial";
	document.body.appendChild(canvas);
}

// 엔진 실행.
const engineConfiguration = new EngineConfiguration();
engineConfiguration.referenceResolutionSize = Vec2.create(800, 1280);
engineConfiguration.canvasId = "tutorialCanvas";
engineConfiguration.useStatistics = true;
const engine = new Engine(engineConfiguration);
document.title = "vanilla.js - Tutorial_Merge";
const tutorial = new TutorialMerge();
engine.run(tutorial);
