# Languages

This chapter covers how to show on-screen text in several languages, switch the chosen language, and prepare fonts that can draw it. It walks through `Localization`, which keeps translation tables in code, `LanguagePack`, which keeps one JSON file per language, `UIFont`, which groups font slices for many scripts under one font name, `DynamicFont`, which draws frequently changing numbers from a glyph atlas, and the engine's default font.

The engine's text components (`Text`, `UILabel`) do not read translation tables on their own. The game puts translated text in with `setText` and puts it in again when the language changes.

## Translation tables with Localization

Every method of `Localization` is static. Add a table (key to translation) per language, choose the current language, then read text with `text(key)`.

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

- `text(key, ...substitutions)` looks in the current language's table, then the fallback language's table, then returns the key itself. In the example, `hud.greeting` is missing from the French table so the English text comes out, and `menu.quit`, which is in no table, comes out as the key.
- You can use the source text itself as the key. Missing entries show the source text, so you can fill in translations gradually.
- Numbered slots such as `{0}` and `{1}` are replaced in order by the extra arguments to `text`.
- The current language and the fallback language both start as `"ko"`. Language codes are stored in lowercase.
- `clear()` empties every table. (For tests)

## Named slots and multi-line entries

Naming the value slots in a translation lets each language put values in a different order. `textNamed(key, values)` finds the translation, then fills each `{name}` slot with the value of the same name in `values`. Slots whose names are not in `values` are left as they are.

A translation can also be an array of strings. For multi-line entries such as dialogue lists, `textList(key)` returns an array. A single-string entry comes back as an array holding that string, and a key missing from every table comes back as an array holding the key. `lookup(key)` returns the raw value (a string, an array, or `undefined` when missing).

Tables read with `JsonAsset` go in with `setTableFromJson(languageCode, tableJson)`. String values are kept as strings, arrays keep only their strings, and any other value is skipped.

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

Reading an array entry with `text(key)` returns the key, because the value is not a string. Read array entries with `textList`.

## Choosing the browser language

`detectLanguage(supportedLanguageCodes, defaultLanguageCode = "ko")` walks the browser's preferred languages (`navigator.languages`) in order and returns the first one in the supported list. To use only the matching part, pass a candidate list directly to `selectLanguage(candidateList, supportedLanguageCodes, defaultLanguageCode)`.

- Language tags are lowercased, underscores become hyphens, and subtags are dropped from the end one at a time while matching. `"zh-Hant-TW"` is tried as `"zh-hant-tw"`, `"zh-hant"`, then `"zh"`.
- After `setLanguageAliases(languageCode, aliasList)`, the aliases also count as that language.
- The returned value is a lowercase code. If nothing matches, the default language code is returned as is.

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

The example prints `"pt"`, `"zh-hant"`, and `"en"` in that order.

## Switching languages on screen

Switching languages means changing the current language with `setLanguage` and putting every on-screen text in again. The engine does not announce language changes, so keep the code that fills in text in one place and call it after switching. Store the chosen language in a `PersistedStore` and it will be used again on the next start. (See the "Storage" chapter)

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

## Right-to-left languages

Right-to-left languages such as Arabic and Hebrew flip the screen layout horizontally along with the text direction. `Localization` treats `ar`, `fa`, `he`, `ur`, `ps`, `yi`, and `dv` as such languages from the start. It decides by the first subtag of the language code, so `"ar-EG"` counts too.

- `isRightToLeft()` returns whether the current language is one of them. Add or remove languages with `setRightToLeft(languageCode, isRightToLeft)`.
- `mirrorLayoutX(x, width, parentWidth)` takes the left position `x` used for left-to-right languages and returns the mirrored position inside the parent width (`parentWidth - x - width`) for right-to-left languages, or `x` otherwise. Call it only for layouts that should flip, such as windows and tables, not for things pinned to a screen corner or for slider directions.
- `readLayoutTextAlign(textAlign)` swaps `"left"` and `"right"` for right-to-left languages.
- `isolateText(text)` wraps text in directional isolate characters (U+2068, U+2069) for right-to-left languages. Numbers with units (`+60%`) and people's names then stay together as one unit instead of scattering among the surrounding text. `textNamed` wraps filled values this way, and slots joined only by slashes, such as `"{count}/{limit}"`, are wrapped once as a whole rather than value by value. (Wrapping each value makes 1/40 look like 40/1)

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

The direction of the glyphs themselves is set on the text components. `Text.setTextDirection(textDirection)` and `UILabel.setTextDirection(textDirection)` accept `"inherit"` (the initial value, following the `Graphic` direction at draw time), `"ltr"`, `"rtl"`, and `"auto"` (decided by the first strong character of the text), and the `"start"` and `"end"` alignments map to left or right according to this direction. Screens for right-to-left languages use `"rtl"` with `"start"`.

## Language files with LanguagePack

Games with many languages, where translators edit files separately, keep translation tables in JSON asset files instead of code. `LanguagePack` is a module of functions, so you call it through its namespace, as in `LanguagePack.translate(...)`. There is only one state per module.

The files are one language list plus one table per language. The default paths are `./assets/localization/languages.json` and that folder; change them with `setLanguagePaths(listPath, directoryPath)` before loading. The folder path ends with `/`.

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

A language file (such as `en.json`) is a single table of key to text. Give every language file the same keys as the default language file.

```json
{
	"game.title": "Dungeon Run",
	"menu.start": "Start",
	"hud.restart": "Restart {seconds}"
}
```

- `fontGroup` is the font group name used by `UIFont` below, and `direction` set to `"rtl"` marks a right-to-left language.
- `aliases` are language tags that count as that language. Write them in lowercase; matching lowercases the tag and compares it as is.

Loading works in this order.

1. Call `applyLanguageSetting(settingLanguageCode)`. Pass the language code saved in your settings; when it is empty (`""`), the device language is used.
2. The language used is the one from the settings if it is in the list. Otherwise the list is searched with the platform language set by `setPreferredLanguageTag`, then the browser's language list (`matchLanguageTag`, which drops subtags from the end and checks codes and aliases). If none match, it is the list's `fallbackLanguage` (or `"en"` if that is missing too).
3. The tables for that language and the default language are fetched. The page's `<html lang>` is set to the language code, and if there is text for the `setDocumentTitleKey` key (initially `"game.title"`; `""` leaves the title alone), it becomes the tab title.
4. The function set with `setLanguageLoadedHandler` is called with `(language entry, all text of that language)` and awaited. Hook font loading here.

Read text with `translate(key)` (current language, default language, then the key) and `formatText(key, values)` (fills named slots with the same rules as `Localization.textNamed`). Read the direction with `readTextDirection()` (`"ltr"` or `"rtl"`) and `isRightToLeft()`; `mirrorLayoutX`, `readLayoutTextAlign`, and `isolateText` behave like the `Localization` functions of the same names.

You can also put the list and tables in directly from code without files. `setLanguageList(data)` takes the same shape as `languages.json`, and `setLanguageTexts(languageCode, texts, fallbackTextTable)` sets the current language's table together with the default language's table. (It returns `false` for a language not in the list) This path does not change `<html lang>` or the tab title.

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

`readLanguages()` returns the languages in the list (for building a language menu), `readLanguage()` the current language's entry (`null` before any is loaded), `findLanguage(code)` the entry found by code (case-insensitive), and `readAllTexts()` all text of the current language joined into one string.

## Grouping fonts for many scripts with UIFont

A game that draws many languages on one screen needs a different font file per script, and CJK font files are very large. `UIFont` creates a `FontFace` for each font slice split by character range (`unicode-range`), as Google Fonts does, and adds them all under one font name (initially `"GameUI"`). The browser then fetches only the slices that contain characters shown on screen. Like `LanguagePack`, it is a module of functions.

The font list is one index file plus one slice list file per group. The default paths are `./assets/fonts/fonts.json` and `./assets/fonts/`.

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

Use it in this order.

1. Before loading, configure it with `configureUiFont(options)`. Fields you leave out keep their values; the fields and their defaults are `family` (`"GameUI"`), `manifestPath` (`"./assets/fonts/fonts.json"`), `directoryPath` (`"./assets/fonts/"`), `primaryGroup` (`"latin"`), `weights` (`[500, 700]`), `waitMilliseconds` (1500), and `remainingDelayMilliseconds` (3000).
2. In `LanguagePack.setLanguageLoadedHandler`, call `loadUiFont(language.fontGroup, allTexts)`. It adds the chosen language's group and the last group (`primaryGroup`), and waits up to `waitMilliseconds` for the slices containing that language's characters. The remaining groups start loading once, `remainingDelayMilliseconds` later. If the list cannot be read, the game carries on with system fonts.
3. Give text components the `FontFace` returned by `readUiFontFace()` through `setFont`. (The engine uses only its font name) When you need a font string, `buildUiFontString(fontWeight, fontSize)` builds one like `"700 24px \"GameUI\", sans-serif"`.
4. For characters that appear on the fly, such as people's names, request their slices with `requestUiFontText(text)`. It fetches only characters it has not seen, without waiting.
5. Turn on `EngineConfiguration.rebakeTextOnFontLoad`. Canvas does not wait for slices that have not arrived and draws with another font instead; with this on, each time a slice arrives, only the glyph textures baked from that slice's characters are discarded and baked again.

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

Call it in the scene's `load`, as in `const fontFace = await applyLanguage("")`, and pass the resulting `fontFace` to `UILabel.setFont`. When the player picks a language in a language menu, call it again with that code and put the on-screen text in again. (The example above only configures and does not fetch any files)

The rules `UIFont` uses to pick slices are as follows.

- Characters shared by several fonts, such as Han characters, are drawn by the group added last. The chosen language's group is added right before the last group, so Japanese gets Han characters from the Japanese font and Traditional Chinese from the Traditional font. `applyUiFontGroup(fontGroup)` re-applies this order. (`loadUiFont` calls it)
- The last group (initially Latin) always sits highest, so digits and Latin letters use that font in every language.
- Every slice is added only at the `weights` values. A slice with a weight range (`"100 900"`) is added once per weight inside the range, and a slice with a single value (`"400"`) is added at the nearest weight. With the defaults, a request for 400 is drawn by the 500 slice and a request for 600 by the 700 slice.

## Drawing numbers with DynamicFont

`Text` bakes each string as a whole into a texture. For places where text changes often and the same characters are drawn many times, such as scores, damage numbers, and clocks, use `DynamicFont`. It bakes a chosen set of characters in one font and size onto a single canvas (1024 pixels wide) and cuts each character out of that atlas when drawing. Every character uses the same image, so sprite batching is not broken.

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

- Without `setFontAsset(fontAsset)`, the atlas is baked with `-apple-system, sans-serif`. The font size starts at 32 pixels and the letter spacing at 0.
- `buildAtlas(charset)` adds characters that are not there yet and bakes every character again onto a new canvas. After changing the font, size, or letter spacing, call `rebuildAtlas()`. `clearAtlas()` removes every character.
- Characters are counted as grapheme clusters (composed syllables, combining marks, emoji sequences). A character missing from the atlas leaves a gap of half the font size.
- `position` in `drawText(text, position, graphic)` is the left edge and baseline of the first character. `measureText(text)` is the sum of the advances (glyph width plus letter spacing).
- `getGlyph(char)` returns the `GlyphInfo` for one character (its area in the atlas `uvRect`, the advance `advance`, `bearingX`, `bearingY`), or `null` when missing. `getAtlasCanvas()` returns the baked canvas.
- Baking before the font file has arrived bakes with a different font. Call `buildAtlas` after the `FontAsset` has finished loading.

## The engine's default font

When `EngineConfiguration.defaultFontUrl` has an address, `engine.run()` fetches that font in the background and adds it to the browser's font set as `"default"`. The font name `default` (the engine default font chain) is this font followed by the system font chain, so Text, ShadowText and DynamicFont without a chosen font use it first (same as Rust `default_font_url`). The default is an empty string (`""`), so the engine fetches no font. If the fetch fails or is slow, the engine keeps running and only logs a warning.

This font is used by internal engine displays such as the `useStatistics` overlay. Without a font set through `setFont`, `Text` and `UILabel` draw with the system font list (`-apple-system, "Segoe UI", Roboto, "Apple SD Gothic Neo", "Malgun Gothic", sans-serif`). To use another font, load it with `FontAsset` and pass it to `setFont`. (See the "Loading Assets" chapter)

## Things to watch for

- The engine does not announce language changes. When the language changes, the game puts the on-screen text in again.
- `Localization` and `LanguagePack` use separate tables. Text added with `Localization.setTable` cannot be read with `LanguagePack.translate`, and the reverse is also true.
- `Localization.text` returns the key for array entries. Read array entries with `textList`.
- Write the `aliases` in a `LanguagePack` language list in lowercase.
- Set the paths and settings of `LanguagePack` and `UIFont` before loading. The language list and the font index are read only once.
- Games that fetch web font slices on the fly should turn on `EngineConfiguration.rebakeTextOnFontLoad`. With it off, glyphs baked with another font before the slice arrived stay until they are pushed out of the cache.

## Related classes

Localization, LanguagePack, UIFont, DynamicFont, GlyphInfo, FontAsset, Text, UILabel, EngineConfiguration, PersistedStore
