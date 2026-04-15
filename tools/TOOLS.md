# 개발 보조 도구

## 이미지 파일 목록을 하나의 텍스쳐로 묶어주는 도구.
node tools/atlas.cjs <폴더경로>

## 정해진 규약에 따라서 프로젝트 안의 파일들을 최종 출력 폴더로 복사해주는 도구. 
node tools/build.cjs --source <폴더경로> --target <대상>

## 여러 종류의 음원을 webm 형식으로 변환해주는 도구.
node tools/convertwebm.cjs <폴더경로>  

## 프로젝트 상태 확인.
node tools/projectchecker.cjs

## 코드 내 문자열 추가 정리 도구.
node tools/mangle.cjs <입력파일> <출력파일> <추가로 제외할 문자열>