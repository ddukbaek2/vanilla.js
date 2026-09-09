using UnrealBuildTool;

public class OldFaceTools : ModuleRules
{
	public OldFaceTools(ReadOnlyTargetRules Target) : base(Target)
	{
		PCHUsage = PCHUsageMode.UseExplicitOrSharedPCHs;
		PublicDependencyModuleNames.AddRange(new string[] { "Core", "CoreUObject", "Engine", "RigLogicModule", "RigLogicLib", "Json" });
		PrivateDependencyModuleNames.AddRange(new string[] { });
	}
}
