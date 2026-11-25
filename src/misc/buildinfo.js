//==============================================================================
// 포함 모듈 목록.
//==============================================================================
const System = globalThis;
import { Object } from "../base/object.js";

// 빌드 판을 적는 meta 의 이름. (<meta name="build-version" content="...">)
const DEFAULT_META_NAME = "build-version";
// 빌드 판을 적는 파일. (페이지 기준 상대 주소)
const DEFAULT_VERSION_JSON_PATH = "./version.json";


//==============================================================================
// 빌드 정보.
// - 배포 빌드가 적어 둔 판을 앱이 켜질 때 한 번 읽는다. 읽는 차례:
//   1. 페이지 머리의 <meta name="build-version" content="..."> 의 content. (있으면 그 글 그대로)
//   2. 없으면 version.json 을 캐시 없이(cache: "no-cache") 받는다. 새 판을 올려도 옛 판 표시가 남지 않게 한다.
//      { version, date, time, hash, ... } 꼴이고, 글은 "날짜 시각 (해시)" 이다. 해시가 없으면 version, 그것도 없으면 빈 글.
// - 읽지 못하면(파일이 없는 개발 실행 같은 것) 예외 없이 빈 글이다. setPackageVersion 으로 넣은 판이 있으면 그 글이다.
// - 게임마다 판을 쓰는 꼴이 다르면 readVersionData() 로 받은 값을 게임이 엮는다.
//==============================================================================
/**
 * @example <caption>판의 글 읽기</caption>
 * import { BuildInfo } from "./build/vanilla.js";
 *
 * const buildInfo = new BuildInfo();
 * buildInfo.setVersionJsonPath("");
 * buildInfo.setPackageVersion("1.2.3");
 * const versionText = await buildInfo.load();
 * const composedText = BuildInfo.composeText({ version: "1.2.3", date: "2026-11-26", time: "07:30", hash: "a1b2c3d" });
 * console.log(versionText, buildInfo.isLoaded(), composedText);
 */
export class BuildInfo extends Object {
	//==============================================================================
	// 멤버 변수 목록.
	//==============================================================================
	/** @private @type { string } */ #metaName;
	/** @private @type { string } */ #versionJsonPath;
	/** @private @type { string } */ #text;
	/** @private @type { object | null } */ #versionData;
	/** @private @type { boolean } */ #isLoaded;
	/** @private @type { string } */ #packageVersion; // meta 도 version.json 도 없을 때의 판.

	//==============================================================================
	// 생성.
	//==============================================================================
	/**
	 * @constructor
	 * @param { string } versionJsonPath 빌드 판 파일 주소. (기본 "./version.json")
	 */
	constructor(versionJsonPath = DEFAULT_VERSION_JSON_PATH) {
		super();
		this.#metaName = DEFAULT_META_NAME;
		this.#versionJsonPath = versionJsonPath;
		this.#text = "";
		this.#versionData = null;
		this.#isLoaded = false;
		this.#packageVersion = "";
	}

	//==============================================================================
	// meta 이름 설정. (기본 "build-version")
	//==============================================================================
	/**
	 * @param { string } metaName 판을 적은 meta 의 name.
	 */
	setMetaName(metaName) {
		this.#metaName = metaName;
	}

	//==============================================================================
	// 빌드 판 파일 주소 설정. (빈 글이면 파일을 받지 않는다)
	//==============================================================================
	/**
	 * @param { string } versionJsonPath 빌드 판 파일 주소. (빈 글이면 받지 않는다)
	 */
	setVersionJsonPath(versionJsonPath) {
		this.#versionJsonPath = versionJsonPath;
	}

	//==============================================================================
	// 읽기. (meta, 없으면 version.json. 실패해도 예외를 내지 않는다)
	//==============================================================================
	/**
	 * @returns { Promise<string> } 판의 글. (readText 와 같다)
	 */
	async load() {
		this.#text = "";
		this.#versionData = null;
		const metaText = this.readMetaText();
		if (metaText !== "") {
			this.#text = metaText;
			this.#isLoaded = true;
			return metaText;
		}
		const versionJsonPath = this.#versionJsonPath;
		if (versionJsonPath !== "") {
			try {
				const response = await System.fetch(versionJsonPath, { cache: "no-cache" });
				if (response.ok) {
					const versionData = await response.json();
					if (versionData !== null && typeof versionData === "object") {
						this.#versionData = versionData;
						this.#text = BuildInfo.composeText(versionData);
					}
				}
			}
			catch (error) {
				this.#versionData = null;
				this.#text = "";
			}
		}
		this.#isLoaded = true;
		return this.readText();
	}

	//==============================================================================
	// 페이지의 meta 에 적힌 판. (없으면 빈 글)
	//==============================================================================
	/**
	 * @returns { string } meta 의 content 를 앞뒤 공백을 떼어 돌려준 글. 없으면 빈 글.
	 */
	readMetaText() {
		const document = System.document;
		if (document === null || document === undefined) {
			return "";
		}
		const metaElement = document.querySelector(`meta[name="${this.#metaName}"]`);
		if (metaElement === null) {
			return "";
		}
		const content = metaElement.getAttribute("content");
		return typeof content === "string" ? content.trim() : "";
	}

	//==============================================================================
	// 빌드 때 넣은 판 설정. (meta 도 version.json 도 없을 때의 글, 번들러가 넣은 판 등)
	//==============================================================================
	/**
	 * @param { string } packageVersion 빌드 때 넣은 판의 글.
	 */
	setPackageVersion(packageVersion) {
		this.#packageVersion = packageVersion;
	}

	//==============================================================================
	// 빌드 때 넣은 판 반환.
	//==============================================================================
	/**
	 * @returns { string } 빌드 때 넣은 판의 글. (처음은 빈 글)
	 */
	getPackageVersion() {
		return this.#packageVersion;
	}

	//==============================================================================
	// 판의 글. (meta > version.json > 빌드 때 넣은 판, 다 없으면 빈 글)
	//==============================================================================
	/**
	 * @returns { string } 판의 글. 다 없으면 빈 글.
	 */
	readText() {
		if (this.#text !== "") {
			return this.#text;
		}
		return this.getPackageVersion();
	}

	//==============================================================================
	// version.json 에서 읽은 값. (meta 로 읽었거나 읽지 못했으면 null)
	//==============================================================================
	/**
	 * @returns { object | null } version.json 의 값. 없으면 null.
	 */
	readVersionData() {
		return this.#versionData;
	}

	//==============================================================================
	// 읽기를 마쳤는지. (실패해도 마친 것)
	//==============================================================================
	/**
	 * @returns { boolean } load 를 마쳤으면 참.
	 */
	isLoaded() {
		return this.#isLoaded;
	}

	//==============================================================================
	// version.json 값으로 판의 글 만들기. (정적, "날짜 시각 (해시)", 해시가 없으면 version, 그것도 없으면 빈 글)
	//==============================================================================
	/**
	 * @param { object } versionData { version, date, time, hash }
	 * @returns { string } 판의 글.
	 */
	static composeText(versionData) {
		const hash = typeof versionData.hash === "string" ? versionData.hash.trim() : "";
		if (hash === "") {
			return typeof versionData.version === "string" ? versionData.version.trim() : "";
		}
		const parts = [];
		if (typeof versionData.date === "string" && versionData.date !== "") {
			parts.push(versionData.date);
		}
		if (typeof versionData.time === "string" && versionData.time !== "") {
			parts.push(versionData.time);
		}
		parts.push("(" + hash + ")");
		return parts.join(" ");
	}
}
