# 업데이트 기록

# 아직 release 에 합치지 않은 것 (release 에 합칠 때 패치 판을 하나 올려 매긴다)
- 외계행성 광부 키우기(webgame-rimminer)가 게임 쪽에 따로 만들어 쓰던 범용 기능을 엔진으로 옮긴다. (게임 코드는 건드리지 않았다, 게임은 지금처럼 자기 것을 쓴다)
- ShaderWarmer: 셰이더 미리 링크. 켤 때 같은 소스를 KHR_parallel_shader_compile 로 뒤에서 링크해 브라우저 프로그램 캐시에 남겨, 나중에 ShaderProgram 이 같은 소스를 지을 때 주 스레드가 멈추지 않게 한다. 확장이 없으면 아무것도 하지 않는다. 매 프레임 update(), isFinished(), isSupported(). 어트리뷰트 위치는 ShaderProgram 과 같은 attributeLocationTable 로 준다
- Outline: 테만 그리는 컴포넌트. (Paint 는 속을 채우기만 한다) 둥근 네모 테(setRoundSize) 또는 동그라미 테(setCircle), 선은 내용 크기 안쪽에 들어온다. setColor(Color 나 "#rrggbb", "rgba(...)"), setLineWidth
- UIProgressRing: 진행 고리 컴포넌트. 노드의 꼴(둥근 네모, 둥근 정도가 크기의 반이면 동그라미)을 따라 위 가운데에서 시계 방향으로 채운 몫(setRatio)만큼 채운 색, 나머지는 바탕 색으로 그린다. 둘레의 점은 크기, 둥근 정도, 굵기가 바뀔 때만 셈한다
- UIHitArea: 누르는 자리 넓히기. UIHitArea.attach(buttonNode, minimumSize) 로 단추 바로 뒤 형제로 투명한 누름 자리를 두어 가로세로를 minimumSize 이상으로 넓힌다. 넓힌 몫을 누르면 단추의 클릭 알림을 부르고, 단추가 꺼지거나 누를 수 없으면 따른다. 단추의 자리, 크기, 피봇을 프레임마다 따라간다. setClipNode 로 넓힌 몫을 창이나 스크롤 칸 안으로 자를 수 있다
- FrameProbe: 처지는 기기 가리기. 기다리는 초 뒤 재는 초 동안 프레임 간격을 보아, 목표 간격의 1.4 배를 넘긴 프레임이 25% 이상이면 처지는 기기다. (90 Hz 화면의 60 FPS 처럼 늘 한 장 걸러 그리는 것은 처진 것으로 보지 않는다) restart, measureAgain, 값은 setSeconds, setSlowFrameThreshold 로 바꾼다
- PointerCursor: 마우스 커서. 켜면(PointerCursor.getInstance().setEnabled(true)) 엔진이 프레임 끝마다 캔버스의 커서를 정한다. UIButton 위(누르는 중 포함)면 단추의 커서(처음은 pointer), 아니면 setScreenCursor 로 정한 커서다. registerImageCursor 로 1 배와 2 배 그림 커서를 더한다. 손가락 기기에서는 건드리지 않는다. 꺼져 있으면(기본) 지금까지와 같다
- UIButton: 마우스가 올라 있거나 누르는 중이면 PointerCursor 에 알린다. (PointerCursor 가 꺼져 있으면 아무 일도 없다)
- Engine: 프레임 끝(묶어 그리기를 그린 뒤)에 PointerCursor.apply() 를 부른다
- Platform: isDesktopWeb() (모바일이 아니고, 손가락 입력이 여럿 되는 맥인 아이패드도 아님), isCoarsePointer() (CSS pointer: coarse)
- ViewManager: getCssPixelScale(). 뷰 한 단위가 화면에서 몇 CSS 픽셀인지. (작은 화면에서 UI 층만 키울 배율을 셈할 때 쓴다)
- SoftShade, SoftShadeShape: 부드러운 그늘 컴포넌트. 글 뒤를 어둡게 눌러 밝은 바탕 위에서도 읽히게 한다. 띠(가운데가 가장 짙고 위아래와 양옆으로 엷어짐) 또는 바닥(아래가 가장 짙은 세로 그라데이션)을 작은 캔버스에 구워 내용 크기로 늘려 그린다. 크기, 모양, 색, 짙기가 바뀔 때만 다시 굽는다
- ShadowText: 그림자를 깐 한 줄 글 컴포넌트. 그림자 위에 글을 얹은 모습을 캔버스 한 장에 구워 그리므로 노드의 불투명도가 글과 그림자에 한 장째로 먹는다. (Text 두 벌로 깔면 흐리게 할 때 밑의 그림자가 비친다) 그림자는 번지게(setShadow 의 shadowBlur) 할 수 있고, 넘치면 setFitMinimumRatio 까지 줄여 맞춘다. 가로 정렬과 자리는 Graphic.drawTextEntry 와 같은 셈, 세로는 가운데. setFontFace, setTextDirection
- ShadowImage: 그림자를 깐 그림 컴포넌트. 그림(또는 setImage(image, imageRect) 로 아틀라스의 조각)을 노드 안에 비를 지켜 가운데로 그리고, 그림의 모양 밑에 그림자를 칠해 한 장으로 굽는다. setImageColor 로 그림을 한 빛으로 칠할 수 있다
- buildRGBAString(colorText, opacity): "#rrggbb" 와 불투명도로 캔버스의 rgba 색 글을 만든다. (shadowtext.js)
- CameraGestures: 카메라 손짓. 3D 판이나 지도를 돌리고 밀고 키우는 손짓을 캔버스의 DOM 사건에서 따로 읽는다. 마우스 오른쪽 끌기(가로는 돌리기, 화면 너비가 한 바퀴, 세로는 기울이기, 끌지 않고 떼면 오른쪽 클릭), 가운데 끌기(밀기), 두 손가락(밀기, 오므려 키우기, 문턱을 넘게 비틀면 돌리기). 모인 양은 takePan, takeRotation, takeTilt, takeZoom, getZoomAnchor 로 매 프레임 꺼낸다. 손짓 중이면 isGestureActive. 손가락을 뗀 바로 뒤의 흉내 낸 마우스 사건은 무시한다. setThresholds 로 문턱을 바꾸고 dispose 로 뗀다
- SoundSystem, setSoundSystem, readSoundSystem: 소리 표로 다루는 배경음악과 효과음. (AudioManager 의 공유 AudioContext 와 AudioAsset 을 쓴다) 줄마다 { id, path 나 paths, volume, minimumInterval, isMusic, maximumVoices, pitchVariation, playSeconds, fadeOutSeconds }. 여러 녹음 중 바로 앞과 다른 것 고르기, 같은 소리 동시 수 제한, 음 높이 흔들기, 앞 몇 초만 틀고 줄여 끄기, 배경음악 겹쳐 바꾸기와 이어 틀기, 음악과 효과음 버스. 음소거는 사용자 단추, 페이지 가려짐, 터치 기기의 창 포커스 잃음(아이폰이 앱 전환 때 오디오가 얼어 되풀이되는 것을 막는다), setExternalMuteProvider 로 준 바깥 음소거(플랫폼 SDK, 광고) 가운데 하나라도 맞으면 걸리고, 그동안 AudioContext 를 멈춘다. 풀린 뒤 돌지 않으면 잠깐마다 다시 깨운다. setAutoplayAllowedProvider 로 누르기 전 깨우기를 막을 수 있다. 매 프레임 update()
- LanguagePack: 자산의 JSON 으로 두는 언어 묶음. (import 의 LanguagePack 이름 아래 함수들) languages.json(언어 목록, fallbackLanguage, 언어마다 code, name, englishName, fontGroup, direction, aliases, countries, file)과 언어마다의 표를 읽는다. 설정의 언어가 비면 setPreferredLanguageTag 로 준 언어(플랫폼이 알려 준 것), 그다음 기기의 언어, 목록에 없으면 기본 언어. 없는 열쇠는 기본 언어의 글자, 거기도 없으면 열쇠 그대로. translate, formatText({이름}), readTextDirection, isolateText(방향 격리), html 의 lang 과 탭 제목(setDocumentTitleKey). setLanguagePaths 로 경로를, setLanguageLoadedHandler 로 언어를 불러온 뒤 할 일(그 언어의 글꼴 받기)을 건다. Localization(코드 안의 표)은 그대로다
- UIFont: 여러 문자의 글꼴 조각을 한 글꼴 이름 아래 묶는다. (import 의 UIFont 이름 아래 함수들) Google Fonts 가 나눠 둔 조각마다 FontFace 를 그 조각의 글자 범위(unicode-range)로 올려, 화면에 쓰는 글자가 든 조각만 받는다. 고른 언어의 묶음을 라틴 바로 앞에 올려 한자가 그 언어의 글꼴로 나오고, 숫자와 영문은 늘 라틴 글꼴이다. 굵기는 두 가지로만 올려 범위로 함께 고르게 한다. 쓸 글자의 조각을 미리 받고(loadUiFontText, requestUiFontText), 처음 조각은 정한 시간까지만 기다린다. 나머지 묶음은 조금 뒤에 받는다. configureUiFont 로 이름, 목록 경로, 굵기, 기다리는 시간을 정하고 readUiFontFace 로 Text 와 ShadowText 에 줄 FontFace 를 읽는다
- ToastMotion, attachToastMotion, readToastSeconds: 알림 노드에 붙이는 나옴과 사라짐 모션. show(text, seconds, applyText) 로 바깥쪽(setEnterSide, 위나 아래)에서 미끄러져 들어오며 살짝 커졌다 돌아오고, 머문 뒤 떠오르며 사라지고 노드를 끈다. 떠 있는 동안 다른 글이 오면 앞 것이 빨리 비키고, 같은 글이 또 오면 시간만 다시 채우고 통 튄다. 자리는 놓인 자리를 기준으로 그 둘레에서만 움직인다. readToastSeconds 는 긴 글일수록 머무는 시간을 늘린다. (UIToast 는 줄 세운 알약 알림을 스스로 만들고, 이것은 게임이 만든 알림 노드를 움직인다)
- ButtonMotion, ButtonMotionStyle, attachButtonMotion, setButtonMotionArea, shakeButton: 단추 반응. UIButton 다음으로 붙이면 단추의 상태를 읽어 노드를 가운데를 두고 키우고 줄인다. normal 꼴은 올리면 커지고 누르는 동안 줄고 떼면 통 튄다. inset 꼴(창 안)은 커지지 않고, 올린 동안 바탕을 밝히고 안쪽에 흰 테를 둔다. 누를 수 없으면 shakeButton 으로 좌우로 흔든다. 꼴은 단추마다(setStyle) 또는 위 노드에 setButtonMotionArea 로 건다. 손가락 기기는 올림을 쓰지 않는다. 반응이 없을 때는 노드를 건드리지 않아 다른 연출과 겹치지 않는다. 단추에 얹은 꾸밈이 제 모양으로 밝히게 하려면 setLitHandler 로 함수를 건다
- ToonMesh(experimental/graphics/toon/meshbuilder.js): 툰 3D(점토 같은 한 색 재질과 바깥선)를 그릴 꼭짓점 배열 짓기. MeshBuilder 에 상자, 둥근 상자, 원기둥, 구, 회전체, 캡슐, 도넛, 팔면체 도형을 자리, 돌림, 크기를 곱해 한 덩어리로 담는다. 꼭짓점은 자리 3, 노멀 3, 색 3(sRGB), 재질 2(빛남, 빛을 받지 않음), 무늬 4(무늬 번호와 색, 뜻은 셰이더가 정함). 바깥선은 점마다 같은 굵기로 민 껍데기(inverted hull)를 따로 담고, 모서리에서 너무 튀지 않게 민다. 삼각형의 감기는 노멀을 보고 바깥이 앞면이 되게 맞춘다. 뼈대 모형은 본 번호와 무게를 따로 담는다
- ToonGlb(experimental/graphics/toon/glbmeshreader.js): 텍스처 없이 재질 색으로 칠하는 GLB 를 MeshBuilder 배열로 읽는다. (readGlbArrays, 노드마다 따로 readGlbNodeArrays, 노드 정보 readGlbNodeInfos) baseColorFactor 는 sRGB 로, emissiveFactor 는 빛남으로, 재질 extras 의 outline 과 basic 을 읽는다. 뼈대(skin)와 움직임(animations, extras)을 읽고 writeSkinPose 로 한 순간의 본 행렬을 셈한다. (앞 자세와 섞기, 흔들림 배율) 엔진의 SkinnedModel(텍스처 PBR)과는 따로다
- ToonRenderer(experimental/graphics/toon/toonrenderer.js): ToonMesh 와 ToonGlb 의 배열을 그리는 툰 렌더러. 해(방향, 색)와 하늘색, 땅색을 섞은 바탕빛, setBandCount 로 셀 셰이딩 칸, 꼭짓점의 빛남과 빛을 받지 않음, 모형마다 틴트와 불투명도, 바깥선 껍데기는 뒷면만 그린다. 뼈대는 writeSkinPose 의 본 행렬을 drawMesh 의 jointMatrices 로 넘긴다. (96 개까지, 엔진 SkinnedModelRenderer 와 같다) beginFrame 이 앞의 그리기 상태를 적어 두고 endFrame 이 돌려, 엔진 2D 그리기 사이(flushSpriteBatch 뒤)에 끼울 수 있다. readProgramSources 로 ShaderWarmer 에 넘길 소스를 준다. 외계행성 광부 키우기의 판 렌더러에서 땅 무늬와 화면 공간 선 같은 게임 몫은 빼고 새로 지었다
- ToonRenderer: GPU 인스턴싱(drawMeshInstanced, 인스턴스마다 { modelMatrix, tintColor }, 몸과 바깥선 모두), 화면 밖 거르기(모형의 경계 구를 절두체에, 인스턴스는 하나씩 걸러 남은 것만 올린다, options.isCulled), 그림자(beginShadowPass, drawMesh 가 깊이만, endShadowPass 가 프레임버퍼와 뷰포트를 돌린다, setShadow(ShadowMap) 로 3x3 PCF 로 받는다), HDR 출력(setHdrOutput), 한 프레임의 그린 수와 거른 수와 드로우콜(getFrameStatistics), extractFrustumPlanes
- ToonPostProcess: HDR 마무리. 반정밀 실수 RenderTarget 에 그린 씬을 BloomEffect 로 번지게 하고, 노출과 ACES 근사 톤매핑과 sRGB 감마로 화면에 낸다. (begin, end, setExposure, setBloom) 러스트 vanilla-engine 과 같은 구성이다
- 렌더링: 노드와 Paint 를 그릴 때 프레임마다 생기던 객체와 드로우 콜마다의 일을 줄인다. 그리는 결과는 같고 부르는 쪽의 사용법도 같다. (아래 벤치 장면과 예제 uishowcase, uisample, spriteeffects, particleeffects, timelineshowcase 를 시계를 고정해 같은 프레임에서 뜨면 화면 픽셀이 고치기 전과 같다) 크롬(헤드리스, 실제 GPU)에서 Paint 로 둥근 사각형을 그리는 노드 8천 개가 움직이는 장면(rustgame-test 의 같은 스펙 비교 벤치)을 같은 때에 재면 그리기가 78.0 ms 에서 13.0 ~ 14.4 ms, 프레임이 90.1 ms 에서 23.9 ~ 26.3 ms 가 되고, 60 FPS 를 지키는 노드 수는 1천에서 4천 ~ 6천이 된다. (한 PC 의 측정, 게임 로직 시간은 그대로다)
- Graphic.drawRoundRect: 꼭짓점 36 개의 cos / sin 을 모듈을 읽을 때 한 번 구해 둔 표로 셈하고, Vector2 배열을 만들지 않고 고쳐 쓰는 칸에 적은 좌표로 바로 버텍스를 쓴다. (노드마다 프레임마다 삼각함수 72 번, Vector2 36 개, 코너 객체 4 개가 없어진다) 표는 지금까지와 같은 식(엔진 base/math.js 의 cos / sin)으로 구해 꼭짓점 값이 비트까지 같다. buildRoundRectPositions 도 표를 쓴다. (돌려주는 Vector2 배열은 지금처럼 새로 만든다) drawRoundRect 는 이제 buildRoundRectPositions 를 거치지 않는다
- Graphic: writeRoundRectPositionData(rect, roundSize), drawRoundRectPositionData(color). 라운드 사각형 좌표를 모듈의 칸에 적고, 그 칸으로 채움을 그린다. (drawRoundRect 가 쓴다)
- Paint.draw: 그릴 때마다 Rect 하나(안의 Vector2 포함)와 내용 크기 복제본을 만들던 것을, 모듈에 하나 둔 사각 영역을 고쳐 쓰고 WorldNode.copyContentSizeTo 로 크기를 받게 바꾼다. graphic 의 그리기 함수에 넘긴 사각 영역은 다음 Paint 를 그릴 때 바뀐다. (엔진 안에서 받은 사각 영역을 들고 있는 곳은 없다)
- WorldNode: copyContentSizeTo(target). 내용 크기를 복제본 없이 target 에 적는다. getContentSize 를 덮어쓴 하위 클래스(UINode 등)면 그 함수가 주는 값을 적는다
- TransformNode, WorldNode 의 pushTransform: 위치, 크기, 피봇, 내용 크기를 복제본 없이 읽는다. (노드마다 프레임마다 Vector2 넷) TransformNode.applyLocalTransform(graphic) 이 로컬 위치, 회전, 크기를 건다. 그 getter 들을 덮어쓴 하위 클래스면 지금처럼 getter 를 불러 읽는다
- TransformMatrix: rotate(0) 과 scale(1, 1) 은 행렬을 셈하지 않고 돌아간다. (결과는 같다, 회전하지 않는 노드도 그릴 때마다 부른다)
- Graphic.pushState / popState: 저장할 때마다 행렬 복제본과 상태 객체를 만들지 않고, 스택 깊이마다 만들어 둔 칸에 지금 행렬 객체와 그 값을 적는다. 복원하면 저장할 때의 행렬 객체에 그 값을 되돌려 적고 다시 지금 행렬로 삼는다. 그래서 getTransformMatrix() 로 받아 둔 행렬은 복원 뒤에도 지금 행렬이다. (지금까지는 복원하면 저장해 둔 복제본으로 바뀌어, 받아 둔 행렬은 더는 지금 행렬이 아니었다)
- TransformNode.setLocalPosition / setLocalScale, WorldNode.setPivot / setContentSize: 받은 벡터를 복제하지 않고 가진 벡터에 값을 옮겨 적는다. getter 는 지금처럼 복제해 주므로 가진 벡터는 밖으로 나가지 않는다
- Rect: 생성자와 create() 가 갓 만든 Vector2 를 setter 로 한 번 더 복제하지 않는다. (Rect.create 하나에 Vector2 여덟 개이던 것이 두 개)
- Color.clone(): Reflection.clone 을 거치지 않고 rgba 를 바로 옮긴 새 Color 를 만든다. (Rect.clone 처럼 하위 클래스가 아니라 Color 를 돌려준다, 엔진 안에 Color 의 하위 클래스는 없다) setFillColor 처럼 그릴 때마다 부르는 곳이 있다
- Reflection.clone: getter 와 setter 를 함께 가진 프로퍼티 이름 목록을 프로토타입마다 처음 한 번만 훑어 두고 쓴다. (부를 때마다 프로토타입 사슬을 훑었다) 복사하는 차례와 값은 같다
- Object: 비공개 필드(#instanceId, #isDestroyed)를 뺀다. 고유식별자는 처음 getInstanceId() 를 부를 때 모듈의 WeakMap 에 넣는다. isDestroyed() 는 지금처럼 늘 false 다. (destroy() 가 파괴 표시를 남기지 않았다) 모든 엔진 객체가 만들어질 때마다 채우던 칸 둘이 없어진다
- Graphic.drawVertices: 유니폼 자리(modelMatrix, mainColor, tintColor, globalAlpha)를 드로우 콜마다 이름으로 찾지 않고 셰이더 프로그램이 바뀔 때만 찾는다. (uploadDrawUniforms) 기본 프로그램의 틴트와 전역 투명도는 지난번에 올린 값과 같으면 다시 올리지 않는다. 프레임 시작(applySettings)과 프로그램이 바뀔 때 올린 값을 잊고, 바꿔 끼운 프로그램(setShaderProgramOverride)에는 늘 올린다. 게임이 기본 프로그램의 tintColor, globalAlpha 유니폼을 직접 올리면 다음 드로우 콜이 그 값을 바로잡지 않을 수 있다. (엔진 안에는 그런 곳이 없다)
- Engine: 최대 FPS 제한(EngineConfiguration.maximumFramePerSecond)을 처리한 프레임 수로 센다. 세기 시작한 때부터 처리한 프레임 수로 다음 프레임의 차례(시작 시각 + 수 × 간격)를 정하고, 차례보다 4 ms 넘게 일찍 온 프레임만 건너뛴다. 밀린 것은 다음 프레임에 처리해 평균이 최대 FPS 가 된다. 지금까지는 마지막으로 처리한 프레임 뒤로 간격보다 4 ms 덜 지났으면 건너뛰고 기준을 처리한 프레임의 시각으로 다시 잡아 밀린 것을 잊었으므로, 주사율이 최대 FPS 로 나누어떨어지지 않으면 제한이 어긋났다. (60 FPS 에서 90 Hz 는 한 프레임 걸러 45, 144 Hz 는 72, 75 Hz 는 하나도 건너뛰지 않아 75) 한 프레임 넘게 밀리면(창이 가려졌다 돌아옴 등) 몰아서 처리하지 않고 그 시각부터 다시 센다. 차례보다 1 ms 안쪽으로 일찍 온 프레임을 처리하면 그 시각부터 다시 세어, 주사율이 최대 FPS 와 거의 같은 화면(60.05 Hz 등)에서 조금씩 앞서 간 것이 쌓여 가끔 한 프레임을 건너뛰지 않는다. 최대 FPS 를 바꾸면 다시 센다. 60 Hz 화면의 60 FPS, 주사율의 약수인 최대 FPS(90 Hz 의 30 FPS 등)는 지금까지와 같다.
- UIDocument: getReflectedProperties(component) 로 컴포넌트의 짝 맞는 get(또는 is)/set 속성 목록을 연다. (에디터의 인스펙터가 쓴다) 컴포넌트 종류 표에 Outline, SoftShade, ShadowText, UIProgressRing 을 더했다
- 비주얼 에디터(tools/visualeditor)를 유니티처럼 새로 지었다. 위 메뉴(File, Edit, Node, View, Window)와 도구 막대 밑에 도킹 창들(Hierarchy, Scene, Game, Inspector, Project, Console). 처음 배치는 왼쪽 하이어라키, 가운데 씬과 게임, 오른쪽 인스펙터, 아래 프로젝트와 콘솔
  - 도킹(docklayout.js): 유니티나 VS Code 처럼 창 탭을 끌어 다른 창의 탭 줄이나 가운데에 놓으면 탭으로 합치고, 창 가장자리(30%)에 놓으면 그쪽으로 나누어 붙이고, 도킹 전체 가장자리에 놓으면 전체 바깥쪽에 붙인다. 끄는 동안 붙을 자리를 파란 칸으로 미끄러지듯 보여 주고, 탭 사이에 넣을 자리는 막대로 보인다. Esc 는 그만두기. 사이 막대를 끌어 크기를 바꾸고, 탭을 두 번 누르면 그 묶음을 크게 펼친다. 탭의 X 나 가운데 단추로 창을 닫고 Window 메뉴로 다시 연다(닫을 때 같이 있던 창 옆으로 돌아간다). Window > 창 배치 되돌리기. 배치는 브라우저에 남겨 두고 다시 열면 되살린다
  - Scene 창과 Game 창은 캔버스 하나를 나누어 쓴다. 둘이 따로 보이면 고른 쪽에 캔버스를 달고 다른 쪽에는 누르면 옮겨 오는 안내를 둔다. 씬 뷰는 창 크기가 바뀌어도 보던 가운데를 지킨다
  - 레티나처럼 픽셀 배율이 1 이 아닌 화면에서 씬 뷰가 왼쪽 위 일부에만 그려지던 것을 고쳤다 (EditorScene preDraw 에서 applyViewRect)
  - 씬 뷰: 엔진 캔버스에 격자와 화면 틀(기준 해상도)을 깔고 실제 WorldNode 를 그린다. 누르면 고르고, 손잡이로 옮기기(W), 돌리기(E), 키우기(R), 밀기(Q, 스페이스, 가운데와 오른쪽 끌기), 마우스 바퀴와 Ctrl 바퀴(트랙패드 모으기)로 키우기, 트랙패드 두 손가락으로 밀기. Ctrl 은 10 단위, Shift 는 15 도에 맞춘다. 화살표로 1 칸(Shift 10 칸), F 는 고른 노드로, Home 은 화면 틀로
  - 게임 뷰(Tab): 격자와 손잡이 없이 화면 틀을 뷰에 꽉 맞추고 틀 밖을 가린다. 재생하면 게임 뷰로, 멈추면 씬 뷰로 돌아온다
  - 하이어라키: 펼치기와 접기, 두 번 눌러 이름 바꾸기, 끌어서 자식으로 넣거나 앞뒤 형제로 옮기기(화면 위치는 지킨다), 찾기 칸, 오른쪽 클릭으로 만들기, 복사, 붙여넣기, 복제, 지우기, 프리팹으로 저장
  - 인스펙터: 켜기와 이름, 변환(위치, 회전, 크기, 내용 크기, 피봇, 앵커, 불투명도), 컴포넌트마다 반사로 모은 속성 칸(숫자, 글, 참거짓, 색과 알파, Vector2, 정해진 값은 고르기 칸). 숫자 이름표를 좌우로 끌면 값이 바뀐다. Sprite 의 그림은 프로젝트의 그림 애셋을 끌어다 놓고, 원래 크기 단추로 내용 크기를 그림에 맞춘다. 컴포넌트 더하기와 빼기
  - 프로젝트: 폴더 열기(showDirectoryPicker, 크롬 계열)로 실제 애셋 폴더를 읽고 쓴다. 그 밖의 브라우저는 파일과 폴더를 끌어다 놓아 가져온다. 폴더 나무와 애셋 격자(그림 썸네일), 종류(그림, 소리, JSON, 씬, 프리팹, 모델, 글꼴, 글) 가르기, 가져오기 단추로 지금 폴더에 파일 복사. 애셋을 고르면 인스펙터에 미리보기(그림과 해상도, 소리 재생, JSON 과 글 내용, 글꼴 견본, GLB 는 메시와 뼈와 애니메이션 수와 툰 렌더러로 그려 끌어 돌리는 3D 미리보기)
  - 그림 애셋을 씬 뷰에 놓으면 그 자리에 그림 크기의 Sprite 노드를 만든다. 프리팹(.prefab.json, UIDocument 문서 하나)은 놓거나 두 번 눌러 꺼내고, 씬(.scene.json)은 두 번 눌러 연다
  - 씬 저장과 열기: UIDocument 형식에 에디터 값 frameSize 를 얹은 .scene.json. 게임은 UIDocument.fromJsonText 로 그대로 읽는다. 폴더를 열었으면 그 안에 바로 쓰고, 아니면 내려받는다. Sprite 의 그림은 imagePath 로 적고 프로젝트에서 찾아 잇는다
  - 되돌리기와 다시 하기(200 칸, 같은 값을 잇달아 바꾸면 한 칸), 복사와 붙여넣기, 복제, 재생과 멈춤(멈추면 재생 전으로 되돌린다), 바꾸고 1 초 뒤 브라우저에 자동 보관하고 다시 열면 되살린다. 콘솔은 에디터 알림과 브라우저의 경고와 오류를 함께 보인다
  - 앞의 입자 스크립트 시연 에디터는 이것으로 바꿨다
- 렌더링: 같은 셰이더 프로그램과 같은 텍스처를 다시 거는 호출을 거른다. Graphic 이 마지막으로 쓰게 한 프로그램과 0 번 텍스처 유닛에 묶은 텍스처를 기억해 같으면 useProgram, bindTexture 를 부르지 않는다. (useShaderProgram, bindTexture) 묶어 그리기(flushSpriteBatch)와 파티클 그리기(drawColoredQuads)는 그린 뒤 기본 프로그램으로 되돌리지 않고 다음에 그리는 쪽이 제 프로그램을 쓰게 해, 묶음을 잇달아 그릴 때 프로그램을 오가지 않는다. 그리는 결과는 같다. (예제 uishowcase, uisample, spriteeffects, particleeffects, timelineshowcase 와 바깥 GL, ShaderSprite, ScreenEffect, 씬 둘, 밉맵 바꾸기를 섞은 시험 장면을 시계와 난수를 고정해 같은 프레임에서 뜨면 묶기 끔, 켬 모두 고치기 전과 픽셀이 같다)
- Graphic: invalidateRenderStateCache(). 묶음 기억을 잊는다. Graphic 을 거치지 않고 WebGL 로 프로그램이나 텍스처를 바꾼 뒤 Graphic 출력을 이어갈 때 부른다. restoreRenderState, applySettings 와 컨텍스트를 잃거나 되살릴 때(webglcontextlost, webglcontextrestored)는 스스로 잊는다. (바깥 GL 을 끼우는 곳은 지금처럼 flushSpriteBatch 와 restoreRenderState 로 감싸면 된다)
- Engine: 씬마다 그리기 전(preDraw, 로딩 중이면 drawOnLoad)에 Graphic 의 묶음 기억을 잊는다. (앞 씬의 그리기와 이 씬의 갱신 사이에 바깥 WebGL 이 텍스처를 바꿨을 수 있다)
- ImageTextureCache, TextStringTextureCache: 생성자의 둘째 인자로 텍스처를 묶는 함수(textureBinder)를 받는다. Graphic 이 넘겨, 캐시가 텍스처를 올릴 때도 묶은 텍스처를 기억한다. 없으면 지금처럼 바로 묶는다. ImageTextureCache.getTexture 는 텍스처를 만들거나 필터를 다시 걸 때만 묶는다. (그리려고 묶는 것은 Graphic 이 한다)
- Text: 줄바꿈한 줄 배열을 기억해 두고, 글, 글꼴, 크기, 굵게, 기울임, 폭, 줄바꿈 방식이 바뀌거나 웹 글꼴이 받아지거나(loadingdone) 문서에 글꼴 얼굴이 올라가고 빠질 때만 다시 나눈다. (readWrappedLines) 그릴 때마다 단어와 글자마다 measureText 하던 것이 없어진다
- Sprite.draw: 그릴 때마다 만들던 Vector2 넷(위치, 내용 크기 복제, 뒤집기, 곱한 크기)과 그림 영역이 없을 때의 Rect 를 없앤다. 모듈의 벡터를 고쳐 쓰고 WorldNode.copyContentSizeTo 로 크기를 받으며, 영역이 없으면 그림 전체를 바로 그린다. Graphic.drawImageWithImageRect 도 영역이 없을 때 Rect 를 만들지 않는다
- Graphic.beginClipRect: 영역과 변환 행렬의 복제본을 만들지 않고 클립 깊이마다 만들어 둔 칸에 값을 적는다. endClipRect 는 그 칸을 지금 행렬 객체로 삼지 않고 값만 옮겨 적는다. (popState 가 begin 때의 행렬로 되돌리는 것은 같다) Mask.beginClip 도 클립 영역을 새로 만들지 않는다
- TextStringTextureCache.getEntry: 찾을 때마다 열쇠 문자열을 만들지 않고, 문자열별 엔트리 목록에서 나머지 값(방식, 방향, 배율, 선 두께, 색, 글꼴)을 견준다. 열쇠 문자열은 구울 때 한 번 만들어 엔트리에 둔다. (LRU 차례와 상한, invalidateFontFaces 는 같다)
- ParticleSystem: 수명이 다한 파티클을 splice 로 하나씩 빼지 않고(뒤를 매번 당긴다) 살아 있는 것을 앞으로 당겨 담는다. (그리는 차례는 같다) 그림 파티클은 그릴 때마다 Vector2 둘을 만들지 않는다
- 화면 밖 거르기: Graphic.setCullingEnabled(true) 면(기본 false, 지금까지와 같다) WorldNode 가 컴포넌트를 그리기 전에, 켜진 컴포넌트가 모두 내용 영역 안에서만 그린다고 알리면 내용 영역(한 단위씩 넓혀)을 지금 변환으로 옮긴 경계 상자가 화면에 걸치지 않을 때 그 노드의 컴포넌트 그리기를 건너뛴다. 판정은 그릴 때 Graphic 의 지금 변환(부모의 배율과 회전, pushState 로 건 것까지)으로 한다. 자식은 저마다 따로 보고 그대로 그리며, Mask 의 클립도 그대로 건다. draw 를 덮어쓴 노드와 TransformNode, UINode 는 거르지 않는다. (러스트 vanilla-engine 과 같은 방식이다, 러스트는 기본 켬)
- Component.isDrawnInsideContent(): 노드 내용 영역 안에서만 그리는지. 기본 false 라 알리지 않는 컴포넌트가 하나라도 켜진 노드는 거르지 않는다. Paint, Sprite 와 ShaderSprite(뒤집지 않았을 때, 조각과 나인 슬라이스와 타일 포함), Mask, Outline, SoftShade, UIProgressRing 만 true 를 알린다. draw 를 덮어쓴 하위 클래스는 false 로 돌아간다. 글자(Text, RichText, ShadowText 는 칸을 넘칠 수 있다), ShadowImage(그림자 여백), ParticleSystem, TrailRenderer, UI 위젯은 알리지 않는다
- Graphic: isCullingEnabled(), isLocalRectVisible(rect) (지금 변환으로 옮긴 사각형이 드로잉 버퍼에 걸치는지), addCulledNodeCount(count), getLastFrameCulledNodeCount(). 엔진 통계(useStatistics)에 culledNodes 줄을 더했다
- HeatHazeEffect(experimental): 없는 graphic.getCanvasRenderingContext() 를 부르던 Canvas2D 시절 코드를 지금 WebGL Graphic 으로 다시 짰다. 묶음을 먼저 그린 뒤 노드 영역의 화면 바운딩 박스를 copyTexSubImage2D 로 텍스처에 떠 오고, 줄마다 쿼드 한 장씩 정점 색 쿼드(drawColoredQuads)로 사인 곡선만큼 옮겨 그린다. (러스트 vanilla-engine 과 같은 방식, 흔들림 0 이면 효과가 없는 화면과 픽셀이 같다) 영역이 화면 밖으로 나가면 가장자리 픽셀을 늘인다. 내용 크기와 피봇을 쓰므로 TransformNode 대신 WorldNode 를 상속한다. (TransformNode 에는 setContentSize, getWorldBounds 가 없어 만들 때부터 죽었다) 떠 온 텍스처는 destroy() 가 지운다
- Indicator(experimental): 없는 graphic.getCanvasRenderingContext() 와 isVisible() 을 부르고 import 경로("./graphic.js")가 깨져 있던 것을 고쳤다. Graphic 의 pushState, drawLine, drawStrokeCircle 로 그린다. (Graphic 의 선은 끝이 각져 Canvas2D 시절의 둥근 끝은 없다)
- 수학(base/math.js): sqrt 가 바빌로니아법 10 번으로 셈해 1 만을 넘으면 틀리던 것을 내장 제곱근으로 고쳤다. (sqrt(1e5) 가 317.2, sqrt(1e6) 이 1296, 2026-03-21 부터) 이 sqrt 를 쓰는 길이가 100 넘는 벡터의 length, normalize, distance(Vector2, Vector3)와 Quaternion, TransformMatrix, Graphic 의 긴 선(굵기와 이음새가 가늘고 짧았다), ParticleSystem 의 셈이 틀리던 것이라 게임에서 동작이 바뀔 수 있다
- 수학: asin, acos 가 급수 100 항으로 ±1 가까이에서 틀리던 것(asin(0.9999) 가 1.5132, 정답 1.5567)과 pow 가 지수가 분수면 틀리던 것(pow(4, 0.5) 가 1, pow(2, 2.2) 가 4)을 내장으로 고쳤다. Tween 의 exponential, elastic 이징과 Vector2.angle 이 바뀐다. floor, ceil, round 는 무한대를 NaN 으로 돌려주던 것을 그대로 돌려준다. (sin, cos, tan 은 내장과 4e-9 안으로 같아 그대로 둔다)
- Vector2: modulo 가 나머지 대신 나누기를 하던 것, half 가 반이 아니라 두 배를 돌려주던 것을 고쳤다
- Engine: 뒤로 가기 캐시에서 돌아올 때(pageshow 의 persisted) 없는 dispatchPageProcessRestored 를 불러 예외가 나던 것을 고쳤다. resume 때처럼 엔진 상태(오디오, 입력)를 되살리고 로드된 씬마다 onPageProcessRestored 를 부른다
- 비주얼 에디터(tools/visualeditor/visualeditor.html)를 위 엔진으로 다시 빌드했다
- Graphic: 묶어 그리기(setSpriteBatchingEnabled)와 화면 밖 거르기(setCullingEnabled)를 기본으로 켠다. 지금 엔진을 쓰는 게임(외계행성 광부, 우주생물, aberrant, 찾았다, 종말 생존)이 모두 묶어 그리기를 켜고 돌았고, 거르기는 내용 영역 안에만 그린다고 알린 컴포넌트만 거른다(예제 일곱 장면에서 켬과 끔의 픽셀이 같았다). 예전처럼 쓰려면 setSpriteBatchingEnabled(false), setCullingEnabled(false)
- 입력: 출시 게임들(찾았다, 종말 생존, 우주생물, aberrant, 외계행성 광부)이 게임 쪽에 따로 만들어 쓰던 입력을 엔진 기본으로 옮긴다. (게임 코드는 건드리지 않았다, 게임은 지금처럼 자기 것을 쓴다)
- GamepadKind, readGamepadKind(gamepadId): 패드 이름(Gamepad.id)으로 종류를 가른다. 플레이스테이션(054c, playstation, dualshock, dualsense, sony), 닌텐도(057e, nintendo, joy-con, pro controller), 엑스박스(045e, xbox, xinput, microsoft), 그 밖은 other
- GamepadManager.vibrate(strongMagnitude, weakMagnitude, seconds): 연결된 패드를 모두 브라우저 vibrationActuator 의 dual-rumble 로 떤다. 세기는 0 ~ 1 로 자른다. 진동 장치가 없는 패드와 브라우저는 건너뛴다
- GamepadManager.getActiveGamepadId(): 마지막 갱신에 단추를 누르거나 축을 0.5 넘게 기울인 패드의 이름. (없으면 빈 글, 마지막으로 쓴 장치를 가릴 때)
- GamepadManager.setInputLogEnabled, isInputLogEnabled: 단추와 축이 바뀔 때마다 찍던 console.log 를 끄고 켠다. 기본 동작을 바꿨다: 기본이 꺼짐이라 이제 단추와 축 로그는 찍지 않는다. (스틱을 조금만 움직여도 프레임마다 로그가 쏟아졌고, 로그에 기대는 게임이 없다) 연결과 해제 로그는 그대로 찍는다
- InputManager: 마우스 단추 셋(MouseButton.left, middle, right)의 눌림과 이번 프레임의 누름과 뗌(setMouseButtonDown, isMouseButtonDown, isMouseButtonJustPressed, isMouseButtonJustReleased). 프레임 사이에 눌렀다 뗀 것도 그 프레임에 잡힌다. 러스트 vanilla-engine 과 같은 꼴이다
- InputManager.setTouchFromLeftButtonOnly: 켜면 마우스 왼쪽 단추만 터치로 넘긴다. 끄면(기본) 지금까지처럼 어느 단추든 터치다
- InputManager.setContextMenuPrevented, isContextMenuPrevented: 캔버스의 오른쪽 클릭 메뉴를 막을지. 처음은 참으로 지금까지와 같다
- InputManager.isKeyJustPressed, isKeyJustReleased 의 바뀐 동작: 프레임 끝의 키 사진을 견주지 않고, 지난 프레임 끝 뒤로 온 키 사건(pushKey, popKey)을 쌓아 본다. 프레임 사이에 눌렀다 뗀 키를 놓치던 것을 고쳤다. (그때는 isKeyPressed 가 거짓이고 isKeyJustPressed 와 isKeyJustReleased 가 함께 참이다) 눌린 채 오는 키 되풀이(keydown repeat)는 새 누름이 아니다. updateFrameSnapshot 은 쌓인 사건을 비운다
- TouchPoint, TouchPhase, InputManager.getTouchPoints(), getEndedTouchPoints(): 닿아 있는 손가락 목록. 손가락마다 identifier(Touch.identifier), phase(began, moved, stationary), canvasNativePosition, viewPosition. 이번 프레임에 떨어진 손가락은 getEndedTouchPoints 에 ended 나 cancelled 로 한 프레임 남는다. 엔진이 touchstart, touchmove, touchend, touchcancel 의 바뀐 손가락마다 beginTouchPoint, moveTouchPoint, endTouchPoint 를 부르고, 사건의 touches 에 없는 손가락은 취소로 지운다. 첫 손가락이 터치로 가는 것은 그대로다
- ViewManager.convertClientToView(clientX, clientY): DOM 사건의 화면 좌표를 뷰 좌표로 바꾼다
- InputDevice, InputManager.getLastInputDevice, getLastGamepadKind (setLastInputDevice, setLastGamepadKind): 마지막으로 쓴 장치(keyboard, mouse, touch, gamepad)와 패드 종류. 키를 누르면 keyboard, 마우스 단추와 휠과 6 픽셀 넘는 움직임은 mouse(손가락을 뗀 뒤 0.8 초 안의 흉내 낸 마우스 사건은 빼고), 손가락은 touch, 패드는 getActiveGamepadId 로 gamepad 와 그 종류. 처음은 손가락 기기(pointer: coarse)면 touch, 아니면 keyboard
- InputManager.setPreventedKeys(keys), getPreventedKeys, isKeyPrevented, isTypingInTextField: 브라우저 기본 동작을 막을 키(Tab 의 초점 옮기기, Space 의 쪽 넘기기 같은 것). 글자 입력칸(Engine.isTextInputFocused 의 글자 input, textarea, contenteditable 와 select)에 초점이 있으면 막지 않는다. 처음은 비어 있어 지금까지와 같다
- InputActions(inputactions.js): 입력 동작. InputManager 가 하나 들고(getInputActions) tick 에서 갱신한다. 동작 이름에 키(bindKey), 게임패드 단추(bindGamepadButton), 게임패드 축의 한쪽(bindAxis(action, axisIndex, direction), setAxisPressThreshold 만큼 기울면 눌림)을 묶고 unbindAction 으로 푼다. isPressed, isJustPressed, isJustReleased, readValue(0 ~ 1), readAxis(negativeAction, positiveAction), readGamepadStick(xAxisIndex, yAxisIndex), readMoveAxis(WASD 와 방향키, 왼쪽 스틱, 바깥 입력원 가운데 가장 긴 것, 길이 1 이하). 죽은 구역(setDeadZone, 처음 0.2)은 빼고 나머지를 0 ~ 1 로 다시 편다. setRepeat(action, delaySeconds, intervalSeconds) 를 건 동작은 누르고 있으면 반복 때도 isJustPressed 가 참이고, 프레임이 길게 끊기면 몰아서 반복하지 않는다. 바깥 입력원(addSource, removeSource)은 readActionValue(action), readMoveAxis(), readGamepadKind() 를 가진 객체로, 플랫폼 SDK 의 패드를 게임이 끼운다. 글자 입력칸에 쓰는 동안은 키를 듣지 않는다(setKeysIgnoredWhileTyping). 키는 프레임 사이에 눌렀다 뗀 것도 한 번 눌린 것이다
- Engine: 창이 포커스를 잃으면(blur) 마우스 단추 셋도 뗀다. (InputManager.clear 는 손가락 목록과 마우스 단추, 입력 동작도 비운다)
- 비주얼 에디터(tools/visualeditor/visualeditor.html)를 위 입력 엔진으로 다시 빌드했다
- Camera3D(experimental/graphics): 원근(setPerspective)과 직교(setOrthographic), 가로 세로 비(setAspectRatio), lookAt, 보기와 투영 행렬을 값이 바뀔 때만 다시 셈해 담아 둔다(getViewProjectionMatrix, getInverseViewProjectionMatrix). projectToView(x, y, z, viewRect) 는 월드 점을 3D 를 그리는 사각형 안의 자리와 카메라 앞인지(isInFront)로, unprojectToPlane(viewPosition, planeHeight, viewRect) 는 사각형 안의 자리에서 나간 시선이 수평면 y = planeHeight 와 만나는 점으로, readViewDepth 는 보는 쪽 깊이로 셈한다. 렌더러와 2D 표시가 같은 카메라를 쓴다. (외계행성 광부, aberrant, 종말 생존이 화면마다 createLookAt, createPerspective 를 다시 짓고 투영을 손으로 셈하던 것)
- ToonRenderer: setScreenRect(x, y, 너비, 높이), clearScreenRect, getScreenRect. 노드 사각형 안에만 그린다. beginFrame 이 보기와 투영의 클립 공간을 사각형으로 옮기고 가위로 밖을 자르며, endFrame 이 가위를 푼다. 화면 밖 거르기는 옮기기 전의 절두체로 한다. beginFrameWithCamera(Camera3D), drawMeshOutline(바깥선만 그리고 세지 않음). 화면 사각형을 주지 않으면 지금과 같다
- ToonDrawQueue: 한 프레임에 그릴 모형을 담아 두었다가 불투명한 몸, 불투명한 것의 바깥선, 비치는 것(카메라에서 먼 것부터, 깊이 쓰기 끔) 차례로 그린다. addMesh, addMeshInstanced, drawShadows(renderer, shadowMap), draw(renderer, camera). (종말 생존 ModelRenderer3D 의 담아 그리기에서)
- Graphic: runExternalPass(callback, { clearDepth }) 와 clearDepthBuffer(). 2D 그리기 사이에 WebGL 패스를 끼운다. 앞의 2D 묶음을 그리고(flushSpriteBatch), 상태 기억을 잊고(invalidateRenderStateCache), 깊이를 비운 뒤 callback 을 부르고, 끝나면(던져도) restoreRenderState 를 부른다. 자르기(스텐실)를 건 뒤 깊이를 비우면 갤럭시 폴드3(Adreno 660)에서 3D 가 하나도 안 그려진 일이 있어(외계행성 광부), 자르기 안에 3D 를 그릴 노드는 beginClipRect 앞에서 clearDepthBuffer 를 부르고 clearDepth: false 를 준다. (게임 노드 넷이 같은 차례를 손으로 쓰던 것)
- ToonView3D(컴포넌트): 노드 사각형 안에 툰 3D 를 그린다. 내용 영역을 지금 변환으로 드로잉 버퍼 사각형으로 옮기고, runExternalPass 안에서 렌더러의 화면 사각형을 걸고 그리기 함수(setDrawCallback)를 부른다. 렌더러는 처음 그릴 때 짓고, 짓지 못하는 기기면 다시 짓지 않고 setFallbackDrawCallback 의 2D 로 그린다. 여러 노드가 렌더러 하나를 함께 쓰려면 setRenderer. 카메라(getCamera)의 가로 세로 비는 그릴 때마다 사각형에 맞춘다. 부모 Mask 안이면 setDepthCleared(false) 와 clearDepthBuffer 로 위 함정을 피한다
- ToonPostProcess: setColorGrade(채도, 대비, 색조 색, 색조 양, 안개빛 색, 안개빛 양), setVignette(가장자리 어둡게). 톤매핑과 감마 뒤에 건다. 색조 색은 밝기를 1 로 맞춰 곱하고, 안개빛은 어두운 곳일수록 그 색 쪽으로 끌어올린다. 기본 값(채도 1, 대비 1, 나머지 0)이면 보정이 없어 지금과 같다. 노드 사각형에 낼 때는 resize(사각형 크기) 뒤 end 의 뷰포트로 사각형을 준다. 번짐은 이미 있는 setBloom 이다. (종말 생존 SceneEffects3D 의 색 고르기에서)
- ToonMesh: MeshBuilder.combine(pieces) 는 움직이지 않는 조각 여럿({ arrays, offset: [x, y, z] })을 옮겨 한 배열로 잇는다. 바깥선 껍데기와 껍데기 기준 자리, 안쪽 범위도 옮겨 잇고 뼈대는 잇지 않는다. createFacetedChunkGeometry(반지름, 꼭짓점 배, 축 배) 는 이십면체의 꼭짓점 열둘을 저마다 늘이고 줄여 면마다 꼭짓점을 따로 둔 각진 돌덩이다. (종말 생존 combineMeshArrays, 외계행성 광부 meshbuilder.js)
- GraphicsQualityGovernor, GraphicsQuality(auto, high, low): 가벼운 길(isLite)을 덮어쓰기(applySearchText 의 ?light, setLiteOverride) → 설정(낮음은 늘, 높음은 아님) → 자동(setAutoLiteDefault 이거나 FrameProbe 가 처지는 기기로 잼) 차례로 정한다. update(프레임 초, 최대 프레임) 는 자동일 때만 재고 가벼운 길이 바뀐 프레임에 true 를 돌려준다. setRenderPixelRatioLimits(보통, 가벼운 길) 와 applyRenderPixelRatio(viewManager) 로 렌더 배율 상한을 바뀔 때만 건다. 가벼운 길에서 무엇을 줄일지는 게임이 정한다. (외계행성 광부 readIsLite, aberrant isLight)
- 출시 게임들이 따로 만들어 쓰던 로딩, 저장, 시간 기능을 엔진 기본으로 넣는다. (게임의 화면 모양과 출시처 코드는 가져오지 않았다, 기본 동작은 LocalStorage 읽기 하나만 바꿨다)
- TimeManager: setMaximumTimeDelta(seconds), getMaximumTimeDelta(). 한 프레임 간격의 상한을 바꾼다. (지금까지 0.25 초로 박혀 있었고 기본값은 그대로다) 물이나 물리가 한 번에 크게 나아가면 안 되는 게임이 0.1, 0.05 로 줄인다. 0 보다 작거나 숫자가 아니면 0.25
- Engine: setMaximumFramePerSecond(n), getMaximumFramePerSecond(). 실행 중에 최대 FPS 를 바꾼다. EngineConfiguration.maximumFramePerSecond 에 적고, 엔진은 프레임마다 그 값을 읽어 바뀐 프레임부터 다시 센다. (게임들이 설정 객체를 직접 고치던 것과 결과가 같다) 0 보다 작거나 숫자가 아니면 0(제한 없음)
- FixedStepper: 고정 걸음. new FixedStepper(stepSeconds, maximumStepsPerFrame) 의 advance(timeDelta, stepFunction) 가 쌓인 시간만큼 stepFunction(stepSeconds) 을 부르고 남은 몫(0 ~ 1, 앞 걸음과 지금 걸음을 섞어 그릴 때 쓴다)을 돌려준다. 한 프레임 상한만큼 돌고도 걸음이 남으면 남은 시간을 버리고(느린 기기에서 몰아 돌지 않게), stepFunction 이 false 를 돌려주면 그 프레임은 거기서 멈추고 시간을 쌓아 둔다. getAlpha, getLastStepCount, reset, setStepSeconds, setMaximumStepsPerFrame
- LocalStorage: 모든 접근을 try 로 감싼다. 저장소가 막혀 있거나(사생활 보호 창, window.localStorage 접근 예외) 가득 차 못 쓰면 예외 없이 이 페이지가 살아 있는 동안 메모리에 대신 둔다. (isMemoryFallback) setBackend({ getItem, setItem, removeItem, getKeys, clear }) 로 저장소를 갈아 끼운다. (플랫폼 SDK 의 저장소 같은 것, getKeys 와 clear 는 없어도 된다, null 이면 브라우저로) getBackend, getItem, setItem(저장소에 썼는지), removeItem, getJson(key, defaultValue), setJson(key, value)
- LocalStorage: 읽기(getString, getBoolean, getNumber)가 없는 키에 기본값을 써 넣지 않는다. (기본 동작을 바꾼 것이다) 읽기만 해도 저장소에 키가 생겨서, 새 판에서 기본값을 바꿔도 옛 기본값이 저장된 값처럼 남고 containsKey 가 늘 참이 됐다. 출시 게임 여섯 가운데 엔진 LocalStorage 를 쓰는 곳은 pipemania 하나이고, 읽은 값만 쓰며 키가 있는지(containsKey, getKeys)는 보지 않아 이 동작에 기대지 않는다. (2026-11-25 게임 코드 grep) 개발자 도구의 저장소 창에는 읽기만 한 키가 더는 보이지 않는다
- PersistedStore: setStorageBackend(backend), getStorageBackend(). 저장소 하나만 다른 곳(getItem, setItem, removeItem 을 가진 객체)에 둔다. 갈아 끼우면 그곳에서 다시 읽고 구독자에게 알리며, 그곳의 접근도 try 로 감싼다. 생성할 때 읽기가 저장소에 빈 키를 만들던 것도 위 LocalStorage 바뀜으로 없어졌다
- AssetLoader: 애셋 함께 받기. addImage, addJson, addText, addBlob, addAudio, addFont(family, path, descriptors), addAsset(asset, path), addTask(path, loadFunction) 로 넣고 await load() 로 setConcurrency(기본 6) 개씩 함께 받는다. 실패해도 멈추지 않고 실패 목록({ path, error })을 돌려준다. getProgress(끝난 수 / 전체 수), getLoadedCount, getFinishedCount, getTotalCount, getFailedList, isFinished, setProgressHandler, setCompleteHandler
- LoadingProgress: 알려 준 진행률(setProgress, 0 ~ 1, 줄지 않음)을 보이는 값(getShownProgress)이 부드럽게 따라간다. 매 프레임 update(timeDelta), 따라가는 빠르기 setFollowRate(기본 초당 남은 거리의 6 배), isFinished, reset
- GameScene: 로딩 화면 바꾸기. setLoadingColors(바탕, 게이지 바탕, 게이지, 바깥) 로 색만, setLoadingDrawer((graphic, viewSize, progress, elapsedSeconds) => ...) 로 바탕 위의 그림 전체를 바꾼다. setLoadingProgress(progress) 나 trackAssetLoader(assetLoader) 로 진행률을 알리면 게이지가 최소 노출 시간의 경과 대신 그 진행률을 부드럽게 따라가고(getLoadingProgress 의 LoadingProgress), loadAssets 가 끝나면 1 로 채운다. 아무것도 정하지 않으면 지금과 같다. (검은 바탕, #333333 과 #ffffff 게이지, 경과 시간 게이지)
- BuildInfo: 빌드 판 읽기. await load() 가 페이지의 <meta name="build-version"> 을 먼저 읽고, 없으면 version.json 을 캐시 없이(cache: "no-cache") 받는다. readText() 는 meta 의 글 그대로, 또는 version.json 의 "날짜 시각 (해시)" (해시가 없으면 version), 못 읽으면 빈 글. readVersionData(), isLoaded(), setMetaName, setVersionJsonPath, BuildInfo.composeText(versionData)
- 비주얼 에디터(tools/visualeditor/visualeditor.html)를 위 엔진으로 다시 빌드했다
- ToonScreenOutline, ToonOutlineWidthUnit: 툰 화면 공간 바깥선. (외계행성 광부 키우기 boardrenderer3d.js 와 애버런트 scenerenderer3d.js 가 따로 쓰던 셰이더 바깥선을 엔진으로) ToonRenderer 의 모형을 같은 행렬로 한 번 더 그려 노멀, 선 번호, 깊이를 선의 판에 쓰고(beginLineIds, drawMesh, drawMeshInstanced, endLineIds), 한 번 훑어 선의 진하기 가면을 쓴 뒤 drawOutline 으로 화면에 섞는다. 실루엣 바깥, 다른 번호와 맞닿은 곳, 한 번호 안에서 꺾인 곳에 선다. 어느 모형과 부품(indexStart, indexCount)에 어떤 번호를 줄지, 인스턴스마다의 번호(instances[i].lineId)는 부르는 쪽이 정한다. 굵기는 월드 길이나 픽셀(setWidth, 원근의 월드 굵기는 setFocusDistance 의 거리에서, 주지 않으면 그린 모형의 평균 거리), 깊이는 투영 행렬로 직교와 원근을 가려 원근이면 미터로 푼다. setDepthThreshold, setCrease(각, 진하기, 이어짐 픽셀), setResolutionScale(0.25 ~ 1), setSampleCount(바깥선 4 ~ 28, 꺾임 0 ~ 4), setColor, setHdrOutput. beginLineIds 때의 뷰포트를 그리는 영역으로 삼아 화면 일부에 그린 3D 에도 맞는다. 껍데기 바깥선과 함께 써도 된다
- ToonVfx, ToonVfxSlot, ToonVfxLook, ToonVfxShape, ToonVfxDecalMode: 툰 3D GPU 효과의 바탕. (외계행성 광부 키우기 boardvfx.js 와 애버런트 effects.js 의 범용 부분, 효과 처방과 램프 색은 게임 몫이라 가져오지 않았다) 그림 파일 없이 코드로 짓는 아틀라스(연기 플립북 16 칸, 알갱이, 줄기, 빛살, 충격 띠, 빔 결, 그을음, 패인 땅, 둘레 빛, 색 램프 여덟 줄), 인스턴스 GPU 파티클(emitParticles: 꼴 point, sphere, ring, disc, cone, line, 끌림, 중력, 바닥에서 멈춤, 속도 쪽 늘임, 램프, 일곱 꼴), 불덩이(addFireball), 충격파 띠와 바닥 빛(addShockwave), 바닥 자국(addDecal, queueDecal, 그을음, 빛, 흐르는 테, 퍼지며 커짐), 연기 기둥(addPlume), 회전체 빔(queueBeam), 리본(queueRibbon)과 감아 내린 번개(queueLightning), 빛 점(queueGlint). update(초) 로 나아가는 자체 시계, 파티클 상한(생성자, setParticleCapacity, 넘으면 오래된 것부터 덮음)과 내는 수의 몫(setCountRatio, 폰과 가벼운 길), 램프 색(setRamps), 바닥 높이 콜백(setFloorHeightReader, 자국, 충격파, 기둥이 그 높이에 놓이고 isGrounded 파티클이 멈춤). draw(보기, 투영) 는 원근이면 빔과 리본이 카메라 자리를, 직교면 카메라 쪽을 향하고 그리기 상태를 돌린다
- 출시 게임들(외계행성 광부, aberrant, 종말 생존, 우주생물)이 따로 만들어 쓰던 창 쌓기와 화면 틀을 엔진 기본으로 옮겼다. (판 모양, 테마, 연출, 출시처 코드는 가져오지 않았다, 게임은 지금처럼 자기 것을 쓴다)
- UIWindowLayer: 창 쌓기. openWindow 로 맨 위에 쌓고 맨 위 창만 보인다. closeWindow 는 목록에서 바로 빼고(누름과 덮임이 바로 풀림) PopupMotion 닫는 움직임이 끝난 뒤 떼어 낸다. (덮여 있던 창은 바로) closeAllWindows, closeTopWindow(뒤로 가기, 바깥 닫기를 끈 창은 닫지 않음), getTopWindow, findWindow, hasOpenWindow, getWindowCount. 창이 뜨고 닫힐 때 setWindowChangeEvent 의 함수를 부른다(놀이 멈춤). 층은 UIScale.read 만큼 커지고(setUIScaleOptions, null 이면 키우지 않음, getUIScale) 창에는 그만큼 나눈 영역 크기(setViewSize)와 세이프에어리어 너비(setViewBleed)를 알린다. 휠은 맨 위 창의 handleWheel, 받지 않으면 그 자리의 스크롤 뷰(scrollWindowAt)
- UIWindow: 창 하나. 영역 전체와 세이프에어리어까지 덮는 어둠(누름을 삼킴) 위 가운데에 판을 띄운다. 판은 영역 가로에 맞춰 넓어지되 setMaximumWidth(기본 480)를 넘지 않고, 세로는 layoutContent(panelWidth) 가 돌려준 값(기본 setPanelHeight), 영역보다 크면 판을 통째로 줄인다. 바깥을 누르면 닫힌다(setOutsideCloseEnabled 로 창마다 끔). close, setCloseEvent(내려갈 때 알림). 판 모양은 Paint 한 장이고 게임은 상속해 틀(getFrameNode)에 꾸밈을 붙이고 layoutPanel, applyMotion, setCovered, handleWheel, dispose 를 덮어써 바꿔 끼운다. getPanelNode, getPanelPaint, getDimPaint, getPopupMotion
- UIConfirmWindow: 확인 창. 제목, 묻는 글, 취소와 확인 두 단추. 글은 판 너비에서 줄을 바꾸고, 영역 세로를 넘으면 글 칸만 스크롤된다. setRightToLeft(true) 면 단추 차례를 뒤집는다(확인이 왼쪽). 확인은 setConfirmEvent 뒤 닫히고, 취소 단추, 바깥 누르기, closeTopWindow, closeAllWindows 로 닫히면 setCancelEvent. setTitle, setMessage, setButtonTexts. (UIDialog 는 그대로 둔다)
- UIScale.read(viewWidth, viewHeight, options): 뷰 한 단위가 minimumCssScale(0.8) CSS 픽셀보다 작으면 UI 층만 키울 배율. (1 ~ maximumScale 1.8, 낮은 화면은 minimumLayerHeight 아래로 키우지 않음(기본 0 이면 보지 않음), 세로 화면(가로가 세로의 portraitRatio 1.1 배 이하)은 상한 없음, cssPixelScale 을 주지 않으면 ViewManager.getCssPixelScale) UIScale.isPortrait
- GameScene: fadeScreen(onDark). 다 어두워지면 onDark 를 부르고, 그것이 Promise 를 돌려주면 끝날 때까지(실패해도) 어둡게 두었다가 밝힌다. 이미 페이드 중이면 false. setScreenFadeColor(기본 검정), setScreenFadeSeconds(기본 0.35), isScreenFading, getScreenFadeAlpha. 막은 postDraw 에서 세이프에어리어까지 캔버스 전체에 그리고, 배율을 곱하지 않은 시간으로 움직인다. 막이 걸린 동안은 누름과 휠을 받지 않는다
- GameScene: isUserInterfaceAt(viewPosition) (그 자리에 누를 수 있는 노드가 있는지, 감춰져 있던 터치 인식기의 raycast), setPlayInputHandler({ press, move, release, wheel }) (UI 가 받지 않은 누름과 그 누름의 이동과 뗌(취소 포함), UI 밖의 휠을 세이프에어리어 왼쪽 위 기준 게임 영역 좌표로 넘긴다), convertViewToPlayArea. 창 층 안을 가리킨 휠은 UIWindowLayer.scrollWindowAt 으로 넘긴다
- GameScene: setPlayAreaReference(fixedLength, isLandscape). 세이프에어리어를 뺀 게임 영역의 고정 쪽 길이가 늘 fixedLength 가 되게 기준 해상도를 늘린다. (캔버스 길이 : 세이프에어리어를 뺀 길이 = 기준 해상도 길이 : fixedLength, 뷰 배율 방식도 가로 고정 stretchWidthExpandHeight, 세로 고정 stretchHeightExpandWidth 로 둔다, resize 와 initialize 에서 다시 셈)
- ViewManager: setIgnoredSafeAreaSides(sides), getIgnoredSafeAreaSides. getSafeAreaInsets 가 그 쪽을 0 으로 돌려준다. (어느 쪽을 무시할지는 게임이 넘긴다)
- GameScene 의 바뀐 동작: computeSafeAreaRect 가 env(safe-area-inset-*) 를 따로 재던 것을 ViewManager.getSafeAreaInsets 로 읽는다. 지금까지는 setSafeAreaOverride, 주소의 ?safeArea=, (새) setIgnoredSafeAreaSides 가 GameScene 의 세이프에어리어 노드에 닿지 않았다. env 값만 쓰는 게임은 인셋이 정수로 잘리지 않는 것 말고 같다. (computeSafeAreaRect 를 덮어쓴 게임은 그대로)
- 출시 게임들(외계행성 광부, 우주생물, aberrant, 찾았다, 종말 생존)이 따로 만들어 쓰던 글자, 노드 편의, 그리기 기능과 최적화를 엔진 기본으로 넣는다. (게임의 화면 모양과 연출은 가져오지 않았다, 게임 코드는 그대로다)
- Text, UILabel: setFitWidth(width, minimumRatio = 0.55), getFitWidth, getFittedFontSize. 한 줄 글이 맞출 너비를 넘치면 처음 크기에서 최소 비율까지 0.1 단위로 줄여 그린다. 정한 크기(getFontSize)는 그대로이고 글, 글꼴, 굵기, 너비가 바뀌거나 웹 글꼴이 받아지면 다시 맞춘다. 최소 비율로도 넘치면 넘친 채 그린다. 줄을 바꾸는 글과 리치텍스트는 맞추지 않는다
- Text, UILabel: measureText(text, fontSize) (주지 않으면 지금 글과 정한 크기). 그 글자의 글꼴, 굵게, 기울임으로 잰 너비
- 글 재기 캐시: TextStringTextureCache.measureText 와 Text 의 재기가 글꼴 문자열과 글이 같으면 다시 재지 않는다. (2048 개, 오래 안 쓴 것부터 버림, 웹 글꼴이 받아지거나 문서의 글꼴 얼굴 수가 바뀌면 비움) measureTextMetrics(fontString, text) (textstringtexturecache.js). 돌려준 TextMetrics 는 나눠 쓰므로 고치지 않는다
- Component.calculateDrawnRect(rect): 내용 영역 밖까지 그리는 컴포넌트가 그리는 사각형을 알려 준다. (기본 false, 모름) WorldNode 의 화면 밖 거르기가 내용 영역 안에 그린다는 컴포넌트와 이 사각형을 합쳐 본다. Text 는 한 줄 글의 사각형(맞춘 크기, 넘쳐도 그 너비, 외곽선과 글꼴 크기 반만큼 양옆, 세로는 글꼴 크기의 1.5 배씩)을 알려 준다. RichText 는 모른다. UILabel 은 내용 영역 안에만(바탕) 그린다고 알린다
- 바뀐 동작: 지금까지 거르지 않던 한 줄 Text 와 UILabel 노드도 화면 밖이면 거른다. (거르기가 켜진 때, 줄을 바꾸는 글과 리치텍스트는 그대로 거르지 않는다) 노드 안에 직접 그리는 컴포넌트를 함께 붙였으면 그 컴포넌트는 지금처럼 알리지 않아 노드를 거르지 않는다
- Text.setText, UILabel.setText: 같은 글이면 건너뛴다. (UILabel 은 리치텍스트 모드가 아닐 때, 내재 크기를 다시 셈하게 하지 않는다) Text.setTextColor: 같은 색 문자열이고 가진 색이 그대로면 다시 풀지 않는다
- Text 그리기: 색을 "#rrggbb" 글로 바꿔 Graphic 에 넘기던 것을 Color 로 바로 넘긴다. (프레임마다 글 만들기와 풀기가 없어진다) 8 비트로 떨어지지 않는 색(rgba 의 0.5 알파 등)은 1/255 안쪽으로 다를 수 있다
- Color.fromCache(colorString): 색 문자열("#..", "rgb(..)", "rgba(..)", 그 밖은 흰색)로 캐시한 색. 같은 문자열이면 같은 인스턴스(1024 개, 오래 안 쓴 것부터 버림), 고쳐 쓰지 않는다. Graphic.setFillColor, setStrokeColor 가 문자열을 받으면 이 캐시를 쓴다
- Graphic: setTextBakeMotionScaleStep, getTextBakeMotionScaleStep(기본 0.25), setTextBakeScaleMoving, isTextBakeScaleMoving, readNodeTextBakeScaleMoving. 글자 굽기 배율 단계(setTextBakeScaleStep)가 0 일 때, 그리는 노드의 변환 배율이 지난 프레임과 다르면(ButtonMotion, PopupMotion, 트윈, 카메라 확대) 이 단계로 묶은 배율로 굽고, 멈추면 정확한 배율로 다시 굽는다. (확대 움직임 동안 프레임마다 글을 새로 굽지 않는다, 1 에서 1.09 로 커지는 단추가 굽는 수가 프레임 수만큼에서 2 장) 처음 그리는 노드는 움직이지 않는 것으로 본다. 단계가 0 이 아니면(기본) 아무것도 셈하지 않는다. ShadowText, ShadowImage 도 같은 배율을 쓴다
- TransformNode: setLastDrawnMaximumScale, getLastDrawnMaximumScale (Graphic.drawNode 가 쓴다)
- ShadowText, ShadowImage, SoftShade: 같은 모양이면 구운 그림을 열쇠별로 나눠 쓴다. 열쇠마다 쓰는 컴포넌트 수를 세어 쓰는 것은 버리지 않고, 아무도 쓰지 않게 된 것은 128 개까지 남겨 두었다 오래 안 쓴 것부터 버린다. 노드에서 떨어질 때(detach) 놓고, 놓지 않고 수거된 컴포넌트는 FinalizationRegistry 가 놓는다. (sharedbakecache.js 의 acquireSharedBake, releaseSharedBake, readSharedBakeCount) ShadowImage 는 그림마다 번호를 붙여 열쇠로 쓰고 setImage 할 때 새 번호를 붙인다
- WorldNode: setContentSizeXY(width, height), setRect(x, y, width, height) (왼쪽 위가 (x, y) 에 오게 피봇까지 셈해 로컬 위치와 내용 크기를 둔다, 앵커는 로컬 위치 셈에 들지 않아 그대로), convertViewToLocal(viewPosition) (뷰 좌표를 부모 변환까지 거쳐 내용 영역 왼쪽 위 기준 좌표로, contains 와 같은 네 귀퉁이 셈). TransformNode: setLocalPositionXY(x, y), setLocalScaleXY(x, y). XY 함수는 Vector2 를 만들지 않는다
- LanguagePack: isRightToLeft(), mirrorLayoutX(x, width, parentWidth), readLayoutTextAlign(align). 지금 언어가 오른쪽에서 왼쪽으로 쓰면 배치의 가로 자리와 정렬의 왼쪽, 오른쪽을 뒤집는다
- TouchRaycaster.touchWheel: 휠을 그 자리를 덮는 것 가운데 그리는 순서로 가장 앞인 스크롤 칸이 받는다. (칸 안의 글이나 그림처럼 누를 수 없는 것 위에서 굴려도 받는다, 지금까지는 누를 수 있는 노드의 조상만 찾아 칸 안 글 위의 휠이 사라졌다) 가장 앞이 누를 수 있는 노드면 지금처럼 그 노드와 조상의 스크롤 칸이 받는다. 받은 칸이 있으면 true. findWheelScrollView, findScrollViewComponent
- GameScene.touchWheel: 받은 스크롤 칸이 있으면 true 를 돌려준다. 덮어쓴 게임 씬은 super.touchWheel 이 false 일 때만 게임(지도 확대 등)으로 넘기면 창의 스크롤과 겹치지 않는다
- Graphic: drawRing(center, innerRadius, outerRadius, startRadian, endRadian) (setFillColor), drawArc(center, radius, startRadian, endRadian, lineWidth) (setStrokeColor). 조각마다 네모 하나를 겹치지 않게 이어 한 번에 그려 반투명이어도 이음매가 짙어지지 않는다. 조각 수는 drawCircle 처럼 화면에서의 반지름을 따라(한 바퀴 16 ~ 64) 그리는 각도만큼. 각도는 0 이 오른쪽, 시계 방향
- Graphic: drawLineSegments(positionValues, size) (setStrokeColor). 숫자 배열 하나(선분마다 x0, y0, x1, y1)로 선분 여럿을 한 번에 그린다. Vector2 를 만들지 않고, 정점 버퍼가 차면 거기까지 그리고 이어 담는다
- SpriteAtlas: 아틀라스 읽기. load(jsonPath), loadData(data, baseDirectory), readFrame(name) (Frame, 없으면 null), hasFrame, applyFrame(sprite, name), getPageImages, getFrameNames. tools/atlas.cjs 의 JSON 과 { pagePaths, frames: { 이름: [쪽, x, y, 가로, 세로] } } 꼴을 읽는다. 이름은 확장자를 떼고도 찾는다. 여러 아틀라스는 SpriteAtlas.addSearchAtlas 로 넣은 차례로 찾는다(findFrame, applySearchFrame, removeSearchAtlas, clearSearchAtlases)
- Sprite.setFrame(frame): Frame 의 그림과 영역을 함께 건다. (null 이면 그림을 비운다)
- tools/atlas.cjs: 여러 장(--max-size 를 넘으면 다음 쪽, 쪽마다 모두 들어가는 가장 작은 2 의 거듭제곱), 가장자리 늘여 붙이기(--extrude), 여백(--padding, 기본 2). 놓기를 선반에서 MaxRects 로 바꿔 같은 그림이라도 자리가 전과 다르다. (JSON 으로 읽으면 같다) JSON 의 images 에 page, meta 에 pages, extrude, padding 을 더했다. 쪽이 한 장이면 파일 이름이 전과 같다
- 비주얼 에디터(tools/visualeditor/visualeditor.html)를 위 엔진으로 다시 빌드했다
- 효과, 3D, 애니메이션에서 러스트 vanilla-engine 과 다르던 것을 맞췄다. (러스트에만 있던 범용 기능을 넣고, 두 엔진에 같이 있던 버그를 같이 고쳤다)
- ParticleSystem: isFinished(방출할 것이 더 없고 남은 입자도 없음, 루프가 아니면 duration 이 지나고 버스트를 다 냈을 때), getParticlePositionList(입자 자리 목록, 같은 씨앗 비교와 시험용). 러스트 판과 같은 씨앗이면 같은 입자 자리가 나온다
- HeatHazeEffect: experimental 노드에서 effect 컴포넌트로 옮겼다. (src/effect/heathazeeffect.js, import.js 에서 내보냄) node.addComponent(HeatHazeEffect) 로 붙이고, 붙을 때 노드 내용 크기가 비어 있으면 300 x 300 으로 정한다. getTimer, calculateRowOffset
- ScreenEffect: destroy 가 렌더 대상과 함께 패스 프로그램과 버텍스 어레이도 지운다
- Material.createTexture: 이미지를 곧은 알파, 색 프로필 변환 없이 받는다. (createImageBitmap 의 premultiplyAlpha, colorSpaceConversion 을 "none" 으로) 지금까지 브라우저 기본값으로 알파가 곱해져 알파 0 텍셀 색이 검어지고, OLD FACE 의 머리카락과 수염 카드 가장자리가 어두웠다
- ToonRenderer, SkinnedModelRenderer, HumanSkinRenderer: 그림자를 받지 않을 때 섀도우 유닛에 1x1 비교 깊이 텍스처를 묶는다. (맥 드라이버의 "sampler type (Depth)" 알림과 WebGL 의 샘플러 불일치를 막는다) SkinnedModelRenderer.getEmptyShadowTexture, ToonRenderer.destroy
- ToonVfx: 빛 파티클과 빛 점의 rim(0 은 더하는 빛, 1 은 테로 덮기, 음수는 엷게 덮는 빛무리), 리본과 번개의 번짐 색 glow, setRimColor, 사는 동안 다시 꺾이는 번개 addLightning(life), 화면 섬광 addFlash, 엔진 Shaker 로 셈하는 카메라 흔들림 addShake, readShake, isShaking. getActiveCounts 에 lightningCount, flashCount. draw 가 깊이 함수도 되돌린다. (게임 aberrant 의 효과에서 범용 몫만, 게임 색과 처방은 매개변수로)
- SkinnedModel: 바이트에서 읽기, 해석과 업로드 나누기, createWithoutShaderProgram(포즈 계산만), destroy. 기본 모프 가중치를 glTF 노드 weights 에서 읽는다. Material.createImageDescription, destroy. ShadowMap, FullscreenPass, 화면 공간 효과의 destroy(풀스크린 패스까지 지움). FbxLoader 가 2^53 을 넘는 64 비트 id 를 정확히 읽고 빠진 노드는 건너뛴다
- Camera2D: 회전(setRotation, getRotation, 도, 화면 가운데 축). 그리기 변환, screenToWorld, worldToScreen, panByScreen, fling, zoomAt 이 회전을 따르고, 경계 클램프는 돌아간 뷰를 감싸는 상자(getVisibleHalfExtent)로 잰다. convertScreenDeltaToWorld, begin, end(pushState 와 applyTransform, popState). experimental/camera.js 의 기능을 모두 덮는다. (실험 Camera.setZoom 의 clamp 인자 버그도 고쳤다)
- Tween: setTarget(node), getTarget, TweenProperty(localPosition, localScale, localRotation, localOpacity, contentSize) 값을 노드에 바로 쓴다, applyTweenProperty, Tween.createNodeTween. 대상이 처음 돈 노드 트리에서 떨어지면 콜백 없이 끝난다. duration 0 이하는 바로 끝. Scene.getTweenCount
- Animation: 비어 있던 pause, resume 을 채웠다. (gotoAndStop 이 멈춘다) stop 은 멈춰 있어도 첫 프레임으로 돌아간다. (setFrames 뒤 예전 번호가 남던 버그) SpriteAnimator.getCurrentFrameIndex
- Action: 조건 함수가 대상을 받는다. wait 의 duration 0 이하는 진행률 1(NaN 버그), repeat 0 번은 돌지 않는다
- Animator: AnimationState setClip, getClip, AnimationTransition setFrom, setTo, getFrom, getTo(상태 번호), getAnimation, addState, getStates, addTransition, getTransitions
- Timeline: 같은 이름 무대 노드를 버리던 버그(모두 붙이고 이름 표에는 뒤의 것), 부모가 자기 자신이거나 고리면 무대 부모에 붙인다. Timeline.loadFromText, createFromJsonAsset
- Indicator: getRadius, getRotation, buildTeethSegments, import.js 에서 내보낸다. Visual.getLocation 의 쓰지 않는 인자를 뺐다. VisualAsset setVisual, getVisual
- 예제 cameratour: 돌아가는 Camera2D(끌면 팬, 휠 줌), Tween.createNodeTween, Indicator
- UI 갈래: 러스트 vanilla-engine 과 UI 기능 차이를 없앤다. 러스트에만 있던 범용 기능을 넣는다
- UIButton.fireClickEvents(): 누르지 않고 클릭이 난 것처럼 clicked, click 알림을 차례로 부른다. UIHitArea 가 넓힌 자리의 클릭을 넘길 때 이것을 쓴다
- UILineChart.calculatePoints(width, height), UIBarChart.calculateBarRects(width, height): 그리기와 같은 자리의 폴리라인 점과 막대 사각형을 셈한다. draw 가 이것을 쓴다
- UISpinner: calculateDotOpacity(dotIndex), getDotColor, getRotationSpeed, getDotNodes
- UIScrollBar: getAxis, getThumbRect (썸이 꺼져 있으면 null)
- ToastMotion.getPhase(), ToastPhase 를 내보낸다. PopupMotion.isInstantEnabled(). UIImageView.getColor()
- UILabel: getWrapMode, getVisibleCharacterCount. UIInputField: getPlaceholder, getMaxLength, getFontSize, getPadding, getBackgroundColor, getRoundSize, getTextColor, getPlaceholderColor, getCursorColor, getCursorIndex, getSelectionStart, getComposition, isComposing
- UIWindow: setDimColor, setPanelColor (어둠과 판의 Paint 색)
- UIListView: setCreateItemEvent(() => WorldNode) 로 템플릿 대신 항목 노드를 만드는 함수를 받는다. 항목 크기를 정하지 않았으면 처음 만든 항목의 크기를 읽는다. isHorizontal()
- TouchRecognizer: getTouchTarget (드래그를 넘겼으면 스크롤 뷰 노드), isTouching
- GameScene: setSafeAreaInsets({ top, right, bottom, left }) 로 세이프 에어리어 인셋을 CSS 픽셀로 직접 정한다. (null 이면 뷰 매니저의 값, 게임 영역 기준도 이 값을 쓴다) 정적 calculateSafeAreaRect(viewSize, targetResolutionScale, insets). setPlayInputEnabled(true) 로 놀이 입력을 모아 두고 takePlayInputs() 로 { kind, position, wheelDelta } 를 꺼낸다. (처리기와 함께 써도 된다) setLoadingOutsideColor, hasLoadingDrawer, isLoadTouchedToSkip, getDevTools
- WebSocketClient: 수신 콜백이 없으면 받은 JSON 을 모아 두었다가(1024 개, 넘치면 오래된 것부터 버린다) takeReceivedMessages() 로 꺼낸다. getReceiveEvent 가 웹소켓을 돌려주던 버그를 고쳐 수신 콜백을 돌려준다
- UIScene: EngineConfiguration.useDevTools 가 꺼져 있으면 GameScene 처럼 개발자 도구를 만들지 않는다. (지금까지는 늘 만들었다)
- 비주얼 에디터(tools/visualeditor/visualeditor.html)를 위 엔진으로 다시 빌드했다

- 글자, 글꼴을 러스트 판(vanilla-engine)과 맞췄다:
  - 표시 글자 수(Text.setVisibleCharacterCount)와 Typewriter 는 글자 묶음 단위로 센다. (전에는 UTF-16 단위라 이모지와 결합 부호가 쪼개졌다) 여러 줄 글에서 남은 수가 음수로 떨어지면 다음 줄을 통째로 그리던 것을 고쳤다. (0 이 되면 다음 줄부터 그리지 않는다) Typewriter 의 글자 공개 알림은 글자 묶음을 받는다. countGraphemes, sliceGraphemes
  - Text.calculateDrawnRect: 줄을 바꾸는 글도 사각형을 안다. (화면 밖 거르기) getMeasuredLineCount
  - RichText: 글자 방향을 쓴다. 조각을 이은 글로 문단 방향을 정하고(이 글자의 방향, "inherit" 면 Graphic 의 방향), 오른쪽에서 왼쪽이면 조각을 오른쪽부터 놓는다. 정렬 "start" / "end" 도 그 방향으로 푼다. (전에는 조각에 방향을 쓰지 않았다)
  - ShadowText: setItalic, setUnderline, setStrikethrough 와 게터, isBold. 밑줄과 취소선도 그림자와 함께 굽는다. 글 방향에 "auto"(글의 첫 강한 글자로)
  - UILabel.getVisibleCharacterCount
  - Graphic: detectTextDirection(text) 를 내보낸다. (setTextDirection("auto") 와 같은 셈)
  - DynamicFont: buildAtlas 로 글자를 더하면 든 글자를 모두 새 캔버스에 다시 놓는다. (전에는 새 글자만 새 캔버스에 놓아 앞서 구운 글자가 어긋났다) 글자 묶음 단위, rebuildAtlas, measureText. import.js 에서 DynamicFont, GlyphInfo 를 내보낸다
  - Localization: selectLanguage(태그의 뒤 조각부터 떼며 코드와 별칭을 본다, detectLanguage 가 쓴다), setLanguageAliases, setRightToLeft, isRightToLeft, mirrorLayoutX, readLayoutTextAlign, isolateText, textNamed
  - LanguagePack: setLanguageList(data), setLanguageTexts(code, texts, fallbackTexts) (파일 없이 바로 넣기)
  - import.js: splitGraphemes, splitWords, countGraphemes, sliceGraphemes, detectTextDirection
  - 비주얼 에디터(tools/visualeditor/visualeditor.html)를 위 엔진으로 다시 빌드했다
- 코어, 플랫폼, 기반 갈래. 러스트 판(vanilla-engine)에만 있던 범용 기능을 들여와 두 엔진의 공개 API 를 맞춘다.
- Color.createFromBytes(red, green, blue, alpha) (0 ~ 255), withAlpha(alpha) (알파만 바꾼 새 색), Color.lerp(from, to, time)
- Math.easeOutQuad(time)
- Matrix4.writeToArray(array), writeToSlice(array, offset): 열 우선 16 칸을 배열(의 offset 자리)에 적는다
- Vector2: addScalar, subtractScalar, multiplyScalar, divideScalar, moduloScalar. Vector3: addScalar, subtractScalar, multiplyScalar, divideScalar. (add(number) 와 같다)
- Rect.intersects(other): 겹치는지. 변이 닿기만 한 것은 겹친 것이 아니다. (overlaps 는 닿기만 해도 겹친 것)
- Cooldown.activate(): use() 와 같다
- TransformMatrix.invert(): 역행렬을 새로 돌려준다. (행렬식이 0 이면 null)
- Platform.applyUserAgent(userAgent): 넘긴 user agent 글로 플랫폼, 브라우저, 모바일 여부를 고른다. (getPlatformInfo 가 브라우저의 글로 부른다)
- Engine: setTitle(title), writeClipboardText(text), readClipboardText() (Promise, 글이 없거나 막히면 null), isCoarsePointer(), loadScene, unloadScene, unloadAllScenes (SceneManager 와 같다), isExitRequested()
- Engine 페이지 이벤트: PageEvent(hidden, visible, blurred, focused, pointerDown), addPageEventListener(listener), removePageEventListener(listener), isPageHidden()
- Engine 검증용 화면 저장: requestFrameCapture(frameNumber) 는 그 프레임을 다 그린 뒤 캔버스를 PNG data URL 로 넘긴다. (Promise, 지난 번호면 이번 프레임) 주소 쿼리 ?capture=120,240 은 그 프레임들을 내려받기로 저장하고, captureName 은 파일 이름("{frame}" 은 번호, 기본 capture_{frame}.png), captureExit=1 은 마지막 저장 뒤 exitApplication 을 부른다
- InputManager: isTouchDown() (누른 프레임부터 뗄 때까지 참, 누른 채 움직이지 않아도 참), isWheelWithCtrl() (마지막 휠을 Ctrl 과 함께 굴렸는지, 터치패드 오므리기), isTouchInput() (마지막 입력이 손가락인지)
- Scene.tickTouch: 한 프레임 안에 누르고 뗀 것(빠른 탭, 클릭)의 뗌을 놓치던 것을 고쳤다. 지금은 touchPress 뒤 같은 프레임에 touchRelease 를 넘긴다. 누른 프레임에는 지금처럼 touchMove 를 넘기지 않는다
- Component.isTickNeeded(): 거짓이면 노드가 그 컴포넌트의 tick 을 부르지 않는다. 기본은 tick 을 다시 정의했는지로 본다. Sprite, Text 는 그리기만 하므로 거짓(하위 클래스가 tick 을 다시 정의하면 참), Paint 처럼 tick 이 없는 컴포넌트도 거짓
- ImageAsset.loadFromBytes(assetPath, bytes), TextAsset.loadFromBytes, JsonAsset.loadFromBytes, BlobAsset.loadFromBytes (assetPath, bytes), AudioAsset.loadFromBytes(bytes), FontAsset.loadFontFromBytes(family, bytes, descriptors): 이미 가진 바이트로 읽는다. (내장 자료나 직접 받은 것, 넘긴 바이트는 바뀌지 않는다)
- AssetLoader: load() 를 부른 뒤 받는 동안 더한 것에 일꾼이 늘지 않던 것을 고쳤다. (처음 한 개로 load 하면 그 뒤에 더한 것을 일꾼 하나가 줄지어 받았다) 지금은 동시에 받는 수까지 일꾼을 더 띄운다
- SpriteAtlas.getPageCount(), SpriteAtlas.findFrameInOrder(atlasList, name), applyFrameInOrder(atlasList, sprite, name): 찾을 아틀라스 목록을 쓰지 않고 넘긴 아틀라스들에서 차례로 찾는다
- AudioPlayer.setPlaybackRate(playbackRate): 재생 빠르기. (1 이면 그대로, 음 높이도 같이 바뀐다, 다음 play 부터)
- SoundSystem: addSoundAsset(soundId, audioAsset) (메모리에서 지은 소리를 그 id 의 녹음 무리에 덧붙인다, 크기와 간격은 소리 표의 줄을 따른다), getEffectVoiceCount()
- Collision2D.findNearestIndexInRadius(targetList, getPositionHandler, center, radius): findNearestInRadius 의 번호판. (없으면 -1)
- Localization: selectLanguage(candidateList, supported, default) (태그의 뒤 조각부터 떼며 맞추기, detectLanguage 도 이것을 쓴다. "zh-Hant-TW" 가 "zh-hant" 에 맞는다), setLanguageAliases, setRightToLeft, isRightToLeft, mirrorLayoutX, readLayoutTextAlign, isolateText, textNamed(key, values) (LanguagePack.formatText 와 같은 이름 자리 채우기), setTableFromJson(languageCode, tableJson)
- PersistedStore.unsubscribe(subscription): subscribe 가 돌려준 것을 넘겨 해지한다. (돌려받은 해지 함수를 부르는 것과 같다)
- SpriteAnimator.getCurrentFrameIndex(), SpriteAnimator.playOnNode(node, clipName, options) (노드의 애니메이터로 play)
- WebSocketClient: 수신 콜백이 없으면 받은 JSON 을 모아 두고 takeReceivedMessages() 로 꺼낸다. (1024 개까지, 넘치면 오래된 것부터 버린다) 바이너리 메시지도 UTF-8 JSON 이면 받는다. tick() (할 일 없음, 다른 플랫폼과 같은 코드로 쓴다). getReceiveEvent() 가 웹소켓을 돌려주던 것을 고쳐 수신 콜백을 돌려준다
- 비주얼 에디터(tools/visualeditor/visualeditor.html)를 위 엔진으로 다시 빌드했다
- BuildInfo: setPackageVersion, getPackageVersion. meta 도 version.json 도 없을 때 readText 가 돌려줄 판이다. (러스트 판의 빌드 때 판과 같은 자리, 넣지 않으면 지금처럼 빈 글) load 도 readText 와 같은 글을 돌려준다
- Identifier.reset 이 처음 값으로 되돌린다. (자기 값을 자기에 다시 넣어 아무것도 하지 않던 버그, Enum.begin 이 열거마다 1 부터 센다)
- AudioBus(src/core/audiobus.js, import.js 에서 낸다): AudioManager.createAudioBus(), AudioBus.createAudioPlayer() (그 버스로 트는 플레이어), setVolume, getVolume, mute, unmute, isMuted, isAvailable, getGainNode. 출력에 이은 GainNode 하나이고, 버스로 만든 플레이어는 출력 대신 버스에 잇는다. AudioPlayer 생성자는 둘째 인자로 내보낼 노드(outputNode)를 받는다. (없으면 audioContext.destination) 러스트 판과 같은 꼴이다
- SoundSystem.getMusicBus(), getEffectBus() 는 GainNode 대신 AudioBus 를 돌려준다. (노드는 getGainNode()) 설정 크기는 전처럼 그 GainNode 에 setTargetAtTime 으로 건다. 버스로 만든 플레이어도 설정 크기와 음소거를 따른다
- Platform.getResourceUsage(): 바른 이름을 더했다. 옛 이름 getResouceUsage() 는 같은 것을 부르는 별칭으로 남긴다
- Color.fromHEXCached: fromCache 처럼 1024 개를 넘으면 가장 오래 안 쓴 것부터 버린다. (전에는 끝없이 쌓였다) Color.getCachedColorCount(): fromCache 캐시에 든 수 (러스트 판의 get_cached_color_count)
- 비주얼 에디터를 위 엔진으로 다시 빌드했다
- KeyCode.audiomute 의 값 "AudioMute" 는 W3C KeyboardEvent.code 표에 없는 이름이라 음소거 키를 눌러도 맞지 않았다. "AudioVolumeMute" 로 고쳤다. (러스트 판과 같이 고침)
- Node.findDescendantByName(name): findChildRecursiveByName 과 같다. Node.destroyChildrenWhere(predicate): 조건에 맞는 직계 자식을 떼어 destroy 하고 그 수를 돌려준다. (러스트 판 find_descendant_by_name, destroy_children_where 와 같은 이름)
- GamepadManager.isButtonJustPressed, isButtonJustReleased: 이번 갱신에 방금 눌리거나 떼어진 버튼인지. (러스트 판과 같다)
- UI 원본 버그를 러스트 판과 같게 고쳤다:
  - UIDocument 가 Sprite 의 nineSlice 를 쓰기만 하고 읽지 않던 것. 쓰는 꼴([왼쪽, 위, 왼쪽 + 오른쪽, 위 + 아래])을 거꾸로 풀어 읽는다
  - UIDropdown: 머리 단추 틴트가 펼침 목록 행까지 잡아 고른 뒤 선택 강조가 옛 색으로 덮이던 것. 머리 단추 틴트에서 펼침 목록을 빼고(excludeNodeFromTint), 강조를 바꾸면 행 단추가 틴트 원래 색을 다시 담는다
  - UIInputField: maxLength 로 잘린 붙여넣기에서 커서가 글 끝을 넘던 것. 글 끝으로 자른다
  - LayoutSolver: 인공 변수 최적화가 예외로 끝나면 인공 행을 비우지 않고 남기던 것. try / finally 로 비운다
  - UILabel 의 배경 그리는 차례는 이미 맞았다. (UILabel 이 require 한 Text, RichText 보다 앞 차례로 붙어 배경을 먼저 그린다)
- 러스트 판에만 있던 범용 기능:
  - DEVTools: setVisible, getActiveTab, setActiveTab, getSelectedNode, setSelectedNode, isNodeExpanded, setNodeExpanded, getPanelRect. (F2 는 setVisible 을 부른다)
  - UIDialog.requestDismiss(isConfirmed): 다음 tick 에 닫는다
  - UIInputField.getDisplayText() (값의 커서 자리에 조합 글을 끼운 글), requestMenuAction(menuAction) (다음 tick 에 잘라내기 / 복사 / 붙여넣기), UIInputFieldMenuAction (import.js 에서 낸다)
  - AmbientOcclusionEffect.buildSampleKernel(), SubsurfaceScatteringEffect.buildKernel(falloffColor, strengthColor): WebGL 없이 커널을 짓는 정적 함수. computeKernel 이 이것을 쓴다
  - FbxLoader.parseNodeRecords(arrayBuffer) (머리 확인과 최상위 노드 레코드, parse 의 앞부분), FbxLoader.readVersion(arrayBuffer) (정적, 머리의 판 번호)
- OBB.overlaps 가 늘 false 이던 버그를 고쳤다. (상대 꼭짓점을 other.length 로 돌아 상대 투영 범위가 비었다, 러스트 판과 같다)
- Platform.getSafeAreaRect 가 Window.getComputedStyle(없는 정적 함수)을 불러 예외를 내던 것을 window.getComputedStyle 로 고쳤다. (헤드리스 크롬에서 typeof Window.getComputedStyle 이 "undefined" 인 것을 확인)
- NodeLayout.arrangeFan: System 을 들여오지 않아 부르면 ReferenceError 로 멈추던 것과, 라디안 값을 도 단위 회전(setLocalRotation)에 넣던 것을 고쳤다. (러스트 판과 같다)
- TextAsset, BlobAsset: 실패 응답(404 등)을 받은 것으로 치던 것을 고쳐 예외를 낸다. (AssetLoader 의 실패 목록에 든다) AudioAsset 도 실패 응답이면 디코딩 전에 실패로 친다
- SoundEffectPool: 보이스 수가 0 이면 play 가 0 으로 나눠 예외를 내던 것을 고쳐 아무것도 하지 않는다. (러스트 판과 같다)
- AudioManager.getContextTime() (AudioContext 시계, 없으면 0), AudioAsset.getLoadError() (마지막 읽기 실패의 까닭, 없으면 null), AssetLoader.getInFlightCount() (일꾼이 집어 받는 중인 수). 러스트 판의 get_context_time, get_load_error, get_in_flight_count 와 같은 자리다
- 비주얼 에디터를 위 엔진으로 다시 빌드했다
- Graphic.setBlendMode: source-over 로 대신 그리던 17 가지를 제대로 그린다. 이제 SpriteBlendMode 26 가지가 모두 된다
  - source-out, source-atop, destination-atop, xor 는 W3C Compositing and Blending Level 1 의 포터 더프 계수 그대로 blendFunc 로 건다
  - overlay, darken, lighten, color-dodge, color-burn, hard-light, soft-light, difference, exclusion, hue, saturation, color, luminosity 는 그리기마다 그릴 영역(정점의 경계 상자)만 지금 프레임버퍼에서 blitFramebuffer 로 떠 와 셰이더로 섞는다. 공식은 W3C 그대로(분리 섞기, 비분리 섞기, Cs' = (1 - αb) x Cs + αb x B(Cb, Cs) 뒤 source-over 합성)이고 바탕 알파가 있는 렌더 타겟(RGBA8, RGBA16F)에서도 맞다. darken, lighten 은 blendEquation MIN / MAX 가 반투명에서 W3C 식과 달라 셰이더로 섞는다
  - 셰이더 섞기 모드에서는 묶어 그리지 않는다. 그리기 하나에 영역 복사 한 번과 드로우 콜 한 번(M2 Pro, 1280x720 에서 그리기 하나에 0.065 ms 안팎, 대부분 복사가 렌더 패스를 끊는 값)
  - 이미지, 도형, 글자, 나인슬라이스, 자르기, 파티클, 바꿔 끼운 셰이더(ShaderSprite) 모두 된다. 파티클은 서로 겹치지 않는 쿼드끼리 모아 한 번 떠 와 그려 Canvas2D 처럼 쿼드마다 앞 쿼드 위에 섞인다. 바꿔 끼운 셰이더는 섞기 함수를 모르므로 덧그림 칸(RGBA16F, 안 되면 RGBA8)에 먼저 그린 뒤 섞어 옮긴다
  - 크롬 Canvas2D 와 같은 장면(여러 색 바탕 위에 반투명 그림, 사각형, 다각형)을 26 모드로 견주면 도형 안쪽 차이가 2 단계 안이다. Canvas2D 는 source-in, source-out, destination-in, destination-atop, copy 가 그린 도형 밖도 지우는데 Graphic 은 지금처럼 도형 안만 바꾼다
  - 모르는 이름의 경고 글을 "unknown blend mode" 로 바꿨다
- 툰 후처리, 효과, 카메라를 애버런트와 광부 키우기가 엔진 그대로 쓰게 넓힌다. (새 옵션이 기본값이면 지금 화면과 화소까지 같다, 두 엔진 같은 API 와 같은 셰이더 글, 게임의 처방과 색 값은 매개변수로 받는다)
- RenderTarget: options 의 sampleCount(2 이상이면 멀티샘플 렌더버퍼에 그리고 resolve() 가 컬러 텍스처마다와 깊이 텍스처로 푼다, MAX_SAMPLES 와 포맷마다 받는 표본 수 밑으로 줄이고 못 받거나 프레임버퍼가 완성되지 않으면 멀티샘플 없이), depthBits(깊이 렌더버퍼 16 이나 24), getSampleCount, getResolveFramebuffer, readSupportedSampleCount. 멀티샘플이면 getFramebuffer 는 그리는 멀티샘플 프레임버퍼다
- BloomEffect.setUseFloatColor: 주고받는 판을 RGBA16F 로 지어 1 을 넘는 밝은 값이 잘리지 않게 한다. (기본 RGBA8 그대로)
- MultiLevelBloomEffect: 다단 블룸. 반 크기로 뽑으며 부드러운 무릎 문턱(밝기는 세 채널 가운데 큰 값), 반씩 줄이는 이중 거르개, 천막 꼴 아홉 점으로 두 배씩 키우며 위 단에 더한다. 단 수(setLevelCount), 문턱과 무릎(setThreshold), 판 정밀도
- ToonPostProcess: 생성 옵션 { sampleCount, useFloatColor, depthBits, useDepthTexture }, isFloatColorSupported(실수 판을 못 쓰는 기기는 RGBA8 판의 LDR 길로, 그때 씬에는 화면 색을 그리고 합성은 톤매핑과 감마 없이 블룸과 색 보정만 건다), setSampleCount, setResolutionScale(3D 판만 출력 크기 x 배율로 그리고 end 의 뷰포트로 키운다, UI 는 기기 화소 그대로), setBloomLevels(단 수, 문턱, 무릎, 0 이면 기본 반 해상도 9 탭), setBloomFloatColor, setBrightness, setLitArea 와 clearLitArea(씬 깊이 텍스처로 화소마다 월드 자리를 되짚어 그 자리에서 수평 거리 안쪽은 밝기 1), getSampleCount, getUseFloatColor, getResolutionScale, getBloomLevelCount. 광부 키우기가 셰이더 안에서 LDR 로 걸던 밝기, 채도, 밝힌 자리를 LDR 길의 후처리로 걸 수 있다. (채도의 밝기 무게는 엔진의 Rec. 709 다, 광부는 Rec. 601)
- 툰 색 공간 규약: 씬 판은 선형이다. (ToonRenderer.setHdrOutput(true), ToonScreenOutline.setHdrOutput(true), ToonVfx 의 색도 선형으로 본다) 애버런트처럼 감마를 건 값 g 를 실수 판에 쓰고 합성에서 g^2.2 로 되돌리던 게임은 옮길 때 값을 선형으로 바꾼다. 색은 c^2.2, 감마 쪽에서 곱하던 밝기 배 k 는 선형 k^2.2 다. (1.37 은 2, 1.6 은 2.81, 2.08 은 5, 밝기 1.6 에 배 1.6 은 7.9) 블룸 문턱 1 과 무릎 0.25, 노출 1, 세기 0.6 은 애버런트가 선형으로 되돌린 뒤 쓰던 값이라 그대로다
- Camera3D.setMatrices(보기, 투영): 게임이 셈한 원 행렬을 그대로 쓴다. (광부 키우기의 기울인 직교처럼) 눈, 보는 곳, 위쪽, 직교인지를 행렬에서 뽑고 projectToView, unprojectToPlane, readViewDepth, ToonRenderer.beginFrameWithCamera 가 그 행렬로 돈다. hasRawMatrices, clearRawMatrices, setPerspective 와 setOrthographic 과 lookAt 은 원 행렬을 버린다
- ToonVfx: emitParticles, addFireball, addShockwave, addDecal, addPlume, addLightning, addFlash 의 options.age(이미 지난 초, 늦게 보인 효과를 그 나이부터, 음수면 그만큼 늦게) 와 options.key(사건 열쇠, 이미 낸 열쇠면 다시 내지 않음, clear 가 잊음, registerEventKey), setLookGain 과 getLookGain(파티클과 빛 점의 꼴마다 밝기 배, 기본 1), setGlintCapacity 와 getGlintCapacity(프레임마다 빛 점 상한, 기본 96), 바닥 자국 꼴 stain(tint 로 덮고 테 둘레가 테 색으로 물듦), sheen(기름 윤), shade(둥글게 엷어지는 그늘) 와 자국 options.flicker(깜빡이는 반주기 초), queueBlobShadow({ x, z, radius, alpha })(발밑 그늘), 불덩이, 충격파, 리본, 번개의 options.rim(몸을 덮고 가장자리를 테 색으로 두르는 꼴의 몫, 밝은 바탕용, 0 이면 지금의 더하는 빛). 흔들림(addShake)은 Shaker 의 지수 감쇠라 늦게 보인 사건이면 세기 x exp(-9 x 나이) 로 넘긴다
- 러스트 판에만 있던 범용 기능을 넣었다. Text.calculateFittedFontSize(), UILabel.calculateFittedFontSize() (그릴 때의 크기를 그 자리에서 잼, 이 판은 Graphic 없이 재므로 getFittedFontSize 와 같은 값), Text.wrapLinesWithoutGraphic(maximumWidth) (지금 글과 글꼴로 나눈 줄 목록, 잴 캔버스가 없으면 null), measureTextWithoutGraphic(fontString, text) (import.js 에서 낸다, measureTextMetrics 와 같음)
- Graphic.readFramebufferPixels() (지금 그린 화면을 { width, height, pixels } 로, 위에서 아래로 놓인 RGBA, 알파 255), getDrawingBufferWidth(), getDrawingBufferHeight() (마지막으로 맞춘 뷰포트), getImageSmoothingQuality()
- WorldNode.setPosition: getPosition 의 거꾸로를 더했다. 지금까지는 TransformNode.setPosition 이 부모 pivot 점의 자리(부모 contentSize x 부모 pivot)를 되돌리지 않아, 부모의 내용 크기와 피벗이 0 이 아니면 setPosition 으로 놓은 자리와 getPosition 이 달랐다. (부모 100x60, 피벗 가운데, 90 도, 크기 2 에서 (280, 200) 에 놓으면 (340, 100) 으로 읽혔다) 부모 스케일이 0 인 축은 부모 pivot 점에 놓는다. (러스트 판과 같이 고침)
- multiply 를 렌더 타겟(프레임버퍼를 묶은 동안)에 그릴 때는 그릴 영역 아래를 떠 와 W3C 식(B(Cb, Cs) = Cb x Cs)대로 셰이더로 섞는다. 고정 블렌딩(DST_COLOR, ONE_MINUS_SRC_ALPHA)은 바탕 알파가 1 보다 작으면 cs x (1 - αb) 항이 빠지고 알파가 바탕 알파로 남아, 반투명 바탕 렌더 타겟에서 크롬 Canvas2D 와 최대 221 달랐다. (이제 도형 안쪽 0) 기본 프레임버퍼(alpha: false)는 바탕 알파가 늘 1 이라 지금처럼 고정 블렌딩과 묶어 그리기로 그려 화면과 드로우 콜, 복사 수가 그대로다. 렌더 타겟의 multiply 는 셰이더 섞기 13 가지처럼 그리기 하나에 영역 복사 한 번과 드로우 콜 한 번이 든다. 섞기 셰이더 글에 blendModeIndex 14 를 더했다. (러스트 판과 같이 고침)
- KeyCode.audioplay 의 값 "MediaPlay" 는 W3C KeyboardEvent.code 표(2025-04-22 권고안)에 없는 이름이다. 표의 이름이고 크롬이 흔한 재생/멈춤 키(USB 0x0C00CD, 윈도우 스캔 코드 0xE022)에 내는 "MediaPlayPause" 로 고쳤다. 크롬은 "MediaPlay" 를 리눅스와 크롬OS 의 재생 키(USB 0x0C00B0)에만 낸다. (러스트 판과 같이 고침)

# 0.3.2 (2026-10-22)
- AudioManager: iOS(iPadOS 포함) 에서는 resumeContext() 로 복원된 컨텍스트가 "running" 이면 verifyContextClock() 으로 currentTime 이 흐르는지 0.5 초 동안 보고, 멈춰 있으면 suspend() 후 resume() 하고 다시 확인한다. (옵션이 아니라 iOS 에서 늘 한다. 다른 플랫폼은 지금까지와 같다) iOS 버전업으로 생긴 문제다. (2026-10-22 03:41, iOS 26.6.2, 아이폰 15 프로 맥스) 앱을 내렸다 돌아오면 WebKit 이 컨텍스트를 스스로 되살리지 않고 suspended 로 두며, 돌아온 직후의 resume() 은 "Failed to start the audio device" 로 거부되거나 "running" 이 되어도 시계가 흐르지 않아 소리가 나지 않았다. 그 전의 iOS 에서는 같은 앱이 돌아오면 소리가 났고, 2026-04 의 엔진(ef1b279)으로 만든 판도 지금은 같은 증상이라 엔진의 변화가 아니다.
- EngineConfiguration: resumeAudioOnTouchEnd. (기본 false, 꺼져 있으면 지금까지와 같다) 켜면 손을 뗄 때(touchend, pointerup)에도 사용자 입력으로 보고 오디오 컨텍스트를 깨운다. (markUserGesture 와 resumeContext) touchstart 는 사용자 활성화를 주지 않아, iOS WebKit 에서 앱 전환이나 전면 광고로 멈춘(suspended, interrupted) 컨텍스트에 resume() 을 불러도 깨어나지 않았다. 캔버스를 끄는 조작은 기본 동작을 막아 click 이 생기지 않으므로, 화면을 끌기만 하는 게임은 한 번 포커스를 잃으면 소리가 돌아오지 않았다. 생성 때 정한다. (리스너를 그때 단다)
- UIScrollView: setPassesCrossAxisDrag(passes) / isPassingCrossAxisDrag() / isScrollDrag(deltaX, deltaY). (기본 false, 꺼져 있으면 지금까지와 같다) 켜면 세로만 스크롤하는 뷰에서 가로로 더 많이 끈 손가락(가로만 스크롤하면 세로로 더 많이 끈 손가락)은 TouchRecognizer 가 뷰로 넘기지 않는다. 보류된 누름을 곧바로 누른 노드에 보내고 그 뒤의 이동과 뗌도 그 노드가 받는다. 두 축 모두 스크롤하는 뷰는 늘 가져간다. (스크롤 안의 슬라이더를 가로로 끌 때, 드래그 임계를 넘자마자 세로 스크롤이 손가락을 가져가 슬라이더가 움직이지 않던 것)
- EngineConfiguration: maxCanvasAspectRatio. (기본 0, 제한하지 않아 지금까지와 같다) 캔버스의 긴 쪽이 짧은 쪽의 몇 배까지인지. 정하면 autoResizeOnWindowResize 로 맞출 때 창이 그보다 길쭉하면 캔버스를 그 비까지 줄이고, 왼쪽과 위의 여백(margin)으로 창의 가운데에 둔다. 남는 곳은 페이지의 바탕이다. 실행 중에 바꾸면 resize() 를 불러 맞춘다. 입력 좌표와 뷰 계산은 지금처럼 캔버스의 실제 자리(getBoundingClientRect)를 읽으므로 그대로 맞는다. (게임 영역의 가로세로 비를 제한하는 웹 게임 포털에서 쓴다)
- UIInputField: setUseDirectTouch(use) / isUsingDirectTouch(). (기본 false, 꺼져 있으면 지금까지와 같다) 켜면 DOM 입력을 쓸 때 필드가 보이는 동안 투명한 DOM 입력이 필드 자리에서 누름을 직접 받는다. (pointer-events: auto, 필드가 보이지 않으면 none) 그래서 포커스와 키보드를 브라우저의 기본 동작이 연다. 엔진이 캔버스의 터치 기본 동작을 막아, 앱 안의 웹뷰가 띄운 다른 출처의 iframe 에서는 게임 프레임이 포커스를 받지 못해 코드로 준 포커스가 잡히지 않던 때(어떤 앱의 오버레이 단추를 눌렀다 와야 잡힘)에 쓴다. 포커스를 받으면 커서는 글 끝에 둔다. (투명한 DOM 글자와 캔버스의 글자는 자리가 달라 누른 자리를 쓰지 않는다)
- UIInputField: 0.3.20 의 touchend 포커스를 옵션으로 바꾼다. setUseTouchEndFocus(use) / isUsingTouchEndFocus(). (기본 false) 꺼져 있으면 touchend 는 아무것도 하지 않아 0.3.19 와 같게 돈다. 켜면 0.3.20 의 동작(활성화가 한 번도 없던 때에 얻은 포커스를 손을 뗄 때 다시 줘 키보드를 띄움)을 한다. 0.3.20 은 기본 동작을 바꿨으므로 0.3.20 을 받았으면 이 판으로 올린다
- UIInputField (DOM 입력): 캔버스의 touchend 에서도 필드를 눌렀으면 포커스를 준다. touchstart 는 사용자 활성화를 주지 않아, 페이지의 첫 터치가 필드면 안드로이드 크롬(웹뷰, 다른 출처의 iframe 포함)이 포커스는 받되 키보드를 띄우지 않았다. 입력은 포커스를 쥔 채라 다시 눌러도 키보드가 뜨지 않고, 필드 바깥을 눌러 포커스가 빠진 뒤에야 떴다. 활성화가 한 번도 없던 때에 얻은 포커스면(navigator.userActivation.hasBeenActive) 손을 뗄 때 blur 뒤 다시 포커스를 줘 키보드를 띄운다. 이미 키보드가 뜬 필드를 다시 누르는 보통의 경우는 지금까지와 같다
- Rect: isZero(). 위치와 크기가 모두 0 인지를 새 객체를 만들지 않고 본다
- Sprite, Graphic.drawImageWithImageRect, ShaderSprite: 그림 영역이 비었는지 볼 때 Rect.zero() 를 만들어 견주던 것을 isZero() 로 바꿔, 그림마다 프레임마다 생기던 객체(Rect 하나와 Vector2 둘)를 없앤다
- WorldNode.pushTransform: 피봇만큼 당기는 자리를 Vector2 로 만들지 않고 바로 옮긴다. (노드마다 프레임마다 객체 하나)
- 그리는 결과는 같다
- GameScene.postDraw: 개발자 도구를 만들지 않았을 때(EngineConfiguration.useDevTools 가 false, 0.3.13) 없는 도구를 그리려다 매 프레임 오류(Cannot read properties of null)가 나던 것을 고친다. 도구가 있을 때만 그린다
- Text 줄바꿈: 줄바꿈 없는 빈칸(U+00A0)으로 이은 단어 사이에서는 줄을 바꾸지 않는다. 공백으로 나눈 조각이 넘쳐 단어 경계에서 나눌 때(0.3.11) 줄바꿈 없는 빈칸 뒤의 단어를 앞 조각에 붙인다. 이름과 값, 숫자와 단위처럼 한 줄에 있어야 하는 글을 줄바꿈 없는 빈칸으로 이으면 갈라지지 않는다. (지금까지는 Intl.Segmenter 의 단어 경계에서 갈라졌다) splitWords(text) 도 같은 조각을 돌려준다
- Graphic: setTextDirection(direction) / getTextDirection(). 글자의 문단 방향. ("inherit" | "ltr" | "rtl" | "auto", Canvas2D direction 대응, pushState / popState 에 든다) 글자를 그 방향으로 굽고(캔버스의 direction, 텍스처 캐시의 열쇠에 든다), 정렬 "start" / "end" 가 그 방향에 따라 왼쪽, 오른쪽이 된다. "inherit" 는 "ltr" 로 본다. (기본, 지금까지와 같다) "auto" 는 문자열마다 처음 나오는 방향이 강한 글자로 정한다. (HTML 의 dir="auto", 없으면 "ltr", 닉네임처럼 사용자가 쓴 글에 쓴다) 오른쪽에서 왼쪽으로 쓰는 언어(아랍어, 히브리어 등)에서 문장 끝의 문장 부호와 숫자로 시작하는 글이 반대쪽에 붙던 것을 바르게 한다
- Graphic: resolveTextDirection(text) (실제 방향 "ltr" / "rtl"), resolveTextAlign(textAlign, textDirection) ("start" / "end" 를 "left" / "right" 로)
- Text, UILabel: setTextDirection(direction) / getTextDirection(). ("inherit" 면 그리는 때의 Graphic 방향, 기본) 여러 줄 글은 글 전체로 방향을 정해 모든 줄에 쓴다. 서식 조각(segment)으로 그리는 RichText 는 방향과 상관없이 왼쪽에서 오른쪽으로 잇는다
- TextStringTextureCache.getEntry / bakeEntry: 마지막 인자로 방향을 받는다. (기본 "ltr") 경계는 늘 왼쪽 기준으로 잰다
- Graphic: setImageMipmapEnabled(value) / isImageMipmapEnabled(). 스무딩이 켜진 이미지 텍스처에 밉맵을 만들고 축소 필터를 LINEAR_MIPMAP_LINEAR 로 한다. (기본 false, 지금까지와 같다) 큰 그림(아틀라스 등)을 크게 줄여 그릴 때(작은 화면, 멀리 물러난 카메라) 가장자리의 계단과 자글거림이 줄어든다. 밉맵은 텍스처마다 처음 필요할 때 한 번 만든다. 아틀라스는 그림 둘레의 여백이 넉넉해야 작은 밉맵 단계에서 옆 그림이 번져 들지 않는다
- ImageTextureCache.getTexture(image, isSmoothingEnabled, isMipmapEnabled): 세 번째 인자로 밉맵을 쓸지 받는다. (기본 false)
- Graphic: setImageMipmapBias(value) / getImageMipmapBias(). 밉맵 단계를 고를 때 더하는 값. (기본 0, 지금까지와 같다) 음수면 한 단계 큰 그림 쪽을 골라 줄여 그린 그림의 외곽선이 옅어지지 않는다. (-0.5 안팎, 너무 작으면 다시 자글거린다) 기본 셰이더(낱장, 묶어 그리기, 파티클)의 프래그먼트 셰이더가 textureLodBias 유니폼으로 받고, 바꿔 끼운 셰이더는 그 유니폼이 있으면 받는다
- Object: 고유식별자(instanceId)를 생성자에서 만들지 않고 처음 getInstanceId() 를 부를 때 만든다. Vector2, Rect, Color, TransformMatrix 처럼 프레임마다 많이 만드는 값 객체가 만들 때마다 GUID 를 지어 그리기 시간의 대부분을 쓰던 것을 없앤다. (한 게임의 측정에서 프레임의 스크립트 시간이 4 ~ 7 배 줄었다) 부르는 쪽에서 보이는 동작은 같다
- TransformNode.getOpacity(): 부모의 투명도를 곱할 때 없는 변수(opcacity)를 쓰던 오타를 고쳐, 부르면 오류가 나던 것을 바로잡는다. (부모들의 로컬 투명도를 모두 곱한 전역 투명도를 돌려준다)
- EngineConfiguration.useDevTools: 개발자 도구(F2 로 여닫는 패널과 기즈모)를 쓸지. (기본 true, 지금까지와 같다) 끄면 GameScene 이 DEVTools 를 만들지 않아 F2 를 받지 않고, 입력도 가로채지 않는다. 출시 빌드처럼 사용자에게 개발 도구가 보이면 안 되는 곳에서 끈다
- AudioPlayer: setVolume(volume) / getVolume(). 음량(0 ~ 1)을 정한다. 음소거(mute)와 따로 기억해, unmute 가 1 이 아니라 정한 음량으로 돌아간다. (기본 1, 지금까지와 같다)
- SoundEffectPool: play(audioAsset, volume) 의 두 번째 인자로 이 재생만의 음량을 준다. (기본 1) setVolume(volume) / getVolume() 은 풀 전체의 음량이고 재생 중인 것에도 바로 곱해진다. 음악과 효과음의 크기 설정, 거리에 따라 작아지는 효과음에 쓴다
- AudioAsset: 디코딩을 OfflineAudioContext 로 한다. (없으면 지금처럼 잠시 쓰는 AudioContext) 애셋마다 실시간 AudioContext 를 만들지 않아 user gesture 전에 받아도 자동재생 경고가 없고, 여러 애셋을 한꺼번에 받아도 브라우저의 AudioContext 개수 제한에 걸리지 않는다
- Text 줄바꿈: 공백으로 나눈 조각이 넘치고 그 안에 단어가 여럿이면(태국어, 라오어, 크메르어, 버마어, 한중일처럼 공백 없이 쓰는 글자), Intl.Segmenter 의 단어 경계에서 나눠 지금 줄의 남은 자리부터 채운다. 문장 부호처럼 단어가 아닌 조각은 앞 단어에 붙여 줄 맨 앞에 오지 않게 한다. 지금까지는 글자 단위로 끊겨 단어 한가운데에서 줄이 바뀌었다
- Text 줄바꿈: 글자 단위로 나눌 때(넘치는 한 단어, "char" 모드) 코드 포인트가 아니라 글자 묶음(grapheme) 단위로 나눠, 결합 부호와 성조가 앞 글자에서 떨어져 줄 맨 앞에 오지 않는다
- splitGraphemes(text), splitWords(text) 를 text.js 에서 내보낸다. (Intl.Segmenter 가 없으면 코드 포인트, 통째로 한 조각)
- EngineConfiguration.rebakeTextOnFontLoad: 웹 폰트가 늦게 받아지면(document.fonts 의 loadingdone) 그 폰트로 구운 글자 텍스처 가운데 그 폰트 얼굴의 글자 범위(unicodeRange)에 든 글자가 있는 것만 버려, 다음에 그릴 때 받은 폰트로 다시 굽는다. (기본 false) 받기 전에 대신 쓴 폰트로 구운 글자가 그대로 남지 않고, 캐시를 통째로 비우지 않아 받을 때마다 모든 글자를 한꺼번에 다시 굽느라 프레임이 길어지지 않는다
- TextStringTextureCache.invalidateFontFaces(fontFaces): 그 폰트 얼굴들의 이름을 쓰고 그 글자 범위에 든 글자가 있는 엔트리만 텍스처째 버린다. (버린 수를 돌려준다)
- EngineConfiguration.ignoreVirtualKeyboardResize: 글자 입력칸이 포커스된 동안 가로는 그대로이고 세로만 줄어드는 리사이즈(모바일의 화면 키보드)를 무시한다. (기본 false) iOS 사파리에서 입력칸을 누르면 visualViewport 의 세로가 줄어 캔버스와 화면 전체가 갑자기 작아지던 것을 막는다. 키보드가 내려가면 다시 맞춘다. Engine.isTextInputFocused() 로 포커스를 본다
- editorkit: openEditorMenuPanelAt 이 연 메뉴가 창 밖으로 나가면 안으로 들인다. (오른쪽 끝에서 연 오른쪽 단추 메뉴는 왼쪽으로, 아래 끝에서 연 메뉴는 위로)
- Pane: setVisible(isVisible) / isVisible(). 숨긴 패널은 자리를 차지하지 않고(형제 중 마지막으로 보이는 패널이 남는 자리를 받는다), 그 패널과 맞닿은 리사이저도 숨는다. 사이드 패널을 껐다 켜는 도구 화면에 쓴다
- EngineConfiguration.defaultFontUrl: run() 이 뒤에서 불러오는 기본 폰트(DOSGothic)의 주소. (기본은 지금까지와 같은 jsDelivr 주소) 빈 글이면 불러오지 않는다. 인터넷 없이 도는 데스크탑 앱이나 외부 요청을 막은(CSP) 페이지가 바깥 요청과 콘솔 오류 없이 뜬다
- Graphic: 스프라이트 묶어 그리기(옵션). setSpriteBatchingEnabled(true) 면 같은 텍스처를 쓰는 연이은 드로우(이미지, 도형, 글자)를 변환한 정점에 색과 틴트를 실어 쌓아 두었다가 한 번의 드로우 콜로 그린다. 텍스처, 블렌드, 클리핑, 바꿔 끼운 셰이더가 바뀌거나 버퍼가 차면 그때까지 쌓인 것을 그리고, 프레임 끝(엔진)과 ScreenEffect.end 에서 남은 것을 그린다. 여러 그림을 아틀라스 한 장에 모으면 드로우 콜이 크게 준다. 기본은 꺼짐. 켠 채로 WebGL 을 직접 다루는 패스를 끼울 때는 그 전에 flushSpriteBatch() 를 부른다
- TouchRaycaster: Mask 가 붙은 노드의 자손은 그 노드 영역 안에서만 맞는다. 스크롤 안에서 잘려 보이지 않는 내용이 스크롤 밖의 버튼과 입력칸의 누름을 가로채던 것을 막는다
- UIView: 바탕색이 투명하면 바탕을 그리지 않는다. (보이지 않는 드로우가 드로우 콜을 늘리고 묶어 그리기를 끊지 않게)
- EngineConfiguration.maximumFramePerSecond: 최대 FPS. (기본 0, 제한 없음) 정하면 그 간격보다 빨리 온 프레임을 건너뛴다. 주사율의 흔들림을 받아 주려고 4 밀리초 덜 요구한다. 주사율이 높거나 프레임이 들쭉날쭉한 기기에서 고른 간격으로 돈다
- Graphic: 텍스트 선명도 선택 기능. setTextBakeScaleStep(step) 으로 베이크 스케일 양자화 단위를 정한다. (기본 0.25 그대로, 0 이면 실제 스케일로 굽는다) setTextPixelSnapEnabled(true) 면 회전 / 기울임이 없는 변환에서 글자 쿼드를 디바이스 픽셀 격자에 맞춘다. 둘을 함께 쓰면 스케일이 고정된 UI 글자가 늘어나지 않고 1:1 로 그려진다
- Graphic: 프레임 그리기 통계를 센다. 엔진이 매 프레임 씬을 그리기 전에 beginFrameStatistics() 를 부르고, 지난 프레임의 드로우 콜 / 정점 / 삼각형 수를 getLastFrameDrawCallCount() / getLastFrameVertexCount() / getLastFrameTriangleCount() 로 읽는다. 2D 경로(drawVertices, drawColoredQuads)만 센다. 개발 정보 창(useStatistics)에도 세 값을 띄운다

# 0.3.1 (2026-09-14)
- GamepadManager: gamepadconnected 이벤트를 놓쳐도 패드를 붙잡는다. 그 이벤트는 페이지가 뜬 뒤 패드를 처음 만질 때 한 번만 오므로, 놓치면 연결 목록이 빈 채로 남아 패드가 먹지 않았다. updateAllGamepads 가 매 갱신마다 navigator.getGamepads() 를 훑어 아직 맞이하지 않은 패드를 붙이고 뽑힌 패드를 놓아준다
- FontAsset: loadFont(family, assetPath, descriptors) 로 FontFace 서술자를 넘길 수 있다. 주지 않으면 굵기와 기울기가 모두 normal 로 등록되어, 같은 패밀리에 굵기가 다른 파일을 올리면 나중 것이 앞 것을 덮어썼다
- Graphic: 글자 안티앨리어싱 끄기(setTextAntialiasEnabled)와 그리기 버퍼 보존(preserveDrawingBuffer)을 옵션으로 추가
- Toon Shading: 표정 / 동작 버튼 줄을 세로 스택 컨테이너로 묶어 모바일 겹침 제거

# 0.3.0 (2026-09-09)
- 타임라인 편집기(tools/timelineeditor) 신규 — 유니티 타임라인 / 언리얼 시퀀서 쓰임새의 키프레임 저작 도구. 노드별 묶음 트랙 도프 시트 + 커브 보기(값 세로 끌기), 자동 키(레코드) 모드, 속성 줄 ◆ 키 단추, 이벤트 / 사운드 트랙, 마커, 이징 31종 + 3차 베지어(프리셋 6종 + 곡선 미리보기), 다중 선택 / 상자 선택 / 끌기 / 복사·붙여넣기 / 시간 배율 / 뒤집기, 프레임 스냅, 되돌리기 64단계, 무대 미리보기에서 노드 선택 · 끌어 옮기기, 이미지 / 오디오 애셋(데이터 주소로 문서에 내장), .timeline.json 저장 / 열기, 사용 코드 복사
- Timeline 런타임(src/experimental/animation/timeline.js) — 무대 노드 서술(group / paint / sprite / text / particle / sound) 생성, 트랙(x, y, width, height, scaleX, scaleY, rotation, opacity, visible, color, text, number, fontSize, visibleCharacters, frame, effect, event) 보간, 첫 키 이전 / 마지막 키 이후 값 유지, 반복 시 구간 이벤트 발생, 마커 / 이벤트 / 완료 핸들러, 대상 해석기(노드가 아닌 객체도 setTimelineProperty 로 구동)
- ShaderSprite(src/effect/shadersprite.js) 신규 — Sprite 와 같은 출력 경로에 프래그먼트 효과 48종(색: flash / silhouette / colorize / grayscale / sepia / invert / hueShift / colorAdjust / posterize / threshold / gradientMap · 외곽: outline / innerOutline / glow / innerGlow / shadow / edgeDetect / emboss / sharpen · 흐림: blur / motionBlur / radialBlur · 왜곡: wave / flag / ripple / heatHaze / bulge / swirl / mirror / kaleidoscope / jitter / pixelate / glitch / chromatic · 무늬: hologram / scanlines / oldFilm / vignette / shine · 전환: dissolve / burn / noiseFade / pixelDissolve / wipe / iris / diamondWipe / clockWipe / blinds / checkerWipe)
- ScreenEffect(src/effect/screeneffect.js) 신규 — 씬 전체 후처리 사슬 58종(렌즈 왜곡 / 볼록 / 소용돌이 / 만화경 / 대칭 / 파문 / 아지랑이 / 떨림 / 겹침 / 모자이크 / 충격파 / 물결 · 방향 / 방사 / 가우시안 / 틸트 시프트 블러, 빛줄기, 블룸, 아나모픽 · 글리치 / VHS / 색수차 · 색온도 / 리프트-감마-게인 / 컬러 그레이드 / 색상 회전 / 스플릿 토닝 / ACES 톤맵 / 그라디언트 맵 / 세피아 / 무채색 / 포스터화 / 디더 / 하프톤 / 샤픈 / 윤곽 / 낡은 필름 / 야시경 / 반전 · CRT / 그레인 / 빗줄기 / 안개 / 비네트 / 스포트라이트 / 집중선 / 레터박스 · 전환 11종), 스텐실 포함 오프스크린 대상 + 핑퐁 / 하프 해상도 패스, 타임라인 속성("vignette", "shockwave.radius") 구동
- Graphic: setShaderProgramOverride / restoreRenderState 추가(그리기 중 프로그램 바꿔 끼우기, 외부 GL 패스 뒤 상태 복구), ShaderProgram 에 어트리뷰트 위치 고정 옵션
- 샘플 timeline(examples/timelineshowcase) 신규 — 편집기 문서 8종(제목 리빌 / 로고 스팅 / HUD 인트로 / 컷신 / 콤보 팝업 / 장면 전환 / 반복 아이들 / 패럴랙스)을 생성기(generate.mjs)로 만들고 트랜스포트(재생 / 정지 / 반복 / 속도 / 스크럽 + 마커 눈금)로 재생, 화면 효과 트랙 연동
- 성능: Graphic 이 글자를 흰색으로 굽고 그릴 때 색을 곱하도록 바꿔 색 변화(버튼 틴트 전환 / 타임라인 색 트랙)마다 텍스트를 다시 굽지 않음, 타임라인 fontSize 트랙은 정수 픽셀로 적용, ScreenEffect 는 켜진 효과가 없으면 오프스크린 / 복사 패스를 건너뜀, spritefx 목록은 보이는 행만 활성(프레임당 드로우 콜 441 → 약 170) + 다 탄 파티클 노드 정리
- ScreenEffect 적용 영역: setRegion(x, y, 폭, 높이, 둥근 모서리 반지름 — 캔버스 픽셀) 으로 무대 창 안에만 효과를 걸 수 있음. 씬을 오프스크린에 그리지 않고 화면에서 영역만 떠 와(blitFramebuffer) 처리한 뒤 같은 자리에 되돌려 놓으며, 둥근 모서리 바깥은 원본을 유지. resetAll() 로 모드 전환 때 이전 파라미터 / 색이 남지 않게 함. timelineshowcase · spriteeffects 샘플은 무대 사각형(모서리 14)에만 효과가 걸린다
- Mask 에 둥근 모서리(setRoundSize) — Graphic.beginClipRect(rect, roundSize) 가 둥근 사각형을 스텐실에 써서 무대 컨텐트가 배경 모양대로 잘린다. timelineshowcase · spriteeffects · particleeffects 샘플의 무대(반지름 14)에 적용
- Timeline 이 파티클을 시간으로 다룸 — 대상 파티클 시스템을 수동 틱(ParticleSystem.setManualTick / simulate)으로 바꿔 재생 중에만 진행하고, 스크럽 / 되감기 / 반복 감기 때는 비운 뒤 0초부터 이벤트를 다시 밟으며 재시뮬레이션한다. 일시 정지하면 파티클도 멈춘다
- 샘플 이름: Effects → Particle Effects, Timeline → Timeline Showcase, Sprite FX → Sprite Effects. 두 새 샘플에서 상단 설명과 무대 위 코드 패널을 뺐다(시연용). Sprite Effects 목록은 스프라이트 셰이더 → 화면 효과 → 연출 차례
- Toon Shading: Mixamo 클립(idle / walk / run) → VRM 휴머노이드 리타깃(표정 아래 애니메이션 버튼, 절차 포즈 / 호흡 제거), 스프링 본은 갱신 뒤 신선한 뼈 위치 + 체인 전파, 눈마다 카메라를 향하는 시선, 줌 연동 초점 + 우클릭 / 두 손가락 팬, 스프링 본 고정 서브스텝, 프레임 제한기 개선, 기본 30fps
- 샘플 toonshading(examples/toonshading, 처음 이름 celshading) 신규 — VRM 1.0(pixiv Twist Sample) 캐릭터를 호요버스풍 셀 셰이딩으로: 3 톤 램프 · 구면 노멀 얼굴 / 머리카락 · 앞머리 그림자 · 천사 고리 · 계단 스펙큘러 · 화면 공간 림 · 뒤집힌 껍질 아웃라인 · 앞머리 너머 비침 · 스프링 본 · 시선 / 표정 · 바닥 그림자, Old Face 식 옵션 패널. 엔진은 MORPH_GLSL 을 내보내 커스텀 버텍스 셰이더가 모프 경로를 공유
- Old Face: RENDER BASE 가 화면보다 작은 기준으로만 줄이던 상한 방식에서 기준 픽셀 수를 그대로 잡는 방식으로 — 폰처럼 화면 픽셀 수가 기준보다 작으면 슈퍼샘플링, 한 변은 GPU 최대 텍스처 / 렌더버퍼 크기로 제한
- Timeline 파티클 재현성: 수집한 파티클 시스템에 시드 난수(ParticleSystem.setRandomSeed — stop(true) 마다 시드로 되돌아감)를 줘 스크럽 / 되감기마다 같은 결과. 이벤트 트랙이 없는 파티클은 타임라인 시작과 함께 자유 재생. 틱 끝이 키 시간과 정확히 같을 때 이벤트가 빠지던 구간 판정(fireEventsBetween) 수정. Timeline Showcase 는 눌린 채 같은 위치면 seek 하지 않음
- 샘플 공통: 페이지 제목 Title Case 통일, Scene 기반 샘플(Sprite Effects / Particle Effects / UI Showcase)에 휠 → 스크롤 뷰 전달, 엔진 import 에 캐시 스탬프, Sprite Effects 목록은 행을 눌러도 스크롤을 옮기지 않음. Timeline Showcase 스크럽은 잡으면 일시 정지 · PLAY 로 재개
- 샘플 spritefx(examples/spriteeffects) 신규 — 절차적 픽셀 스프라이트(슬라임 / 코인 / 박쥐 / 문장 / 별 / 보석)로 ShaderSprite 48종 · ScreenEffect 58종을 표에서 자동 나열하고, 연출 조합 25종(히트 스톱 / 화면 흔들림 / 슬로 모션 / 잔상 / 플립북 / 떠오르는 데미지 / 타자기 대사 / 슬래시 트레일 / 패럴랙스 / 카메라 펀치 / 스쿼시 앤 스트레치 / 스폰·디스폰 / 체력 바 / 번개 / 레벨 업 / 텔레포트 / 프리즈 프레임 / 포털 / 수중 / 상태 이상 / 승리 / 게임 오버 / 낮·밤 / 피격 넉백 / 폭우) 시연

- 새 샘플 Toon Shading(examples/toonshading) — VRM1 Twist Sample 을 호요버스풍 셀 셰이딩으로. 3 톤 램프 / 구면 노멀 / 앞머리 그림자 / 천사 고리 / 림 / 아웃라인 / 비침 / 스프링 본 / 표정, 엔진 MORPH_GLSL 내보내기. (이름은 Cel Shading 에서 바꿨다)
- Toon Shading 동작: Mixamo 클립 리타깃(IDLE / WALK / RUN + JUMP / GREET / CLAP / CHEER / DANCE), 골반 이동을 X/Y/Z 모두 리타깃해 다리 미끄러짐 제거, 스프링 본 갱신 순서 / 체인 전파 / 클립 전환 시 꼬리 재설정, 콜라이더 여유 + 중간점 검사
- Toon Shading 시선: 두 눈이 각자 카메라를 향하고(뼈 로컬 축과 무관) 머리 정면 방향을 보정, 비침 패스 정면 가드, 우클릭 / 두 손가락 팬 + 줌 연동 초점
- Old Face: RENDER BASE 를 상한이 아닌 기준 픽셀 수로 적용(모바일 슈퍼샘플링), 렌더 타겟 한 변을 GPU 상한으로 제한
- Timeline: 파티클을 시드 난수로 돌려 스크럽 재현성 확보, 이벤트가 없는 파티클은 자유 재생, 틱 경계에서 이벤트가 빠지던 것 수정
- README 개편: 배지 / 빠른 시작 / 기능 표 / 도구 · 샘플 · 게임 링크 표 / 저장소 구조, 소개를 엔진 기능 설명으로 정리하고 본문을 존댓말로
- 편집기 파비콘 정리: 타임라인 편집기가 파티클 편집기 아이콘을 덮어썼던 것을 바로잡고, 편집기 계열(공통 바탕 + 띠 + 라벨) 로 통일

# 0.2.8 (2026-09-07)
- OLD FACE 옵션 전면 확장 — 우측 패널에 슬라이더 36종(렌더: 프레임 레이트 30 / 60 / 최대, 슈퍼샘플링 0.5~2x, 노출, 블룸 강도 / 문턱, 비네트, 그레인 / 지오메트리: 머리 메시 LOD 0~2, 머리카락 카드 5단계(LOW~CINEMATIC), 텍스처 크기 4단계 / 그림자: 섀도우 맵 1K~8K + 표본 4~24, 부드러움, 강도 / 피부: 노멀, 모공, 캐비티, 마이크로 노멀, 주름 깊이, SSS 폭, 스펙큘러, 러프니스, 잔털 / AO 강도 · 반경 / 조명 키 · 필 · 림 · 앰비언트 / 머리카락 흔들림 · 스펙큘러 · 뿌리 차폐 / 눈 홍채 · 동공 · 깊이 / 머리 따라가기 · 깜빡임 빈도), 패널 세로 스크롤 · 폭 확대
  - 머리 LOD 0 / 1 / 2 (24k / 12k / 6k 정점) 와 머리카락 카드 LOD 0~4 를 별도 glb 로 나눠 슬라이더로 필요할 때 로드, 텍스처 크기는 TEXTURE_MIN_LOD 로 실효 해상도 조절, 섀도우 맵은 해상도 변경 시 재생성
  - HumanSkinRenderer: 버텍스 셰이더 주입(기반 렌더러 옵션) 으로 머리카락 흔들림(가닥 끝 가중 사인 합성), 섀도우 표본 수 유니폼(포아송 24), 프린지 블렌드 토글
  - 머티리얼 그래프 2배 확대 + 휠 세로 스크롤, 기본 표정 SERIOUS(미간 / 입술 압박) 추가, 눈물선 / 침 유체 커버리지 상수화(눈꺼풀 위 흰 줄 제거), 실사 얼굴 파비콘(favicon.png)
  - 메타휴먼 DCC 패키지의 Eyes_Color / Eyes_Normal(캐릭터 실제 청회색 홍채) 과 Head_SRMF(스펙큘러 / 러프니스 맵)를 눈 · 피부 머티리얼에 적용 (compose_dcc_textures.py)
  - 옵션 패널 세로 스크롤 복구(overflow 충돌) / 폭 372px, 슬라이더는 모두 왼쪽 = 성능, 오른쪽 = 품질 방향으로 통일, 머티리얼 그래프 드래그 스크롤 + 노드 폭에 맞춘 줄바꿈 + 크레딧 겹침 회피, 렌더링 정보에 GPU 메모리 추정 / JS 힙 / 장치 메모리, 포트폴리오 목록용 favicon.svg(PNG 내장)
  - ANTI-ALIASING 슬라이더(OFF / FXAA / FXAA + 대비 적응 샤픈)로 FXAA 토글 대체, 로딩 진행 막대, 얼굴 털(눈썹 / 수염)은 흔들림 제외 셰이딩 모드로 분리, 주름 색 오버레이 폭 제한(눈꺼풀 청백색 얼룩 제거), 눈물선 유체 축소, 눈꺼풀이 감길수록 눈알을 그늘지게(감은 눈 틈의 흰 하이라이트 제거)
  - 그래픽 설정 패널 접기 / 펼치기(기본 접음, 제목 클릭) + 표정 버튼 위 z-index, 슬라이더 값 칸 잘림 수정, 머티리얼 그래프를 설정 패널과 같은 규격(폭 372 / 여백 18 / 제목 바 / 패딩 / 폰트 / 스텐실 클립 내부 스크롤)으로 재구성 — 모바일은 접힌 설정 아래 전체 폭 카드, 크레딧은 모바일에서도 표시
  - 패널 제목 OPTIONS, 옵션 패널 / 그래프 높이를 렌더링 정보 HUD 위까지로 자동 제한, 그래프 구성 요소 크기(제목 10px · 그룹 9px · 본문 10.5px · 자간)를 옵션 패널 CSS 와 동일하게, 프레임 레이트 30 / 60(기본 30), RENDER SCALE 슬라이더(해상도 대비 % — 내부 렌더 버퍼, 4K 픽셀 예산 제한), HUD 에 display / render buffer 분리 표시

# 0.2.7 (2026-09-07)
- OLD FACE 렌더링을 언리얼 메타휴먼 룩에 맞춰 상향 — HumanSkinRenderer 를 셰이딩 모드(피부 / 눈 / 머리카락 / 차폐 / 유체) 통합 셰이더로 재작성
  - 피부: 표정 주름 맵 3종(노멀 / 색 오버레이) 을 메타휴먼 마스크 아틀라스(4x4 타일 x RGBA 채널) 와 RigLogic 애니메이티드 맵 출력으로 가중 혼합(assets/wrinkles.json), 타일링 마이크로 노멀 / 캐비티, 골 기반 러프니스, 회전 포아송 PCF 소프트 섀도우(4K 섀도우 맵)
  - 눈: 각막 굴절 시차 홍채, 홍채 노멀 / 림버스 / 동공, 각막 하이라이트 + 환경 반사, 공막 정맥 노멀, 눈꺼풀 차폐 셸 메시(블렌드 어둡힘), 눈물선 / 침 메시(유체 스펙큘러)
  - 머리카락: 카드 탄젠트 아틀라스로 Kajiya-Kay 이중 로브 이방성 하이라이트, 뿌리 차폐, 투과 역광, 컷아웃 + 프린지 블렌드 2패스(조도 감쇠 + 스펙큘러 버퍼에 색), 섀도우 맵 컷아웃 캐스팅
  - AmbientOcclusionEffect(신규): 깊이 + 노멀 MRT 로 반구 표본 SSAO + 깊이 인식 블러, 합성에서 조도 / 스펙큘러에 적용
  - 1.5x 슈퍼샘플링(내부 렌더 해상도) + FXAA, 배경을 씬 MRT 에 직접 그려 블렌드 패스가 커버리지에 의존하지 않게 함
  - 애셋: 메타휴먼 룩데브 텍스처(주름 마스크 / 마이크로 노멀 / 눈 / 치아) 내보내기와 합성 스크립트, C++ 덤프에 애니메이티드 맵 출력 추가
  - 렌더링 옵션 패널에 AMBIENT OCCLUSION / EXPRESSION WRINKLE MAPS 토글 추가

# 0.2.6 (2026-09-07)
- OLD FACE 애셋을 메타휴먼 크리에이터 노인 프리셋 "Walter" 로 교체 — 실제 피부 텍스처(알베도 / 노멀 / 캐비티 → 러프니스와 디테일 높이), 그룸 카드 머리카락 / 눈썹 / 콧수염 / 턱수염, 총 11.1만 삼각형, ARKit 51 셰이프키(얼굴 리그 RigLogic 을 그대로 계산)
  - UE 5.8.2 + MetaHuman Creator Core Data 헤드리스 파이프라인(examples/oldface/tools/metahuman/ue): 프리셋 복제 → 클라우드 오토리그(JOINTS_AND_BLEND_SHAPES) / 고해상도 텍스처 → DNA / 머리 메시 / 머티리얼 텍스처 내보내기 → C++ 모듈 OldFaceTools 로 DNA 2.5 지오메트리 덤프와 RigLogic 포즈 평가(엔진의 RigLogicLib 사용, 65 프레임 ARKit 매핑 커브)
  - 그룸 카드: 그룸 애셋의 카드 LOD1 스태틱 메시와 아틀라스(Layout2: Attribute R 커버리지 / G 깊이, Tangent A 가닥 좌표)를 꺼내 바인딩 소스 머리(레거시 그룸 머리, UV 로 DNA 정점 순서 대응)의 최근접 삼각형 프레임으로 Walter 머리에 다시 붙이고, 같은 바인딩으로 표정 포즈마다 정점을 옮겨 셰이프키로 굽음(턱수염이 턱, 눈썹이 이마를 따라감). 머리카락만 양면 사본, 셰이프키는 4mm 이상 이동만 유지
  - 샘플: 머리 머티리얼에 메타휴먼 노멀 / 러프니스 맵, 그룸 카드 4종 머티리얼(알파 컷아웃, 산란 없음), 머티리얼 그래프 패널 썸네일(NORMAL / CAVITY / HAIR), 크레딧 문구

# 0.2.5 (2026-09-05)
- OLD FACE 샘플 추가 (examples/oldface) — 에픽 메타휴먼 얼굴(Taro DNA: 머리 2.4만 정점 + 치아 / 눈알 / 속눈썹, RigLogic 을 ARKit 51종 셰이프키로 굽음)을 피부 파이프라인으로 렌더링
  - 애셋 생성(examples/oldface/tools/metahuman): UE 5.8 에서 ARKit 매핑 애니메이션의 raw 제어 커브를 덤프하고, 에픽 DNA 라이브러리로 DNA 의 RigLogic(PSD / 조인트 그룹 행렬 / 블렌드셰이프 채널)을 직접 평가해 포즈별 정점을 계산, Blender 로 희소 셰이프키 glb 생성.
    눈(공막 + 홍채 합성) / 치아 / 속눈썹 텍스처는 메타휴먼 플러그인 기본 텍스처, 피부 알베도는 자리표시자(코어 데이터 설치 후 교체 예정)
  - 표정 버튼 13종(NEUTRAL / HAPPY / GRIN / PEACEFUL / EXCITED / ANGRY / FURIOUS / SAD / PAIN / DISGUSTED / BORED / CONFUSED / EMBARRASSED) — ARKit 블렌드셰이프 가중치 프리셋(assets/expressions.json)을 부드럽게 전환, 깜빡임은 EyeBlink 단위
  - 머리 / 치아 / 눈알 / 속눈썹 카드(알파 컷아웃)를 부위별 머티리얼로 분리(눈과 카드는 산란 마스크 0)
  - 머리 방향은 흉상 모델 행렬을 목 아래 피벗으로 회전해 포인터를 따라감, 카메라 초점은 눈알 정점 중심, 폰 핀치 줌, 렌더링 정보 패널이 홈 링크와 겹치면 위로 이동
  - 선형 HDR 피부 파이프라인: 섀도우 깊이 → 피부 MRT(조도 / 알베도 / 스펙큘러) → 화면 공간 SSS → 합성 → 블룸 → ACES 톤 매핑 → FXAA
  - 렌더링 옵션 패널(숫자 키) + 우측 하단 렌더링 정보(fps / 프레임 시간 / 해상도 / 삼각형 / 정점 / 드로우 콜 / 모프 수)
  - 와이어프레임 토글(깊이 프리패스로 앞면 모서리만, 모프 / 스키닝 반영), 좌측 머티리얼 그래프 패널(원본 / 노화 텍스처 축소본, 셰이딩 파라미터, MRT / SSS / HDR 중간 버퍼 실시간 미리보기, 토글)
- experimental/graphics
  - HumanSkinRenderer 추가 (SkinnedModelRenderer 파생 — 3점 조명 + 3색 반구 앰비언트 + 소프트박스 반사 환경,
    탄젠트 노멀 + 4K 높이 미분 디테일 + 캐비티, 피부 F0 이중 로브 GGX + 잔털, 조도 / 알베도 / 스펙큘러 MRT 출력)
  - SubsurfaceScatteringEffect 추가 (분리형 화면 공간 SSS — 피부 확산 프로파일 커널, 깊이 인식, 산란 폭 투영)
  - SkinnedModel: 스킨 없는 정적 메시 로드(합성 스킨), 모프 타깃(glTF targets / weights 애니메이션 + addMorphTarget / setMorphWeight, 최대 96),
    glTF 희소(sparse) 접근자, 드로어블에 메시 CPU 데이터와 머티리얼 이름 유지, setMaterial 추가
  - SkinnedModelRenderer: 프래그먼트 셰이더 주입 생성자, 모프 타깃 버텍스 경로(실수 텍스처 + gl_VertexID)
  - SkinnedModelRenderer.drawWireframe / SkinnedModel.uploadWireframeIndices: 중복 없는 모서리 선 인덱스로 와이어프레임 출력
  - Material: sRGB 색 텍스처(SRGB8_ALPHA8), 캔버스 소스 이미지, 이방성 필터, 추가 텍스처 슬롯(setTexture), URL 이미지 서술 로더,
    머티리얼별 서브서피스 팩터(setSubsurfaceFactor), setUseAlphaCutout
  - HumanSkinRenderer: 색 텍스처 셰이더 디코드, 러프니스 텍스처(G) x roughnessFactor, 오파시티 알파 컷아웃, 머티리얼별 SSS 마스크
  - RenderTarget: 다중 컬러 어태치먼트(MRT), RGBA16F 실수 컬러, 깊이 텍스처 옵션
- ParticleSystem: EmitterShape 를 ParticleEmitterShape 로 개명하고, 문자열이던 렌더 모양을 ParticleRenderShape 열거형(circle / rect / streak / image)으로 통일 (값은 기존 문자열과 같아 vfx JSON 은 그대로 호환)
- UIDropdown: 펼친 목록을 트리 뿌리로 옮겨 그려 나중에 그려지는 형제 노드에 가려지지 않게 수정 (접으면 되돌림)
- UI 쇼케이스: 내비게이션 캡션을 CONSOLE 에서 UI SHOWCASE 로 변경

# 0.2.4 (2026-09-03)
- Graphic: 정점 버퍼 올리기를 bufferSubData 덮어쓰기에서 bufferData 고아 처리로 교체 (drawVertices / drawColoredQuads)
  — 사파리(ANGLE → Metal)는 GPU 가 아직 읽는 버퍼를 덮어쓰면 드로우 콜마다 CPU 를 세워, 드로우 콜 45 · 정점 1000 남짓에도
  아이폰 10 fps · 맥 22 fps 가 나왔음. 교체 뒤 맥 사파리 60 fps 확인 (srpg 프로젝트에서 발견, 크롬은 영향 없음)
- 에디터 · EFFECTS 샘플: 이펙트 20종 + 코드 패널 / 복사 / fps, 유사 이펙트 7종 정리와 신규 메커니즘 5종, 오버레이 / 스크롤바 개선,
  ASSETS 구획 3종 · 파티클 계층 트리 · 격자 / 뷰 토글 · 팔레트 드래그 앤 드롭 수리

# 0.2.3 (2026-08-31)
- 형제 게임 프로젝트들에서 반복 구현되던 범용 기능을 엔진으로 흡수 (실험적 브랜치)
- base
  - math: randomRange / randomInt / pickRandom / shuffle / approach / moveTowards 추가
  - SeededRandom 추가 (mulberry32, 일일 시드 생성 포함)
  - Cooldown / RepeatTimer 추가
  - ObjectPool 추가
  - FiniteStateMachine 재작성 (enter / tick / exit, 전이 가드 / 알림)
  - Format 추가 (천 단위 / 한국어 단위 / K·M·B 축약 / 자릿수 채움 / 분:초)
  - Color.fromHEXCached 추가 (공유 인스턴스 캐시)
- core
  - InputManager: isKeyJustPressed / isKeyJustReleased (프레임 엣지 검출) 추가
  - ViewManager: 안전 영역 조회(getSafeAreaInsets), 화면비 기반 자동 스케일 모드(applyAspectViewScaleMode), 렌더 픽셀 배율 상한(setMaxRenderPixelRatio) 추가
  - Engine.exitApplication 추가 (Capacitor 앱 종료 지원)
  - TextAsset: 캐시 무시 로드(setNoCache) 추가
  - SoundEffectPool 추가 (다중 보이스 효과음 재생)
  - Text: 자동 줄바꿈(단어 / 글자 단위), 줄 간격, 글자 수 노출(타자기용) 추가
  - AnimationClip.fromAtlas 추가 (TexturePacker json / 사각형 배열)
- ui
  - UILabel: 줄바꿈 / 노출 글자 수 전달 메서드 추가
  - UIButton: 최소 눌림 시간(setMinimumPressedSeconds) 추가
  - UIProgressView: 보조 게이지(setSecondaryValue) 추가
  - PopupMotion 추가 (팝업 등장 / 퇴장 배율·딤 전환기)
  - UIToast 추가 (줄 세워 보여 주는 알약 알림)
  - UIDialog 추가 (딤 + 카드 + 확인 / 취소 대화 상자)
- misc
  - PathFinder(A*), Grid(플러드필 / 연결 검사 / 사각형 겹침), Collision2D, Steering2D 추가
  - Camera2D 추가 (팬 / 줌 / 관성 / 추적 / 경계 / 트윈, 앵커 보존 줌)
  - PointerGesture(탭 / 드래그 / 길게 누름), Shaker(화면 흔들림), FocusNavigator(방향키 포커스 이동) 추가
  - PersistedStore(버전 붙은 저장소), Localization(다국어 표), LocalStorage.clearByPrefix 추가
  - Typewriter, DialogueRunner / DialogueScriptParser(대화 스크립트), SpriteAnimator, PlatformerBody, FloatingText, BeepPlayer 추가
- 검증: 순수 로직 Node 테스트 83건(41 + 42) 통과, 헤드리스 크롬 스모크 26건 통과
- UIListView 추가 (재활용 리스트 — 템플릿 노드 + 데이터 수만 받아 보이는 범위만 생성 / 회수, 끝 도달 알림으로 무한 스크롤)
- TimeManager: 프레임 시간을 [0, 0.25초]로 제한 (타이머 역행 / 백그라운드 탭 복귀 시 튀는 dt 방지)
- SkinnedModel: 애니메이션 없는 정적 모델도 기본 포즈로 그려지도록 수정
- UI 쇼케이스 전면 개편: 기준 해상도 1440x900 고밀도 레이아웃, 왼쪽 레일 내비, 절제된 팔레트,
  목록 항목은 문서에 굽지 않고 템플릿 + 데이터로 동적 생성 (상품 500건 무한 스크롤 + 로딩 줄, 구매 기록, 대사 패널)
- NEON HORIZON: 셰이더 실루엣 전투순양함을 실제 3D 모델로 교체 (Quaternius 'Ultimate Spaceships' Executioner, CC0)
  — 엔진 SkinnedModel GLB 경로 사용, 선미 엔진 글로우 / 기함 주포는 투영 앵커로 유지
- UILabel: getTextAlign / getTextBaseline 추가, UIDocument 가 라벨 정렬을 저장 / 복원하도록 보강
- 위젯 대량 추가: UIDropdown(콤보박스), UIContextMenu(우클릭 메뉴), UISpinner(회전 인디케이터),
  UILineChart / UIBarChart(실시간 차트), UIDraggable(드래그 앤 드롭, 스냅백 / settleHere)
- UIButton: 길게 누름(setLongPressedEvent / setLongPressSeconds, 발화 시 클릭 삼킴), 눌림 경과 시간 조회 추가
- UIToast: 가로 표시 자리(setRestX) / 글자 크기 옵션 추가
- ParticleSystem / TrailRenderer 추가 (유니티식 2D 파티클 — rate / burst / shape(point·circle·cone·box·edge) /
  수명·속도·크기·회전·색 시작 범위 / 수명 그라디언트 / 중력·감쇠 / 가산 합성 / 월드 공간, 트레일 띠)
- UI 쇼케이스를 "VANILLA CONSOLE" 앱으로 전면 재구성: 실시간 대시보드(라인 / 바 차트, KPI, 이벤트 피드),
  스토어(카트 선택 / 해제 / 클리어 / 체크아웃, 스피너 로딩 줄), 설정(드롭다운 포함), 컴포넌트 플레이그라운드
  (버튼 상태 / 롱프레스 / 컨텍스트 메뉴 / 드래그 / 스피너 / 타자기 / 차트) — 화면 좌우 여백 제거(stretchShortExpandLong + 우측 앵커)
- EFFECTS 샘플 추가 (파티클 놀이터 — 불 / 분수 / 눈 / 색종이 / 폭발 / 불꽃놀이 / 마법 궤적)
- 쇼케이스 테마 선택 추가 (Dim 기본 / Dark / Light — 문서 색을 역할로 캐시해 즉시 리매핑, localStorage 저장)
- Graphic: 정점 색 배치 경로 추가 (파티클 전용 셰이더 + 단일 업로드 — 시스템당 드로우 1회) / 부드러운 원 텍스처
- ParticleSystem: 배치 렌더 전환(수백 배 드로우콜 절감), blendMode 선택(lighter/multiply/screen), 어트랙터(끌림+소용돌이),
  워블(살랑임), streak 렌더(비/유성), applyDescription(vfx JSON 애셋 로드)
- EFFECTS 샘플 V2: 세그먼트 탭 + 무대 상자(Mask 클리핑) + 전 모드 자동 무한 반복, 12모드로 확충
  (불/분수/눈/비/색종이/폭발/불꽃놀이/별가루/불씨/거품/소용돌이/궤적), 모드 전환 시 파티클 정리
- 파티클 편집기 tools/particleeditor 추가 (라이브 프리뷰 + 전체 속성 인스펙터 + 프리셋 9종 + .vfx.json 저장/불러오기)
- Engine.run: 기본 폰트(CDN) 로드가 실패하거나 늦어도 씬 로드 / 렌더 루프가 막히지 않게 수정

# 0.2.2 (2026-08-30)
- 렌더러 교체: Canvas 2D -> WebGL2
- WebGL2 3D 샘플 추가 (NEON HORIZON / ancientmountain) — 절차적 지형, 블룸, 파티클, 함대 연출
- FBX 로더에 스키닝 / PBR 머터리얼 / 애니메이션 클립 처리 추가
- SkinnedModel 을 데이터와 자세만 갖도록 정리하고 렌더링은 SkinnedModelRenderer 로 분리
- Material 추가 (셰이더 템플릿 + PBR 계수 + 텍스처 슬롯)
- UI 문서 형식 UIDocument 추가 (uiasset json 저장 / 복원)
  - 노드와 컴포넌트 종류 등록 API (registerNodeType / registerComponentType)
  - 전용 처리기가 없는 컴포넌트는 get/set 짝으로 저장 / 복원
  - 노드 참조를 UI 뿌리 기준 절대 경로로 기록 ({ "$nodeRef": "/Panel/Slider/Thumb" })
- UI 편집기 tools/uieditor 추가 (서버 없이 파일 하나로 실행)
- 컴포넌트 Enable 이 렌더링에 반영되도록 수정 (WorldNode / TransformNode 가 draw 전에 isEnable 확인)
- UISlider: thumb 을 자식 노드로 대신 쓸 수 있는 setThumbNode / getThumbNode 추가
- UIButton: 마우스가 올라간 상태(hover) 처리와 색 / 이벤트 설정 추가
- UIView: 배경 기본색을 투명으로 변경
- UIProgressView 를 import.js 에 추가
- Paint: getRoundSize 추가
- WorldNode.getWorldBounds 가 첫 모서리를 빠뜨리던 것 수정
- Pane: 구분선 두께를 PaneTheme.size.resizer 로 정할 수 있게 추가
- Pane: 구분선을 잡은 지점 기준으로 끌고, 누를 때 브라우저 기본 끌기를 막아 첫 드래그가 죽던 문제 수정
- UI 편집기: 뿌리도 다른 노드와 같게 다룬다. 뿌리 크기가 곧 문서 크기다.

# 0.2.1 (2026-08-02)
- 엑셀 도구 추가
- 입력 처리기 추가 및 휠 입력 처리
- WorldNode 에 앵커드포지션 추가
- Label ==> Text 변경
- UINode 관련 작업 및 UI 구조/컴포넌트 위치 정리
- AnchoredWorldNode 의존성 제거 및 마스크 분리
- Color 객체에 클론 기능 추가
- 활성화된 객체만 틱 처리가 되도록 처리
- 스크롤뷰가 버튼의 부모로 있을 때 스크롤뷰 우선 처리
- 데브툴즈 관련 수정
    - 네이티브 해상도를 따르도록 수정
    - 이미지 안티앨리어싱 처리 설정 추가
- 모바일 웹브라우저 화면 해상도 처리 오류 수정
- 입력필드 관련 오류 수정
- 오디오 컨텍스트 경고 관련 수정
- AudioManager.resumeContext() 에서 iOS WebKit 비표준 "interrupted" 상태 복구 처리

# 0.2.0 (...)
- 컴포넌트 이름 수정 및 위치 변경
- UIBuilder ==> NodeLayout
- 데브툴즈 관련 설정 및 기능 추가
    - 데브툴즈를 켤때 현재 모든 노드의 기즈모를 보이기/감추기 할 것인지 프로퍼티
    - 데브툴즈를 켜고 있는 중에 뷰렉트의 해상도 비율 가이드라인을 보여줄 것인지 프로퍼티


# 0.1.0 (2026-04-13)
- 런타임에서 엔진 상태 파악을 위한 DEVTools 추가
- LocalStorage 추가
- ViewScaleMode 3종 추가 및 정리
- Node 구조 개선
- TouchRaycaster 추가

# 0.0.11 (2026-04-08)
- UIBuilder 추가
- ScrollViewComponent, SnapScrollViewComponent, ToggleButtonComponent 추가
- VirtualPad 추가
- ViewManager.getViewSize() 추가
- WebSocketClient 추가

# 0.0.10 (2026-04-05)
- AudioManager 추가.
- AudioContext 소실시 복원 처리.

# 0.0.9 (2026-04-03)
# 0.0.8 (2026-03-30)
# 0.0.7 (2026-03-30)
# 0.0.6 (2026-03-29)
# 0.0.5 (2026-03-27)
# 0.0.4 (2026-03-27)
# 0.0.3 (2026-03-26)
# 0.0.2 (2026-03-25)
# 0.0.1 (2026-03-18)