# 개발 보조 도구

## 이미지 파일 목록을 하나의 텍스쳐로 묶어주는 도구.
node tools/atlas.cjs <폴더경로>

## 프로젝트 도구. (빌드 / 자산 현황 체크)
node tools/project.cjs build --script <진입파일> --input <입력디렉토리> --output <출력디렉토리>
node tools/project.cjs check --input <입력디렉토리>

## 여러 종류의 음원을 webm 형식으로 변환해주는 도구.
node tools/webm.cjs <폴더경로>  

## 코드 내 문자열 추가 정리 도구.
node tools/mangle.cjs <입력파일> <출력파일> <추가로 제외할 문자열>