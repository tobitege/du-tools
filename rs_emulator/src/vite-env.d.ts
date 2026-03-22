/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_RS_ENABLE_IMAGE_LOADING?: string;
  readonly VITE_RS_ENABLE_LUA_HOST_IO?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}

declare module "*.lua?raw" {
  const content: string;
  export default content;
}
