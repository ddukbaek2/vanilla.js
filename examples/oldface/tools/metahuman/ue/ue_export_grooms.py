import unreal
import os
import json
import traceback

# 캐릭터가 쓰는 그룸(머리카락 / 수염 / 눈썹)의 카드 LOD 스태틱 메시와 카드 텍스처를 내보낸다.
# 그룸 애셋 구조는 실행 시 로그로 확인한다 (hair_groups_cards → imported_mesh / textures).
CHARACTER_PATH = os.environ.get("OLDFACE_CHARACTER_PATH", "/Game/OldFace/OldMan.OldMan")
OUTPUT_DIR = os.environ.get("OLDFACE_GROOM_DIR", "D:/MetaHumanExport/Grooms")
GROOM_ROOT = "/MetaHumanCharacter/Optional/Grooms/GroomAssets"

def log(message):
    unreal.log_warning("[OLDFACE] " + str(message))

def export_static_mesh(mesh, path):
    task = unreal.AssetExportTask()
    task.object = mesh
    task.filename = path
    options = unreal.FbxExportOption()
    options.level_of_detail = False
    options.collision = False
    options.vertex_color = True
    task.options = options
    task.automated = True
    task.replace_identical = True
    task.prompt = False
    task.exporter = unreal.StaticMeshExporterFBX()
    return unreal.Exporter.run_asset_export_task(task)

def export_texture(texture, path):
    task = unreal.AssetExportTask()
    task.object = texture
    task.filename = path
    task.automated = True
    task.replace_identical = True
    task.prompt = False
    task.exporter = unreal.TextureExporterPNG()
    return unreal.Exporter.run_asset_export_task(task)

try:
    os.makedirs(OUTPUT_DIR, exist_ok=True)
    character = unreal.load_asset(CHARACTER_PATH)
    # 캐릭터가 선택한 워드로브 아이템 이름 수집 (내부 컬렉션 → 슬롯 선택)
    selected_names = []
    try:
        collection = character.internal_collection
        instance = collection.default_instance
        for selection in instance.get_editor_property("slot_selections") if hasattr(instance, "get_editor_property") else []:
            selected_names.append(str(selection))
    except Exception:
        log("slot selection read failed: " + traceback.format_exc())
    log(f"selections {selected_names[:12]}")

    registry = unreal.AssetRegistryHelpers.get_asset_registry()
    registry.scan_paths_synchronous([GROOM_ROOT], force_rescan=True)
    groom_assets = [a for a in registry.get_assets_by_path(GROOM_ROOT, recursive=True) if str(a.asset_class_path.asset_name) == "GroomAsset"]
    log(f"groom assets {len(groom_assets)}")
    wanted = [w.strip() for w in os.environ.get("OLDFACE_GROOM_NAMES", "BobLayered,Goatee_L_Wavy,Goatee_S_SoulpatchStrip,Eyebrows_M_FlatThick,Eyebrows_M_Messy").split(",") if w.strip()]
    manifest = {"grooms": []}
    for asset_data in groom_assets:
        name = str(asset_data.asset_name)
        if not any(w.lower() in name.lower() for w in wanted):
            continue
        groom = asset_data.get_asset()
        log(f"groom {name}: props {[p for p in dir(groom) if 'card' in p.lower() or 'mesh' in p.lower() or 'lod' in p.lower()][:20]}")
        entry = {"name": name, "cards": []}
        try:
            cards = groom.get_editor_property("hair_groups_cards")
            log(f"  cards groups {len(cards)}")
            for index, card in enumerate(cards):
                fields = [p for p in dir(card) if not p.startswith("_")]
                mesh = None
                for field in ("imported_mesh", "procedural_mesh", "imported_mesh_asset"):
                    try:
                        mesh = card.get_editor_property(field)
                        if mesh is not None:
                            break
                    except Exception:
                        continue
                textures = []
                try:
                    textures = list(card.get_editor_property("textures").get_editor_property("textures"))
                except Exception:
                    try:
                        textures = list(card.get_editor_property("textures"))
                    except Exception:
                        pass
                lod = None
                try:
                    lod = card.get_editor_property("lod_index")
                except Exception:
                    pass
                log(f"  card {index} lod {lod} mesh {mesh} textures {len(textures)} fields {fields[:12]}")
                card_entry = {"lod": lod, "mesh": None, "textures": []}
                if mesh is not None:
                    path = os.path.join(OUTPUT_DIR, f"{name}_cards_lod{lod}.fbx")
                    ok = export_static_mesh(mesh, path)
                    card_entry["mesh"] = path if ok else None
                    log(f"  exported mesh {path}: {ok}")
                for texture in textures:
                    if texture is None:
                        continue
                    path = os.path.join(OUTPUT_DIR, f"{name}_{texture.get_name()}.png")
                    ok = export_texture(texture, path)
                    card_entry["textures"].append(path)
                    log(f"  exported texture {texture.get_name()}: {ok}")
                entry["cards"].append(card_entry)
        except Exception:
            log("  cards read failed: " + traceback.format_exc())
        manifest["grooms"].append(entry)
    json.dump(manifest, open(os.path.join(OUTPUT_DIR, "grooms.json"), "w"), indent=1)
except Exception:
    log("failed: " + traceback.format_exc())
log("DONE")
unreal.SystemLibrary.quit_editor()
