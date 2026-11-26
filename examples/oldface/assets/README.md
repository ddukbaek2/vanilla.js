# OLD FACE 자산

| 파일 | 출처 | 라이선스 |
| --- | --- | --- |
| `character_lod0.glb`, `character_lod1.glb`, `character_lod2.glb` | ICT FaceKit(FaceXModel)의 위상, UV, 눈, 이, 속눈썹, 눈 가림과 표정 셰이프(ARKit 이름으로 바꿈), https://github.com/USC-ICT/ICT-FaceKit . 중립 머리를 아래 Infinite 머리 스캔 꼴로 감쌌다(`../tools/ictfacekit/fit_scan.py`). 그 뒤 옮기고 줄였다 | MIT, Copyright (c) 2020 USC Institute for Creative Technologies. 머리 꼴은 아래 스캔(CC BY 3.0) |
| `head_albedo.jpg`, `head_normal.jpg`, `skin_detail.jpg`, `head_roughness.jpg`, `head_specular.jpg` | "Infinite, 3D Head Scan" by Lee Perry-Smith(Infinite-Realities, I-R Entertainment Ltd.), based on a work at www.triplegangers.com. McGuire Computer Graphics Archive 사본(`lpshead.zip`, https://casual-effects.com/data/ )에서 받았다. 바꾼 것: 색과 변위를 ICT UV 로 다시 구움(`../tools/ictfacekit/bake_scan.py`), 수염 자국과 눈썹을 지우고 수염 그늘을 걷음, 피부 빛을 옮김, 변위를 노멀과 디테일 높이로 나눔, 거칠기와 스펙큘러를 지음 | CC BY 3.0, https://creativecommons.org/licenses/by/3.0/ |
| 그 밖의 텍스처, `hair_lod0..4.glb`, `wrinkles.json`, `expressions.json` | 이 저장소에서 지었다. 텍스처와 머리카락 카드는 `../tools/ictfacekit` 이 원본 그림 없이 절차로 굽는다 | 이 저장소의 MIT |

Infinite 머리 스캔 라이선스 원문(받은 묶음의 `Infinite-Scan_License.txt`)

```text
Creative Commons Licence
Infinite, 3D Head Scan by Lee Perry-Smith is licensed under a Creative Commons Attribution 3.0 Unported License.
Based on a work at www.triplegangers.com.
Permissions beyond the scope of this license may be available at http://www.ir-ltd.net/
Please remember: Do what you want with the files, but always mention where you got them from...
```

ICT FaceKit 라이선스 원문

```text
MIT License

Copyright (c) 2020 USC Institute for Creative Technologies

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE.
```
