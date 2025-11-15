import { ProfileConfig, ValnorConfig } from "./types.js";

export function resolveProfile(
   profile: ProfileConfig | string | undefined,
   config: ValnorConfig,
): string | undefined {
   if (!profile) return undefined;
   if (typeof profile === "string") return profile;

   for (const [key, value] of Object.entries(config.profiles)) {
      if (value === profile) return key;
   }

   throw new Error("Profile not found in config");
}
