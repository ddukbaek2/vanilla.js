/**
 * @example <caption>바닐라색 문자열로 색 만들기</caption>
 * import { Colors, Color } from "./build/vanilla.js";
 *
 * const colorString = Colors.vanilla;
 * const background = Color.createFromHEX(colorString);
 * console.log(Colors.darkVanilla, background.toRGBAString());
 */

//==============================================================================
// 색상 값.
//==============================================================================
export const Colors = {
	/** @public @type { string } */ black: "#000000", // 검은색. (#000000)
	/** @public @type { string } */ white: "#ffffff", // 흰색. (#ffffff)
	/** @public @type { string } */ vanilla: "#f3e5ab", // 바닐라색. (#f3e5ab)
	/** @public @type { string } */ darkVanilla: "#d1c1b2", // 어두운 바닐라색. (#d1c1b2)
	/** @public @type { string } */ lightVanilla: "#f1e9d8", // 밝은 바닐라색. (#f1e9d8)
};