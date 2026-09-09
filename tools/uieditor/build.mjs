//==============================================================================
// UI 편집기 단일 HTML 빌드. (서버 없이 file:// 로 바로 실행 가능한 한 파일)
// - 실행: node tools/uieditor/build.mjs
//==============================================================================
import { execFileSync } from "child_process";
import { readFileSync, writeFileSync, unlinkSync } from "fs";
import { dirname, join } from "path";
import { fileURLToPath } from "url";

const scriptDirectory = dirname(fileURLToPath(import.meta.url));
const bundlePath = join(scriptDirectory, "uieditor.bundle.js");
const outputPath = join(scriptDirectory, "uieditor.html");

// 편집기 + 엔진을 IIFE 로 번들. (file:// 에서는 ES 모듈 import 가 막히므로 인라인이 필요)
execFileSync("esbuild", [
	join(scriptDirectory, "uieditor.js"),
	"--bundle",
	`--outfile=${bundlePath}`,
	"--format=iife",
	"--keep-names",
], { stdio: "inherit", shell: true });

const bundleSource = readFileSync(bundlePath, "utf-8");
const htmlText = `<!DOCTYPE html>
<html lang="ko">
<head>
<meta charset="utf-8">
<title>vanilla.js - UI Editor</title>
<link rel="icon" href="./favicon.svg" type="image/svg+xml">
<style>
	html, body { margin: 0; padding: 0; width: 100vw; height: 100vh; overflow: hidden; background: #1e1e1e; color: #ccc; font-family: sans-serif; }
</style>
</head>
<body>
<script>
${bundleSource}
</script>
</body>
</html>
`;
writeFileSync(outputPath, htmlText);
unlinkSync(bundlePath);
console.log("built:", outputPath, `(${(htmlText.length / 1024 / 1024).toFixed(2)} MB)`);
