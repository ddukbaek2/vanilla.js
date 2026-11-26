# 도구

엔진과 함께 쓰는 웹 저작 도구입니다. 브라우저에서 바로 열리고, 결과물은 JSON 문서로 저장됩니다.

| 도구 | 설명 | 데모 | 소스 |
| --- | --- | --- | --- |
| UI Editor | 노드 트리, 인스펙터, 캔버스 편집으로 UI 화면을 짜고 `.uiasset.json` 으로 저장 | [열기](https://vanillapunch.com/tools/editor/uieditor/) | [`tools/uieditor`](https://github.com/ddukbaek2/vanilla.js/blob/release/tools/uieditor) |
| Particle Editor | 파티클 프리셋 저작. 미리보기에서 값을 바꾸며 조정 | [열기](https://vanillapunch.com/tools/editor/particleeditor/) | [`tools/particleeditor`](https://github.com/ddukbaek2/vanilla.js/blob/release/tools/particleeditor) |
| Timeline Editor | 유니티 타임라인 / 언리얼 시퀀서 쓰임새의 키프레임 저작. 도프 시트 + 커브, 자동 키, 이벤트 / 마커 | [열기](https://vanillapunch.com/tools/editor/timelineeditor/) | [`tools/timelineeditor`](https://github.com/ddukbaek2/vanilla.js/blob/release/tools/timelineeditor) |
| Visual Editor | 유니티처럼 도킹 창(하이어라키, 씬, 게임, 인스펙터, 프로젝트, 콘솔)을 갖춘 통합 편집기. 폴더 열기, 프리팹, 되돌리기, 재생. 씬은 UIDocument 형식(`.scene.json`)으로 저장 | [열기](https://vanillapunch.com/tools/editor/visualeditor/) | [`tools/visualeditor`](https://github.com/ddukbaek2/vanilla.js/blob/release/tools/visualeditor) |

명령줄 도구는 Node.js 로 실행합니다. 자세한 사용법은 [`tools/TOOLS.md`](https://github.com/ddukbaek2/vanilla.js/blob/release/tools/TOOLS.md) 에 있습니다.

| 명령 | 설명 |
| --- | --- |
| `node tools/atlas.cjs <폴더>` | 이미지 여러 장을 텍스처로 묶기 (MaxRects, 넘치면 여러 장, `SpriteAtlas` 가 읽음) |
| `node tools/project.cjs build --script <진입> --input <입력> --output <출력>` | 템플릿 복사와 esbuild 번들링 |
| `node tools/project.cjs check --input <입력>` | 자산 현황 점검 |
| `node tools/project.cjs stage --source <소스> --destination <대상>` | 배포할 폴더로 복사 |
| `node tools/webm.cjs <폴더>` | 음원을 webm 으로 변환 |
| `node tools/mangle.cjs <입력> <출력> <제외 문자열>` | 코드 내 문자열 정리 |
| `node tools/apidoc.cjs <버전>` | 공개 API 문서 자료(`docs/api/<버전>.json`) 뽑기 |

`tools/excel.cjs` 는 엑셀(xlsx)과 JSON, 데이터 클래스 소스를 오가는 함수 모음입니다. `module.exports` 로 함수만 내보내고 명령줄 진입점이 없어서 `node tools/excel.cjs` 로 혼자 실행하면 아무것도 하지 않습니다. 다른 스크립트에서 `require` 로 불러 쓰고, 쓰는 프로젝트에 npm 패키지 `xlsx` 가 깔려 있어야 합니다. `tools/table.cjs` 는 지금 빈 파일입니다.

## 명령줄 도구 사용법 (tools/TOOLS.md)

### 이미지 파일 목록을 하나의 텍스쳐로 묶어주는 도구.
```bash
node tools/atlas.cjs <폴더경로> [--extrude 픽셀] [--padding 픽셀] [--max-size 쪽 상한]
```

### 프로젝트 도구. (빌드 / 자산 현황 체크 / 배포 복사)
```bash
node tools/project.cjs build --script <진입파일> --input <입력디렉토리> --output <출력디렉토리> [-t|--template <빌드템플릿경로>]
node tools/project.cjs check --input <입력디렉토리>
node tools/project.cjs stage --source <소스디렉토리> --destination <대상디렉토리> [--skip <이름1,이름2,...>]
```
- build: 출력 디렉토리를 비우고 빌드 템플릿(기본 tools/buildtemplate, -t 나 --template 로 바꿈)과 <입력>/assets 를 복사한 뒤 진입 파일을 esbuild 로 묶어 <출력>/js/bundle.min.js 에 쓴다. (iife, --minify --keep-names)
- check: <입력>/assets/sprites 아래 그림과 아틀라스 현황 보고. (npm 패키지 canvas 가 필요하다)
- stage: 소스 디렉토리를 대상 디렉토리로 복사한다. (대상은 먼저 비운다, --skip 에 쉼표로 준 맨 위 이름은 건너뛴다)

### 여러 종류의 음원을 webm 형식으로 변환해주는 도구.
```bash
node tools/webm.cjs <폴더경로>
```

### 코드 내 문자열 추가 정리 도구.
```bash
node tools/mangle.cjs <입력파일> <출력파일> <추가로 제외할 문자열>
```

### 엔진 API 문서 자료(JSON)를 뽑는 도구. (외부 의존 없음, node 내장 모듈만 씀)
```bash
node tools/apidoc.cjs <버전> [--date YYYY-MM-DD]
node tools/apidoc.cjs <버전> --missing
node tools/apidoc.cjs <버전> --check
```
- 첫 줄: import.js 가 내보내는 공개 API(클래스, 멤버, 모듈 함수와 상수, 열거)를 소스 주석과 JSDoc 에서 읽어 docs/api/<버전>.json 을 쓴다. #이름, 밑줄로 시작하는 이름, JSDoc @private 멤버는 뺀다.
- 설명의 ko 는 소스 주석 원문(긴 줄표와 가운뎃점만 쉼표로 바꿈), en 은 docs/api/translation.en.json(ko 원문 → en) 표에서 가져온다. 표에 없는 ko 는 en 을 빈 글로 두고 몇 개인지 알린다.
- since 는 v0.0.8 부터 그 판 앞까지의 태그를 훑어 그 클래스(이름으로 찾음)에 그 멤버가 처음 있던 판이다. 어느 태그에도 없으면 그 판.
- date 는 --date, UPDATE.md 의 "# <버전> (YYYY-MM-DD)", 이미 있는 자료의 날짜, 오늘 차례로 정한다.
- --missing: 표에 없는 ko 글 목록을 JSON 배열로 낸다. 옮긴 것을 translation.en.json 에 더하고 첫 줄을 다시 돌려 en 빈 칸을 0 으로 만든다.
- --check: docs/api/<버전>.json 의 꼴(설명 칸이 { ko, en } 인지, kind, since)을 검사하고 모듈, 클래스, 멤버, 함수, 열거 수와 en 빈 칸 수, since 분포를 찍는다.
- 가이드(docs/guide/<버전>/ko, en)와 업데이트(docs/update/<버전>.ko.md, .en.md)는 손으로 옮긴다. 업데이트 ko 는 UPDATE.md 의 그 판 절이다.
