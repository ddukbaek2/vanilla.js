# OLD FACE 자산 짓기 (ICT FaceKit + 절차 텍스처)

얼굴 메시, 눈, 이, 속눈썹, 눈 가림과 표정 셰이프는 ICT FaceKit(https://github.com/USC-ICT/ICT-FaceKit , MIT, Copyright (c) 2020 USC Institute for Creative Technologies)의 FaceXModel 을 옮긴다. 피부, 주름, 눈, 이 텍스처와 머리카락, 턱수염, 콧수염, 눈썹 카드는 원본 그림 없이 절차로 굽는다. 결과는 `../../assets` 에 같은 이름으로 쓴다.

준비물
- Python 3.12 + numpy, scipy, Pillow
- Blender 5.2 (LOD1, 2 를 줄일 때만)
- ICT FaceKit 의 `FaceXModel` 폴더(generic_neutral_mesh.obj, vertex_indices.json, 표정 OBJ 53 개). 받은 자료는 빈 폴더에 두고 아래 스크립트는 그 밖에서 `python -I` 로 돌린다.

순서 (`W` 는 작업 폴더, `A` 는 `examples/oldface/assets`)
1. `python -I parseict.py <FaceXModel> W/ict.npz` : OBJ 를 읽어 정점, UV, 삼각형(재질별), 표정 델타를 npz 로.
2. `python -I build_head.py W/ict.npz W A` : 두 눈 가운데를 (0, 1.6785, 0.09) m, 눈 사이를 6 cm 로 옮기고 부분을 나눠 `character_lod0.glb` 와 `W/parts.npz`, `W/head_info.json` 을 쓴다.
   - 부분: head(M_Face + M_BackHead), teeth(M_Teeth + M_GumsTongue), eyeLeft, eyeRight(공막 겉면), eyeshell(M_EyeOcclusion), eyelashes, eyeEdge(M_LacrimalFluid + M_EyeBlend). ICT 에는 침(saliva) 메시가 없다.
   - UV 는 ICT 의 UDIM 꼴(u 0..7)을 한 장(0..1)에 다시 붙인다. 얼굴 0..0.75, 뒷머리 0.75..1, 이 0..0.5, 잇몸과 혀 0.5..1.
   - 눈알 UV 는 각막 축 둘레 등거리 방위 투영으로 새로 준다. 각막이 구에서 솟기 시작하는 각(35 도)이 셰이더 홍채 반경 0.133 에 온다.
   - 표정 53 은 ARKit 대문자 이름으로 바꾼다(browInnerUp, cheekPuff 는 좌우를 더해 51 개, TongueOut 은 없음). ICT 는 시선 셰이프에서 눈꺼풀만 움직이므로 눈알에는 25 도 회전을 EyeLook* 셰이프로 굽는다.
3. `Blender -b --factory-startup -P decimate_blender.py -- W/parts.npz W/lod1.npz 0.5` (LOD2 는 0.25) : 머리와 이를 줄인다.
4. `python -I build_head.py W/ict.npz W A W/lod1.npz W/lod2.npz` : 줄인 정점마다 같은 부분의 가장 가까운 원 정점 델타를 써서 `character_lod1.glb`, `character_lod2.glb`.
5. `python -I bake_skin.py W/ict.npz <FaceXModel>/vertex_indices.json W A` : 머리 UV 에 삼각형을 래스터해 텍셀마다 3D 자리와 노멀을 얻고, ICT 얼굴 랜드마크 68 개로 영역(이마, 미간, 눈꼬리, 눈 밑, 팔자, 입술, 목)을 잡아 굽는다.
   - head_albedo, head_normal, head_roughness(R 차폐, G 거칠기), head_specular, skin_detail(모공과 나이 든 주름 높이), skin_micro(타일)
   - wrinkle_masks.png(4x4 타일 RGBA, 영역 16 채널), wrinkle_normal.jpg, wrinkle_color.jpg(2x2 타일, 주름 맵 셋), wrinkles.json(채널 -> 영역과 주름 맵, ARKit 셰이프 -> 영역 가중치)
   - teeth_albedo, teeth_normal, eye_sclera, eye_sclera_normal, eye_iris, eye_iris_normal, eye_occlusion, eyelash
6. `python -I build_hair.py W/ict.npz <FaceXModel>/vertex_indices.json W A` : 머리 표면에 뿌리를 뿌려 가닥을 중력과 흐름 방향으로 뻗고 리본 카드(양면)를 지어 `hair_lod0..4.glb`(hair, beard, mustache, eyebrows). 카드 정점은 뿌리 얼굴 정점의 모프 델타를 받는다(머리카락은 4 mm 미만 움직이는 셰이프를 버림). 텍스처 hair, beard, mustache, eyebrows(rgb 색, a 커버리지)와 탄젠트(rgb 가닥 방향, a 뿌리 0 -> 끝 1).

`expressions.json`(ARKit 이름 가중치 프리셋)은 손으로 쓴 것이다.
