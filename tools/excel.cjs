"use strict";
//==============================================================================
// vanilla.js 의 공용 엑셀 처리 도구.
//
// 외부 의존성: npm 패키지 "xlsx" (SheetJS Community Edition).
//             사용 프로젝트가 자기 node_modules 에 xlsx 를 설치해 둬야 한다.
//
// 제공 기능:
//  - 셀/행 정규화 (JSON 리터럴, boolean, 빈 셀 처리)
//  - xlsx 파일 → 시트별 행 배열
//  - 행 배열 → json 파일 (배열 그대로, 들여쓰기 \t)
//  - 컬럼 이름/타입 자동 추론
//  - 데이터 클래스 (.js) 소스 코드 생성
//  - 디렉토리 일괄 변환 (xlsx → json / xlsx → 클래스 / json → xlsx)
//
// 호출 측은 본 모듈을 require 하여 디렉토리 정책 (어떤 파일을 건너뛸지,
// 어디에 출력할지) 만 결정하면 된다.
//==============================================================================
const fileSystem = require("fs");
const path = require("path");
const xlsx = require("xlsx");


//==============================================================================
// 셀 값 정규화.
//   - "[" / "{" 시작 문자열은 JSON.parse 시도
//   - "true" / "false" 는 boolean
//   - 그 외는 원본 그대로
//==============================================================================
function normalizeCellValue(value) {
	if (typeof value !== "string") {
		return value;
	}
	const trimmed = value.trim();
	if (trimmed === "") {
		return "";
	}
	if (trimmed === "true") {
		return true;
	}
	if (trimmed === "false") {
		return false;
	}
	if (trimmed.startsWith("[") || trimmed.startsWith("{")) {
		try {
			return JSON.parse(trimmed);
		}
		catch (error) {
			return value;
		}
	}
	return value;
}


//==============================================================================
// 행 객체 전체 정규화. 빈 셀은 결과에서 제외해 스키마 흔들림 방지.
//==============================================================================
function normalizeRow(rawRow) {
	const result = {};
	for (const key of Object.keys(rawRow)) {
		const value = rawRow[key];
		if (value === undefined || value === null || value === "") {
			continue;
		}
		result[key] = normalizeCellValue(value);
	}
	return result;
}


//==============================================================================
// xlsx 파일 → { sheetName: rows[], ... } 반환.
//
// options:
//   skipSheetPrefixes: string[]  // 시트명이 이 prefix 들 중 하나로 시작하면 건너뜀
//==============================================================================
function readSheetsFromXlsx(xlsxFullPath, options) {
	const skipSheetPrefixes = options && options.skipSheetPrefixes ? options.skipSheetPrefixes : [];
	const workbook = xlsx.readFile(xlsxFullPath);
	const result = {};
	for (const sheetName of workbook.SheetNames) {
		const skipped = skipSheetPrefixes.some((prefix) => sheetName.startsWith(prefix));
		if (skipped) {
			continue;
		}
		const sheet = workbook.Sheets[sheetName];
		const rawRows = xlsx.utils.sheet_to_json(sheet, { defval: "" });
		result[sheetName] = rawRows.map(normalizeRow);
	}
	return result;
}


//==============================================================================
// 행 배열 → json 파일 (배열 그대로, \t 들여쓰기 + 끝 개행).
//==============================================================================
function writeJsonFile(jsonFullPath, rows) {
	fileSystem.mkdirSync(path.dirname(jsonFullPath), { recursive: true });
	fileSystem.writeFileSync(jsonFullPath, JSON.stringify(rows, null, "\t") + "\n", "utf8");
}


//==============================================================================
// 단일 값의 타입 분류 (배열/객체 구분 포함). 빈 값은 null.
//==============================================================================
function classifyValue(value) {
	if (value === undefined || value === null || value === "") {
		return null;
	}
	if (typeof value === "number") {
		return "number";
	}
	if (typeof value === "boolean") {
		return "boolean";
	}
	if (Array.isArray(value)) {
		return "array";
	}
	if (typeof value === "object") {
		return "object";
	}
	return "string";
}


//==============================================================================
// 행 배열에서 컬럼 [{ name, type }] 추론.
// 첫 행의 키를 컬럼 순서로 보존. 모든 행의 같은 컬럼이 같은 타입이면 그 타입,
// 혼합이면 "string" 으로 안전하게 fallback.
//==============================================================================
function inferColumns(rows) {
	if (rows.length === 0) {
		return [];
	}
	const columnOrder = Object.keys(rows[0]);
	const accumulators = columnOrder.map((name) => ({ name: name, types: new Set() }));
	for (const row of rows) {
		for (const accumulator of accumulators) {
			const type = classifyValue(row[accumulator.name]);
			if (type !== null) {
				accumulator.types.add(type);
			}
		}
	}
	return accumulators.map((accumulator) => {
		let resolvedType;
		if (accumulator.types.size === 0) {
			resolvedType = "string";
		}
		else if (accumulator.types.size === 1) {
			resolvedType = accumulator.types.values().next().value;
		}
		else {
			resolvedType = "string";
		}
		return { name: accumulator.name, type: resolvedType };
	});
}


//==============================================================================
// 컬럼 타입 → JSDoc 표기.
//==============================================================================
function jsdocType(type) {
	switch (type) {
		case "number": {
			return "number";
		}
		case "boolean": {
			return "boolean";
		}
		case "array": {
			return "Array";
		}
		case "object": {
			return "Object";
		}
		default: {
			return "string";
		}
	}
}


//==============================================================================
// 컬럼 → constructor 한 줄.
//==============================================================================
function constructorLine(column) {
	const key = column.name;
	switch (column.type) {
		case "number": {
			return `\t\tthis.${key} = typeof data.${key} === "number" ? data.${key} : 0;`;
		}
		case "boolean": {
			return `\t\tthis.${key} = data.${key} === true;`;
		}
		case "array": {
			return `\t\tthis.${key} = System.Array.isArray(data.${key}) ? data.${key} : [];`;
		}
		case "object": {
			return `\t\tthis.${key} = (typeof data.${key} === "object" && data.${key} !== null) ? data.${key} : {};`;
		}
		default: {
			return `\t\tthis.${key} = data.${key} || "";`;
		}
	}
}


//==============================================================================
// 데이터 클래스 .js 소스 코드 생성.
//
// options:
//   className:        클래스 이름 (e.g. "CardTableData")
//   sourceFileLabel:  헤더 주석에 표시할 원본 파일 이름 (e.g. "cardtable.json")
//   baseImportPath:   Object 베이스 클래스 import 경로 (e.g. "../../libs/vanilla.js/src/base/object.js")
//==============================================================================
function generateClassSource(columns, options) {
	const className = options.className;
	const sourceFileLabel = options.sourceFileLabel;
	const baseImportPath = options.baseImportPath;
	const usesSystemArray = columns.some((c) => c.type === "array");
	const fieldDeclarations = columns.map((c) => `\t/** @type { ${jsdocType(c.type)} } */ ${c.name};`).join("\n");
	const constructorBody = columns.map(constructorLine).join("\n");
	const systemImport = usesSystemArray ? "const System = globalThis;\n" : "";
	const header = `//==============================================================================\n// 포함 모듈 목록.\n//==============================================================================\n${systemImport}import { Object } from "${baseImportPath}";\n\n\n//==============================================================================\n// ${className} (${sourceFileLabel} 의 한 객체에 대응). vanilla.js excel 도구가 자동 생성.\n// 수동 편집 금지 — xlsx 의 컬럼/타입을 바꾼 뒤 클래스 생성을 다시 실행할 것.\n//==============================================================================\n`;
	return `${header}export class ${className} extends Object {\n\t//==============================================================================\n\t// 멤버 변수 목록.\n\t//==============================================================================\n${fieldDeclarations}\n\n\t//==============================================================================\n\t// 생성. data = ${sourceFileLabel} 의 한 객체.\n\t//==============================================================================\n\t/**\n\t * @param { Object } data\n\t */\n\tconstructor(data) {\n\t\tsuper();\n${constructorBody}\n\t}\n}\n`;
}


//==============================================================================
// 시트 이름 → 클래스 이름 (PascalCase + suffix).
// 예) "cardtable" + "Data" → "CardTableData"
//     "card"      + "Data" → "CardData"
//==============================================================================
function defaultClassNamer(sheetName, suffix) {
	const base = sheetName.endsWith("table") ? sheetName.slice(0, -5) : sheetName;
	const head = base.length > 0 ? base[0].toUpperCase() + base.slice(1) : "";
	return `${head}Table${suffix || "Data"}`;
}


//==============================================================================
// 디렉토리 일괄 변환: xlsx → json (시트당 한 파일, 시트명 = 파일명).
//
// options:
//   skipFileBaseNames: string[]  // .xlsx 확장자 제외한 base name 목록 (e.g. ["tabletemplate"])
//   skipSheetPrefixes: string[]  // 시트 이름 prefix
//   logger:            (text) => void  (기본: console.log)
//
// returns: { totalSheetCount, failCount }
//==============================================================================
function convertDirectoryToJson(xlsxDir, jsonOutputDir, options) {
	const opts = options || {};
	const skipFileBaseNames = opts.skipFileBaseNames || [];
	const skipSheetPrefixes = opts.skipSheetPrefixes || [];
	const logger = opts.logger || console.log;

	if (!fileSystem.existsSync(xlsxDir)) {
		logger(`[excel] xlsx 디렉토리가 없습니다: ${xlsxDir}`);
		return { totalSheetCount: 0, failCount: 0 };
	}

	let totalSheetCount = 0;
	let failCount = 0;
	const entries = fileSystem.readdirSync(xlsxDir);
	for (const entry of entries) {
		if (!entry.endsWith(".xlsx") || entry.startsWith("~$")) {
			continue;
		}
		const baseName = path.basename(entry, ".xlsx");
		if (skipFileBaseNames.indexOf(baseName) >= 0) {
			logger(`[excel] 건너뜀 (제외 목록): ${entry}`);
			continue;
		}
		const xlsxFullPath = path.join(xlsxDir, entry);
		try {
			const sheets = readSheetsFromXlsx(xlsxFullPath, { skipSheetPrefixes: skipSheetPrefixes });
			for (const sheetName of Object.keys(sheets)) {
				const rows = sheets[sheetName];
				const jsonFullPath = path.join(jsonOutputDir, `${sheetName}.json`);
				writeJsonFile(jsonFullPath, rows);
				logger(`[excel] ${entry}::${sheetName} → ${jsonFullPath} (${rows.length}행)`);
				++totalSheetCount;
			}
		}
		catch (error) {
			logger(`[excel] 실패: ${entry} - ${error.message}`);
			++failCount;
		}
	}
	logger(`[excel] xlsx → json 완료. 시트=${totalSheetCount}, 실패=${failCount}`);
	return { totalSheetCount: totalSheetCount, failCount: failCount };
}


//==============================================================================
// 디렉토리 일괄: xlsx → 데이터 클래스 (.js).
//
// options:
//   skipFileBaseNames, skipSheetPrefixes, logger 동일
//   baseImportPath:   클래스 안에서 Object 를 import 할 상대 경로
//   classNamer:       (sheetName) => className   기본은 PascalCase + "TableData"
//   sourceFileLabelNamer: (sheetName) => "<sheet>.json"   기본은 시트명+".json"
//   classFileNamer:   (sheetName) => "<sheet>data.js"     기본은 시트명+"data.js"
//
// returns: { totalClassCount, failCount }
//==============================================================================
function generateClassesFromDirectory(xlsxDir, classOutputDir, options) {
	const opts = options || {};
	const skipFileBaseNames = opts.skipFileBaseNames || [];
	const skipSheetPrefixes = opts.skipSheetPrefixes || [];
	const logger = opts.logger || console.log;
	const baseImportPath = opts.baseImportPath;
	const classNamer = opts.classNamer || ((sheetName) => defaultClassNamer(sheetName, "Data"));
	const sourceFileLabelNamer = opts.sourceFileLabelNamer || ((sheetName) => `${sheetName}.json`);
	const classFileNamer = opts.classFileNamer || ((sheetName) => `${sheetName}data.js`);

	if (!fileSystem.existsSync(xlsxDir)) {
		logger(`[excel] xlsx 디렉토리가 없습니다: ${xlsxDir}`);
		return { totalClassCount: 0, failCount: 0 };
	}

	let totalClassCount = 0;
	let failCount = 0;
	const entries = fileSystem.readdirSync(xlsxDir);
	for (const entry of entries) {
		if (!entry.endsWith(".xlsx") || entry.startsWith("~$")) {
			continue;
		}
		const baseName = path.basename(entry, ".xlsx");
		if (skipFileBaseNames.indexOf(baseName) >= 0) {
			logger(`[excel] 건너뜀 (제외 목록): ${entry}`);
			continue;
		}
		const xlsxFullPath = path.join(xlsxDir, entry);
		try {
			const sheets = readSheetsFromXlsx(xlsxFullPath, { skipSheetPrefixes: skipSheetPrefixes });
			for (const sheetName of Object.keys(sheets)) {
				const rows = sheets[sheetName];
				if (rows.length === 0) {
					continue;
				}
				const columns = inferColumns(rows);
				if (columns.length === 0) {
					continue;
				}
				const className = classNamer(sheetName);
				const sourceFileLabel = sourceFileLabelNamer(sheetName);
				const source = generateClassSource(columns, {
					className: className,
					sourceFileLabel: sourceFileLabel,
					baseImportPath: baseImportPath,
				});
				const classFullPath = path.join(classOutputDir, classFileNamer(sheetName));
				fileSystem.mkdirSync(path.dirname(classFullPath), { recursive: true });
				fileSystem.writeFileSync(classFullPath, source, "utf8");
				logger(`[excel] ${entry}::${sheetName} → ${classFullPath} (${className}, 컬럼 ${columns.length})`);
				++totalClassCount;
			}
		}
		catch (error) {
			logger(`[excel] 실패: ${entry} - ${error.message}`);
			++failCount;
		}
	}
	logger(`[excel] xlsx → 클래스 완료. 클래스=${totalClassCount}, 실패=${failCount}`);
	return { totalClassCount: totalClassCount, failCount: failCount };
}


//==============================================================================
// 행 배열 → 단일 시트 xlsx 파일. 배열/객체 셀은 JSON 문자열로 직렬화.
//==============================================================================
function writeRowsToXlsx(xlsxFullPath, rows, sheetName) {
	const flatRows = rows.map((rawRow) => {
		const result = {};
		for (const key of Object.keys(rawRow)) {
			const value = rawRow[key];
			if (Array.isArray(value) || (typeof value === "object" && value !== null)) {
				result[key] = JSON.stringify(value);
			}
			else {
				result[key] = value;
			}
		}
		return result;
	});
	const sheet = xlsx.utils.json_to_sheet(flatRows);
	const workbook = xlsx.utils.book_new();
	xlsx.utils.book_append_sheet(workbook, sheet, sheetName);
	fileSystem.mkdirSync(path.dirname(xlsxFullPath), { recursive: true });
	xlsx.writeFile(workbook, xlsxFullPath);
}


//==============================================================================
// 디렉토리 일괄: json → xlsx. 이미 같은 이름의 xlsx 가 있으면 보호 (덮어쓰지 않음).
//
// options: force(boolean), logger
//==============================================================================
function exportJsonDirectoryToXlsx(jsonDir, xlsxOutputDir, options) {
	const opts = options || {};
	const isForce = opts.force === true;
	const logger = opts.logger || console.log;

	if (!fileSystem.existsSync(jsonDir)) {
		logger(`[excel] json 디렉토리가 없습니다: ${jsonDir}`);
		return;
	}
	const entries = fileSystem.readdirSync(jsonDir);
	for (const entry of entries) {
		if (!entry.endsWith(".json")) {
			continue;
		}
		const jsonFullPath = path.join(jsonDir, entry);
		const baseName = path.basename(entry, ".json");
		const xlsxFullPath = path.join(xlsxOutputDir, `${baseName}.xlsx`);
		if (!isForce && fileSystem.existsSync(xlsxFullPath)) {
			logger(`[excel] 건너뜀 (이미 존재): ${xlsxFullPath}`);
			continue;
		}
		const data = JSON.parse(fileSystem.readFileSync(jsonFullPath, "utf8"));
		const rows = Array.isArray(data) ? data : [];
		writeRowsToXlsx(xlsxFullPath, rows, baseName);
		logger(`[excel] ${jsonFullPath} → ${xlsxFullPath} (${rows.length}행)`);
	}
}


module.exports = {
	normalizeCellValue: normalizeCellValue,
	normalizeRow: normalizeRow,
	readSheetsFromXlsx: readSheetsFromXlsx,
	writeJsonFile: writeJsonFile,
	classifyValue: classifyValue,
	inferColumns: inferColumns,
	jsdocType: jsdocType,
	constructorLine: constructorLine,
	generateClassSource: generateClassSource,
	defaultClassNamer: defaultClassNamer,
	convertDirectoryToJson: convertDirectoryToJson,
	generateClassesFromDirectory: generateClassesFromDirectory,
	writeRowsToXlsx: writeRowsToXlsx,
	exportJsonDirectoryToXlsx: exportJsonDirectoryToXlsx,
};
