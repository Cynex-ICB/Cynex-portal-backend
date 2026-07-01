import fs from "fs";
import os from "os";
import path from "path";

function isVercelRuntime() {
  return Boolean(
    process.env.VERCEL ||
      process.env.VERCEL_ENV ||
      process.cwd().startsWith("/var/task")
  );
}




export function getUploadRoot() {
  if (isVercelRuntime()) {
    return path.join(os.tmpdir(), "uploads");
  }

  return path.join(process.cwd(), "server", "uploads");
}

export function getUploadDir(...segments) {
  return path.join(getUploadRoot(), ...segments);
}

export function ensureUploadDir(...segments) {
  const uploadDir = getUploadDir(...segments);
  fs.mkdirSync(uploadDir, { recursive: true });
  return uploadDir;
}
