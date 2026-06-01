export const APP_VERSION = "0.2.0";
export const BUILD_NUMBER = 8;

export function formatBuildLabel(): string {
  return `v${APP_VERSION} / BUILD ${BUILD_NUMBER}`;
}
