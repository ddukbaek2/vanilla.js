# Quaternius 애니메이션 묶음(CC0)에서 예제 자산을 뽑는다. (블렌더 5.2 에서 확인)
# - 받는 곳: https://opengameart.org/content/universal-animation-library (universal_animation_librarystandard.zip)
#   https://opengameart.org/content/universal-animation-library-2 (universal_animation_library_2standard.zip)
# - 사용: Blender --background --factory-startup --python export_quaternius.py -- <AL_Standard.fbx> <UAL2_Standard.fbx(Unity)> <Mannequin_F.glb> <출력 폴더>
# - 출력: mannequin.fbx(남자 마네킹, 움직임 없음), mannequin.glb(여자 마네킹 + Idle, Walk, Run, Dance), anims/*.fbx(뼈대만, 클립 하나씩)
#   ancientmountain 은 mannequin.fbx, mannequin.glb(mannequin_female.glb 로), idle, walk, run, fall, land, climb 을 쓰고
#   toonshading 은 tpose, idle, walk, run, roll, dance, yes, talk, punch 를 쓴다.
import bpy, sys, os
argv = sys.argv[sys.argv.index('--') + 1:]
ual1, ual2, female, out = argv
os.makedirs(os.path.join(out, 'anims'), exist_ok=True)

def reset():
    bpy.ops.wm.read_factory_settings(use_empty=True)

def load(path, armature_name='Rig'):
    bpy.ops.import_scene.fbx(filepath=path)
    arm = [o for o in bpy.context.scene.objects if o.type == 'ARMATURE'][0]
    arm.name = armature_name
    # UAL2 의 유니티용 FBX 는 뼈대 물체가 Z 로 180 도 돌아 있다. (UAL1 언리얼용과 같은 방향으로 맞춘다)
    arm.rotation_mode = 'XYZ'
    arm.rotation_euler = (0, 0, 0)
    bpy.context.view_layer.update()
    return arm

def rest(arm):
    if arm.animation_data:
        arm.animation_data.action = None
    for pb in arm.pose.bones:
        pb.location = (0, 0, 0)
        pb.rotation_quaternion = (1, 0, 0, 0)
        pb.rotation_euler = (0, 0, 0)
        pb.scale = (1, 1, 1)

def select_only(objs):
    for o in bpy.context.scene.objects:
        o.select_set(False)
    for o in objs:
        o.select_set(True)
    bpy.context.view_layer.objects.active = objs[0]

def find_action(suffix):
    for a in bpy.data.actions:
        if a.name.endswith('|' + suffix):
            return a
    raise KeyError(suffix)

def strip_object_keys(act):
    # 뼈가 아닌 뼈대 물체 자체의 키(UAL2 유니티용 FBX 의 Z 180 도 같은)를 뺀다.
    for layer in act.layers:
        for strip in layer.strips:
            for channelbag in strip.channelbags:
                for fcurve in [fcurve for fcurve in channelbag.fcurves if not fcurve.data_path.startswith('pose.bones')]:
                    channelbag.fcurves.remove(fcurve)

def export_clip(arm, action_suffix, file_name, take_name):
    act = find_action(action_suffix)
    strip_object_keys(act)
    act.name = take_name
    if not arm.animation_data:
        arm.animation_data_create()
    arm.animation_data.action = act
    if act.slots:
        arm.animation_data.action_slot = act.slots[0]
    start, end = act.frame_range
    bpy.context.scene.frame_start = int(start)
    bpy.context.scene.frame_end = int(end)
    select_only([arm])
    bpy.ops.export_scene.fbx(filepath=os.path.join(out, 'anims', file_name), use_selection=True, object_types={'ARMATURE'},
        add_leaf_bones=False, bake_anim=True, bake_anim_use_all_actions=False, bake_anim_use_nla_strips=False,
        bake_anim_force_startend_keying=True, bake_anim_simplify_factor=0.0, apply_scale_options='FBX_SCALE_ALL', bake_space_transform=True, axis_forward='-Z', axis_up='Y')
    print('EXPORTED', file_name, take_name, start, end)

# 1. UAL1: 모형과 클립.
reset()
arm = load(ual1)
mesh = [o for o in bpy.context.scene.objects if o.type == 'MESH'][0]
rest(arm)
select_only([mesh, arm])
bpy.ops.export_scene.fbx(filepath=os.path.join(out, 'mannequin.fbx'), use_selection=True, object_types={'ARMATURE', 'MESH'},
    add_leaf_bones=False, bake_anim=False, apply_scale_options='FBX_SCALE_ALL', bake_space_transform=True, axis_forward='-Z', axis_up='Y', mesh_smooth_type='FACE')
print('EXPORTED mannequin.fbx')
for suffix, file_name, take in [('A_TPose', 'tpose.fbx', 'TPose'), ('Idle_Loop', 'idle.fbx', 'Idle'), ('Walk_Loop', 'walk.fbx', 'Walk'),
        ('Jog_Fwd_Loop', 'run.fbx', 'Run'), ('Jump_Loop', 'fall.fbx', 'Fall'), ('Jump_Land', 'land.fbx', 'Land'),
        ('Roll', 'roll.fbx', 'Roll'), ('Dance_Loop', 'dance.fbx', 'Dance'), ('Idle_Talking_Loop', 'talk.fbx', 'Talk'), ('Punch_Cross', 'punch.fbx', 'Punch')]:
    export_clip(arm, suffix, file_name, take)

# 2. UAL2: 오르기와 끄덕이기.
reset()
arm = load(ual2)
for o in [o for o in bpy.context.scene.objects if o.type == 'MESH']:
    bpy.data.objects.remove(o)
for suffix, file_name, take in [('ClimbUp_1m_RM', 'climb.fbx', 'Climb'), ('Yes', 'yes.fbx', 'Yes')]:
    export_clip(arm, suffix, file_name, take)

# 3. 여자 마네킹 glb 에 UAL1 클립 넷.
reset()
arm = load(ual1)
for o in [o for o in bpy.context.scene.objects if o.type == 'MESH']:
    bpy.data.objects.remove(o)
keep = {'Idle_Loop': 'Idle', 'Walk_Loop': 'Walk', 'Jog_Fwd_Loop': 'Run', 'Dance_Loop': 'Dance'}
bpy.data.objects.remove(arm)
for a in list(bpy.data.actions):
    short = a.name.split('|')[-1]
    if short in keep:
        a.name = keep[short]
        a.use_fake_user = True
    else:
        bpy.data.actions.remove(a)
bpy.ops.import_scene.gltf(filepath=female)
for o in [o for o in bpy.context.scene.objects if o.type == 'MESH' and o.parent is None]:
    bpy.data.objects.remove(o)
farm = [o for o in bpy.context.scene.objects if o.type == 'ARMATURE'][0]
print('FEMALE', farm.name, len(farm.data.bones), [o.name for o in bpy.context.scene.objects], [a.name for a in bpy.data.actions])
for a in list(bpy.data.actions):
    if a.name not in keep.values():
        bpy.data.actions.remove(a)
if not farm.animation_data:
    farm.animation_data_create()
for name in keep.values():
    act = bpy.data.actions[name]
    track = farm.animation_data.nla_tracks.new()
    track.name = name
    strip = track.strips.new(name, int(act.frame_range[0]), act)
    if act.slots:
        strip.action_slot = act.slots[0]
bpy.ops.export_scene.gltf(filepath=os.path.join(out, 'mannequin.glb'), export_format='GLB', export_animation_mode='NLA_TRACKS', export_yup=True, export_apply=False)
print('EXPORTED mannequin.glb')
