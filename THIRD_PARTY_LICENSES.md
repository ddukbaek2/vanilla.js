# Third-Party Licenses

이 소프트웨어에 들어가는 제3자 코드와 자료의 라이선스 고지를 모은 파일입니다.
This file collects the license notices for the third-party code and materials built into this software.

- The engine has no runtime package dependencies. The bundles (`build/vanilla.js`, `build/vanilla.min.js`) and the web tools (`tools/uieditor`, `particleeditor`, `timelineeditor`, `visualeditor`) contain only the engine source, which includes the code and tables from other projects listed below.
- Files that are not in the bundles: the drafts in `src/experimental` (imported directly, see README), the examples and their assets, and the build tools (`tools/*.cjs`, which you install from npm yourself).
- The default font DOSGothic is not bundled. The engine loads it at run time from https://cdn.jsdelivr.net/gh/projectnoonnu/noonfonts_eight@1.0/DOSGothic.woff (`src/core/engine.js`), and the examples keep the same file as `examples/assets/DOSGothic.woff`. Its notice is in DOSGothic below.
- The example assets and where they come from are listed in Example Assets at the end.

## Bundled Materials

| Project | Engine files | In the bundles | In the web tools |
| --- | --- | --- | --- |
| Chromium and Blink | `src/ui/uiinputfield.js` (Blink BackspaceStateMachine, word positions); `src/core/browseruitext.js` (UI strings from the .xtb translations); `src/experimental/spatialaudio/spatialaudiomath.js` (Web Audio panner math, draft) | yes (the draft part is not) | UI editor, visual editor |
| tween.js and Robert Penner's easing equations | `src/core/tween.js` | yes | all four |
| Kiwi | `src/ui/autolayout/` | yes | UI editor, visual editor |
| gl-matrix | `src/base/matrix4.js` | yes | UI editor, visual editor |
| Separable SSS | `src/graphics3d/subsurfacescatteringeffect.js` | yes | UI editor |
| libtiled | `src/experimental/tilemap/tilemap.js` (draft) | no | no |
| Box2D | `src/experimental/physics2d/`, `src/experimental/spatial/dynamictree.js` (drafts) | no | no |
| Public domain and CC0 code (MurmurHash3 fmix32, ACES curve fit) | `src/effect/screeneffect.js`, `src/effect/shadersprite.js`, `src/graphics3d/toon/toonvfx.js`, `src/graphics3d/toon/toonpostprocess.js` | yes | wherever these files are bundled (no notice required) |

### Chromium and Blink

- `src/ui/uiinputfield.js`: third_party/blink/renderer/core/editing/state_machines/backspace_state_machine.cc and position_units_word.cc.
- `src/core/browseruitext.js`: the UI strings (the question window title and buttons, 82 locales) are translations from Chromium's generated_resources, ui_strings and components_strings .xtb files, copied through the Rust edition's `src/core/browseruitext.json`.
- `src/experimental/spatialaudio/spatialaudiomath.js` (draft): third_party/blink/renderer/modules/webaudio/panner_handler.cc, third_party/blink/renderer/platform/audio/distance_effect.cc, cone_effect.cc, equal_power_panner.cc, ui/gfx/geometry/vector3d_f.cc. Their notices are the Chromium license and the WebKit-era notices of the Rust edition's THIRD_PARTY_LICENSES.md (https://github.com/ddukbaek2/vanilla-engine/blob/release/THIRD_PARTY_LICENSES.md).

Files under "Copyright The Chromium Authors" are covered by the Chromium license:

````text
// Copyright 2015 The Chromium Authors
//
// Redistribution and use in source and binary forms, with or without
// modification, are permitted provided that the following conditions are
// met:
//
//    * Redistributions of source code must retain the above copyright
// notice, this list of conditions and the following disclaimer.
//    * Redistributions in binary form must reproduce the above
// copyright notice, this list of conditions and the following disclaimer
// in the documentation and/or other materials provided with the
// distribution.
//    * Neither the name of Google LLC nor the names of its
// contributors may be used to endorse or promote products derived from
// this software without specific prior written permission.
//
// THIS SOFTWARE IS PROVIDED BY THE COPYRIGHT HOLDERS AND CONTRIBUTORS
// "AS IS" AND ANY EXPRESS OR IMPLIED WARRANTIES, INCLUDING, BUT NOT
// LIMITED TO, THE IMPLIED WARRANTIES OF MERCHANTABILITY AND FITNESS FOR
// A PARTICULAR PURPOSE ARE DISCLAIMED. IN NO EVENT SHALL THE COPYRIGHT
// OWNER OR CONTRIBUTORS BE LIABLE FOR ANY DIRECT, INDIRECT, INCIDENTAL,
// SPECIAL, EXEMPLARY, OR CONSEQUENTIAL DAMAGES (INCLUDING, BUT NOT
// LIMITED TO, PROCUREMENT OF SUBSTITUTE GOODS OR SERVICES; LOSS OF USE,
// DATA, OR PROFITS; OR BUSINESS INTERRUPTION) HOWEVER CAUSED AND ON ANY
// THEORY OF LIABILITY, WHETHER IN CONTRACT, STRICT LIABILITY, OR TORT
// (INCLUDING NEGLIGENCE OR OTHERWISE) ARISING IN ANY WAY OUT OF THE USE
// OF THIS SOFTWARE, EVEN IF ADVISED OF THE POSSIBILITY OF SUCH DAMAGE.
````

Files that keep their WebKit-era headers carry these notices:

- position_units_word.cc (third_party/blink/renderer/core/editing/):

````text
Copyright (C) 2004, 2005, 2006, 2007, 2008, 2009 Apple Inc. All rights
reserved.

Redistribution and use in source and binary forms, with or without
modification, are permitted provided that the following conditions
are met:
1. Redistributions of source code must retain the above copyright
   notice, this list of conditions and the following disclaimer.
2. Redistributions in binary form must reproduce the above copyright
   notice, this list of conditions and the following disclaimer in the
   documentation and/or other materials provided with the distribution.

THIS SOFTWARE IS PROVIDED BY APPLE COMPUTER, INC. ``AS IS'' AND ANY
EXPRESS OR IMPLIED WARRANTIES, INCLUDING, BUT NOT LIMITED TO, THE
IMPLIED WARRANTIES OF MERCHANTABILITY AND FITNESS FOR A PARTICULAR
PURPOSE ARE DISCLAIMED.  IN NO EVENT SHALL APPLE COMPUTER, INC. OR
CONTRIBUTORS BE LIABLE FOR ANY DIRECT, INDIRECT, INCIDENTAL, SPECIAL,
EXEMPLARY, OR CONSEQUENTIAL DAMAGES (INCLUDING, BUT NOT LIMITED TO,
PROCUREMENT OF SUBSTITUTE GOODS OR SERVICES; LOSS OF USE, DATA, OR
PROFITS; OR BUSINESS INTERRUPTION) HOWEVER CAUSED AND ON ANY THEORY
OF LIABILITY, WHETHER IN CONTRACT, STRICT LIABILITY, OR TORT
(INCLUDING NEGLIGENCE OR OTHERWISE) ARISING IN ANY WAY OUT OF THE USE
OF THIS SOFTWARE, EVEN IF ADVISED OF THE POSSIBILITY OF SUCH DAMAGE.
````

### tween.js and Robert Penner's easing equations

- `src/core/tween.js`: the easing functions.

````text
The MIT License

Copyright (c) 2010-2012 Tween.js authors.

Easing equations Copyright (c) 2001 Robert Penner http://robertpenner.com/easing/

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in
all copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN
THE SOFTWARE.
````

### Kiwi

- `src/ui/autolayout/` (layoutsolver.js, layoutrow.js, layoutstrength.js): the constraint solver follows Kiwi (Cassowary, dual simplex).

````text
=========================
 The Kiwi licensing terms
=========================
Kiwi is licensed under the terms of the Modified BSD License (also known as
New or Revised BSD), as follows:

Copyright (c) 2013-2026, Nucleic Development Team

All rights reserved.

Redistribution and use in source and binary forms, with or without
modification, are permitted provided that the following conditions are met:

Redistributions of source code must retain the above copyright notice, this
list of conditions and the following disclaimer.

Redistributions in binary form must reproduce the above copyright notice, this
list of conditions and the following disclaimer in the documentation and/or
other materials provided with the distribution.

Neither the name of the Nucleic Development Team nor the names of its
contributors may be used to endorse or promote products derived from this
software without specific prior written permission.

THIS SOFTWARE IS PROVIDED BY THE COPYRIGHT HOLDERS AND CONTRIBUTORS "AS IS" AND
ANY EXPRESS OR IMPLIED WARRANTIES, INCLUDING, BUT NOT LIMITED TO, THE IMPLIED
WARRANTIES OF MERCHANTABILITY AND FITNESS FOR A PARTICULAR PURPOSE ARE
DISCLAIMED.  IN NO EVENT SHALL THE COPYRIGHT OWNER OR CONTRIBUTORS BE LIABLE
FOR ANY DIRECT, INDIRECT, INCIDENTAL, SPECIAL, EXEMPLARY, OR CONSEQUENTIAL
DAMAGES (INCLUDING, BUT NOT LIMITED TO, PROCUREMENT OF SUBSTITUTE GOODS OR
SERVICES; LOSS OF USE, DATA, OR PROFITS; OR BUSINESS INTERRUPTION) HOWEVER
CAUSED AND ON ANY THEORY OF LIABILITY, WHETHER IN CONTRACT, STRICT LIABILITY,
OR TORT (INCLUDING NEGLIGENCE OR OTHERWISE) ARISING IN ANY WAY OUT OF THE USE
OF THIS SOFTWARE, EVEN IF ADVISED OF THE POSSIBILITY OF SUCH DAMAGE.
````

### gl-matrix

- `src/base/matrix4.js`: the 4x4 inverse follows gl-matrix `mat4.invert`.

````text
Copyright (c) 2015-2025, Brandon Jones, Colin MacKenzie IV.

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in
all copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN
THE SOFTWARE.
````

### Separable SSS

- `src/graphics3d/subsurfacescatteringeffect.js`: the kernel of Separable Subsurface Scattering. Uses Separable SSS. Copyright (C) 2012 by Jorge Jimenez and Diego Gutierrez.

````text
Copyright (C) 2012 Jorge Jimenez (jorge@iryoku.com)
Copyright (C) 2012 Diego Gutierrez (diegog@unizar.es)
All rights reserved.

Redistribution and use in source and binary forms, with or without
modification, are permitted provided that the following conditions are met:

   1. Redistributions of source code must retain the above copyright notice,
      this list of conditions and the following disclaimer.

   2. Redistributions in binary form must reproduce the following disclaimer
      in the documentation and/or other materials provided with the
      distribution:

      "Uses Separable SSS. Copyright (C) 2012 by Jorge Jimenez and Diego
       Gutierrez."

THIS SOFTWARE IS PROVIDED BY THE COPYRIGHT HOLDERS AND CONTRIBUTORS ``AS
IS'' AND ANY EXPRESS OR IMPLIED WARRANTIES, INCLUDING, BUT NOT LIMITED TO,
THE IMPLIED WARRANTIES OF MERCHANTABILITY AND FITNESS FOR A PARTICULAR
PURPOSE ARE DISCLAIMED. IN NO EVENT SHALL COPYRIGHT HOLDERS OR CONTRIBUTORS
BE LIABLE FOR ANY DIRECT, INDIRECT, INCIDENTAL, SPECIAL, EXEMPLARY, OR
CONSEQUENTIAL DAMAGES (INCLUDING, BUT NOT LIMITED TO, PROCUREMENT OF
SUBSTITUTE GOODS OR SERVICES; LOSS OF USE, DATA, OR PROFITS; OR BUSINESS
INTERRUPTION) HOWEVER CAUSED AND ON ANY THEORY OF LIABILITY, WHETHER IN
CONTRACT, STRICT LIABILITY, OR TORT (INCLUDING NEGLIGENCE OR OTHERWISE)
ARISING IN ANY WAY OUT OF THE USE OF THIS SOFTWARE, EVEN IF ADVISED OF THE
POSSIBILITY OF SUCH DAMAGE.

The views and conclusions contained in the software and documentation are
those of the authors and should not be interpreted as representing official
policies, either expressed or implied, of the copyright holders.
````

### libtiled (draft, not in the bundles)

- `src/experimental/tilemap/tilemap.js`: the coordinate conversion of libtiled's HexagonalRenderer and StaggeredRenderer.

````text
Copyright 2011-2014, Thorbjørn Lindeijer <thorbjorn@lindeijer.nl>

This file is part of libtiled.

Redistribution and use in source and binary forms, with or without
modification, are permitted provided that the following conditions are met:

   1. Redistributions of source code must retain the above copyright notice,
      this list of conditions and the following disclaimer.

   2. Redistributions in binary form must reproduce the above copyright
      notice, this list of conditions and the following disclaimer in the
      documentation and/or other materials provided with the distribution.

THIS SOFTWARE IS PROVIDED BY THE CONTRIBUTORS ``AS IS'' AND ANY EXPRESS OR
IMPLIED WARRANTIES, INCLUDING, BUT NOT LIMITED TO, THE IMPLIED WARRANTIES OF
MERCHANTABILITY AND FITNESS FOR A PARTICULAR PURPOSE ARE DISCLAIMED. IN NO
EVENT SHALL THE CONTRIBUTORS BE LIABLE FOR ANY DIRECT, INDIRECT, INCIDENTAL,
SPECIAL, EXEMPLARY, OR CONSEQUENTIAL DAMAGES (INCLUDING, BUT NOT LIMITED TO,
PROCUREMENT OF SUBSTITUTE GOODS OR SERVICES; LOSS OF USE, DATA, OR PROFITS;
OR BUSINESS INTERRUPTION) HOWEVER CAUSED AND ON ANY THEORY OF LIABILITY,
WHETHER IN CONTRACT, STRICT LIABILITY, OR TORT (INCLUDING NEGLIGENCE OR
OTHERWISE) ARISING IN ANY WAY OUT OF THE USE OF THIS SOFTWARE, EVEN IF
ADVISED OF THE POSSIBILITY OF SUCH DAMAGE.
````

### Box2D (draft, not in the bundles)

- `src/experimental/physics2d/` and `src/experimental/spatial/dynamictree.js`: the 2D physics and the dynamic AABB tree follow Box2D (soft step solver, tree insertion and rotation).

````text
MIT License

Copyright (c) 2022 Erin Catto

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
````

### Public domain and CC0 code

No notice is required for these. They are listed so that the origin of the code is clear.

- `src/effect/screeneffect.js`, `src/effect/shadersprite.js`, `src/graphics3d/toon/toonvfx.js` (hash21, hashPoint): the fmix32 finalizer of MurmurHash3 by Austin Appleby (https://github.com/aappleby/smhasher/blob/master/src/MurmurHash3.cpp): "MurmurHash3 was written by Austin Appleby, and is placed in the public domain. The author hereby disclaims copyright to this source code."
- `src/effect/screeneffect.js` (tonemap), `src/graphics3d/toon/toonpostprocess.js`: the ACES filmic curve fit by Krzysztof Narkowicz (https://knarkowicz.wordpress.com/2016/01/06/aces-filmic-tone-mapping-curve/): "Fitted curve's HLSL source code (free to use under public domain CC0 or MIT license)". Used under CC0.
- The environment BRDF fit of `src/graphics3d/humanskinrenderer.js` and the shader hash above are written for this engine. (The split sum integral is fitted by the engine's own least squares, not taken from another fit)

### DOSGothic

- Default font, loaded at run time (not bundled), and `examples/assets/DOSGothic.woff`. Original font: https://github.com/hurss/fonts (WOFF conversion by noonnu, https://cdn.jsdelivr.net/gh/projectnoonnu/noonfonts_eight@1.0/DOSGothic.woff, the same bytes as the example copy).

````text
The MIT License (MIT)
Copyright (c) 2016-2022 Damheo Lee (이담허) (leedheo@gmail.com),
with Reserved Font Name DOSMyungjo, DOSGothic, DOSSaemmul, Sam3KRFont, MiraeroNormal, and DOSIyagi,
its OTF and BDF suffix name. (e.g. DOSMyungjo OTF)

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
````

## Example Assets

The files under `examples/` are not part of the bundles or the web tools. They come from the sources below.

| Files | Source | License |
| --- | --- | --- |
| `examples/ancientmountain/assets/mannequin.fbx`, `mannequin_female.glb`, `anims/*.fbx`; `examples/toonshading/assets/anims/*.fbx` | Quaternius, Universal Animation Library (Standard) and Universal Animation Library 2 (Standard), https://opengameart.org/content/universal-animation-library , https://opengameart.org/content/universal-animation-library-2 . Exported by `examples/ancientmountain/tools/export_quaternius.py` | CC0 1.0 ("License: CC0 1.0 Universal (CC0 1.0) Public Domain Dedication", License.txt in the packs) |
| `examples/ancientmountain/assets/fox.glb` | Khronos glTF-Sample-Assets, Fox (unmodified), https://github.com/KhronosGroup/glTF-Sample-Assets/tree/main/Models/Fox | Model by PixelMannen, CC0 1.0. Rigging and animation by tomkranis, CC BY 4.0. glTF conversion by @AsoboStudio and @scurest, CC BY 4.0 |
| `examples/ancientmountain/assets/grass.jpg`, `rock.jpg`, `dirt.jpg`, `boulder.jpg` | Made for this repository with Google generative AI (C2PA record in each file: "Created by Google Generative AI") | Google Terms of Service: "Google won't claim ownership over that content." |
| `examples/toonshading/assets/VRM1_Constraint_Twist_Sample.vrm` | pixiv Inc., the VRM 1.0 sample of https://github.com/pixiv/three-vrm (packages/three-vrm/examples/models, same file) | VRM Public License 1.0, https://vrm.dev/licenses/1.0/ . The file's meta allows redistribution and modified redistribution, commercial use by corporations, and needs no credit ("(c) 2022 pixiv Inc.") |
| `examples/assets/DOSGothic.woff` | See DOSGothic above | MIT |
| `examples/assets/spritesheet.png`, `beep.wav`, `tabletemplate.xlsx`, `examples/spriteeffects/assets/*.png` (also in `examples/timelineshowcase/assets/`), `examples/tilemapshowcase/assets/*`, `examples/skeleton2d/assets/*`, `examples/neonhorizon/assets/*.glb`, the `.json` scenes, UI assets and timelines, and the favicons | Made for this repository (the sprites by `examples/spriteeffects/tools/make_sprites.py`, the tiles by `examples/tilemapshowcase/generate.mjs`, the skeleton by `examples/skeleton2d/tools/makeassets.cjs`, the ships by the vanilla.js battlecruiser generator) | MIT, as the rest of this repository |

Fox credit, as CC BY 4.0 asks: "Low poly fox" model by PixelMannen (https://opengameart.org/content/fox-and-shiba, CC0), rigged and animated by tomkranis (https://sketchfab.com/3d-models/low-poly-fox-by-pixelmannen-animated-371dea88d7e04a76af5763f2a36866bc, CC BY 4.0), converted to glTF by @AsoboStudio and @scurest (https://github.com/KhronosGroup/glTF-Sample-Models/pull/150#issuecomment-406300118, CC BY 4.0, https://creativecommons.org/licenses/by/4.0/).
