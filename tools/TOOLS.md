# 개발 보조 도구

## 이미지 파일 목록을 하나의 텍스쳐로 묶어주는 도구.
node tools/atlas.cjs <폴더경로> [--extrude 픽셀] [--padding 픽셀] [--max-size 쪽 상한]

## 프로젝트 도구. (빌드 / 자산 현황 체크 / 배포 복사)
node tools/project.cjs build --script <진입파일> --input <입력디렉토리> --output <출력디렉토리> [-t|--template <빌드템플릿경로>]
node tools/project.cjs check --input <입력디렉토리>
node tools/project.cjs stage --source <소스디렉토리> --destination <대상디렉토리> [--skip <이름1,이름2,...>]
- build: 출력 디렉토리를 비우고 빌드 템플릿(기본 tools/buildtemplate, -t 나 --template 로 바꿈)과 <입력>/assets 를 복사한 뒤 진입 파일을 esbuild 로 묶어 <출력>/js/bundle.min.js 에 쓴다. (iife, --minify --keep-names)
- check: <입력>/assets/sprites 아래 그림과 아틀라스 현황 보고. (npm 패키지 canvas 가 필요하다)
- stage: 소스 디렉토리를 대상 디렉토리로 복사한다. (대상은 먼저 비운다, --skip 에 쉼표로 준 맨 위 이름은 건너뛴다)

## 여러 종류의 음원을 webm 형식으로 변환해주는 도구.
node tools/webm.cjs <폴더경로>  

## 코드 내 문자열 추가 정리 도구.
node tools/mangle.cjs <입력파일> <출력파일> <추가로 제외할 문자열>

## 엔진 API 문서 자료(JSON)를 뽑는 도구. (외부 의존 없음, node 내장 모듈만 씀)
node tools/apidoc.cjs <버전> [--date YYYY-MM-DD] [--counterpart <러스트 판 짝 표>]
node tools/apidoc.cjs <버전> --missing [--only <경로 앞>] [--exclude <경로 앞>]
node tools/apidoc.cjs <버전> --check
node tools/apidoc.cjs <버전> --gaps [--only <경로 앞>] [--exclude <경로 앞>]
node tools/apidoc.cjs <버전> --check-examples [--only <경로 앞>] [--exclude <경로 앞>] [--no-run] [--no-chrome] [--chrome <크롬 경로>]
- 첫 줄: import.js 가 내보내는 공개 API(클래스, 멤버, 모듈 함수와 상수, 열거)를 소스 주석과 JSDoc 에서 읽어 docs/api/<버전>.json 을 쓴다. #이름, 밑줄로 시작하는 이름, JSDoc @private 멤버는 뺀다.
- 설명의 ko 는 소스 주석 원문(긴 줄표와 가운뎃점만 쉼표로 바꿈), en 은 docs/api/translation.en.json(ko 원문 → en) 표에서 가져온다. 표에 없는 ko 는 en 을 빈 글로 두고 몇 개인지 알린다.
- since 는 v0.0.8 부터 그 판 앞까지의 태그를 훑어 그 클래스(이름으로 찾음)에 그 멤버가 처음 있던 판이다. 어느 태그에도 없으면 그 판.
- date 는 --date, UPDATE.md 의 "# <버전> (YYYY-MM-DD)", 이미 있는 자료의 날짜, 오늘 차례로 정한다.
- counterpart 는 러스트 판(vanilla-engine)의 짝이다. 클래스, 열거, 멤버, 모듈 함수와 상수, 열거 값(러스트 판이 연관 상수로 옮긴 것)에 { engine: "vanilla-engine", module, class, name } 로 붙는다. (없는 칸은 뺀다)
  - 짝 표는 docs/api/counterpart.<버전>.json 이다. 러스트 판 도구가 이 저장소 자료의 이름으로 짓고(`cargo run -p vanilla-engine-apidoc -- <버전> --counterpart <이 저장소의 docs/api/<버전>.json>`), 여기서는 --counterpart 로 그 표(러스트 판의 docs/api/counterpart.<버전>.json)를 이 저장소로 옮긴다. 자료를 쓸 때는 이 저장소의 표만 읽는다. (옆 저장소에 기대지 않는다)
  - 차례: 이 저장소 자료 쓰기, 러스트 판에서 짝 표 다시 짓기, 이 저장소에서 --counterpart 로 옮겨 다시 쓰기.
  - 러스트 판 짝이 여럿이면(속성 하나가 get_ 와 set_ 둘 같은) 이름이 같은 것, 읽기(get_, is_, has_), 표 차례 순으로 하나를 고른다. 표에 있지만 자료에 없는 이름은 몇 개인지 알린다. (표를 다시 지을 때)
- --missing: 표에 없는 ko 글 목록을 JSON 배열로 낸다. 옮긴 것을 translation.en.json 에 더하고 첫 줄을 다시 돌려 en 빈 칸을 0 으로 만든다.
- --check: docs/api/<버전>.json 의 꼴(설명 칸이 { ko, en } 인지, kind, since, 예제 칸, counterpart 칸)을 검사하고 모듈, 클래스, 멤버, 함수, 열거 수와 ko, en 빈 칸 수, 예제 수, 짝 수, since 분포를 찍는다. 필드와 정적 필드의 returns 는 값의 꼴만 담는 칸이라 설명이 비어도 ko 빈 칸으로 세지 않고 따로 센다. (값의 설명은 멤버 설명이 맡는다)
- --gaps: 소스에서 문서가 빈 곳을 파일마다 찍는다. 공개 API 의 빈 ko 설명(모듈 요약, 클래스 요약, 멤버, 매개변수, 반환, 열거와 그 값), 빈 매개변수 꼴, 값을 돌려주는 return 이 있는데 @returns 가 없는 함수, 예제 없는 클래스, 제 예제도 클래스 예제도 없는 모듈, 그리고 src 의 모든 파일에서 머리 주석 없는 비공개 함수(#이름, 밑줄 이름, @private, 공개 API 가 아닌 클래스의 메서드)와 떨어진 머리 주석(머리 주석과 JSDoc 뒤에 선언 없이 다른 머리 주석이 오는 옛 덩이, "목록" 으로 끝나지 않는 머리 주석 바로 뒤의 머리 주석). 줄 번호를 아는 것은 이름:줄 로 찍는다. 구획 머리말은 "멤버 변수 목록." 처럼 "목록" 으로 끝내야 한다. 아니면 바로 뒤 선언의 설명으로 읽힌다.
- --only, --exclude: --missing, --gaps, --check-examples 가 볼 파일을 저장소 기준 경로의 앞부분으로 거른다. (src/ui/, docs/guide/0.4.0/en/ 처럼, 여러 번 줄 수 있다)

### 예제 (@example)
- 모듈, 클래스, 멤버, 열거의 JSDoc 에 `@example` 을 쓰면 자료의 examples 칸이 된다. 예제가 없으면 칸이 없다.
  ```json
  "examples": [ { "title": { "ko": "만들고 더하고 길이 재기", "en": "Create, add and measure" }, "code": "import { Vector2 } from \"./build/vanilla.js\";\n...", "language": "javascript" } ]
  ```
- 제목은 `@example <caption>제목</caption>` 의 제목이 ko 이고 en 은 번역 표에서 온다. 제목이 없으면 ko, en 모두 빈 글이다. (빈 제목은 ko 빈 칸으로 세지 않는다)
- 코드는 태그 다음 줄부터 다음 태그 앞까지다. 앞뒤 빈 줄과 모든 줄에 같이 붙은 들여쓰기는 뺀다. @example 은 JSDoc 블록의 맨 끝에 둔다. (코드의 중괄호가 다음 태그 읽기를 흐리지 않게)
- 클래스 예제는 클래스 머리 주석과 class 사이의 JSDoc 블록에, 멤버 예제는 그 멤버의 JSDoc 블록에, 모듈 예제는 어느 선언에도 붙지 않은 깊이 0 의 JSDoc 블록(앞뒤에 빈 줄)에 쓴다. 클래스가 없는 모듈(Wait, Math, Reflection 같은)은 모듈 예제를 둔다.
- 예제 꼴: 첫 줄은 `import { ... } from "./build/vanilla.js";` 이고 엔진의 실제 이름만 쓴다. 코드에 한글을 넣지 않는다. (사이트가 ko, en 을 바꿔 보이므로 설명은 제목으로) 그대로 붙여 넣어 도는 코드여야 한다. 애셋 주소는 저장소에 실제로 있는 파일을 저장소 루트 기준으로 쓴다. (examples/assets/spritesheet.png, examples/assets/beep.wav, examples/assets/DOSGothic.woff 같은)

### 예제 검사 (--check-examples)
- 공개 API 의 예제와 가이드(docs/guide/<버전>/<언어>/*.md)의 javascript, js, html 코드 칸을 모두 검사한다. html 칸은 그 안의 `<script type="module">` 을 돌린다.
- 문법: 엔진 import 를 const 로 바꾼 뒤 async 함수 몸으로 읽힌다. (top-level await 를 쓸 수 있다)
- 이름: import.js 를 node 로 불러, 불러온 이름이 엔진에 있는지, `불러온이름.멤버` 가 있는지, `const 이름 = new 클래스(...)` 나 `const 이름 = 클래스.정적함수(...)`(@returns 꼴이 엔진 클래스일 때)로 만든 이름의 `이름.멤버` 가 그 클래스(프로토타입 사슬, 필드, 생성자가 this 에 넣는 이름)에 있는지 본다. 엔진 밖 모듈을 불러오면 실패다. API 예제와 en 가이드 예제에 한글이 있어도 실패다.
- 돌려 보기: 엔진 import 를 import.js 의 파일 주소로 바꿔 node 워커(예제마다 새 워커, 4 개씩)로 돌린다. 던진 오류, 처리되지 않은 거부, console.error 가 있으면 node 에서 실패로 치고, 그 예제와 html 칸은 헤드리스 크롬으로 다시 돌린다. 크롬에서도 실패하면 실패다.
- 크롬 단계: 노드 내장 http 로 저장소를 루트로 하는 정적 서버를 띄우고, 크롬 하나를 창 없이(--headless=new) 임시 프로필로 띄운다. 실행 페이지가 예제마다 iframe(640x360, 저장소 루트 기준 주소)을 만들어 4 개씩 돌리고, 모듈이 다 돈 뒤 1 초 동안 오류, 처리되지 않은 거부, console.error 를 모은다. 10 초 안에 모듈이 끝나지 않으면 실패다. 결과를 받으면 크롬과 서버를 바로 끄고 임시 프로필을 지운다. 크롬은 --chrome, 환경 변수 CHROME_PATH, 흔한 설치 자리 차례로 찾고, 없거나 --no-chrome 이면 크롬 단계를 건너뛰고 "돌리지 못함" 으로 센다. (외부 npm 의존 없음)
- --no-run 은 문법과 이름만 본다. 실패가 하나라도 있으면 끝 코드가 1 이다.
- 가이드(docs/guide/<버전>/ko, en)와 업데이트(docs/update/<버전>.ko.md, .en.md)는 손으로 옮긴다. 업데이트 ko 는 UPDATE.md 의 그 판 절이다.
