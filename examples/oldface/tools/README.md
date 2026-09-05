# OLD FACE 애셋 생성

캐릭터: Microsoft Rocketbox Avatar Library (MIT) 의 `Assets/Avatars/Adults/Male_Adult_05` — 얼굴용 FBX(`Export/Male_Adult_05_facial.fbx`, ARKit / FACS / 비짐 블렌드셰이프 포함)와 `Textures/m009_*.tga`.
https://github.com/microsoft/Microsoft-Rocketbox

1. `blender -b --python rocketbox_export.py -- <Male_Adult_05_facial.fbx> <assets/character.glb>`
   테이크 애니메이션 제거(남기면 루트 노드에 0.01 스케일이 남는다), cm 단위를 정점 / 셰이프키 / 본 데이터에 굽기, ARKit 키 52종만 유지, 눈 본 가중 폴리곤을 `m_eyes` 머티리얼로 분리.
2. `python rocketbox_textures.py <Textures 디렉토리> m009 <assets 디렉토리>`
   head / body 알베도 · 노멀 JPEG, 스페큘러 → ORM 러프니스, 헤어 카드 RGBA PNG.
3. `assets/expressions.json` 은 ARKit 블렌드셰이프 이름(`AK_44_MouthSmileLeft` 등)에 대한 가중치 프리셋이다. 샘플의 표정 버튼은 이 키를 그대로 쓴다.
