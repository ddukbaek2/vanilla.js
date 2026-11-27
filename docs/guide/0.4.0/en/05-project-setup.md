# Project Setup

This chapter covers the two ways to load the engine into a page, the commands that build the engine bundle, `tools/project.cjs` with its template for packaging a game for deployment, the project folder layout, and the smallest entry file.

## Loading the engine

The engine is loaded as a single ES module. Every public name is exported by `import.js` at the repository root, and the bundles are built from that file, so the names are the same whichever one you load.

| Load from | Contents | When to use |
| --- | --- | --- |
| `./build/vanilla.js` | ES module bundle of `import.js` (the source map `vanilla.js.map` sits next to it) | Using the engine without changing it |
| `./build/vanilla.min.js` | The same bundle, minified | Deployment |
| `./import.js` | Source entry point. The browser fetches each file in `src/` as a module | Checking engine source changes right away (no build needed) |

The smallest page is one canvas and one module script.

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

- Calling `applyViewRect` in `preDraw` switches the following drawing to view coordinates. Without it, coordinates are the canvas's real pixels (CSS pixels times the device pixel ratio). The "Engine and Scenes" chapter explains this in detail.
- Browsers block module scripts on pages opened from `file://`. Open the page through a local web server (such as VSCode Live Server, listed under the development environment in the README).
- The default value of `EngineConfiguration.defaultFontUrl` is an empty string, so the engine fetches no font and draws with the system font (same as Rust `default_font_url`). Give it an address (such as the repository's `examples/assets/DOSGothic.woff`) and `engine.run` fetches it in the background and adds it under the font name `"default"`, so text that picks no font (the engine default font chain) uses it first. If the fetch fails, the engine only logs a warning and continues with the system font.

## Building the engine bundle

`build/vanilla.js` and `build/vanilla.min.js` are built with esbuild. Run the tool below from the repository root.

```bash
node tools/bundle.cjs
```

- `vanilla.js` is the readable build: it keeps lines and indentation and drops comments. The original sources and comments are in the source map (`vanilla.js.map`). `vanilla.min.js` is the minified build.

- The `/*! ... */` line at the top of the bundles points to the engine license and the third-party notices file (THIRD_PARTY_LICENSES.md). It survives minification.
- The drafts (2D physics, tilemap, 2D skeleton, spatial audio, save slots in src/experimental) are not part of the entry point `import.js` or the bundles. To use them, import the source instead of a bundle. The drafts import the engine modules under src, so import the engine from `import.js` too, not from a bundle, so there is one set of classes. Bundling your game with esbuild bundles the drafts along with it.

```js
import { Engine, Vector2 } from "./import.js";
import * as Experimental from "./src/experimental/experimental.js";

const world = new Experimental.PhysicsWorld2D(new Experimental.WorldDefinition2D(32));
```

- `--format=esm` produces a module that can be loaded with `import { ... } from`.
- `--keep-names` keeps class and function names even when minifying. The engine reads class names at run time in a few places. (The developer tools show the `constructor.name` of nodes and components that do not set their own type name, and `UIDocument` writes this name for types that are not registered in its tables. Registered types are written with their registered names, so they stay the same in a minified bundle)
- Install esbuild separately. (for example `npm install -g esbuild`)

## Project folder layout

This is the layout `tools/project.cjs build` reads. Put the entry file and an `assets` folder in one input folder.

```text
mygame/                  input folder (--input)
	main.js                entry file (--script, path relative to the input folder)
	assets/                copied as a whole into the output's assets/
		sprites/             where check looks (the folder right below is the game name)
			mygame/
				hero.png
		.buildignore/        folders with this name are not copied (sources, work files)
	build/web/             output folder (--output, deleted and recreated on every build)
```

Where the engine lives is up to you. When the entry file imports the engine through a relative path, esbuild follows it and bundles the engine too. For example, if the engine repository sits in a `vanilla.js/` folder inside the project, the entry file imports `./vanilla.js/import.js` and the build command becomes `node vanilla.js/tools/project.cjs build ...`.

## The smallest main.js

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

- This block imports `./build/vanilla.js` as if the file were at the repository root. In a project, change the path to wherever the engine is. (for example `./vanilla.js/import.js`)
- The template page has no canvas. `new Engine` looks for an element whose id equals `canvasId`, and if there is none, it creates a `<canvas>` with that id and appends it to the end of `body`.
- `project.cjs build` bundles the entry file with `--format=iife`. esbuild does not accept top-level await in this format, so do not use `await` at the top level of the entry file. Do the waiting inside the scene's `load`.

## tools/project.cjs build

```bash
node tools/project.cjs build --script main.js --input . --output build/web
node tools/project.cjs build --script main.js --input . --output build/web --template mytemplate
```

It does the following, in order.

1. If the output folder exists, it deletes it entirely and creates it again.
2. It copies the template folder into the output folder. The template is the folder given with `-t` or `--template`, or `tools/buildtemplate` next to `project.cjs` if none is given.
3. It copies `<input>/assets` to `<output>/assets`. (folders named `.buildignore` are skipped)
4. It runs `esbuild <input>/<entry file> --bundle --outfile=<output>/js/bundle.min.js --format=iife --minify --keep-names`.

The output looks like this.

```text
build/web/
	index.html          template
	css/style.css       template
	favicon.ico         template
	favicon.svg         template
	assets/             copy of <input>/assets
	js/bundle.min.js    the entry file bundled together with the engine
```

If any of `--script`, `--input` or `--output` is missing, it prints the usage and exits.

## The template (tools/buildtemplate)

`index.html` loads `./js/bundle.min.js` as a module script in the head, and its `body` is empty.

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

`css/style.css` removes the margins of `html` and `body`, hides overflow, makes the background black, and blocks browser panning and zooming with `touch-action: none`. `canvas` is a `100vw` x `100vh` block. To change the page title, icon or background color, copy this folder, edit it and pass it with `--template`. (the title can also be set with `EngineConfiguration.title`)

## tools/project.cjs check

```bash
node tools/project.cjs check --input .
```

It scans every png, jpg and jpeg under `<input>/assets/sprites`, prints the image size and file size per game (the folder right below), and marks with `!` any image wider or taller than 512 pixels. Among the JSON files directly inside a game folder, those with `meta` and `images` are treated as atlases, and their `meta.width`, `meta.height` and `meta.count` are printed. At the end it prints the total image count, total size and atlas count.

- It uses the npm package `canvas` to measure images. If node cannot find it, it prints a message telling you to run `npm install canvas` and exits.
- If `assets/sprites` does not exist, it prints an error and exits.

## Other commands

`stage` copies one folder as a whole to another place. If the destination exists it is deleted first, and the names listed with commas in `--skip` are skipped at the top level.

```bash
node tools/project.cjs stage --source build/web --destination ../deploy/mygame --skip .git,README.md
```

`project.cjs` also exports the `build`, `stage` and `check` functions through `module.exports`. A project can `require` it from its own build script and build on it.

## Things to watch

- `build` and `stage` delete the output (destination) folder entirely first. Do not keep hand-placed files in it.
- `build` minifies with `--keep-names`. Class names (`constructor.name`) stay the same inside the bundled game, so the developer tools and `UIDocument` use the same names.
- `build` calls esbuild directly on the command line, so esbuild must be on the PATH.
- Using top-level await at the top level of the entry file makes the esbuild step of `build` fail.
- If the page already has a canvas whose id equals `canvasId`, the engine uses it. A canvas without a CSS size has the browser's default size (300 x 150), so turn on `autoResizeOnWindowResize` or size it with CSS.

## Related classes

Engine, EngineConfiguration, Scene, ViewManager, Graphic, UIDocument
