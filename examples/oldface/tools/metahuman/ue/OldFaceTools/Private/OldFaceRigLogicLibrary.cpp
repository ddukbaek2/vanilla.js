#include "OldFaceRigLogicLibrary.h"

#include "DNA.h"
#include "DNAReader.h"
#include "DNAAssetUserData.h"
#include "RigLogic.h"
#include "RigInstance.h"
#include "Engine/SkeletalMesh.h"
#include "Misc/FileHelper.h"
#include "Misc/Paths.h"
#include "HAL/PlatformFileManager.h"
#include "Dom/JsonObject.h"
#include "Dom/JsonValue.h"
#include "Serialization/JsonSerializer.h"
#include "Serialization/JsonWriter.h"

namespace
{
	bool WriteFloatFile(const FString& Path, const TArray<float>& Values)
	{
		TArrayView<const uint8> Bytes(reinterpret_cast<const uint8*>(Values.GetData()), Values.Num() * sizeof(float));
		return FFileHelper::SaveArrayToFile(Bytes, *Path);
	}

	bool WriteUIntFile(const FString& Path, const TArray<uint32>& Values)
	{
		TArrayView<const uint8> Bytes(reinterpret_cast<const uint8*>(Values.GetData()), Values.Num() * sizeof(uint32));
		return FFileHelper::SaveArrayToFile(Bytes, *Path);
	}

	bool WriteJsonFile(const FString& Path, const TSharedRef<FJsonObject>& Object)
	{
		FString Text;
		TSharedRef<TJsonWriter<>> Writer = TJsonWriterFactory<>::Create(&Text);
		if (!FJsonSerializer::Serialize(Object, Writer))
		{
			return false;
		}
		return FFileHelper::SaveStringToFile(Text, *Path);
	}

	FString NormalizeControlName(const FString& Name)
	{
		return Name.ToLower().Replace(TEXT("."), TEXT("_"));
	}
}

UDNA* UOldFaceRigLogicLibrary::LoadDNAFile(const FString& FilePath)
{
	UDNA* DNA = NewObject<UDNA>(GetTransientPackage(), NAME_None, RF_Transient);
	if (DNA == nullptr || !DNA->Init(FilePath))
	{
		UE_LOG(LogTemp, Error, TEXT("[OLDFACE] failed to load DNA %s"), *FilePath);
		return nullptr;
	}
	return DNA;
}

UDNA* UOldFaceRigLogicLibrary::GetDNAFromSkeletalMesh(USkeletalMesh* SkeletalMesh)
{
	if (SkeletalMesh == nullptr)
	{
		return nullptr;
	}
	UDNAAssetUserData* UserData = SkeletalMesh->GetAssetUserData<UDNAAssetUserData>();
	return UserData != nullptr ? UserData->DNAAsset.Get() : nullptr;
}

bool UOldFaceRigLogicLibrary::DumpGeometry(UDNA* DNA, const FString& OutputDirectory)
{
	if (DNA == nullptr)
	{
		return false;
	}
	TSharedPtr<IDNAReader> Reader = DNA->GetDNAReader();
	if (!Reader.IsValid())
	{
		UE_LOG(LogTemp, Error, TEXT("[OLDFACE] DNA reader unavailable"));
		return false;
	}
	IPlatformFile& PlatformFile = FPlatformFileManager::Get().GetPlatformFile();
	PlatformFile.CreateDirectoryTree(*OutputDirectory);

	TSharedRef<FJsonObject> Manifest = MakeShared<FJsonObject>();
	Manifest->SetStringField(TEXT("name"), Reader->GetName());
	Manifest->SetNumberField(TEXT("face_winding_ccw"), Reader->GetFaceWindingOrder() == EFaceWindingOrder::CCW ? 1 : 0);

	// 관절 이름 / 부모, RigLogic 중립 관절 값 (위치 3 + 쿼터니언 4 + 스케일 3)
	const uint16 JointCount = Reader->GetJointCount();
	TArray<TSharedPtr<FJsonValue>> JointNames;
	TArray<TSharedPtr<FJsonValue>> JointParents;
	for (uint16 JointIndex = 0; JointIndex < JointCount; ++JointIndex)
	{
		JointNames.Add(MakeShared<FJsonValueString>(Reader->GetJointName(JointIndex)));
		JointParents.Add(MakeShared<FJsonValueNumber>(Reader->GetJointParentIndex(JointIndex)));
	}
	Manifest->SetArrayField(TEXT("joint_names"), JointNames);
	Manifest->SetArrayField(TEXT("joint_parents"), JointParents);
	{
		FRigLogic RigLogic(Reader.Get());
		TArrayView<const float> Neutral = RigLogic.GetNeutralJointValues();
		TArray<float> NeutralArray(Neutral.GetData(), Neutral.Num());
		WriteFloatFile(FPaths::Combine(OutputDirectory, TEXT("neutral_joints.f32")), NeutralArray);
		Manifest->SetNumberField(TEXT("joint_count"), JointCount);
		Manifest->SetNumberField(TEXT("joint_attribute_count"), JointCount > 0 ? Neutral.Num() / JointCount : 0);
	}

	// raw 제어 이름, 블렌드셰이프 채널 이름
	TArray<TSharedPtr<FJsonValue>> RawControlNames;
	for (uint16 Index = 0; Index < Reader->GetRawControlCount(); ++Index)
	{
		RawControlNames.Add(MakeShared<FJsonValueString>(Reader->GetRawControlName(Index)));
	}
	Manifest->SetArrayField(TEXT("raw_control_names"), RawControlNames);
	TArray<TSharedPtr<FJsonValue>> ChannelNames;
	for (uint16 Index = 0; Index < Reader->GetBlendShapeChannelCount(); ++Index)
	{
		ChannelNames.Add(MakeShared<FJsonValueString>(Reader->GetBlendShapeChannelName(Index)));
	}
	Manifest->SetArrayField(TEXT("blendshape_channel_names"), ChannelNames);

	// LOD0 메시
	TArray<TSharedPtr<FJsonValue>> MeshEntries;
	for (uint16 MeshIndex = 0; MeshIndex < Reader->GetMeshCount(); ++MeshIndex)
	{
		const FString MeshName = Reader->GetMeshName(MeshIndex);
		if (!MeshName.Contains(TEXT("_lod0_")))
		{
			continue;
		}
		const FString ShortName = MeshName.Replace(TEXT("_lod0_mesh"), TEXT(""));
		const FString Prefix = FPaths::Combine(OutputDirectory, ShortName + TEXT("__"));

		TArrayView<const float> Xs = Reader->GetVertexPositionXs(MeshIndex);
		TArrayView<const float> Ys = Reader->GetVertexPositionYs(MeshIndex);
		TArrayView<const float> Zs = Reader->GetVertexPositionZs(MeshIndex);
		const int32 VertexCount = Xs.Num();
		TArray<float> Positions;
		Positions.Reserve(VertexCount * 3);
		for (int32 Index = 0; Index < VertexCount; ++Index)
		{
			Positions.Add(Xs[Index]);
			Positions.Add(Ys[Index]);
			Positions.Add(Zs[Index]);
		}
		WriteFloatFile(Prefix + TEXT("positions.f32"), Positions);

		const uint32 UVCount = Reader->GetVertexTextureCoordinateCount(MeshIndex);
		TArray<float> UVs;
		UVs.Reserve(UVCount * 2);
		for (uint32 Index = 0; Index < UVCount; ++Index)
		{
			const FTextureCoordinate Coordinate = Reader->GetVertexTextureCoordinate(MeshIndex, Index);
			UVs.Add(Coordinate.U);
			UVs.Add(Coordinate.V);
		}
		WriteFloatFile(Prefix + TEXT("uvs.f32"), UVs);

		const uint32 LayoutCount = Reader->GetVertexLayoutCount(MeshIndex);
		TArray<uint32> LayoutPositions;
		TArray<uint32> LayoutUVs;
		LayoutPositions.Reserve(LayoutCount);
		LayoutUVs.Reserve(LayoutCount);
		for (uint32 Index = 0; Index < LayoutCount; ++Index)
		{
			const FVertexLayout Layout = Reader->GetVertexLayout(MeshIndex, Index);
			LayoutPositions.Add(static_cast<uint32>(Layout.Position));
			LayoutUVs.Add(static_cast<uint32>(Layout.TextureCoordinate));
		}
		WriteUIntFile(Prefix + TEXT("layout_positions.u32"), LayoutPositions);
		WriteUIntFile(Prefix + TEXT("layout_uvs.u32"), LayoutUVs);

		TArray<uint32> Triangles;
		const uint32 FaceCount = Reader->GetFaceCount(MeshIndex);
		for (uint32 FaceIndex = 0; FaceIndex < FaceCount; ++FaceIndex)
		{
			TArrayView<const uint32> Layouts = Reader->GetFaceVertexLayoutIndices(MeshIndex, FaceIndex);
			for (int32 Corner = 1; Corner + 1 < Layouts.Num(); ++Corner)
			{
				Triangles.Add(Layouts[0]);
				Triangles.Add(Layouts[Corner]);
				Triangles.Add(Layouts[Corner + 1]);
			}
		}
		WriteUIntFile(Prefix + TEXT("triangles.u32"), Triangles);

		const uint16 Influences = FMath::Max<uint16>(Reader->GetMaximumInfluencePerVertex(MeshIndex), 1);
		TArray<uint32> SkinJoints;
		TArray<float> SkinWeights;
		SkinJoints.SetNumZeroed(VertexCount * Influences);
		SkinWeights.SetNumZeroed(VertexCount * Influences);
		for (int32 VertexIndex = 0; VertexIndex < VertexCount; ++VertexIndex)
		{
			TArrayView<const float> Weights = Reader->GetSkinWeightsValues(MeshIndex, VertexIndex);
			TArrayView<const uint16> Joints = Reader->GetSkinWeightsJointIndices(MeshIndex, VertexIndex);
			for (int32 Slot = 0; Slot < Weights.Num() && Slot < Influences; ++Slot)
			{
				SkinJoints[VertexIndex * Influences + Slot] = Joints[Slot];
				SkinWeights[VertexIndex * Influences + Slot] = Weights[Slot];
			}
		}
		WriteUIntFile(Prefix + TEXT("skin_joints.u32"), SkinJoints);
		WriteFloatFile(Prefix + TEXT("skin_weights.f32"), SkinWeights);

		TArray<uint32> TargetChannels;
		TArray<uint32> TargetOffsets;
		TArray<uint32> TargetVertexIndices;
		TArray<float> TargetDeltas;
		const uint16 TargetCount = Reader->GetBlendShapeTargetCount(MeshIndex);
		TargetOffsets.Add(0);
		for (uint16 TargetIndex = 0; TargetIndex < TargetCount; ++TargetIndex)
		{
			TargetChannels.Add(Reader->GetBlendShapeChannelIndex(MeshIndex, TargetIndex));
			TArrayView<const uint32> Indices = Reader->GetBlendShapeTargetVertexIndices(MeshIndex, TargetIndex);
			TArrayView<const float> DeltaXs = Reader->GetBlendShapeTargetDeltaXs(MeshIndex, TargetIndex);
			TArrayView<const float> DeltaYs = Reader->GetBlendShapeTargetDeltaYs(MeshIndex, TargetIndex);
			TArrayView<const float> DeltaZs = Reader->GetBlendShapeTargetDeltaZs(MeshIndex, TargetIndex);
			for (int32 Index = 0; Index < Indices.Num(); ++Index)
			{
				TargetVertexIndices.Add(Indices[Index]);
				TargetDeltas.Add(DeltaXs[Index]);
				TargetDeltas.Add(DeltaYs[Index]);
				TargetDeltas.Add(DeltaZs[Index]);
			}
			TargetOffsets.Add(TargetVertexIndices.Num());
		}
		WriteUIntFile(Prefix + TEXT("target_channels.u32"), TargetChannels);
		WriteUIntFile(Prefix + TEXT("target_offsets.u32"), TargetOffsets);
		WriteUIntFile(Prefix + TEXT("target_vertex_indices.u32"), TargetVertexIndices);
		WriteFloatFile(Prefix + TEXT("target_deltas.f32"), TargetDeltas);

		TSharedRef<FJsonObject> Entry = MakeShared<FJsonObject>();
		Entry->SetStringField(TEXT("name"), ShortName);
		Entry->SetNumberField(TEXT("vertex_count"), VertexCount);
		Entry->SetNumberField(TEXT("layout_count"), LayoutCount);
		Entry->SetNumberField(TEXT("influences"), Influences);
		Entry->SetNumberField(TEXT("target_count"), TargetCount);
		MeshEntries.Add(MakeShared<FJsonValueObject>(Entry));
		UE_LOG(LogTemp, Warning, TEXT("[OLDFACE] mesh %s vertices %d layouts %u triangles %d targets %d"), *ShortName, VertexCount, LayoutCount, Triangles.Num() / 3, TargetCount);
	}
	Manifest->SetArrayField(TEXT("meshes"), MeshEntries);
	return WriteJsonFile(FPaths::Combine(OutputDirectory, TEXT("manifest.json")), Manifest);
}

bool UOldFaceRigLogicLibrary::EvaluatePoses(UDNA* DNA, const TArray<FString>& RawControlNames, const TArray<float>& FlatValues, int32 PoseCount, const FString& OutputDirectory)
{
	if (DNA == nullptr || PoseCount <= 0 || RawControlNames.Num() == 0 || FlatValues.Num() != PoseCount * RawControlNames.Num())
	{
		UE_LOG(LogTemp, Error, TEXT("[OLDFACE] EvaluatePoses: invalid arguments"));
		return false;
	}
	TSharedPtr<IDNAReader> Reader = DNA->GetDNAReader();
	if (!Reader.IsValid())
	{
		return false;
	}
	IPlatformFile& PlatformFile = FPlatformFileManager::Get().GetPlatformFile();
	PlatformFile.CreateDirectoryTree(*OutputDirectory);

	FRigLogic RigLogic(Reader.Get());
	FRigInstance Instance(&RigLogic);
	Instance.SetLOD(0);
	const uint16 RawCount = Instance.GetRawControlCount();
	TMap<FString, int32> RawIndexByName;
	for (uint16 Index = 0; Index < RawCount; ++Index)
	{
		RawIndexByName.Add(NormalizeControlName(Reader->GetRawControlName(Index)), Index);
	}
	TArray<int32> MappedIndices;
	int32 MatchedCount = 0;
	for (const FString& Name : RawControlNames)
	{
		const int32* Found = RawIndexByName.Find(NormalizeControlName(Name));
		MappedIndices.Add(Found != nullptr ? *Found : INDEX_NONE);
		MatchedCount += Found != nullptr ? 1 : 0;
	}

	TArrayView<const float> Neutral = RigLogic.GetNeutralJointValues();
	const uint16 JointCount = Reader->GetJointCount();
	const int32 AttributeCount = JointCount > 0 ? Neutral.Num() / JointCount : 0;
	if (AttributeCount != 10)
	{
		UE_LOG(LogTemp, Error, TEXT("[OLDFACE] unexpected joint attribute count %d (expected 10: translation, quaternion, scale)"), AttributeCount);
		return false;
	}
	TArray<float> JointValues;
	JointValues.Reserve(PoseCount * JointCount * 10);
	TArray<float> BlendShapeValues;
	const int32 NameCount = RawControlNames.Num();
	int32 BlendShapeCount = 0;
	for (int32 Pose = 0; Pose < PoseCount; ++Pose)
	{
		for (uint16 Index = 0; Index < RawCount; ++Index)
		{
			Instance.SetRawControl(Index, 0.0f);
		}
		for (int32 NameIndex = 0; NameIndex < NameCount; ++NameIndex)
		{
			const int32 RawIndex = MappedIndices[NameIndex];
			if (RawIndex != INDEX_NONE)
			{
				Instance.SetRawControl(static_cast<uint16>(RawIndex), FlatValues[Pose * NameCount + NameIndex]);
			}
		}
		RigLogic.CalculateMLControls(&Instance);
		RigLogic.CalculateRBFControls(&Instance);
		RigLogic.CalculatePSDControls(&Instance);
		RigLogic.CalculateJoints(&Instance);
		RigLogic.CalculateBlendShapes(&Instance);
		TArrayView<const float> Delta = Instance.GetJointOutputs();
		const float* N = Neutral.GetData();
		const float* D = Delta.GetData();
		for (uint16 JointIndex = 0; JointIndex < JointCount; ++JointIndex)
		{
			const int32 Attribute = JointIndex * 10;
			const FQuat Rotation = FQuat(N[Attribute + 3], N[Attribute + 4], N[Attribute + 5], N[Attribute + 6]) * FQuat(D[Attribute + 3], D[Attribute + 4], D[Attribute + 5], D[Attribute + 6]);
			JointValues.Add(N[Attribute + 0] + D[Attribute + 0]);
			JointValues.Add(N[Attribute + 1] + D[Attribute + 1]);
			JointValues.Add(N[Attribute + 2] + D[Attribute + 2]);
			JointValues.Add(static_cast<float>(Rotation.X));
			JointValues.Add(static_cast<float>(Rotation.Y));
			JointValues.Add(static_cast<float>(Rotation.Z));
			JointValues.Add(static_cast<float>(Rotation.W));
			JointValues.Add(N[Attribute + 7] + D[Attribute + 7]);
			JointValues.Add(N[Attribute + 8] + D[Attribute + 8]);
			JointValues.Add(N[Attribute + 9] + D[Attribute + 9]);
		}
		TArrayView<const float> BlendShapes = Instance.GetBlendShapeOutputs();
		BlendShapeCount = BlendShapes.Num();
		BlendShapeValues.Append(BlendShapes.GetData(), BlendShapes.Num());
	}
	WriteFloatFile(FPaths::Combine(OutputDirectory, TEXT("poses_joints.f32")), JointValues);
	WriteFloatFile(FPaths::Combine(OutputDirectory, TEXT("poses_blendshapes.f32")), BlendShapeValues);

	TSharedRef<FJsonObject> Manifest = MakeShared<FJsonObject>();
	Manifest->SetNumberField(TEXT("pose_count"), PoseCount);
	Manifest->SetNumberField(TEXT("joint_count"), JointCount);
	Manifest->SetNumberField(TEXT("joint_attribute_count"), 10);
	Manifest->SetNumberField(TEXT("blendshape_count"), BlendShapeCount);
	Manifest->SetNumberField(TEXT("matched_controls"), MatchedCount);
	UE_LOG(LogTemp, Warning, TEXT("[OLDFACE] evaluated %d poses, joints %d, blendshapes %d, matched controls %d of %d"), PoseCount, JointCount, BlendShapeCount, MatchedCount, NameCount);
	return WriteJsonFile(FPaths::Combine(OutputDirectory, TEXT("poses_manifest.json")), Manifest);
}
