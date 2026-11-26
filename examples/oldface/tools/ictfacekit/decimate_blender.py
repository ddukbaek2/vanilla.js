# 블렌더로 머리, 치아 줄이기. (Blender -b --factory-startup -P decimate_blender.py -- <parts.npz> <출력 npz> <비율>)
import sys
import bpy, bmesh
import numpy as np

arguments = sys.argv[sys.argv.index("--") + 1:]
parts = np.load(arguments[0])
ratio = float(arguments[2])
output = {}
for name in ("head", "teeth"):
	positions = parts[name + "_positions"]
	uvs = parts[name + "_uvs"]
	triangles = parts[name + "_triangles"]
	# UV 이음매로 갈린 정점을 같은 자리끼리 다시 묶어 이어진 메시로. (UV 는 고리마다)
	_, weldFirst, weldInverse = np.unique(np.round(positions * 1e7), axis=0, return_index=True, return_inverse=True)
	weldInverse = weldInverse.ravel()
	mesh = bpy.data.meshes.new(name)
	mesh.from_pydata(positions[weldFirst].tolist(), [], weldInverse[triangles].tolist())
	uvLayer = mesh.uv_layers.new(name="UVMap")
	loopUvs = uvs[triangles.ravel()]
	uvLayer.data.foreach_set("uv", loopUvs.ravel())
	obj = bpy.data.objects.new(name, mesh)
	bpy.context.scene.collection.objects.link(obj)
	bpy.context.view_layer.objects.active = obj
	modifier = obj.modifiers.new("decimate", "DECIMATE")
	modifier.decimate_type = "COLLAPSE"
	modifier.ratio = ratio
	modifier.use_collapse_triangulate = True
	modifier.delimit = {"UV", "SEAM"}
	triangulate = obj.modifiers.new("triangulate", "TRIANGULATE")
	bpy.ops.object.modifier_apply(modifier="decimate")
	bpy.ops.object.modifier_apply(modifier="triangulate")
	mesh = obj.data
	vertexPositions = np.zeros(len(mesh.vertices) * 3)
	mesh.vertices.foreach_get("co", vertexPositions)
	vertexPositions = vertexPositions.reshape(-1, 3)
	loopVertex = np.zeros(len(mesh.loops), dtype=np.int64)
	mesh.loops.foreach_get("vertex_index", loopVertex)
	loopUv = np.zeros(len(mesh.loops) * 2)
	mesh.uv_layers[0].data.foreach_get("uv", loopUv)
	loopUv = loopUv.reshape(-1, 2)
	polygonLoops = np.zeros(len(mesh.polygons) * 3, dtype=np.int64)
	for index, polygon in enumerate(mesh.polygons):
		polygonLoops[index * 3:index * 3 + 3] = list(polygon.loop_indices)
	keys = np.column_stack([loopVertex.astype(np.float64), np.round(loopUv * 1e6)])
	_, first, inverse = np.unique(keys, axis=0, return_index=True, return_inverse=True)
	inverse = inverse.ravel()
	output[name + "_positions"] = vertexPositions[loopVertex[first]]
	output[name + "_uvs"] = loopUv[first]
	output[name + "_triangles"] = inverse[polygonLoops].reshape(-1, 3)
	print(name, len(positions), "->", len(first))
np.savez(arguments[1], **output)
