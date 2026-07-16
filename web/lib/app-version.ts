import generated from "./generated/app-version.json";

/** 大版本号：只在较大改版（如今天这次导航/AI配置改版）时手动 +1。 */
export const APP_VERSION_MAJOR = 1;

/** 展示用版本号：v{大版本号}.{构建号}，构建号是 git 提交数，每次推送自动 +1，无需手动维护。 */
export function getAppVersion(): { label: string; commitSha: string } {
  return {
    label: `v${APP_VERSION_MAJOR}.${generated.commitCount}`,
    commitSha: generated.commitSha,
  };
}
