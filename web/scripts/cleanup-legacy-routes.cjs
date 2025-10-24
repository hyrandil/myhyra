const fs = require("fs/promises");
const path = require("path");

const legacyTargets = ["app/(admin)", "app/(customer)"];

async function removeLegacyTarget(relativePath) {
  const fullPath = path.join(__dirname, "..", relativePath);
  try {
    const stat = await fs.lstat(fullPath);
    if (stat.isDirectory()) {
      await fs.rm(fullPath, { recursive: true, force: true });
    } else {
      await fs.rm(fullPath, { force: true });
    }
    console.log(`Removed legacy route artifact: ${relativePath}`);
  } catch (error) {
    if (error && error.code !== "ENOENT") {
      console.warn(`Could not clean ${relativePath}:`, error.message);
    }
  }
}

(async () => {
  await Promise.all(legacyTargets.map(removeLegacyTarget));
})();
