export interface RuntimeFlags {
  imageLoadingEnabled: boolean;
  luaHostIoEnabled: boolean;
}

function parseBooleanFlag(value: string | undefined): boolean {
  if (!value) {
    return false;
  }

  const normalized = value.trim().toLowerCase();
  return normalized === "1" || normalized === "true" || normalized === "yes" || normalized === "on";
}

export function readRuntimeFlags(env: ImportMetaEnv = import.meta.env): RuntimeFlags {
  return {
    imageLoadingEnabled: parseBooleanFlag(env.VITE_RS_ENABLE_IMAGE_LOADING),
    luaHostIoEnabled: parseBooleanFlag(env.VITE_RS_ENABLE_LUA_HOST_IO),
  };
}

export const runtimeFlags = readRuntimeFlags();
