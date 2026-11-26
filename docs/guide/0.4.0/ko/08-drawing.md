# 그리기

그리는 길은 둘입니다. 노드에 그리기 컴포넌트(`Paint`, `Sprite`, `Text`, `RichText` 와 꾸밈 컴포넌트)를 붙이면 노드 트리를 그릴 때 엔진이 함께 그립니다. 씬의 `preDraw`, `draw`, `postDraw` 나 컴포넌트의 `draw` 안에서는 `Graphic` 으로 바로 그립니다. 이 장은 두 길과 블렌드 모드, 화면을 비추는 `Camera2D` 를 봅니다.

## Graphic 으로 바로 그리기

`Graphic` 은 WebGL2 위에 Canvas2D 와 같은 꼴(왼쪽 위 원점, 픽셀 단위, 상태 스택)을 만든 렌더러입니다. 씬의 그리기 메서드가 인자로 받습니다. 엔진이 씬마다 그리기 앞에 뷰 좌표(`viewManager.applyViewRect(graphic)`)를 걸어 두므로, 씬은 처음부터 뷰 좌표로 그립니다. ("엔진과 씬" 장)

| 갈래 | 메서드 |
| --- | --- |
| 색 | `setFillColor(color)`, `setStrokeColor(color)`. `Color` 또는 `"#rgb"`, `"#rgba"`, `"#rrggbb"`, `"#rrggbbaa"`, `"rgb(...)"`, `"rgba(...)"` 글 |
| 상태 | `pushState()`, `popState()` (변환, 투명도, 블렌드, 색, 글꼴, 틴트를 쌓고 되돌림), `translate(x, y)`, `rotate(radian)`, `scale(x, y)`, `setGlobalAlpha(value)` |
| 채운 도형 | `drawRect(rect)`, `drawRoundRect(rect, roundSize)`, `drawCircle(center, radius)`, `drawRing(center, innerRadius, outerRadius, startRadian, endRadian)`, `drawConvexPolygon(positions, color)` |
| 선 | `drawLine(positions, size)`, `drawLineLoop(positions, size)`, `drawStrokeRect(rect, lineWidth)`, `drawStrokeRoundRect(rect, roundSize, lineWidth)`, `drawStrokeCircle(center, radius, lineWidth)`, `drawArc(center, radius, startRadian, endRadian, lineWidth)`, `drawLineSegments(positionValues, size)` |
| 그림 | `drawImage(image, position, size)`, `drawImageWithImageRect(image, position, size, imageRect)`, `drawImageWithNineSlice(image, position, size, nineSlice)` |
| 글 | `setFontString(fontString)`, `setTextAlign(textAlign)`, `setTextBaseline(textBaseline)`, `drawFillText(text, x, y)`, `drawStrokeText(text, x, y, lineWidth)`, `measureText(text)` |

채운 도형과 `drawFillText` 는 채움 색을, 선과 `drawStrokeText` 는 선 색을 씁니다. 각도는 라디안이고 0 이 오른쪽, 늘수록 화면에서 시계 방향입니다.

```javascript
import { Engine, EngineConfiguration, Scene, Vector2, Rect, Color } from "./build/vanilla.js";

class ShapeScene extends Scene {
	preDraw(graphic) {
		super.preDraw(graphic);
		const engine = this.getEngine();
		const viewManager = engine.getViewManager();
		viewManager.applyViewRect(graphic);
	}

	draw(graphic) {
		super.draw(graphic);
		graphic.setFillColor("#2a3550");
		graphic.drawRoundRect(Rect.create(40, 40, 360, 220), 24);

		graphic.setFillColor(new Color(1, 0.8, 0.2, 1));
		graphic.drawCircle(Vector2.create(560, 150), 80);
		graphic.drawRing(Vector2.create(800, 150), 50, 80, -Math.PI / 2, Math.PI);

		graphic.setStrokeColor("#66ddff");
		graphic.drawLine([Vector2.create(40, 320), Vector2.create(240, 420), Vector2.create(440, 320)], 6);
		graphic.drawStrokeRect(Rect.create(520, 300, 160, 120), 3);

		const triangle = [Vector2.create(800, 300), Vector2.create(900, 460), Vector2.create(700, 460)];
		graphic.drawConvexPolygon(triangle, new Color(0.6, 0.4, 1, 1));

		graphic.pushState();
		graphic.translate(1040, 380);
		graphic.rotate(Math.PI / 8);
		graphic.setGlobalAlpha(0.6);
		graphic.setFillColor("#ff6688");
		graphic.drawRect(Rect.create(-80, -50, 160, 100));
		graphic.popState();

		graphic.setFillColor("#ffffff");
		graphic.setFontString("32px sans-serif");
		graphic.setTextAlign("left");
		graphic.setTextBaseline("top");
		graphic.drawFillText("Hello, Graphic", 40, 520);
	}
}

const engineConfiguration = new EngineConfiguration();
engineConfiguration.referenceResolutionSize = Vector2.create(1280, 720);
engineConfiguration.autoResizeOnWindowResize = true;
const engine = new Engine(engineConfiguration);
engine.run(new ShapeScene());
```

컴포넌트의 `draw(graphic)` 안에서도 같은 메서드를 씁니다. 그때 원점은 노드 내용 영역의 왼쪽 위이고 노드의 자리, 회전, 크기, 투명도가 이미 걸려 있습니다.

## 그리기 컴포넌트

| 컴포넌트 | 그리는 것 |
| --- | --- |
| `Paint` | 내용 크기만큼 한 색 사각형 (`setColor`, `setRoundSize`, 처음 색 흰색) |
| `Sprite` | 그림. `Paint` 를 이어받습니다. 그림이 없으면 `Paint` 처럼 칠합니다 (처음 색은 투명) |
| `Text` | 한 글꼴, 한 크기, 한 색의 글 (여러 줄 가능) |
| `RichText` | 마크업으로 조각마다 꼴을 바꾼 글. `Text` 를 이어받습니다 |

컴포넌트는 노드의 내용 크기 안에 그립니다. 노드에 내용 크기를 주지 않으면(0, 0) 아무것도 보이지 않습니다.

## Sprite

```javascript
import { Engine, EngineConfiguration, Scene, WorldNode, Sprite, ImageAsset, Vector2, Rect, Color } from "./build/vanilla.js";

class SpriteScene extends Scene {
	async load(engine) {
		await super.load(engine);
		const imageAsset = new ImageAsset();
		await imageAsset.load("examples/assets/spritesheet.png");
		const root = this.getRoot();

		const wholeNode = new WorldNode();
		wholeNode.setContentSize(Vector2.create(300, 300));
		wholeNode.setLocalPosition(Vector2.create(220, 360));
		const wholeSprite = wholeNode.addComponent(Sprite);
		wholeSprite.setImage(imageAsset);
		root.addChild(wholeNode);

		const frameNode = new WorldNode();
		frameNode.setContentSize(Vector2.create(200, 200));
		frameNode.setLocalPosition(Vector2.create(560, 360));
		const frameSprite = frameNode.addComponent(Sprite);
		frameSprite.setImage(imageAsset);
		frameSprite.setImageRect(Rect.create(200, 0, 200, 200));
		root.addChild(frameNode);

		const tintNode = new WorldNode();
		tintNode.setContentSize(Vector2.create(200, 200));
		tintNode.setLocalPosition(Vector2.create(800, 360));
		const tintSprite = tintNode.addComponent(Sprite);
		tintSprite.setImage(imageAsset);
		tintSprite.setImageRect(Rect.create(0, 0, 200, 200));
		tintSprite.setColor(new Color(1, 0.2, 0.2, 0.5));
		root.addChild(tintNode);

		const tiledNode = new WorldNode();
		tiledNode.setContentSize(Vector2.create(180, 400));
		tiledNode.setLocalPosition(Vector2.create(1080, 360));
		const tiledSprite = tiledNode.addComponent(Sprite);
		tiledSprite.setImage(imageAsset);
		tiledSprite.setImageRect(Rect.create(0, 200, 100, 100));
		tiledSprite.setSpriteDrawMode("tiled");
		root.addChild(tiledNode);
	}

	preDraw(graphic) {
		super.preDraw(graphic);
		const engine = this.getEngine();
		const viewManager = engine.getViewManager();
		viewManager.applyViewRect(graphic);
	}
}

const engineConfiguration = new EngineConfiguration();
engineConfiguration.referenceResolutionSize = Vector2.create(1280, 720);
engineConfiguration.autoResizeOnWindowResize = true;
const engine = new Engine(engineConfiguration);
engine.run(new SpriteScene());
```

- `setImage(image)` 는 `ImageAsset` 이나 `HTMLImageElement` 를 받습니다. 그림은 노드의 내용 크기로 늘여 그립니다.
- `setImageRect(rect)` 는 그림 안의 한 조각만 그립니다. 영역이 0 이면 그림 전체입니다. `setFrame(frame)` 은 `Frame`(그림과 영역)을 한 번에 겁니다. (`SpriteAtlas` 는 "애셋 불러오기" 장)
- `setSpriteDrawMode(mode)`: `"simple"`(처음 값, 늘이기), `"sliced"`(나인 슬라이스), `"tiled"`(조각 크기대로 되풀이해 채움, 넘치는 곳은 자름).
- `"sliced"` 는 `setNineSlice(rect)` 로 테두리 두께를 줍니다. 사각형의 `x` 가 왼쪽, `y` 가 위, `width` 가 오른쪽, `height` 가 아래 두께입니다. 내용 크기가 테두리 합보다 작으면 그리지 않습니다.
- `setColor(color)` 의 알파가 0 보다 크면 그림의 모양(불투명한 곳) 안에만 그 색을 알파 비율로 덮습니다.
- `setHorizontalFlip`, `setVerticalFlip` 은 내용 영역의 왼쪽 끝(위쪽 끝)을 축으로 뒤집어, 그림이 내용 영역의 왼쪽(위쪽) 바깥에 그려집니다. 제자리에서 뒤집으려면 노드의 로컬 크기 배율을 음수로 줍니다. (`node.setLocalScaleXY(-1, 1)`, 기준점을 축으로 뒤집힙니다)

## Text

```javascript
import { Engine, EngineConfiguration, Scene, WorldNode, Paint, Text, RichText, TextAlign, TextBaseline, Vector2, Color } from "./build/vanilla.js";

class TextScene extends Scene {
	initialize(engine) {
		super.initialize(engine);
		const root = this.getRoot();

		const titleNode = new WorldNode();
		titleNode.setContentSize(Vector2.create(800, 80));
		titleNode.setLocalPosition(Vector2.create(640, 100));
		const title = titleNode.addComponent(Text);
		title.setText("vanilla.js");
		title.setFontSize(64);
		title.setBold(true);
		title.setTextColor("#ffe08a");
		title.setStrokeColor("#402000");
		title.setStrokeWidth(4);
		root.addChild(titleNode);

		const bodyNode = new WorldNode();
		bodyNode.setContentSize(Vector2.create(520, 200));
		bodyNode.setLocalPosition(Vector2.create(400, 330));
		const bodyPaint = bodyNode.addComponent(Paint);
		bodyPaint.setColor(new Color(0, 0, 0, 0.4));
		const body = bodyNode.addComponent(Text);
		body.setText("Text wraps inside the node width when a word wrap width is set or the text has a line break.");
		body.setFontSize(26);
		body.setTextAlign(TextAlign.left);
		body.setTextBaseline(TextBaseline.top);
		body.setWordWrapWidth(500);
		body.setLineSpacing(1.4);
		root.addChild(bodyNode);

		const richNode = new WorldNode();
		richNode.setContentSize(Vector2.create(600, 60));
		richNode.setLocalPosition(Vector2.create(960, 330));
		const rich = richNode.addComponent(RichText);
		rich.setFontSize(30);
		rich.setText("<b>Bold</b>, <color=#ff6666>red</color>, <size=40>big</size> and <u>underline</u>");
		root.addChild(richNode);

		const buttonNode = new WorldNode();
		buttonNode.setContentSize(Vector2.create(200, 60));
		buttonNode.setLocalPosition(Vector2.create(960, 480));
		const buttonPaint = buttonNode.addComponent(Paint);
		buttonPaint.setColor("#3366cc");
		buttonPaint.setRoundSize(12);
		const buttonText = buttonNode.addComponent(Text);
		buttonText.setText("A very long button caption");
		buttonText.setFontSize(28);
		buttonText.setFitWidth(180);
		root.addChild(buttonNode);
	}

	preDraw(graphic) {
		super.preDraw(graphic);
		const engine = this.getEngine();
		const viewManager = engine.getViewManager();
		viewManager.applyViewRect(graphic);
	}
}

const engineConfiguration = new EngineConfiguration();
engineConfiguration.referenceResolutionSize = Vector2.create(1280, 720);
engineConfiguration.autoResizeOnWindowResize = true;
const engine = new Engine(engineConfiguration);
engine.run(new TextScene());
```

`Text` 의 처음 값은 크기 32, 흰색, 가운데 정렬(`"center"`), 가운데 기준선(`"middle"`), 외곽선 두께 0, 줄 간격 1.25, 시스템 글꼴입니다.

- 글은 노드의 내용 영역 안에 놓입니다. 가로는 정렬이 `left` 면 왼쪽 끝, `right` 면 오른쪽 끝, 그 밖은 가운데이고, 세로는 기준선이 `top` 이면 위, `bottom`, `alphabetic`, `ideographic` 이면 아래, 그 밖은 가운데입니다.
- `setWordWrapWidth(width)` 가 0 보다 크거나 글에 `"\n"` 이 있으면 여러 줄로 그립니다. 폭을 주지 않은 여러 줄 글은 노드 너비로 나눕니다. `setWrapMode("char")` 는 낱말과 상관없이 글자 단위로 나눕니다. (처음 값 `"word"`)
- `setFitWidth(width, minimumRatio)` 는 한 줄 글이 그 너비를 넘치면 정한 크기에서 최소 비율(처음 0.55)까지 줄여 그립니다. 언어마다 길이가 다른 단추 글에 씁니다.
- `setVisibleCharacterCount(count)` 는 앞에서 그만큼의 글자만 보입니다. (-1 이면 전체, 타자기 연출)
- `setFont(font)` 는 `FontAsset` 이나 `FontFace` 를 받습니다. 글꼴 받기는 "애셋 불러오기" 장에서 봅니다.

## RichText

`RichText.setText` 는 마크업을 읽어 조각으로 나눕니다. 조각에 적지 않은 꼴은 `Text` 의 설정을 따릅니다.

| 태그 | 뜻 |
| --- | --- |
| `<b>...</b>`, `<i>...</i>` | 굵게, 기울임 |
| `<u>...</u>`, `<s>...</s>` | 밑줄, 취소선 |
| `<color=#RRGGBB>...</color>`, `<color=#RRGGBBAA>...</color>` | 색 |
| `<color=red>...</color>` | 이름 있는 색 (red, green, blue, white, black, yellow, cyan, magenta, gray, orange, purple 같은 22 가지) |
| `<size=N>...</size>` | 글자 크기 |

모르는 태그는 글 그대로 보입니다. 마크업 없이 코드로 조각을 쌓을 때는 `appendSegment(text, attributes)` 를 씁니다. 속성은 `fontFace`, `fontSize`, `textColor`, `strokeColor`, `strokeWidth`, `bold`, `italic`, `underline`, `strikethrough` 이고 색은 `Color` 로 줍니다.

```javascript
import { WorldNode, RichText, Color, Vector2 } from "./build/vanilla.js";

const node = new WorldNode();
node.setContentSize(Vector2.create(600, 60));
const richText = node.addComponent(RichText);
richText.appendSegment("HP ", { bold: true });
richText.appendSegment("120", { textColor: new Color(0.4, 1, 0.4, 1), fontSize: 40 });
richText.appendSegment(" / 150", { textColor: new Color(0.7, 0.7, 0.7, 1) });
const segments = richText.getSegments();
console.log(segments.length);
```

조각이 있는 `RichText` 는 조각을 왼쪽부터 한 줄로 이어 그립니다. 정렬과 기준선은 조각 폭의 합과 가장 큰 글자 크기로 셉니다.

## 블렌드 모드

블렌드 모드는 Canvas2D 의 합성 이름 26 가지를 모두 받습니다. 컴포넌트는 `Sprite.setSpriteBlendMode(name)`, 바로 그릴 때는 `graphic.setBlendMode(name)` 을 씁니다. 처음 값은 `"source-over"` 입니다.

- 고정 블렌딩: `source-over`, `source-in`, `source-out`, `source-atop`, `destination-over`, `destination-in`, `destination-out`, `destination-atop`, `lighter`, `copy`, `xor`, `multiply`, `screen`
- 셰이더로 섞기: `overlay`, `darken`, `lighten`, `color-dodge`, `color-burn`, `hard-light`, `soft-light`, `difference`, `exclusion`, `hue`, `saturation`, `color`, `luminosity`

셰이더로 섞는 13 가지는 그릴 때마다 그릴 영역 아래를 지금 화면에서 떠 와 W3C Compositing and Blending 공식대로 섞습니다. 이 모드에서는 묶어 그리지 않고 그리기마다 영역 복사가 한 번 더 듭니다. `multiply` 는 렌더 타겟에 그릴 때만 셰이더로 섞습니다. 모르는 이름은 `source-over` 로 그립니다.

```javascript
import { Engine, EngineConfiguration, Scene, Vector2, Color } from "./build/vanilla.js";

class BlendScene extends Scene {
	preDraw(graphic) {
		super.preDraw(graphic);
		const engine = this.getEngine();
		const viewManager = engine.getViewManager();
		viewManager.applyViewRect(graphic);
	}

	draw(graphic) {
		super.draw(graphic);
		const blendModes = ["source-over", "lighter", "multiply", "screen", "difference"];
		for (let index = 0; index < blendModes.length; ++index) {
			const centerX = 160 + index * 240;
			graphic.setFillColor(new Color(0.9, 0.3, 0.2, 1));
			graphic.drawCircle(Vector2.create(centerX - 40, 360), 90);
			graphic.pushState();
			graphic.setBlendMode(blendModes[index]);
			graphic.setFillColor(new Color(0.2, 0.5, 0.9, 1));
			graphic.drawCircle(Vector2.create(centerX + 40, 360), 90);
			graphic.popState();
		}
	}
}

const engineConfiguration = new EngineConfiguration();
engineConfiguration.referenceResolutionSize = Vector2.create(1280, 720);
engineConfiguration.autoResizeOnWindowResize = true;
const engine = new Engine(engineConfiguration);
engine.run(new BlendScene());
```

`pushState` 와 `popState` 로 감싸면 블렌드 모드도 함께 되돌아갑니다. Canvas2D 와 달리 `source-in`, `source-out`, `destination-in`, `destination-atop`, `copy` 는 그린 도형 안만 바꿉니다.

## 꾸밈 컴포넌트

| 컴포넌트 | 하는 일 | 주요 메서드 (처음 값) |
| --- | --- | --- |
| `Mask` | 노드의 내용 영역으로 자식 그리기를 자릅니다. 돌아간 노드도 맞게 자르고, 잘린 곳의 자식은 터치도 받지 않습니다 | `setRoundSize` (0) |
| `Outline` | 테만 그립니다. 둥근 네모 테나 동그라미 테 (선은 내용 영역 안쪽에 들어옵니다) | `setColor` (흰색), `setLineWidth` (1), `setRoundSize` (0), `setCircle` (false) |
| `ShadowText` | 그림자를 깐 한 줄 글을 캔버스 한 장에 구워 그립니다. 노드를 흐리게 해도 글과 그림자가 한 장으로 흐려집니다. 넘치면 줄여 맞춥니다 | `setText`, `setTextStyle(fontSize, isBold, textColor)` (16, false, `"#ffffff"`), `setShadow(color, opacity, offset, blur)`, `setFitMinimumRatio` (0.6) |
| `SoftShade` | 글 뒤를 부드럽게 어둡게 누르는 그늘 | `setShade(shape, color, opacity, fadeWidth)` (`SoftShadeShape.band`, `"#000000"`, 0.5, 0) |
| `ShadowImage` | 그림자를 깐 그림. 노드 안에 비를 지켜 가장 크게, 가운데로 | `setImage(image, imageRect)`, `setImageColor`, `setShadow(color, opacity, offset, blur)` |

`ShadowText`, `SoftShade`, `ShadowImage` 의 색은 `"#rrggbb"` 글로 줍니다. `SoftShadeShape.band` 는 가운데 가로줄이 가장 짙고 위아래로 엷어지는 띠, `SoftShadeShape.bottom` 은 아래 끝이 가장 짙은 세로 그라데이션입니다.

```javascript
import { Engine, EngineConfiguration, Scene, WorldNode, Paint, Mask, Outline, ShadowText, SoftShade, SoftShadeShape, Vector2, Rect, Color } from "./build/vanilla.js";

class DecorationScene extends Scene {
	initialize(engine) {
		super.initialize(engine);
		const root = this.getRoot();

		const panel = new WorldNode();
		panel.setContentSize(Vector2.create(480, 300));
		panel.setLocalPosition(Vector2.create(400, 360));
		const panelPaint = panel.addComponent(Paint);
		panelPaint.setColor("#1d2333");
		panelPaint.setRoundSize(20);
		const mask = panel.addComponent(Mask);
		mask.setRoundSize(20);
		root.addChild(panel);

		const bigCircle = new WorldNode();
		bigCircle.setContentSize(Vector2.create(320, 320));
		bigCircle.setLocalPosition(Vector2.create(460, 280));
		const circlePaint = bigCircle.addComponent(Paint);
		circlePaint.setColor(new Color(1, 0.6, 0.2, 1));
		circlePaint.setRoundSize(160);
		panel.addChild(bigCircle);

		const frame = new WorldNode();
		frame.setContentSize(Vector2.create(480, 300));
		frame.setLocalPosition(Vector2.create(240, 150));
		const outline = frame.addComponent(Outline);
		outline.setColor("#8899cc");
		outline.setLineWidth(3);
		outline.setRoundSize(20);
		panel.addChild(frame);

		const shadeNode = new WorldNode();
		shadeNode.setContentSize(Vector2.create(560, 120));
		shadeNode.setLocalPosition(Vector2.create(960, 360));
		const softShade = shadeNode.addComponent(SoftShade);
		softShade.setShade(SoftShadeShape.band, "#000000", 0.7, 80);
		root.addChild(shadeNode);

		const captionNode = new WorldNode();
		captionNode.setContentSize(Vector2.create(520, 80));
		captionNode.setLocalPosition(Vector2.create(960, 360));
		const shadowText = captionNode.addComponent(ShadowText);
		shadowText.setText("Shadow Text");
		shadowText.setTextStyle(48, true, "#ffffff");
		shadowText.setShadow("#000000", 0.8, 4, 6);
		root.addChild(captionNode);
	}

	preDraw(graphic) {
		super.preDraw(graphic);
		const engine = this.getEngine();
		const viewManager = engine.getViewManager();
		viewManager.applyViewRect(graphic);
		graphic.setFillColor("#5a6b7a");
		graphic.drawRect(Rect.create(700, 0, 580, 720));
	}
}

const engineConfiguration = new EngineConfiguration();
engineConfiguration.referenceResolutionSize = Vector2.create(1280, 720);
engineConfiguration.autoResizeOnWindowResize = true;
const engine = new Engine(engineConfiguration);
engine.run(new DecorationScene());
```

`Mask` 는 컴포넌트를 그리는 단계에서는 아무것도 그리지 않고, 노드가 자식을 그리기 직전에 자르기를 시작해 직후에 풉니다. 그래서 같은 노드의 `Paint` 는 잘리지 않고, 자식만 잘립니다. 노드는 자기 컴포넌트를 모두 그린 뒤 자식을 그리므로, 테(`Outline`)를 자식 위에 보이려면 위 예제처럼 마지막 자식 노드에 붙입니다.

## Camera2D

`Camera2D` 는 컴포넌트가 아니라 씬이 들고 쓰는 객체입니다. 바라보는 월드 좌표(`position`, 화면 가운데에 옵니다), 확대 배율(`zoom`, 처음 1, `setZoomRange` 의 범위 안으로 자르며 처음 범위는 0.1 ~ 8), 회전(`rotation`, 도, 화면 가운데가 축)을 갖고, `begin(graphic)` 과 `end(graphic)` 사이에서 그린 것에 그 변환을 겁니다.

| 메서드 | 내용 |
| --- | --- |
| `setViewSize(size)` | 화면 크기. 매 프레임이나 리사이즈 때 뷰 크기를 줍니다 (처음 960 x 640) |
| `setPosition`, `setZoom`, `setRotation` | 바로 정하기 |
| `setWorldBounds(rect)` | 보이는 영역이 이 사각형 밖으로 나가지 않게 막습니다 (`null` 이면 막지 않음) |
| `setZoomRange(minimum, maximum)` | 확대 배율 범위 |
| `follow(targetPositions, rate, timeDelta)` | 대상(여럿이면 가운데)을 프레임과 상관없이 고르게 따라갑니다 |
| `panByScreen(deltaX, deltaY)`, `fling(velocityX, velocityY)` | 화면 픽셀 단위로 끌기, 놓을 때 관성 |
| `zoomAt(anchorScreen, zoomFactor)` | 화면의 한 점 아래 월드 지점을 고정한 채 확대 |
| `tweenTo(position, zoom, duration)` | 자리와 배율로 부드럽게 옮기기 (처음 0.4 초) |
| `tick(timeDelta)` | 관성, 옮기기, 경계 막기 갱신 |
| `screenToWorld(position)`, `worldToScreen(position)` | 좌표 바꾸기 |

```javascript
import { Engine, EngineConfiguration, Scene, Camera2D, Vector2, Rect, Color } from "./build/vanilla.js";

class CameraScene extends Scene {
	#camera;
	#elapsedSeconds;

	constructor() {
		super();
		this.#camera = new Camera2D();
		this.#elapsedSeconds = 0;
	}

	initialize(engine) {
		super.initialize(engine);
		this.#camera.setWorldBounds(Rect.create(0, 0, 2400, 1600));
		this.#camera.setPosition(Vector2.create(400, 400));
		this.#camera.setZoom(1.5);
	}

	tick(timeDelta) {
		super.tick(timeDelta);
		this.#elapsedSeconds += timeDelta;
		const engine = this.getEngine();
		const viewManager = engine.getViewManager();
		const viewSize = viewManager.getViewSize();
		this.#camera.setViewSize(viewSize);
		const target = Vector2.create(400 + this.#elapsedSeconds * 200, 400 + this.#elapsedSeconds * 100);
		this.#camera.follow([target], 4, timeDelta);
		this.#camera.setRotation(Math.sin(this.#elapsedSeconds) * 10);
		this.#camera.tick(timeDelta);
	}

	preDraw(graphic) {
		super.preDraw(graphic);
		const engine = this.getEngine();
		const viewManager = engine.getViewManager();
		viewManager.applyViewRect(graphic);
	}

	draw(graphic) {
		this.#camera.begin(graphic);
		for (let row = 0; row < 16; ++row) {
			for (let column = 0; column < 24; ++column) {
				const isDark = (row + column) % 2 === 0;
				graphic.setFillColor(isDark ? "#283040" : "#3a4660");
				graphic.drawRect(Rect.create(column * 100, row * 100, 100, 100));
			}
		}
		graphic.setFillColor(new Color(1, 0.8, 0.2, 1));
		graphic.drawCircle(Vector2.create(400 + this.#elapsedSeconds * 200, 400 + this.#elapsedSeconds * 100), 30);
		this.#camera.end(graphic);
		super.draw(graphic);
	}
}

const engineConfiguration = new EngineConfiguration();
engineConfiguration.referenceResolutionSize = Vector2.create(1280, 720);
engineConfiguration.autoResizeOnWindowResize = true;
const engine = new Engine(engineConfiguration);
engine.run(new CameraScene());
```

위 예제는 카메라를 끝낸 뒤 `super.draw(graphic)` 로 노드 트리를 그리므로 노드는 카메라와 상관없이 화면에 고정됩니다. (HUD) 노드 트리까지 카메라로 비추려면 `super.draw(graphic)` 를 `begin` 과 `end` 사이에서 부릅니다.

## 그리기 설정

`engine.getGraphic()` 으로 얻은 `Graphic` 에 정합니다.

- `setImageSmoothingEnabled(false)`: 그림을 가장 가까운 픽셀로 늘입니다. 도트 그림 게임이 씁니다. (처음 켬)
- `setImageMipmapEnabled(true)`: 큰 그림을 크게 줄여 그릴 때 자글거림을 줄입니다. (처음 끔)
- `setSpriteBatchingEnabled`, `setCullingEnabled`: 묶어 그리기와 화면 밖 거르기. 둘 다 처음 켜져 있습니다. 거르기는 켜진 컴포넌트가 모두 내용 영역 안에만 그린다고 알리거나 그리는 사각형을 알려 준 노드만 화면 밖일 때 건너뜁니다.

## 주의할 점

- 그림은 다 받은 뒤에 그립니다. 씬의 `load` 에서 `await imageAsset.load(...)` 로 받고 노드를 짓습니다.
- `Sprite.setImage` 는 `ImageAsset` 과 `HTMLImageElement` 만 받고 그 밖(캔버스 등)은 조용히 무시합니다. 캔버스는 `graphic.drawImage` 나 `ShadowImage` 로 그립니다.
- `Paint.setColor` 와 `Text.setTextColor` 의 글은 `"#..."` 이나 `"rgb..."` 로 시작해야 합니다. `Graphic.setFillColor` 에 모르는 꼴의 글을 주면 흰색이 됩니다.
- 그리기 모드와 블렌드 모드 이름(`SpriteDrawMode`, `SpriteBlendMode`)은 공개 이름에 없으므로 `"tiled"`, `"lighter"` 처럼 글로 씁니다.
- 셰이더로 섞는 블렌드 모드는 그리기마다 영역 복사가 들고 묶어 그리지 않으므로 많이 쓰면 느려집니다.
- 글은 문자열과 꼴마다 텍스처로 구워 캐시에 둡니다. (상한 512 개, 오래 안 쓴 것부터 버립니다) 매 프레임 바뀌는 숫자처럼 글이 자주 바뀌면 바뀔 때마다 새로 굽습니다.

## 관련 클래스

Graphic, Color, Colors, Rect, Paint, Sprite, Text, RichText, TextAlign, TextBaseline, Mask, Outline, ShadowText, SoftShade, SoftShadeShape, ShadowImage, Camera2D, ImageAsset, Frame
