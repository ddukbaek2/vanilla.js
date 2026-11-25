# 개발 보조 도구

## 이미지 파일 목록을 하나의 텍스쳐로 묶어주는 도구.
node tools/atlas.cjs <폴더경로> [--extrude 픽셀] [--padding 픽셀] [--max-size 쪽 상한]

## 프로젝트 도구. (빌드 / 자산 현황 체크)
node tools/project.cjs build --script <진입파일> --input <입력디렉토리> --output <출력디렉토리>
node tools/project.cjs check --input <입력디렉토리>

## 여러 종류의 음원을 webm 형식으로 변환해주는 도구.
node tools/webm.cjs <폴더경로>  

## 코드 내 문자열 추가 정리 도구.
node tools/mangle.cjs <입력파일> <출력파일> <추가로 제외할 문자열>

## 엔진 API 문서 자료(JSON)를 뽑는 도구. (외부 의존 없음, node 내장 모듈만 씀)
node tools/apidoc.cjs <버전> [--date YYYY-MM-DD]
node tools/apidoc.cjs <버전> --missing
node tools/apidoc.cjs <버전> --check
- 첫 줄: import.js 가 내보내는 공개 API(클래스, 멤버, 모듈 함수와 상수, 열거)를 소스 주석과 JSDoc 에서 읽어 docs/api/<버전>.json 을 쓴다. #이름, 밑줄로 시작하는 이름, JSDoc @private 멤버는 뺀다.
- 설명의 ko 는 소스 주석 원문(긴 줄표와 가운뎃점만 쉼표로 바꿈), en 은 docs/api/translation.en.json(ko 원문 → en) 표에서 가져온다. 표에 없는 ko 는 en 을 빈 글로 두고 몇 개인지 알린다.
- since 는 v0.0.8 부터 그 판 앞까지의 태그를 훑어 그 클래스(이름으로 찾음)에 그 멤버가 처음 있던 판이다. 어느 태그에도 없으면 그 판.
- date 는 --date, UPDATE.md 의 "# <버전> (YYYY-MM-DD)", 이미 있는 자료의 날짜, 오늘 차례로 정한다.
- --missing: 표에 없는 ko 글 목록을 JSON 배열로 낸다. 옮긴 것을 translation.en.json 에 더하고 첫 줄을 다시 돌려 en 빈 칸을 0 으로 만든다.
- --check: docs/api/<버전>.json 의 꼴(설명 칸이 { ko, en } 인지, kind, since)을 검사하고 모듈, 클래스, 멤버, 함수, 열거 수와 en 빈 칸 수, since 분포를 찍는다.
- 가이드(docs/guide/<버전>/ko, en)와 업데이트(docs/update/<버전>.ko.md, .en.md)는 손으로 옮긴다. 업데이트 ko 는 UPDATE.md 의 그 판 절이다.
