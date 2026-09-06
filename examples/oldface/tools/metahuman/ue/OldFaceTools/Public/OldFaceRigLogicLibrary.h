#pragma once

#include "CoreMinimal.h"
#include "Kismet/BlueprintFunctionLibrary.h"
#include "OldFaceRigLogicLibrary.generated.h"

class UDNA;
class USkeletalMesh;

// 메타휴먼 DNA 의 지오메트리를 파일로 덤프하고, RigLogic 으로 raw 제어값 포즈를 평가해 관절 로컬 변환 / 블렌드셰이프 가중치를 덤프한다.
UCLASS()
class OLDFACETOOLS_API UOldFaceRigLogicLibrary : public UBlueprintFunctionLibrary
{
	GENERATED_BODY()

public:
	UFUNCTION(BlueprintCallable, Category = "OldFace")
	static UDNA* LoadDNAFile(const FString& FilePath);

	UFUNCTION(BlueprintCallable, Category = "OldFace")
	static UDNA* GetDNAFromSkeletalMesh(USkeletalMesh* SkeletalMesh);

	UFUNCTION(BlueprintCallable, Category = "OldFace")
	static bool DumpGeometry(UDNA* DNA, const FString& OutputDirectory, int32 LodIndex = 0);

	UFUNCTION(BlueprintCallable, Category = "OldFace")
	static bool EvaluatePoses(UDNA* DNA, const TArray<FString>& RawControlNames, const TArray<float>& FlatValues, int32 PoseCount, const FString& OutputDirectory);
};
