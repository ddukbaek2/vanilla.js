# Tools

Web authoring tools used with the engine. They open directly in the browser, and their output is saved as JSON documents.

| Tool | Description | Demo | Source |
| --- | --- | --- | --- |
| UI Editor | Build UI screens with node tree, inspector and canvas editing, and save them as `.uiasset.json` | [Open](https://vanillapunch.com/tools/editor/uieditor/) | [`tools/uieditor`](https://github.com/ddukbaek2/vanilla.js/blob/release/tools/uieditor) |
| Particle Editor | Particle preset authoring. Tune values while watching the preview | [Open](https://vanillapunch.com/tools/editor/particleeditor/) | [`tools/particleeditor`](https://github.com/ddukbaek2/vanilla.js/blob/release/tools/particleeditor) |
| Timeline Editor | Keyframe authoring for the same uses as Unity Timeline / Unreal Sequencer. Dope sheet + curves, auto key, events / markers | [Open](https://vanillapunch.com/tools/editor/timelineeditor/) | [`tools/timelineeditor`](https://github.com/ddukbaek2/vanilla.js/blob/release/tools/timelineeditor) |
| Visual Editor | An integrated editor with Unity-like docking windows (hierarchy, scene, game, inspector, project, console). Open folder, prefabs, undo, play. Scenes are saved in UIDocument format (`.scene.json`) | [Open](https://vanillapunch.com/tools/editor/visualeditor/) | [`tools/visualeditor`](https://github.com/ddukbaek2/vanilla.js/blob/release/tools/visualeditor) |

Command-line tools run with Node.js. Detailed usage is in [`tools/TOOLS.md`](https://github.com/ddukbaek2/vanilla.js/blob/release/tools/TOOLS.md).

| Command | Description |
| --- | --- |
| `node tools/atlas.cjs <folder>` | Pack multiple images into textures (MaxRects, multiple sheets on overflow, read by `SpriteAtlas`) |
| `node tools/project.cjs build --script <entry> --input <input> --output <output>` | Template copy and esbuild bundling |
| `node tools/project.cjs check --input <input>` | Asset status check |
| `node tools/project.cjs stage --source <source> --destination <destination>` | Copy to the folder to deploy |
| `node tools/webm.cjs <folder>` | Convert audio to webm |
| `node tools/mangle.cjs <input> <output> <excluded strings>` | Clean up strings in code |
| `node tools/apidoc.cjs <version>` | Generate public API documentation data (`docs/api/<version>.json`) |

`tools/excel.cjs` is a collection of functions for converting between Excel (xlsx), JSON and data class source. It only exports functions through `module.exports` and has no command-line entry point, so running it alone with `node tools/excel.cjs` does nothing. Load it with `require` from other scripts, and the project using it must have the npm package `xlsx` installed. `tools/table.cjs` is currently an empty file.

## Command-Line Tool Usage (tools/TOOLS.md)

### A tool that packs a list of image files into a single texture.
```bash
node tools/atlas.cjs <folder path> [--extrude pixels] [--padding pixels] [--max-size page size limit]
```

### Project tool. (build / asset status check / deploy copy)
```bash
node tools/project.cjs build --script <entry file> --input <input directory> --output <output directory> [-t|--template <build template path>]
node tools/project.cjs check --input <input directory>
node tools/project.cjs stage --source <source directory> --destination <destination directory> [--skip <name1,name2,...>]
```
- build: empties the output directory, copies the build template (tools/buildtemplate by default, changed with -t or --template) and <input>/assets, then bundles the entry file with esbuild into <output>/js/bundle.min.js. (iife, --minify --keep-names)
- check: reports the images and atlases under <input>/assets/sprites. (needs the npm package canvas)
- stage: copies the source directory to the destination directory. (the destination is emptied first, top-level names given to --skip separated by commas are skipped)

### A tool that converts various kinds of audio to webm format.
```bash
node tools/webm.cjs <folder path>
```

### A tool for additional cleanup of strings in code.
```bash
node tools/mangle.cjs <input file> <output file> <additional strings to exclude>
```

### A tool that generates engine API documentation data (JSON). (No external dependencies, uses only Node built-in modules)
```bash
node tools/apidoc.cjs <version> [--date YYYY-MM-DD]
node tools/apidoc.cjs <version> --missing
node tools/apidoc.cjs <version> --check
```
- First line: reads the public API exported by import.js (classes, members, module functions and constants, enums) from source comments and JSDoc and writes docs/api/<version>.json. #names, names starting with an underscore, and JSDoc @private members are left out.
- In descriptions, ko is the original source comment text (with only em dashes and middle dots replaced by commas), and en is taken from the docs/api/translation.en.json table (ko original → en). For ko text not in the table, en is left as an empty string and the count is reported.
- since is the first version in which that member existed in that class (looked up by name), found by scanning tags from v0.0.8 up to just before that version. If it is in no tag, it is that version.
- date is decided in this order: --date, "# <version> (YYYY-MM-DD)" in UPDATE.md, the date of the existing data, today.
- --missing: outputs the list of ko text not in the table as a JSON array. Add the translations to translation.en.json and run the first line again to bring the empty en entries to 0.
- --check: checks the format of docs/api/<version>.json (whether description fields are { ko, en }, kind, since) and prints the counts of modules, classes, members, functions and enums, the number of empty en entries, and the since distribution.
- The guide (docs/guide/<version>/ko, en) and updates (docs/update/<version>.ko.md, .en.md) are translated by hand. The update ko is that version's section in UPDATE.md.
