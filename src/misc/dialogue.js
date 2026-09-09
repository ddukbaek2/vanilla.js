//==============================================================================
// 포함 모듈 목록.
//==============================================================================
const System = globalThis;
import { Object } from "../base/object.js";


//==============================================================================
// 대사 진행기.
// - {speaker, text} 대사와 선택지 / 라벨 / 점프로 이루어진 대본을 순서대로 해석한다.
//   비주얼노벨 / RPG 대화 / 튜토리얼이 제각각 만들던 상태기계를 표준화했다.
// - 대본 항목 형식:
//     { speaker: "이름", text: "대사" }
//     { label: "이름표" }
//     { jump: "이름표" }
//     { choice: [{ text: "보기", jump: "이름표" }, ...] }
//     { end: true }
// - 사용:
//     runner.setScript(entries); runner.start();
//     runner.getCurrent()   → { kind: "line" | "choice" | "finished", ... }
//     대사에서 runner.advance(), 선택지에서 runner.choose(index).
//==============================================================================
export class DialogueRunner extends Object {
	//==============================================================================
	// 멤버 변수 목록.
	//==============================================================================
	/** @private @type { object[] } */ #entryList;
	/** @private @type { Map } */ #labelTable;
	/** @private @type { number } */ #cursor;
	/** @private @type { boolean } */ #isFinished;

	//==============================================================================
	// 생성.
	//==============================================================================
	constructor() {
		super();
		this.#entryList = [];
		this.#labelTable = new System.Map();
		this.#cursor = 0;
		this.#isFinished = true;
	}

	//==============================================================================
	// 대본 설정.
	//==============================================================================
	/**
	 * @param { object[] } entryList
	 */
	setScript(entryList) {
		this.#entryList = entryList ? entryList : [];
		this.#labelTable.clear();
		for (let index = 0; index < this.#entryList.length; ++index) {
			const entry = this.#entryList[index];
			if (entry.label !== undefined) {
				this.#labelTable.set(entry.label, index);
			}
		}
		this.#cursor = 0;
		this.#isFinished = true;
	}

	//==============================================================================
	// 시작. (라벨을 넘기면 그 지점부터)
	//==============================================================================
	/**
	 * @param { string | null } labelName
	 */
	start(labelName = null) {
		this.#isFinished = (this.#entryList.length === 0);
		this.#cursor = 0;
		if (labelName !== null && this.#labelTable.has(labelName)) {
			this.#cursor = this.#labelTable.get(labelName);
		}
		this.skipToPresentable();
	}

	//==============================================================================
	// 현재 항목 반환.
	// - { kind: "line", speaker, text } | { kind: "choice", options: [{text}] } | { kind: "finished" }
	//==============================================================================
	/**
	 * @returns { object }
	 */
	getCurrent() {
		if (this.#isFinished) {
			return { kind: "finished" };
		}
		const entry = this.#entryList[this.#cursor];
		if (entry.choice !== undefined) {
			return { kind: "choice", options: entry.choice.map((option) => ({ text: option.text })) };
		}
		return { kind: "line", speaker: entry.speaker !== undefined ? entry.speaker : "", text: entry.text !== undefined ? entry.text : "" };
	}

	//==============================================================================
	// 다음으로. (대사 항목에서 부른다 — 선택지 위에서는 무시)
	//==============================================================================
	advance() {
		if (this.#isFinished) {
			return;
		}
		const entry = this.#entryList[this.#cursor];
		if (entry.choice !== undefined) {
			return;
		}
		this.#cursor += 1;
		this.skipToPresentable();
	}

	//==============================================================================
	// 선택. (선택지 항목에서 부른다)
	//==============================================================================
	/**
	 * @param { number } optionIndex
	 */
	choose(optionIndex) {
		if (this.#isFinished) {
			return;
		}
		const entry = this.#entryList[this.#cursor];
		if (entry.choice === undefined) {
			return;
		}
		const option = entry.choice[optionIndex];
		if (!option) {
			return;
		}
		if (option.jump !== undefined && this.#labelTable.has(option.jump)) {
			this.#cursor = this.#labelTable.get(option.jump);
		}
		else {
			this.#cursor += 1;
		}
		this.skipToPresentable();
	}

	//==============================================================================
	// 보여 줄 수 있는 항목까지 이동. (라벨 / 점프 / 끝 처리 — 무한 루프 가드 포함)
	//==============================================================================
	/**
	 * @private
	 */
	skipToPresentable() {
		let guardCount = this.#entryList.length + 8;
		while (guardCount > 0) {
			guardCount -= 1;
			if (this.#cursor >= this.#entryList.length) {
				this.#isFinished = true;
				return;
			}
			const entry = this.#entryList[this.#cursor];
			if (entry.end === true) {
				this.#isFinished = true;
				return;
			}
			if (entry.label !== undefined) {
				this.#cursor += 1;
				continue;
			}
			if (entry.jump !== undefined) {
				if (this.#labelTable.has(entry.jump)) {
					this.#cursor = this.#labelTable.get(entry.jump) + 1;
				}
				else {
					this.#cursor += 1;
				}
				continue;
			}
			this.#isFinished = false;
			return;
		}

		// 라벨 / 점프만 맴도는 잘못된 대본이면 끝낸다.
		this.#isFinished = true;
	}

	//==============================================================================
	// 종료 여부.
	//==============================================================================
	/**
	 * @returns { boolean }
	 */
	isFinished() {
		return this.#isFinished;
	}
}


//==============================================================================
// 대본 파서.
// - 한 줄 명령어 텍스트를 DialogueRunner 대본으로 바꾼다. 형식:
//     /label 이름표
//     /jump 이름표
//     /speaker 화자이름            (이후 /say 의 기본 화자)
//     /say 대사 내용
//     /option 보기 텍스트 -> 이름표   (연달아 쓴 /option 은 하나의 선택지로 묶인다)
//     /end
//   "/" 로 시작하지 않는 줄은 직전 화자의 /say 로 본다. "//" 는 주석.
//==============================================================================
export class DialogueScriptParser extends Object {
	//==============================================================================
	// 파싱. (정적)
	//==============================================================================
	/**
	 * @param { string } scriptText
	 * @returns { object[] } DialogueRunner 대본.
	 */
	static parse(scriptText) {
		const entryList = [];
		let currentSpeaker = "";
		let pendingChoice = null;
		const flushChoice = () => {
			if (pendingChoice) {
				entryList.push({ choice: pendingChoice });
				pendingChoice = null;
			}
		};
		for (const rawLine of scriptText.split("\n")) {
			const line = rawLine.trim();
			if (line.length === 0 || line.indexOf("//") === 0) {
				continue;
			}
			if (line.indexOf("/option ") === 0) {
				const body = line.substring("/option ".length);
				const arrowIndex = body.indexOf("->");
				let optionText = body;
				let jumpLabel = undefined;
				if (arrowIndex >= 0) {
					optionText = body.substring(0, arrowIndex).trim();
					jumpLabel = body.substring(arrowIndex + 2).trim();
				}
				if (!pendingChoice) {
					pendingChoice = [];
				}
				pendingChoice.push(jumpLabel !== undefined ? { text: optionText, jump: jumpLabel } : { text: optionText });
				continue;
			}
			flushChoice();
			if (line.indexOf("/label ") === 0) {
				entryList.push({ label: line.substring("/label ".length).trim() });
			}
			else if (line.indexOf("/jump ") === 0) {
				entryList.push({ jump: line.substring("/jump ".length).trim() });
			}
			else if (line.indexOf("/speaker ") === 0) {
				currentSpeaker = line.substring("/speaker ".length).trim();
			}
			else if (line.indexOf("/say ") === 0) {
				entryList.push({ speaker: currentSpeaker, text: line.substring("/say ".length) });
			}
			else if (line === "/end") {
				entryList.push({ end: true });
			}
			else if (line.indexOf("/") === 0) {

				// 모르는 명령어는 건너뛴다.
				continue;
			}
			else {
				entryList.push({ speaker: currentSpeaker, text: line });
			}
		}
		flushChoice();
		return entryList;
	}
}
