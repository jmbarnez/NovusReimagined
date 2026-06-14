// Ambient module declarations for non-code imports handled by Vite
declare module "*.css" {
  const content: string;
  export default content;
}

interface Window {
  webkitAudioContext?: typeof AudioContext;
  novusPerf?: import("./render/perf-devtools.js").NovusPerfDevtools;
}
