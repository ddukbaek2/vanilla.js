# ICT FaceKit OBJ 를 읽어 npz 로. (python -I parseict.py <FaceXModel 폴더> <출력 npz>)
import sys, os, json
import numpy as np
source = sys.argv[1]
def readVertices(path):
	rows = []
	with open(path) as file:
		for line in file:
			if line.startswith("v "):
				rows.append(line.split()[1:4])
	return np.array(rows, dtype=np.float64)
positions = []
uvs = []
faces = []
current = None
with open(os.path.join(source, "generic_neutral_mesh.obj")) as file:
	for line in file:
		if line.startswith("v "):
			positions.append(line.split()[1:4])
		elif line.startswith("vt "):
			uvs.append(line.split()[1:3])
		elif line.startswith("usemtl "):
			current = line.split()[1]
		elif line.startswith("f "):
			corners = [corner.split("/") for corner in line.split()[1:]]
			for index in range(1, len(corners) - 1):
				triangle = [corners[0], corners[index], corners[index + 1]]
				faces.append((current, [int(c[0]) - 1 for c in triangle], [int(c[1]) - 1 for c in triangle]))
positions = np.array(positions, dtype=np.float64)
uvs = np.array(uvs, dtype=np.float64)
materials = sorted(set(f[0] for f in faces))
faceMaterial = np.array([materials.index(f[0]) for f in faces])
faceVertex = np.array([f[1] for f in faces])
faceUv = np.array([f[2] for f in faces])
indices = json.load(open(os.path.join(source, "vertex_indices.json")))
names = indices["expressions"]
deltas = np.zeros((len(names), len(positions), 3), dtype=np.float32)
for index, name in enumerate(names):
	deltas[index] = readVertices(os.path.join(source, name + ".obj")) - positions
np.savez_compressed(sys.argv[2], positions=positions, uvs=uvs, faceMaterial=faceMaterial, faceVertex=faceVertex, faceUv=faceUv, materials=np.array(materials), names=np.array(names), deltas=deltas)
print(len(positions), len(uvs), len(faces), materials, len(names))
print("bounds", positions.min(0), positions.max(0))
for m, name in enumerate(materials):
	mask = faceMaterial == m
	uv = uvs[faceUv[mask].ravel()]
	vertexSet = np.unique(faceVertex[mask])
	print(name, mask.sum(), "verts", len(vertexSet), "uv", uv.min(0).round(3), uv.max(0).round(3), "pos", positions[vertexSet].min(0).round(2), positions[vertexSet].max(0).round(2))
