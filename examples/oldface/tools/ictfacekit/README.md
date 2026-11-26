# OLD FACE 자산 짓기 (ICT FaceKit + Infinite 머리 스캔 + 절차 텍스처)

얼굴 메시, 눈, 이, 속눈썹, 눈 가림과 표정 셰이프는 ICT FaceKit(https://github.com/USC-ICT/ICT-FaceKit , MIT, Copyright (c) 2020 USC Institute for Creative Technologies)의 FaceXModel 을 옮긴다. 중립 머리 꼴과 피부 텍스처(알베도, 노멀, 디테일 높이, 거칠기, 스펙큘러)는 "Infinite, 3D Head Scan" by Lee Perry-Smith(CC BY 3.0, based on a work at www.triplegangers.com)에서 온다. McGuire Computer Graphics Archive 의 `lpshead.zip`(https://casual-effects.com/data/ , head.OBJ, lambertian.jpg 4096, bump.png 6000 16 비트 변위, Infinite-Scan_License.txt)을 쓴다. 주름, 눈, 이 텍스처와 머리카락, 턱수염, 콧수염, 눈썹 카드는 원본 그림 없이 절차로 굽는다. 결과는 `../../assets` 에 같은 이름으로 쓴다.

준비물
- Python 3.12 + numpy, scipy, Pillow
- Blender 5.2 (LOD1, 2 를 줄일 때만)
- ICT FaceKit 의 `FaceXModel` 폴더(generic_neutral_mesh.obj, vertex_indices.json, 표정 OBJ 53 개). 받은 자료는 빈 폴더에 두고 아래 스크립트는 그 밖에서 `python -I` 로 돌린다.

순서 (`W` 는 작업 폴더, `A` 는 `examples/oldface/assets`)
1. `python -I parseict.py <FaceXModel> W0/ict.npz` : OBJ 를 읽어 정점, UV, 삼각형(재질별), 표정 델타를 npz 로.
1-1. `python -I fit_scan.py W0/ict.npz <FaceXModel>/vertex_indices.json <lpshead>/head.OBJ W/ict.npz W/scan.npz` : ICT 중립 정점을 스캔 꼴로 감싼다(위상, UV, 표정 델타는 그대로). 스캔 기준점 15 개(정면 직교 렌더에서 고른 화면 자리, 스크립트의 표)로 닮음 변환과 가우스 RBF, 그 뒤 머리 겉면만 점-평면 ICP 를 메시 위에서 고르게 펴 붙인다. 스캔은 눈을 감고 있어 눈 구멍은 붙이지 않고, 눈꺼풀, 속눈썹, 눈 가림은 눈알과 같이 옮겨 눈알이 살을 뚫지 않게 한다. 눈알과 이는 모양을 지킨 채 통째로 옮긴다. 아래 단계의 `W/ict.npz` 는 이 결과다.
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
   - teeth_albedo, teeth_normal, eye_sclera, eye_sclera_normal, eye_iris(회청 바깥, 동공 둘레 호박빛, 방사 섬유와 틈), eye_iris_normal, eye_occlusion, eyelash(ICT 속눈썹 UV 의 띠 여섯마다 띠 아래 끝 뿌리에서 자라는 가닥, 위는 짙고 촘촘, 아래는 짧고 성김)
5-1. `python -I bake_scan.py W W/scan.npz <lpshead>/lambertian.jpg <lpshead>/bump.png A` : 머리 텍셀마다 가장 가까운 스캔 겉면 텍셀(스캔 UV 에 위치를 래스터한 KD 트리)에서 색과 변위를 가져와 head_albedo, head_normal(변위 중간 띠), skin_detail(고운 띠), head_roughness, head_specular 를 덮어쓴다. 털 자국(수염, 눈썹)은 지우고 둘레 살빛으로 메우고, 수염 그늘을 걷고, 눈 둘레 붉은 기를 줄이고, 볼 평균을 (0.62, 0.47, 0.40) 으로 옮기고, 두피에 머리카락 빛을 섞는다. bake_skin 이 쓴 절차 맵은 처음 돌 때 `W/procedural_*.jpg` 로 옮겨 두고 읽는다.
6. `python -I build_hair.py W/ict.npz <FaceXModel>/vertex_indices.json W A` : 머리 표면에 뿌리를 뿌려 가닥을 중력과 흐름 방향으로 뻗고 리본 카드(양면)를 지어 `hair_lod0..4.glb`(hair, beard, mustache, eyebrows). 카드 정점은 뿌리 얼굴 정점의 모프 델타를 받는다(머리카락은 4 mm 미만 움직이는 셰이프를 버림). 텍스처 hair, beard, mustache, eyebrows(rgb 색, a 커버리지: 칸 가운데로 몰린 가는 가닥, 가닥마다 뿌리와 끝이 다르고 끝으로 갈수록 가늘고 옅으며 뿌리는 조금 어둡고 누르스름하다)와 탄젠트(rgb 가닥 방향, a 뿌리 0 -> 끝 1). LOD0 카드는 머리 6000, 턱수염 2400, 콧수염 900, 눈썹 1000.

`expressions.json`(ARKit 이름 가중치 프리셋)은 손으로 쓴 것이다.
