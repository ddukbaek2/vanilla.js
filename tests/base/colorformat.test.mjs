//==============================================================================
// 색과 숫자 표기 시험. (node tests/base/colorformat.test.mjs)
// - 러스트 판 짝: src/base/color.rs 의 strings_match_original, hex_cache_quantizes_alpha, hex_strings_match_original_range,
//   out_of_range_components_are_kept_and_clamped_in_text, rgba_strings_match_original_regex,
//   src/base/format.rs 의 format_number_matches_original, format_number_with_unit_matches_original,
//   format_compact_number_matches_original, format_padded_number_matches_original,
//   format_minutes_seconds_matches_original, shortest_digits_choose_even_on_tie.
// - 색 성분은 러스트 판이 f32 라 1e-6 안에서 비교한다. 숫자 표기는 글자까지 같아야 한다.
//==============================================================================
import { Color } from "../../src/base/color.js";
import * as Format from "../../src/base/format.js";
import { check, checkEqual, checkNear, finish } from "../testcheck.mjs";

function getColorList(color) {
	return [color.red, color.green, color.blue, color.alpha];
}

// 문자열 변환. (알파가 1 이면 붙이지 않는다)
const orangeColor = new Color(1, 0.5, 0, 1);
checkEqual(orangeColor.toRGBAString(), "rgb(255, 128, 0)", "toRGBAString");
checkEqual(orangeColor.toHEXString(), "#ff8000", "toHEXString");
const halfOrangeColor = orangeColor.withAlpha(0.5);
checkEqual(halfOrangeColor.toRGBAString(), "rgba(255, 128, 0, 0.5)", "반투명 toRGBAString");
checkEqual(halfOrangeColor.toHEXString(), "#ff800080", "반투명 toHEXString");

// HEX 캐시는 알파를 0.01 단위로 다듬는다.
const cachedColor = Color.fromHEXCached("#ff0000", 0.504);
checkEqual(cachedColor.red, 1, "fromHEXCached 빨강");
checkEqual(cachedColor.alpha, 0.5, "fromHEXCached 알파 다듬기");
checkEqual(Color.fromCache("rgb(0, 255, 0)").green, 1, "fromCache rgb");

// 16진 글. (# 필요, #rgba, 두 자리씩 parseInt, 범위 밖 성분은 자르지 않는다)
checkNear(getColorList(Color.createFromHEX("#f00a")), [1, 0, 0, 170 / 255], 1e-6, "#f00a");
checkNear(getColorList(Color.createFromHEX(" #00FF0080 ")), [0, 1, 0, 128 / 255], 1e-6, "#00FF0080 앞뒤 빈칸");
checkNear(getColorList(Color.createFromHEX("ff0000")), [1, 1, 1, 1], 0, "# 없으면 흰색");
const fiveDigitColor = Color.createFromHEX("#12345");
checkNear(fiveDigitColor.blue, 5 / 255, 1e-6, "#12345 파랑");
checkEqual(fiveDigitColor.alpha, 1, "#12345 알파");
const partialColor = Color.createFromHEX("#1zz");
checkNear(partialColor.red, 17 / 255, 1e-6, "#1zz 빨강");
check(Number.isNaN(partialColor.green), "#1zz 초록은 NaN");
checkEqual(new Color(1.5, -0.2, 0, 1).toHEXString(), "#ff0000", "범위 밖 HEX 글");
checkEqual(new Color(1.5, -0.2, 0, 1).toRGBAString(), "rgb(255, 0, 0)", "범위 밖 rgb 글");
checkEqual(partialColor.toHEXString(), "#11NaNNaN", "NaN HEX 글");

// 0 ~ 1 밖 성분은 담고(HDR), 글로 낼 때만 자른다.
const brightColor = new Color(1.5, -0.2, 0.5, 1.2);
checkEqual(brightColor.red, 1.5, "HDR 빨강");
checkEqual(brightColor.alpha, 1.2, "HDR 알파");
checkEqual(brightColor.toRGBAString(), "rgb(255, 0, 128)", "HDR rgb 글");
checkEqual(brightColor.toHEXString(), "#ff0080", "HDR HEX 글");
const negativeAlphaColor = new Color(0.5, 0.5, 0.5, -0.5);
checkEqual(negativeAlphaColor.toRGBAString(), "rgba(128, 128, 128, 0)", "음수 알파 rgba 글");
checkEqual(negativeAlphaColor.toHEXString(), "#80808000", "음수 알파 HEX 글");
const notANumberColor = new Color(NaN, 1.5, -0.2, NaN);
checkEqual(notANumberColor.toHEXString(), "#NaNff00", "NaN 성분 HEX 글");
checkEqual(notANumberColor.toRGBAString(), "rgb(NaN, 255, 0)", "NaN 성분 rgb 글");

// rgb 글은 원본 createFromRGBA 의 정규식처럼 읽는다.
const rgbaCaseList = [
	["rgba(255, 0, 0, 0.5)", [255, 0, 0, 0.5]],
	["rgb(0, 255)", null],
	["RGB(10,20,30)", [10, 20, 30, 1]],
	["rgb(10.5, 0, 0)", null],
	["rgba(1,2,3,0.5.7)", [1, 2, 3, 0.5]],
	["x rgb(1,2,3)", null],
	["rgbx rgb(1,2,3)", [1, 2, 3, 1]],
	["rgb)(", null],
	["rgb(1,2,3,)", null],
	["rgb( 1 , 2 , 3 )", [1, 2, 3, 1]],
	["rgba(300, 0, 0, 2)", [300, 0, 0, 2]],
	["rgb(1,2,3) rgb(4,5,6)", [1, 2, 3, 1]],
	["rgba(1,2,3,4", null],
	["rgb(1,2,3 , 0.5 )", [1, 2, 3, 0.5]],
];
for (const [rgbaString, byteList] of rgbaCaseList) {
	const expectedList = byteList === null ? [1, 1, 1, 1] : [byteList[0] / 255, byteList[1] / 255, byteList[2] / 255, byteList[3]];
	checkNear(getColorList(Color.createFromRGBA(rgbaString)), expectedList, 1e-6, "createFromRGBA(" + rgbaString + ")");
}
check(Number.isNaN(Color.createFromRGBA("rgba(1,2,3,.)").alpha), "rgba(1,2,3,.) 알파는 NaN");

// formatNumber. (반올림, 음수, -0, 큰 수, NaN, 무한대, 로캘마다의 기호와 묶음과 숫자 모양)
const formatNumberCaseList = [
	["en-US", 12480, "12,480"], ["en-US", 1234.5678, "1,234.568"], ["en-US", -1234.5678, "-1,234.568"], ["en-US", 0.0005, "0.001"],
	["en-US", 0.0004999, "0"], ["en-US", -0.0001, "-0"], ["en-US", -0, "-0"], ["en-US", 999.9995, "1,000"],
	["en-US", 1e21, "1,000,000,000,000,000,000,000"], ["en-US", 1.2345678901234566e25, "12,345,678,901,234,566,000,000,000"],
	["en-US", NaN, "NaN"], ["en-US", Infinity, "∞"], ["en-US", -Infinity, "-∞"], ["en-US", 0.30000000000000004, "0.3"],
	["en-US", 1.0005, "1.001"], ["ko-KR", 1234567.891, "1,234,567.891"], ["de-DE", 1234567.891, "1.234.567,891"],
	["es-ES", 1234.5, "1234,5"], ["es-ES", 12345.5, "12.345,5"], ["es-ES", 1234567, "1.234.567"], ["pl-PL", 1234, "1234"],
	["pl-PL", 12345, "12 345"], ["fr-FR", -1234567.891, "-1 234 567,891"], ["de-CH", 1234567.891, "1'234'567.891"],
	["hi-IN", 123456789.123, "12,34,56,789.123"], ["en-IN", 123456789.123, "12,34,56,789.123"],
	["ar-EG", -1234567.891, "؜-١٬٢٣٤٬٥٦٧٫٨٩١"],
	["ar-SA", -1234567.891, "؜-١٬٢٣٤٬٥٦٧٫٨٩١"],
	["ar", -1234567.891, "‎-1,234,567.891"],
	["fa-IR", -1234567.891, "‎−۱٬۲۳۴٬۵۶۷٫۸۹۱"],
	["sv-SE", -1234567.891, "−1 234 567,891"],
	["bn-BD", 1234567.891, "১২,৩৪,৫৬৭.৮৯১"],
	["ru-RU", NaN, "не число"], ["zh-TW", NaN, "非數值"],
	["pt-PT", 1234.5, "1234,5"], ["pt-BR", 1234.5, "1.234,5"], ["zh-Hant-TW", 1234567.891, "1,234,567.891"], ["ja-JP", 1234567.891, "1,234,567.891"],
	["ps", -1234567.891, "‎-‎۱٬۲۳۴٬۵۶۷٫۸۹۱"],
	["it-CH", 1234567.891, "1'234'567.891"], ["et-EE", -1234.5, "−1234,5"], ["en-u-nu-latn", 1234567.891, "1,234,567.891"],
	["EN_gb", 1234567.891, "RangeError: Invalid language tag: EN_gb"],
];
for (const [locale, value, expectedText] of formatNumberCaseList) {
	let actualText = "";
	try {
		actualText = Format.formatNumber(value, locale);
	}
	catch (error) {
		actualText = error.name + ": " + error.message;
	}
	checkEqual(actualText, expectedText, "formatNumber(" + value + ", " + locale + ")");
}

// 언어 태그 검사. (받는 태그는 null, 던지는 태그는 오류 글에 찍히는 태그. 러스트 판 src/base/format.rs::language_tag_validation_matches_chrome 과 같은 목록)
const languageTagCaseList = [
	["EN--US", "EN--US"],
	["EN-US-U", "en-us-u"],
	["EN-US-X", "en-us-x"],
	["EN-a-B", "en-a-b"],
	["EN-US-1996-1996", "en-us-1996-1996"],
	["EN-U-CA-U-NU", "en-u-ca-u-nu"],
	["EN-T-A1", "en-t-a1"],
	["EN-T-IT", null],
	["EN-T-A1-XYZ", null],
	["EN-U-CA", null],
	["EN-U-C", "en-u-c"],
	["EN-U-ABC", null],
	["EN-U-ABC-CA-GREGORY", null],
	["EN-U-CA-GREGORY-ABC", null],
	["root", "root"],
	["ROOT", "ROOT"],
	["Latn", "Latn"],
	["Latn-US", "Latn-US"],
	["abcde", null],
	["ABCDEFGHI", "ABCDEFGHI"],
	["en-Latn-US-fonipa", null],
	["EN-LATN", null],
	["en-123", null],
	["en-1234", null],
	["en-12", "en-12"],
	["en-1abc", null],
	["en-abcd5", null],
	["en-US-POSIX", null],
	["en-x-abcdefghi", "en-x-abcdefghi"],
	["en-x-", "en-x-"],
	["EN-X-A-B", null],
	["de-u-co-phonebk-ka-shifted", null],
	["zh-Hans-CN-u-nu-hanidec", null],
	["en-a-bc-a-de", "en-a-bc-a-de"],
	["en-a-bc-b-de", null],
	["en-Latn-Cyrl", "en-Latn-Cyrl"],
	["en-US-GB", "en-US-GB"],
	["und", null],
	["UND-US", null],
	["en-t-zh-latn-cn-variant1-m0-ungegn", null],
	["en-t-zh-Latn-CN-variant1-variant1", "en-t-zh-latn-cn-variant1-variant1"],
	["en-t-m0", "en-t-m0"],
	["en-t-m0-ab", "en-t-m0-ab"],
	["en-t-zh-zh", null],
	["art-lojban", null],
	["zh-min-nan", "zh-min-nan"],
	["EN-U-NU-LATN-NU-ARAB", null],
	["en-US-u-", "en-us-u-"],
	["en-_US", "en-_US"],
	["en US", "en US"],
	["\u00e9\u00e9", "\u00c3\u00a9\u00c3\u00a9"],
	["en-u-0a", null],
	["en-u-a0", "en-u-a0"],
	["en-u-ab-c", "en-u-ab-c"],
	["en-u-ab-cde", null],
	["en-u-ab-cdefghij", null],
	["en-t-a1-ab", "en-t-a1-ab"],
	["en-t-a1-abc-defghijkl", "en-t-a1-abc-defghijkl"],
	["en-t-zh-u-nu-latn", null],
	["en-u-nu-latn-t-zh", null],
	["en-a-bcdefghij", "en-a-bcdefghij"],
	["en-a-b1", null],
	["en-x-a-u-ca", null],
	["en-US-x-12345678", null],
	["EN-001", null],
	["en-419-u-nu-latn", null],
	["EN-us-POSIX-posix", "en-us-posix-posix"],
	["EN-LATN-US-1901-1902", null],
	["fil", null],
	["FIL", null],
	["in", null],
	["IN", null],
	["iw-IL", null],
	["ab", null],
	["AB", null],
	["abc", null],
	["ABCD", "ABCD"],
];
for (const [locale, expectedErrorTag] of languageTagCaseList) {
	let actualErrorText = null;
	try {
		Format.formatNumber(1, locale);
	}
	catch (error) {
		actualErrorText = error.name + ": " + error.message;
	}
	const expectedErrorText = expectedErrorTag === null ? null : "RangeError: Invalid language tag: " + expectedErrorTag;
	checkEqual(actualErrorText, expectedErrorText, "formatNumber 언어 태그 " + JSON.stringify(locale));
}

// formatNumberWithUnit.
checkEqual(Format.formatNumberWithUnit(1200000, "원", "ko-KR"), "1,200,000원", "formatNumberWithUnit 원");
checkEqual(Format.formatNumberWithUnit(-5, "점", "ko-KR"), "-5점", "formatNumberWithUnit 점");
checkEqual(Format.formatNumberWithUnit(1234.5678, "G", "en-US"), "1,234.568G", "formatNumberWithUnit G");
checkEqual(Format.formatNumberWithUnit(1234.5, "€", "de-DE"), "1.234,5€", "formatNumberWithUnit 유로");

// formatCompactNumber.
const compactCaseList = [
	[1234, 1, "1.2K"], [5600000, 1, "5.6M"], [999, 1, "999"], [999.5, 1, "999.5"], [1000, 1, "1K"], [1250, 1, "1.3K"], [1350, 1, "1.4K"],
	[1050, 1, "1.1K"], [1000000, 1, "1M"], [999999, 1, "1M"], [999950, 1, "1M"], [999949, 1, "999.9K"], [999999999, 1, "1B"],
	[-999999, 1, "-1M"], [999500, 0, "1M"], [999499, 0, "999K"], [-1234, 1, "-1.2K"], [-0, 1, "0"], [0, 1, "0"], [1234567890, 2, "1.23B"],
	[1e30, 1, "1e+21B"], [Infinity, 1, "InfinityB"], [NaN, 1, "NaN"], [-Infinity, 1, "-InfinityB"], [0.1, 1, "0.1"], [1e-7, 1, "1e-7"],
	[2500, 0, "3K"], [3500, 0, "4K"], [1234, 3, "1.234K"], [1e21, 1, "1000000000000B"], [123.456, 1, "123.456"], [1999.95, 1, "2K"],
	[1500000000000000, 1, "1500000B"], [1005, 2, "1K"], [1015, 2, "1.01K"],
];
for (const [value, fractionDigits, expectedText] of compactCaseList) {
	checkEqual(Format.formatCompactNumber(value, fractionDigits), expectedText, "formatCompactNumber(" + value + ", " + fractionDigits + ")");
}

// formatPaddedNumber.
const paddedCaseList = [
	[7, 3, -Infinity, Infinity, "007"], [-5, 3, -Infinity, Infinity, "-05"], [1234, 3, -Infinity, Infinity, "1234"], [1234, 3, -99, 999, "999"],
	[-1234, 3, -99, 999, "-99"], [7.5, 4, -Infinity, Infinity, "07.5"], [-0, 3, -Infinity, Infinity, "000"], [NaN, 3, -Infinity, Infinity, "NaN"],
	[5, 0, -Infinity, Infinity, "5"], [-5, 1, -Infinity, Infinity, "-5"], [-5, 0, -Infinity, Infinity, "-5"], [1e21, 3, -Infinity, Infinity, "1e+21"],
	[42, 5, 0, 100, "00042"], [0.000001, 2, -Infinity, Infinity, "0.000001"], [1e-7, 2, -Infinity, Infinity, "1e-7"],
];
for (const [value, digitCount, minValue, maxValue, expectedText] of paddedCaseList) {
	checkEqual(Format.formatPaddedNumber(value, digitCount, minValue, maxValue), expectedText, "formatPaddedNumber(" + value + ", " + digitCount + ")");
}

// formatMinutesSeconds.
const minutesSecondsCaseList = [
	[75, "1:15"], [0, "0:00"], [59.9, "0:59"], [60, "1:00"], [3599, "59:59"], [3600, "60:00"], [-5, "0:00"], [NaN, "NaN:NaN"],
	[Infinity, "Infinity:NaN"], [125.7, "2:05"], [1e21, "16666666666666666000:40"], [600, "10:00"],
];
for (const [totalSeconds, expectedText] of minutesSecondsCaseList) {
	checkEqual(Format.formatMinutesSeconds(totalSeconds), expectedText, "formatMinutesSeconds(" + totalSeconds + ")");
}

// 가장 짧은 표기가 딱 가운데면 끝자리가 짝수인 쪽.
checkEqual(Format.formatPaddedNumber(-224567413330.078125, 6), "-224567413330.07812", "짝수 쪽 1");
checkEqual(Format.formatPaddedNumber(31122207641.6015625, 6), "31122207641.601562", "짝수 쪽 2");
checkEqual(Format.formatNumber(-1083787679672241.25, "it"), "-1.083.787.679.672.241,2", "짝수 쪽 it");
checkEqual(Format.formatNumber(-281161069869995.125, "hr"), "−281.161.069.869.995,12", "짝수 쪽 hr");

finish("tests/base/colorformat.test.mjs");
