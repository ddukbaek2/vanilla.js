import io

# OLD FACE 샘플을 메타휴먼(Taro DNA 로 구운 얼굴 메시 + ARKit 셰이프키) 애셋 구성으로 바꾼다.
path = "D:/Github/vanilla.js/examples/oldface/index.html"
text = io.open(path, encoding="utf-8").read()
edits = [
    ('CHARACTER: <a href="https://github.com/microsoft/Microsoft-Rocketbox" target="_blank" rel="noopener">MICROSOFT ROCKETBOX MALE ADULT 03 (MIT)</a>, EXPRESSIONS: ARKIT BLENDSHAPE PRESETS',
     'CHARACTER: <a href="https://www.metahuman.com/" target="_blank" rel="noopener">EPIC METAHUMAN (TARO DNA, RIGLOGIC BAKED TO ARKIT SHAPES)</a>, EXPRESSIONS: ARKIT BLENDSHAPE PRESETS'),
    ('''		{ keyword: "eyes", albedo: "head_albedo.jpg", normal: null, roughness: null, opacity: null, baseColorFactor: null, useDetail: false, roughnessFactor: 0.14, subsurfaceFactor: 0.0 },
		{ keyword: "head", albedo: "head_albedo.jpg", normal: "head_normal.jpg", roughness: "head_roughness.jpg", opacity: null, baseColorFactor: null, useDetail: true, roughnessFactor: 1.0, subsurfaceFactor: 1.0 },
		{ keyword: "body", albedo: "body_albedo.jpg", normal: "body_normal.jpg", roughness: "body_roughness.jpg", opacity: null, baseColorFactor: null, useDetail: false, roughnessFactor: 1.0, subsurfaceFactor: 0.5 },
		{ keyword: "opacity", albedo: "hair.png", normal: null, roughness: null, opacity: "hair.png", baseColorFactor: null, useDetail: false, roughnessFactor: 1.0, subsurfaceFactor: 0.0 },
''',
     '''		{ keyword: "eyeball", albedo: "eye_albedo.jpg", normal: null, roughness: null, opacity: null, baseColorFactor: null, useDetail: false, roughnessFactor: 0.14, subsurfaceFactor: 0.0 },
		{ keyword: "eyelashes", albedo: "eyelash.png", normal: null, roughness: null, opacity: "eyelash.png", baseColorFactor: null, useDetail: false, roughnessFactor: 1.0, subsurfaceFactor: 0.0 },
		{ keyword: "head", albedo: "head_albedo.jpg", normal: null, roughness: null, opacity: null, baseColorFactor: null, useDetail: true, roughnessFactor: 0.7, subsurfaceFactor: 1.0 },
		{ keyword: "teeth", albedo: "teeth_albedo.jpg", normal: null, roughness: null, opacity: null, baseColorFactor: null, useDetail: false, roughnessFactor: 0.45, subsurfaceFactor: 0.25 },
'''),
    ('// 애셋 로드. (Microsoft Rocketbox 중년 남성 glb — 골격 + ARKit 블렌드셰이프 52종, 부위별 텍스처는 직접 로드)',
     '// 애셋 로드. (메타휴먼 얼굴 glb — DNA 의 RigLogic 을 굽은 ARKit 셰이프키, 부위별 텍스처는 직접 로드)'),
    ('if (!drawable.materialName.includes("eyes")) {', 'if (!drawable.materialName.includes("eyeball")) {'),
    ('''		albedo: await createThumbnail("head_albedo.jpg"),
		normal: await createThumbnail("head_normal.jpg"),
		roughness: await createThumbnail("head_roughness.jpg"),
		detail: await createThumbnail("skin_detail.jpg"),
		body: await createThumbnail("body_albedo.jpg"),
		hair: await createThumbnail("hair.png"),
''',
     '''		albedo: await createThumbnail("head_albedo.jpg"),
		detail: await createThumbnail("skin_detail.jpg"),
		eye: await createThumbnail("eye_albedo.jpg"),
		teeth: await createThumbnail("teeth_albedo.jpg"),
		eyelash: await createThumbnail("eyelash.png"),
'''),
    ('''		const leftClosed = System.Math.max(expressionState.currentWeights.get("AK_09_EyeBlinkLeft") || 0, blink);
		const rightClosed = System.Math.max(expressionState.currentWeights.get("AK_10_EyeBlinkRight") || 0, blink);
		headModel.setMorphWeight("AK_09_EyeBlinkLeft", leftClosed);
		headModel.setMorphWeight("AK_10_EyeBlinkRight", rightClosed);
''',
     '''		const leftClosed = System.Math.max(expressionState.currentWeights.get("EyeBlinkLeft") || 0, blink);
		const rightClosed = System.Math.max(expressionState.currentWeights.get("EyeBlinkRight") || 0, blink);
		headModel.setMorphWeight("EyeBlinkLeft", leftClosed);
		headModel.setMorphWeight("EyeBlinkRight", rightClosed);
'''),
    ('''					{ label: "ALBEDO 2K", image: thumbnails.albedo },
					{ label: "NORMAL 2K", image: thumbnails.normal },
					{ label: "ROUGH 2K", image: thumbnails.roughness },
					{ label: "DETAIL 4K", image: thumbnails.detail },
''',
     '''					{ label: "ALBEDO", image: thumbnails.albedo },
					{ label: "DETAIL 4K", image: thumbnails.detail },
'''),
    ('''				title: "BODY, EYES AND HAIR",
				isActive: true,
				lines: ["eyes from the head atlas, hair and brow cards with alpha cutout", "no subsurface on eyes and hair"],
				thumbnails: [
					{ label: "BODY 2K", image: thumbnails.body },
					{ label: "HAIR CARDS", image: thumbnails.hair },
				],
''',
     '''				title: "EYES, TEETH AND LASHES",
				isActive: true,
				lines: ["metahuman eye atlas (sclera and iris), teeth, lash cards with alpha cutout", "no subsurface on eyes and lashes"],
				thumbnails: [
					{ label: "EYE", image: thumbnails.eye },
					{ label: "TEETH", image: thumbnails.teeth },
					{ label: "LASHES", image: thumbnails.eyelash },
				],
'''),
    ('lines: ["preset " + expressionState.activeName + ", " + morphTargetCount + " ARKit units, " + activeUnitCount + " active", "blink from eye blink units, head via bones"],',
     'lines: ["preset " + expressionState.activeName + ", " + morphTargetCount + " ARKit shapes baked from RigLogic, " + activeUnitCount + " active", "blink from eye blink shapes"],'),
]
for old, new in edits:
    count = text.count(old)
    assert count == 1, (count, old[:80])
    text = text.replace(old, new)
io.open(path, "w", encoding="utf-8", newline="").write(text)
print("patched", len(edits))
