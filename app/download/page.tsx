import type { Metadata } from "next";
import { promises as fs } from "fs";
import path from "path";
import DownloadView from "./DownloadView";

export const metadata: Metadata = {
  title: "ດາວໂຫຼດແອັບຊ່າງ",
  description: "ດາວໂຫຼດແອັບຊ່າງ ODG ສຳລັບ Android",
};

// App build metadata. Bump `VERSION` whenever a new APK is published so the
// page shows the right number; the file size is read from disk at request time.
const VERSION = "1.0.1";
const APK_PATH = "/downloads/saang-app.apk";

async function getApkSizeLabel(): Promise<string | null> {
  try {
    const stat = await fs.stat(path.join(process.cwd(), "public", "downloads", "saang-app.apk"));
    const mb = stat.size / (1024 * 1024);
    return `${mb.toFixed(1)} MB`;
  } catch {
    return null;
  }
}

export default async function DownloadPage() {
  const sizeLabel = await getApkSizeLabel();

  return <DownloadView version={VERSION} apkPath={APK_PATH} sizeLabel={sizeLabel} />;
}
