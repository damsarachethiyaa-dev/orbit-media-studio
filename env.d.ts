interface ImportMetaEnv {
  readonly VITE_ORBIT_ENGINE_URL?: string;
  readonly VITE_ORBIT_ENGINE_KEY?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
