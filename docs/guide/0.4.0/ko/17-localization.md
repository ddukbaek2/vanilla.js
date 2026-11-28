# 언어

화면 글자를 여러 언어로 보이고, 고른 언어를 바꾸고, 그 언어를 그릴 글꼴을 준비하는 방법을 다룹니다. 번역 표를 코드에 두는 `Localization`, 번역 표를 언어마다 JSON 파일로 두는 `LanguagePack`, 여러 문자의 글꼴 조각을 한 글꼴 이름으로 묶는 `UIFont`, 자주 바뀌는 숫자를 글자 아틀라스로 그리는 `DynamicFont`, 엔진의 기본 글꼴 차례로 봅니다.

엔진의 글자 컴포넌트(`Text`, `UILabel`)는 번역 표를 스스로 읽지 않습니다. 번역한 글을 `setText` 로 넣고, 언어를 바꾸면 다시 넣는 일은 게임이 합니다.

## Localization 으로 번역 표 쓰기

`Localization` 은 모든 메서드가 정적입니다. 언어마다 표(키 → 번역문)를 넣고, 지금 언어를 정한 뒤 `text(key)` 로 꺼냅니다.

```javascript
import { Localization } from "./build/vanilla.js";

Localization.setTable("en", {
	"menu.start": "Start",
	"hud.score": "Score {0}",
	"hud.greeting": "Hello, {0}. You have {1} coins.",
});
Localization.setTable("fr", {
	"menu.start": "Commencer",
	"hud.score": "Score {0}",
});
Localization.setFallbackLanguage("en");
Localization.setLanguage("fr");

console.log(Localization.getLanguage());
console.log(Localization.text("menu.start"));
console.log(Localization.text("hud.greeting", "Mina", 30));
console.log(Localization.text("menu.quit"));
```

- `text(key, ...substitutions)` 는 지금 언어의 표, 폴백 언어의 표, 키 원문 차례로 찾습니다. 위 예제의 `hud.greeting` 은 프랑스어 표에 없어 영어 표의 글이 나오고, 어느 표에도 없는 `menu.quit` 은 키 그대로 나옵니다.
- 키는 원문을 그대로 써도 됩니다. 표에 없으면 원문이 나오므로 번역을 조금씩 채워 갈 수 있습니다.
- `{0}`, `{1}` 처럼 번호 자리는 `text` 의 뒤 인자로 차례대로 바꿉니다.
- 지금 언어와 폴백 언어는 처음에 둘 다 `"ko"` 입니다. 언어 코드는 모두 소문자로 바꿔 둡니다.
- `clear()` 는 모든 표를 비웁니다. (시험용)

## 이름 자리와 여러 줄 항목

번역문 안의 값 자리에 이름을 붙이면 언어마다 값의 차례가 달라도 됩니다. `textNamed(key, values)` 는 번역문을 찾은 뒤 `{이름}` 자리를 `values` 의 같은 이름 값으로 채웁니다. `values` 에 없는 이름의 자리는 그대로 둡니다.

번역문은 글 배열이어도 됩니다. 대사 목록처럼 여러 줄인 항목은 `textList(key)` 로 배열을 받습니다. 글 하나인 항목이면 그 글 하나를 담은 배열, 어느 표에도 없으면 키 하나를 담은 배열입니다. `lookup(key)` 는 바꾸지 않은 원래 값(글, 배열, 없으면 `undefined`)을 돌려줍니다.

`JsonAsset` 으로 읽은 표는 `setTableFromJson(languageCode, tableJson)` 으로 넣습니다. 값이 글이면 글로, 배열이면 그 안의 글만 모아 넣고, 그 밖의 값은 건너뜁니다.

```javascript
import { Localization } from "./build/vanilla.js";

Localization.setTableFromJson("en", {
	"hud.restart": "Restart in {seconds}",
	"hud.ammo": "Ammo {count}/{limit}",
	"intro.lines": ["Long ago, the tower fell.", "One hero climbed again."],
	"meta.version": 3,
});
Localization.setLanguage("en");

console.log(Localization.textNamed("hud.restart", { seconds: 3 }));
console.log(Localization.textNamed("hud.ammo", { count: 12 }));
const introLines = Localization.textList("intro.lines");
console.log(introLines.length, introLines[0]);
console.log(Localization.lookup("meta.version"));
```

배열인 항목을 `text(key)` 로 꺼내면 글이 아니므로 키가 나옵니다. 배열 항목은 `textList` 로 꺼냅니다.

## 브라우저 언어 고르기

`detectLanguage(supportedLanguageCodes, defaultLanguageCode = "ko")` 는 브라우저가 앞세우는 언어 목록(`navigator.languages`)을 차례로 보고 지원 목록에 있는 첫 언어를 돌려줍니다. 대조하는 부분만 따로 쓰려면 `selectLanguage(candidateList, supportedLanguageCodes, defaultLanguageCode)` 에 후보 목록을 직접 넘깁니다.

- 언어 태그는 소문자로 바꾸고 밑줄을 하이픈으로 바꾼 뒤, 뒤 조각부터 하나씩 떼며 맞춥니다. `"zh-Hant-TW"` 는 `"zh-hant-tw"`, `"zh-hant"`, `"zh"` 차례로 봅니다.
- `setLanguageAliases(languageCode, aliasList)` 로 별칭을 넣으면 그 별칭도 그 언어로 봅니다.
- 돌려주는 값은 소문자 코드입니다. 맞는 것이 없으면 기본 언어 코드를 그대로 돌려줍니다.

```javascript
import { Localization } from "./build/vanilla.js";

Localization.setLanguageAliases("zh-hant", ["zh-TW", "zh-HK"]);
const supportedLanguageCodes = ["en", "ko", "zh-hant", "pt"];

console.log(Localization.selectLanguage(["pt-BR", "en-US"], supportedLanguageCodes, "en"));
console.log(Localization.selectLanguage(["zh-TW"], supportedLanguageCodes, "en"));
console.log(Localization.selectLanguage(["de-DE"], supportedLanguageCodes, "en"));

const languageCode = Localization.detectLanguage(supportedLanguageCodes, "en");
Localization.setLanguage(languageCode);
console.log(Localization.getLanguage());
```

위 예제는 차례로 `"pt"`, `"zh-hant"`, `"en"` 을 찍습니다.

## 화면에서 언어 바꾸기

언어를 바꾸는 일은 `setLanguage` 로 지금 언어를 바꾸고, 화면의 글을 모두 다시 넣는 것입니다. 엔진은 언어가 바뀐 것을 알리지 않으므로 글을 넣는 함수를 한 곳에 모아 두고 언어를 바꾼 뒤 부릅니다. 고른 언어는 `PersistedStore` 에 저장해 두면 다음에 켤 때 그대로 씁니다. (저장은 "저장" 장)

```javascript
import { Engine, EngineConfiguration, UIScene, WorldNode, UILabel, UIButton, Paint, Pivot, Vector2, Color, Localization, PersistedStore } from "./build/vanilla.js";

Localization.setTable("en", {
	"menu.title": "Dungeon Run",
	"menu.language": "Language: English",
	"menu.coins": "Coins {coins}",
});
Localization.setTable("fr", {
	"menu.title": "Course au donjon",
	"menu.language": "Langue : Français",
	"menu.coins": "Pièces {coins}",
});
Localization.setFallbackLanguage("en");

const settingsStore = new PersistedStore("mygame.settings", { language: "" }, 1);

class MenuScene extends UIScene {
	#titleLabel;
	#coinsLabel;
	#languageLabel;

	constructor() {
		super();
		this.setLoadingMinDurationMs(0);
		this.#titleLabel = null;
		this.#coinsLabel = null;
		this.#languageLabel = null;
	}

	initialize(engine) {
		super.initialize(engine);
		const settings = settingsStore.get();
		const savedLanguage = settings.language;
		const languageCode = savedLanguage !== "" ? savedLanguage : Localization.detectLanguage(["en", "fr"], "en");
		Localization.setLanguage(languageCode);

		this.#titleLabel = this.createLabel(Vector2.create(40, 40), 40);
		this.#coinsLabel = this.createLabel(Vector2.create(40, 110), 24);

		const buttonNode = new WorldNode();
		buttonNode.setPivot(Pivot.topLeft);
		buttonNode.setAnchor(Pivot.topLeft);
		buttonNode.setLocalPosition(Vector2.create(40, 180));
		buttonNode.setContentSize(Vector2.create(320, 60));
		const paint = buttonNode.addComponent(Paint);
		paint.setColor(new Color(0.2, 0.45, 0.85, 1));
		paint.setRoundSize(12);
		this.#languageLabel = buttonNode.addComponent(UILabel);
		this.#languageLabel.setFontSize(22);
		const button = buttonNode.addComponent(UIButton);
		button.setClickedEvent(() => {
			const nextLanguage = Localization.getLanguage() === "en" ? "fr" : "en";
			Localization.setLanguage(nextLanguage);
			settingsStore.set({ language: nextLanguage });
			this.refreshTexts();
		});
		const root = this.getRoot();
		root.addChild(buttonNode);

		this.refreshTexts();
	}

	createLabel(position, fontSize) {
		const labelNode = new WorldNode();
		labelNode.setPivot(Pivot.topLeft);
		labelNode.setAnchor(Pivot.topLeft);
		labelNode.setLocalPosition(position);
		labelNode.setContentSize(Vector2.create(560, fontSize + 16));
		const label = labelNode.addComponent(UILabel);
		label.setFontSize(fontSize);
		const root = this.getRoot();
		root.addChild(labelNode);
		return label;
	}

	refreshTexts() {
		this.#titleLabel.setText(Localization.text("menu.title"));
		this.#coinsLabel.setText(Localization.textNamed("menu.coins", { coins: 120 }));
		this.#languageLabel.setText(Localization.text("menu.language"));
	}
}

const engineConfiguration = new EngineConfiguration();
engineConfiguration.referenceResolutionSize = Vector2.create(640, 360);
engineConfiguration.autoResizeOnWindowResize = true;
const engine = new Engine(engineConfiguration);
engine.run(new MenuScene());
```

## 오른쪽에서 왼쪽으로 쓰는 언어

아랍어, 히브리어처럼 오른쪽에서 왼쪽으로 쓰는 언어는 글자 방향과 함께 화면 배치도 좌우로 뒤집습니다. `Localization` 은 처음부터 `ar`, `fa`, `he`, `ur`, `ps`, `yi`, `dv` 를 그런 언어로 봅니다. 언어 코드의 첫 조각으로 판단하므로 `"ar-EG"` 도 같습니다.

- `isRightToLeft()` 는 지금 언어가 그런 언어인지 돌려줍니다. `setRightToLeft(languageCode, isRightToLeft)` 로 목록에 더하거나 뺍니다.
- `mirrorLayoutX(x, width, parentWidth)` 는 왼쪽에서 오른쪽 언어일 때의 왼쪽 자리 `x` 를 받아, 오른쪽에서 왼쪽 언어면 부모 너비 안에서 뒤집은 자리(`parentWidth - x - width`)를, 아니면 `x` 를 돌려줍니다. 창과 표처럼 뒤집을 배치에만 부르고, 화면 구석에 붙은 것이나 슬라이더의 방향처럼 뒤집지 않을 것에는 부르지 않습니다.
- `readLayoutTextAlign(textAlign)` 는 오른쪽에서 왼쪽 언어면 `"left"` 와 `"right"` 를 바꿔 돌려줍니다.
- `isolateText(text)` 는 오른쪽에서 왼쪽 언어면 글을 방향 격리 문자(U+2068, U+2069)로 감쌉니다. 숫자와 단위(`+60%`)나 사람 이름이 앞뒤 글과 섞여 흩어지지 않고 한 덩어리로 놓입니다. `textNamed` 는 채운 값을 이것으로 감싸고, `"{count}/{limit}"` 처럼 빗금으로만 이은 자리들은 값마다가 아니라 통째로 한 번 감쌉니다. (값마다 감싸면 1/40 이 40/1 로 보입니다)

```javascript
import { Localization } from "./build/vanilla.js";

Localization.setLanguage("ar");
const panelLeft = Localization.mirrorLayoutX(20, 300, 1280);
const textAlign = Localization.readLayoutTextAlign("left");
const isolatedText = Localization.isolateText("+60%");
console.log(Localization.isRightToLeft(), panelLeft, textAlign, isolatedText.length);

Localization.setRightToLeft("ar", false);
console.log(Localization.isRightToLeft(), Localization.mirrorLayoutX(20, 300, 1280));
```

글자 자체의 방향은 글자 컴포넌트에서 정합니다. `Text.setTextDirection(textDirection)` 과 `UILabel.setTextDirection(textDirection)` 은 `"inherit"`(처음 값, 그리는 때의 `Graphic` 방향을 따름), `"ltr"`, `"rtl"`, `"auto"`(글의 첫 강한 글자로 정함)를 받고, 정렬 `"start"` 와 `"end"` 가 이 방향에 따라 왼쪽이나 오른쪽이 됩니다. 오른쪽에서 왼쪽 언어의 화면은 `"rtl"` 과 `"start"` 를 씁니다.

## LanguagePack 으로 언어 파일 쓰기

언어가 많고 번역가가 파일을 따로 고치는 게임은 번역 표를 코드가 아닌 애셋의 JSON 파일로 둡니다. `LanguagePack` 은 함수 묶음 모듈이라 `LanguagePack.translate(...)` 처럼 이름 공간으로 부릅니다. 상태는 모듈 하나에 하나뿐입니다.

파일은 언어 목록 하나와 언어마다 표 하나입니다. 경로는 처음에 `./assets/localization/languages.json` 과 그 폴더이고, 불러오기 전에 `setLanguagePaths(listPath, directoryPath)` 로 바꿉니다. 폴더 경로는 `/` 로 끝납니다.

```json
{
	"fallbackLanguage": "en",
	"languages": [
		{ "code": "en", "name": "English", "englishName": "English", "fontGroup": "latin", "direction": "ltr", "aliases": [], "file": "en.json" },
		{ "code": "zh-Hant", "name": "繁體中文", "englishName": "Chinese (Traditional)", "fontGroup": "tc", "direction": "ltr", "aliases": ["zh-tw", "zh-hk"], "file": "zh-hant.json" },
		{ "code": "ar", "name": "العربية", "englishName": "Arabic", "fontGroup": "arabic", "direction": "rtl", "aliases": [], "file": "ar.json" }
	]
}
```

언어 파일(`en.json` 같은 것)은 키 → 글 표 하나입니다. 모든 언어 파일은 기본 언어 파일과 같은 키를 갖게 둡니다.

```json
{
	"game.title": "Dungeon Run",
	"menu.start": "Start",
	"hud.restart": "Restart {seconds}"
}
```

- `fontGroup` 은 아래 `UIFont` 의 글꼴 묶음 이름이고, `direction` 이 `"rtl"` 이면 오른쪽에서 왼쪽 언어입니다.
- `aliases` 는 그 언어로 볼 언어 태그입니다. 소문자로 적습니다. 대조할 때 태그를 소문자로 바꿔 그대로 비교합니다.

불러오는 차례는 이렇습니다.

1. `applyLanguageSetting(settingLanguageCode)` 를 부릅니다. 설정에 저장한 언어 코드를 넘기고, 비었으면(`""`) 기기의 언어를 씁니다.
2. 쓸 언어는 설정의 코드가 목록에 있으면 그 언어, 없으면 `setPreferredLanguageTag` 로 넣은 플랫폼의 언어, 그다음 브라우저 언어 목록 차례로 목록에서 찾고(`matchLanguageTag`, 뒤 조각을 떼며 코드와 별칭을 봄), 다 없으면 목록의 `fallbackLanguage`(그것도 없으면 `"en"`)입니다.
3. 그 언어의 표와 기본 언어의 표를 받습니다. 페이지의 `<html lang>` 을 그 언어 코드로 바꾸고, `setDocumentTitleKey` 의 키(처음은 `"game.title"`, `""` 이면 바꾸지 않음)의 글이 있으면 탭 제목으로 씁니다.
4. `setLanguageLoadedHandler` 로 건 함수를 `(언어 한 줄, 그 언어의 모든 글)` 로 부르고 기다립니다. 글꼴 받기를 여기에 겁니다.

글은 `translate(key)`(지금 언어, 기본 언어, 키 차례)와 `formatText(key, values)`(이름 자리 채우기, `Localization.textNamed` 와 같은 규칙)로 꺼냅니다. 방향은 `readTextDirection()`(`"ltr"` 또는 `"rtl"`), `isRightToLeft()` 로 읽고, `mirrorLayoutX`, `readLayoutTextAlign`, `isolateText` 는 `Localization` 의 같은 이름 함수와 같게 동작합니다.

파일 없이 목록과 표를 코드로 바로 넣을 수도 있습니다. `setLanguageList(data)` 는 `languages.json` 과 같은 꼴을 받고, `setLanguageTexts(languageCode, texts, fallbackTextTable)` 는 지금 언어의 표와 기본 언어의 표를 함께 넣습니다. (목록에 없는 언어면 `false`) 이 길은 `<html lang>` 과 탭 제목을 바꾸지 않습니다.

```javascript
import { LanguagePack } from "./build/vanilla.js";

LanguagePack.setLanguageList({
	fallbackLanguage: "en",
	languages: [
		{ code: "en", name: "English", englishName: "English", fontGroup: "latin", direction: "ltr", aliases: [], file: "en.json" },
		{ code: "fr", name: "Français", englishName: "French", fontGroup: "latin", direction: "ltr", aliases: ["fr-ca"], file: "fr.json" },
	],
});

const englishTexts = {
	"game.title": "Dungeon Run",
	"menu.start": "Start",
	"hud.restart": "Restart {seconds}",
	"hud.ammo": "Ammo {count}/{limit}",
};
const frenchTexts = {
	"game.title": "Course au donjon",
	"menu.start": "Commencer",
};
LanguagePack.setLanguageTexts("fr", frenchTexts, englishTexts);

console.log(LanguagePack.readLanguageCode(), LanguagePack.readTextDirection());
console.log(LanguagePack.translate("menu.start"));
console.log(LanguagePack.formatText("hud.restart", { seconds: 3 }));
console.log(LanguagePack.formatText("hud.ammo", { count: 12, limit: 40 }));

const matchedLanguage = LanguagePack.matchLanguageTag("fr-CA");
console.log(matchedLanguage.code, LanguagePack.readLanguages().length);
```

`readLanguages()` 는 목록의 언어들(언어 창을 만들 때), `readLanguage()` 는 지금 언어의 한 줄(아직 없으면 `null`), `findLanguage(code)` 는 코드로 찾은 한 줄(대소문자 가리지 않음), `readAllTexts()` 는 지금 언어의 글을 모두 이은 글입니다.

## UIFont 로 여러 문자의 글꼴 묶기

여러 언어를 한 화면에 그리는 게임은 문자마다 다른 글꼴 파일이 필요하고, 한중일 글꼴은 파일이 매우 큽니다. `UIFont` 는 Google Fonts 처럼 글자 범위(`unicode-range`)로 나눈 글꼴 조각마다 `FontFace` 를 만들어 한 글꼴 이름(처음은 `"GameUI"`) 아래에 올립니다. 브라우저는 화면에 쓰는 글자가 든 조각만 받습니다. `LanguagePack` 처럼 함수 묶음 모듈입니다.

글꼴 목록은 색인 파일 하나와 묶음마다 조각 목록 파일 하나입니다. 처음 경로는 `./assets/fonts/fonts.json` 과 `./assets/fonts/` 입니다.

```json
{
	"fonts": [
		{ "group": "latin", "manifest": "fonts-latin.json" },
		{ "group": "tc", "manifest": "fonts-tc.json" }
	]
}
```

```json
{
	"faces": [
		{ "file": "exo2-latin.woff2", "weight": "100 900", "style": "normal", "unicodeRange": "U+0000-00FF, U+0131, U+0152-0153" }
	]
}
```

쓰는 차례는 이렇습니다.

1. 불러오기 전에 `configureUiFont(options)` 로 설정합니다. 주지 않은 칸은 그대로이고, 칸과 처음 값은 `family`(`"GameUI"`), `manifestPath`(`"./assets/fonts/fonts.json"`), `directoryPath`(`"./assets/fonts/"`), `primaryGroup`(`"latin"`), `weights`(`[500, 700]`), `waitMilliseconds`(1500), `remainingDelayMilliseconds`(3000)입니다.
2. `LanguagePack.setLanguageLoadedHandler` 에서 `loadUiFont(language.fontGroup, allTexts)` 를 부릅니다. 고른 언어의 묶음과 맨 뒤 묶음(`primaryGroup`)을 올리고, 그 언어의 글자가 든 조각을 `waitMilliseconds` 까지만 기다립니다. 나머지 묶음은 처음 한 번 `remainingDelayMilliseconds` 뒤에 받기 시작합니다. 목록을 읽지 못해도 게임은 시스템 글꼴로 이어집니다.
3. 글자 컴포넌트에는 `readUiFontFace()` 가 돌려준 `FontFace` 를 `setFont` 로 줍니다. (엔진은 그 글꼴 이름만 씁니다) 글꼴 글이 필요하면 `buildUiFontString(fontWeight, fontSize)` 가 `"700 24px \"GameUI\", sans-serif"` 꼴을 만듭니다.
4. 사람 이름처럼 그때그때 나오는 글자는 `requestUiFontText(text)` 로 조각 받기를 청합니다. 처음 보는 글자만 기다리지 않고 받습니다.
5. `EngineConfiguration.rebakeTextOnFontLoad` 를 켭니다. 캔버스는 받지 않은 조각을 기다리지 않고 다른 글꼴로 그려 버리므로, 켜 두면 조각이 받아질 때마다 그 조각의 글자로 구운 글자 텍스처만 버려 다시 굽습니다.

```javascript
import { EngineConfiguration, LanguagePack, UIFont } from "./build/vanilla.js";

const engineConfiguration = new EngineConfiguration();
engineConfiguration.rebakeTextOnFontLoad = true;

LanguagePack.setLanguagePaths("./assets/localization/languages.json", "./assets/localization/");
LanguagePack.setDocumentTitleKey("game.title");
UIFont.configureUiFont({
	family: "GameUI",
	manifestPath: "./assets/fonts/fonts.json",
	directoryPath: "./assets/fonts/",
	primaryGroup: "latin",
	weights: [500, 700],
	waitMilliseconds: 1500,
});
LanguagePack.setLanguageLoadedHandler(async (language, allTexts) => {
	await UIFont.loadUiFont(language.fontGroup, allTexts);
});

async function applyLanguage(settingLanguageCode) {
	await LanguagePack.applyLanguageSetting(settingLanguageCode);
	return UIFont.readUiFontFace();
}

console.log(UIFont.readUiFontFamily(), UIFont.buildUiFontString(700, 24));
```

씬의 `load` 에서 `const fontFace = await applyLanguage("")` 처럼 부르고, 받은 `fontFace` 를 `UILabel.setFont` 에 줍니다. 언어 창에서 언어를 고르면 그 코드로 다시 부르고 화면의 글을 다시 넣습니다. (위 예제는 설정만 하고 파일을 받지는 않습니다)

`UIFont` 가 조각을 고르는 규칙은 이렇습니다.

- 한자처럼 여러 글꼴이 함께 가진 글자는 나중에 올린 묶음이 그립니다. 고른 언어의 묶음을 맨 뒤 묶음 바로 앞에 올리므로, 일본어면 일본 글꼴의, 중국어 번체면 번체 글꼴의 한자가 나옵니다. `applyUiFontGroup(fontGroup)` 이 이 차례를 다시 맞춥니다. (`loadUiFont` 가 부릅니다)
- 맨 뒤 묶음(처음은 라틴)은 늘 가장 높게 있어 숫자와 영문은 어느 언어에서나 그 글꼴입니다.
- 모든 조각은 `weights` 의 굵기로만 올립니다. 굵기 범위가 있는 조각(`"100 900"`)은 그 안의 굵기마다 한 번씩, 한 값뿐인 조각(`"400"`)은 가장 가까운 굵기 하나로 올립니다. 처음 값에서 화면이 400 을 청하면 500, 600 을 청하면 700 조각이 그립니다.

## DynamicFont 로 숫자 그리기

`Text` 는 문자열마다 글 전체를 텍스처로 굽습니다. 점수, 피해 숫자, 시계처럼 글이 자주 바뀌고 같은 글자를 많이 그리는 곳에는 `DynamicFont` 를 씁니다. 정한 글자들을 한 글꼴, 한 크기로 캔버스 한 장(가로 1024 픽셀)에 모아 굽고, 그릴 때 아틀라스에서 글자를 잘라 그립니다. 같은 그림을 쓰므로 묶어 그리기가 끊기지 않습니다.

```javascript
import { Engine, EngineConfiguration, Scene, DynamicFont, FontAsset, Vector2 } from "./build/vanilla.js";

class ScoreScene extends Scene {
	#dynamicFont;
	#score;

	constructor() {
		super();
		this.#dynamicFont = new DynamicFont();
		this.#score = 0;
	}

	async load(engine) {
		await super.load(engine);
		const fontAsset = new FontAsset();
		await fontAsset.loadFont("DOSGothic", "examples/assets/DOSGothic.woff");
		const dynamicFont = this.#dynamicFont;
		dynamicFont.setFontAsset(fontAsset);
		dynamicFont.setFontSize(48);
		dynamicFont.setLetterSpacing(2);
		dynamicFont.buildAtlas("0123456789,SCORE ");
	}

	tick(timeDelta) {
		super.tick(timeDelta);
		this.#score += Math.floor(timeDelta * 1000);
	}

	draw(graphic) {
		super.draw(graphic);
		const engine = this.getEngine();
		const viewManager = engine.getViewManager();
		viewManager.applyViewRect(graphic);
		const dynamicFont = this.#dynamicFont;
		const scoreText = "SCORE " + this.#score.toLocaleString("en-US");
		const textWidth = dynamicFont.measureText(scoreText);
		const position = Vector2.create(640 - textWidth * 0.5, 360);
		dynamicFont.drawText(scoreText, position, graphic);
	}
}

const engineConfiguration = new EngineConfiguration();
engineConfiguration.referenceResolutionSize = Vector2.create(1280, 720);
const engine = new Engine(engineConfiguration);
engine.run(new ScoreScene());
```

- `setFontAsset(fontAsset)` 을 주지 않으면 `-apple-system, sans-serif` 로 굽습니다. 글자 크기는 처음 32 픽셀, 자간은 0 입니다.
- `buildAtlas(charset)` 는 아직 없는 글자를 더하고 든 글자를 모두 새 캔버스에 다시 굽습니다. 글꼴, 크기, 자간을 바꾼 뒤에는 `rebuildAtlas()` 를 부릅니다. `clearAtlas()` 는 글자를 모두 비웁니다.
- 글자는 글자 묶음(받침, 결합 부호, 이모지 묶음) 단위로 셉니다. 아틀라스에 없는 글자는 글자 크기의 반만큼 비우고 넘어갑니다.
- `drawText(text, position, graphic)` 의 `position` 은 첫 글자의 왼쪽과 베이스라인입니다. `measureText(text)` 는 전진폭(글자 너비 + 자간)의 합입니다.
- `getGlyph(char)` 는 글자 하나의 `GlyphInfo`(아틀라스 안 영역 `uvRect`, 전진폭 `advance`, `bearingX`, `bearingY`)를, 없으면 `null` 을 돌려줍니다. `getAtlasCanvas()` 는 구운 캔버스입니다.
- 글꼴 파일을 받기 전에 구우면 다른 글꼴로 구워집니다. `FontAsset` 을 다 받은 뒤 `buildAtlas` 를 부릅니다.

## 엔진의 기본 글꼴

`engine.run()` 은 `EngineConfiguration.defaultFontUrl` 에 주소가 있으면 그 글꼴을 뒤에서 받아 `"default"` 라는 이름으로 브라우저 글꼴 목록에 올립니다. 글꼴 이름 `default`(엔진 기본 글꼴 사슬)는 이 글꼴 다음 시스템 글꼴 사슬이라, 글꼴을 고르지 않은 Text, ShadowText, DynamicFont 가 이 글꼴을 먼저 씁니다(러스트 판 `default_font_url` 과 같다). 처음 값은 빈 글(`""`)이라 엔진은 글꼴을 받지 않습니다. 받기가 실패하거나 늦어도 엔진은 멈추지 않고 경고만 남깁니다.

이 글꼴을 쓰는 곳은 `useStatistics` 의 정보창 같은 엔진 내부 표시입니다. `Text` 와 `UILabel` 은 `setFont` 로 글꼴을 주지 않으면 시스템 글꼴 목록(`-apple-system, "Segoe UI", Roboto, "Apple SD Gothic Neo", "Malgun Gothic", sans-serif`)으로 그립니다. 다른 글꼴을 쓰려면 `FontAsset` 으로 받아 `setFont` 에 줍니다. ("애셋 불러오기" 장)

## 주의할 점

- 엔진은 언어가 바뀐 것을 알리지 않습니다. 언어를 바꾸면 화면의 글을 게임이 다시 넣습니다.
- `Localization` 과 `LanguagePack` 은 서로 다른 표를 씁니다. `Localization.setTable` 로 넣은 글은 `LanguagePack.translate` 로 꺼낼 수 없고, 그 반대도 같습니다.
- `Localization.text` 는 배열 항목에 키를 돌려줍니다. 배열 항목은 `textList` 로 꺼냅니다.
- `LanguagePack` 언어 목록의 `aliases` 는 소문자로 적습니다.
- `LanguagePack` 과 `UIFont` 의 경로와 설정은 불러오기 전에 정합니다. 언어 목록과 글꼴 색인은 한 번만 읽습니다.
- 웹 글꼴 조각을 그때그때 받는 게임은 `EngineConfiguration.rebakeTextOnFontLoad` 를 켭니다. 끄면 받기 전에 다른 글꼴로 구운 글자가 캐시에서 밀려날 때까지 남습니다.

## 관련 클래스

Localization, LanguagePack, UIFont, DynamicFont, GlyphInfo, FontAsset, Text, UILabel, EngineConfiguration, PersistedStore
