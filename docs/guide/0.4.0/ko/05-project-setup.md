# 프로젝트 시작

엔진을 페이지에 불러오는 두 가지 방법, 엔진 번들을 직접 묶는 명령, 게임 프로젝트를 배포용으로 묶는 `tools/project.cjs` 와 그 템플릿, 프로젝트 폴더 꼴과 가장 작은 진입 파일을 차례로 봅니다.

## 엔진 불러오기

엔진은 ES 모듈 하나로 불러옵니다. 공개 이름은 모두 저장소 루트의 `import.js` 가 내보내고, 번들은 이 파일을 묶은 것이라 어느 쪽을 불러도 이름이 같습니다.

| 불러오는 곳 | 내용 | 쓰는 때 |
| --- | --- | --- |
| `./build/vanilla.js` | `import.js` 를 묶은 ES 모듈 번들 (소스맵 `vanilla.js.map` 이 옆에 있습니다) | 엔진을 고치지 않고 쓸 때 |
| `./build/vanilla.min.js` | 같은 번들을 줄인 것 | 배포할 때 |
| `./import.js` | 소스 진입점. 브라우저가 `src/` 의 파일을 모듈로 하나씩 받습니다 | 엔진 소스를 고치면서 바로 확인할 때 (빌드가 필요 없습니다) |

가장 작은 페이지는 캔버스 하나와 모듈 스크립트 하나입니다.

```html
<canvas id="mainCanvas"></canvas>
<script type="module">
	import { Engine, EngineConfiguration, Scene, Vector2, Rect, Colors } from "./build/vanilla.js";

	class MainScene extends Scene {
		preDraw(graphic) {
			super.preDraw(graphic);
			const engine = this.getEngine();
			const viewManager = engine.getViewManager();
			viewManager.applyViewRect(graphic);
		}

		draw(graphic) {
			super.draw(graphic);
			graphic.setFillColor(Colors.vanilla);
			graphic.drawRect(Rect.create(40, 40, 240, 120));
		}
	}

	const engineConfiguration = new EngineConfiguration();
	engineConfiguration.canvasId = "mainCanvas";
	engineConfiguration.referenceResolutionSize = Vector2.create(1280, 720);
	engineConfiguration.autoResizeOnWindowResize = true;
	const engine = new Engine(engineConfiguration);
	engine.run(new MainScene());
</script>
```

- `preDraw` 에서 `applyViewRect` 를 부르면 그다음 그리기가 뷰 좌표로 바뀝니다. 부르지 않으면 좌표가 캔버스의 실제 픽셀(CSS 픽셀에 기기 배율을 곱한 값)입니다. 자세한 것은 "엔진과 씬" 장에서 봅니다.
- 모듈 스크립트는 `file://` 로 연 페이지에서 브라우저가 막습니다. 로컬 웹 서버로 엽니다. (README 의 개발 환경에 적힌 VSCode Live Server 같은 것)
- `EngineConfiguration.defaultFontUrl` 의 처음 값은 빈 글이라 엔진은 글꼴을 받지 않고 시스템 글꼴로 그립니다(러스트 판 `default_font_url` 과 같다). 주소(예: 저장소의 `examples/assets/DOSGothic.woff`)를 주면 `engine.run` 이 뒤에서 받아 글꼴 이름 `"default"` 로 올리고, 글꼴을 고르지 않은 글자(엔진 기본 글꼴 사슬)가 그 글꼴을 먼저 씁니다. 받지 못해도 경고만 찍고 시스템 글꼴로 계속합니다.

## 엔진 번들 만들기

`build/vanilla.js` 와 `build/vanilla.min.js` 는 esbuild 로 묶습니다. 저장소 루트에서 실행합니다.

```bash
esbuild import.js --bundle --outfile=build/vanilla.js --format=esm --keep-names --sourcemap '--banner:js=/*! vanilla.js | (c) 2026 vanillapunch | MIT License | https://github.com/ddukbaek2/vanilla.js/blob/release/LICENSE | Third-party notices: https://github.com/ddukbaek2/vanilla.js/blob/release/THIRD_PARTY_LICENSES.md */'
esbuild import.js --bundle --outfile=build/vanilla.min.js --format=esm --minify --keep-names '--banner:js=/*! vanilla.js | (c) 2026 vanillapunch | MIT License | https://github.com/ddukbaek2/vanilla.js/blob/release/LICENSE | Third-party notices: https://github.com/ddukbaek2/vanilla.js/blob/release/THIRD_PARTY_LICENSES.md */'
```

- 묶음 머리의 `/*! ... */` 한 줄은 엔진 라이선스와 제3자 고지 파일(THIRD_PARTY_LICENSES.md)을 가리킵니다. 줄여도 남습니다.
- 초안(src/experimental 의 2D 물리, 타일맵, 2D 뼈대, 공간 소리, 세이브)은 진입점 `import.js` 와 묶음에 들지 않습니다. 쓰려면 묶음 대신 소스를 불러옵니다. 초안이 src 의 엔진 모듈을 불러오므로 엔진도 묶음이 아닌 `import.js` 로 불러야 클래스가 하나입니다. 게임을 esbuild 로 묶으면 초안도 함께 묶입니다.

```js
import { Engine, Vector2 } from "./import.js";
import * as Experimental from "./src/experimental/experimental.js";

const world = new Experimental.PhysicsWorld2D(new Experimental.WorldDefinition2D(32));
```

- `--format=esm` 은 `import { ... } from` 으로 부를 수 있는 모듈로 묶습니다.
- `--keep-names` 는 줄이더라도 클래스와 함수의 이름을 지킵니다. 엔진은 실행 중에 클래스 이름을 읽는 곳이 있습니다. (개발자 도구는 종류 이름을 따로 정하지 않은 노드와 컴포넌트에 `constructor.name` 을 보이고, `UIDocument` 는 표에 등록하지 않은 종류를 이 이름으로 적습니다. 등록한 종류는 등록한 이름으로 적어 줄인 번들에서도 같습니다)
- esbuild 는 따로 깔아 둡니다. (예: `npm install -g esbuild`)

## 프로젝트 폴더 꼴

`tools/project.cjs build` 가 읽는 꼴입니다. 입력 폴더 하나에 진입 파일과 `assets` 폴더를 둡니다.

```text
mygame/                  입력 폴더 (--input)
	main.js                진입 파일 (--script, 입력 폴더 기준 경로)
	assets/                통째로 출력의 assets/ 로 복사됩니다
		sprites/             check 가 훑는 자리 (바로 아래 폴더 이름이 게임 이름)
			mygame/
				hero.png
		.buildignore/        이 이름의 폴더는 복사하지 않습니다 (원본, 작업 파일)
	build/web/             출력 폴더 (--output, 빌드할 때마다 지우고 새로 만듭니다)
```

엔진을 어디에 둘지는 정해져 있지 않습니다. 진입 파일이 엔진을 상대 경로로 import 하면 esbuild 가 따라가 함께 묶습니다. 예를 들어 엔진 저장소를 프로젝트 안의 `vanilla.js/` 폴더에 두었다면 진입 파일은 `./vanilla.js/import.js` 를 부르고, 빌드 명령은 `node vanilla.js/tools/project.cjs build ...` 가 됩니다.

## 가장 작은 main.js

```javascript
import { Engine, EngineConfiguration, Scene, Vector2, Rect, Color } from "./build/vanilla.js";

class MainScene extends Scene {
	preDraw(graphic) {
		super.preDraw(graphic);
		const engine = this.getEngine();
		const viewManager = engine.getViewManager();
		viewManager.applyViewRect(graphic);
	}

	draw(graphic) {
		super.draw(graphic);
		graphic.setFillColor(new Color(0.2, 0.6, 1, 1));
		graphic.drawRect(Rect.create(100, 100, 200, 120));
	}
}

const engineConfiguration = new EngineConfiguration();
engineConfiguration.canvasId = "mainCanvas";
engineConfiguration.referenceResolutionSize = Vector2.create(1280, 720);
engineConfiguration.autoResizeOnWindowResize = true;
const engine = new Engine(engineConfiguration);
engine.run(new MainScene());
```

- 이 칸은 저장소 루트에 둔 파일처럼 `./build/vanilla.js` 를 부릅니다. 프로젝트에서는 엔진을 둔 자리에 맞춰 경로를 바꿉니다. (예: `./vanilla.js/import.js`)
- 템플릿 페이지에는 캔버스가 없습니다. `new Engine` 은 `canvasId` 와 같은 아이디의 요소를 찾고, 없으면 그 아이디로 `<canvas>` 를 만들어 `body` 끝에 붙입니다.
- `project.cjs build` 는 진입 파일을 `--format=iife` 로 묶습니다. esbuild 는 이 형식에서 top-level await 를 받지 않으므로 진입 파일의 맨 바깥에서 `await` 를 쓰지 않습니다. 기다릴 일은 씬의 `load` 안에서 합니다.

## tools/project.cjs build

```bash
node tools/project.cjs build --script main.js --input . --output build/web
node tools/project.cjs build --script main.js --input . --output build/web --template mytemplate
```

차례로 이렇게 합니다.

1. 출력 폴더가 있으면 통째로 지우고 새로 만듭니다.
2. 템플릿 폴더를 출력 폴더로 복사합니다. 템플릿은 `-t` 또는 `--template` 로 준 폴더이고, 주지 않으면 `project.cjs` 옆의 `tools/buildtemplate` 입니다.
3. `<입력>/assets` 를 `<출력>/assets` 로 복사합니다. (`.buildignore` 라는 이름의 폴더는 건너뜁니다)
4. `esbuild <입력>/<진입 파일> --bundle --outfile=<출력>/js/bundle.min.js --format=iife --minify --keep-names` 를 실행합니다.

출력은 이런 꼴입니다.

```text
build/web/
	index.html          템플릿
	css/style.css       템플릿
	favicon.ico         템플릿
	favicon.svg         템플릿
	assets/             <입력>/assets 사본
	js/bundle.min.js    진입 파일과 엔진을 함께 묶은 것
```

`--script`, `--input`, `--output` 셋 가운데 하나라도 빠지면 사용법을 찍고 끝납니다.

## 템플릿 (tools/buildtemplate)

`index.html` 은 머리에서 `./js/bundle.min.js` 를 모듈 스크립트로 부르고, `body` 는 비어 있습니다.

```text
<!DOCTYPE html>
<html lang="ko">
	<head>
		<meta charset="utf-8">
		<meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=1.0, viewport-fit=cover, user-scalable=no">
		<link rel="icon" href="./favicon.ico">
		<link rel="icon" href="./favicon.svg" type="image/svg+xml">
		<link rel="stylesheet" href="./css/style.css">
		<script type="module" src="./js/bundle.min.js"></script>
	</head>
	<body>
	</body>
</html>
```

`css/style.css` 는 `html` 과 `body` 의 여백을 없애고, 넘침을 숨기고, 바탕을 검게 하고, `touch-action: none` 으로 브라우저의 끌기와 확대를 막습니다. `canvas` 는 `100vw` x `100vh` 블록입니다. 페이지 제목, 아이콘, 바탕색을 바꾸려면 이 폴더를 복사해 고친 뒤 `--template` 로 줍니다. (제목은 `EngineConfiguration.title` 로도 정합니다)

## tools/project.cjs check

```bash
node tools/project.cjs check --input .
```

`<입력>/assets/sprites` 아래의 png, jpg, jpeg 를 모두 훑어 게임(바로 아래 폴더)마다 이미지 크기, 파일 크기를 찍고, 가로나 세로가 512 픽셀을 넘는 것에 `!` 를 붙입니다. 게임 폴더 바로 아래의 JSON 가운데 `meta` 와 `images` 가 있는 것은 아틀라스로 보고 `meta.width`, `meta.height`, `meta.count` 를 찍습니다. 마지막에 전체 이미지 수, 크기 합, 아틀라스 수를 냅니다.

- 이미지 크기를 재려고 npm 패키지 `canvas` 를 씁니다. node 가 찾지 못하면 `npm install canvas` 를 하라는 말을 찍고 끝납니다.
- `assets/sprites` 가 없으면 오류를 찍고 끝납니다.

## 그 밖의 명령

`stage` 는 폴더 하나를 통째로 다른 자리에 복사합니다. 대상 폴더가 있으면 먼저 지우고, `--skip` 에 쉼표로 적은 이름은 맨 위 단계에서 건너뜁니다.

```bash
node tools/project.cjs stage --source build/web --destination ../deploy/mygame --skip .git,README.md
```

`project.cjs` 는 `build`, `stage`, `check` 함수를 `module.exports` 로도 내보냅니다. 프로젝트가 자기 빌드 스크립트에서 `require` 로 불러 이어 쓸 수 있습니다.

## 주의할 점

- `build` 와 `stage` 는 출력(대상) 폴더를 먼저 통째로 지웁니다. 손으로 넣은 파일을 그 안에 두지 않습니다.
- `build` 는 `--keep-names` 를 붙여 줄입니다. 묶은 게임 안에서도 클래스 이름(`constructor.name`)이 그대로라 개발자 도구와 `UIDocument` 가 같은 이름을 씁니다.
- esbuild 는 `build` 가 명령줄에서 그대로 부르므로 PATH 에 있어야 합니다.
- 진입 파일의 맨 바깥에서 top-level await 를 쓰면 `build` 의 esbuild 단계가 실패합니다.
- `canvasId` 와 같은 아이디의 캔버스가 페이지에 이미 있으면 엔진은 그것을 씁니다. CSS 로 크기를 정하지 않은 캔버스는 브라우저 기본 크기(300 x 150)이므로 `autoResizeOnWindowResize` 를 켜거나 CSS 로 크기를 줍니다.

## 관련 클래스

Engine, EngineConfiguration, Scene, ViewManager, Graphic, UIDocument
