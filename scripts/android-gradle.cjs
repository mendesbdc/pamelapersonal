/**
 * Executa apenas o Gradle (apos `npm run android:sync`).
 * Define JAVA_HOME para tools/jdk-21 se existir; no Windows usa cwd=android
 * para nao partir caminhos com espacos.
 */
const { spawnSync, execSync } = require("child_process");
const fs = require("fs");
const path = require("path");

const projectRoot = path.join(__dirname, "..");
const localJdk = path.join(projectRoot, "tools", "jdk-21");
const java =
  process.platform === "win32"
    ? path.join(localJdk, "bin", "java.exe")
    : path.join(localJdk, "bin", "java");

if (fs.existsSync(java)) {
  process.env.JAVA_HOME = localJdk;
  const sep = path.delimiter;
  process.env.PATH = `${path.join(localJdk, "bin")}${sep}${process.env.PATH || ""}`;
}

function run(cmd, args, options) {
  const r = spawnSync(cmd, args, { stdio: "inherit", ...options });
  const code = r.status;
  if (code === 0 || code === null) return 0;
  return typeof code === "number" ? code : 1;
}

const androidDir = path.join(projectRoot, "android");

if (process.platform === "win32") {
  try {
    execSync("gradlew.bat --no-daemon --max-workers=1 clean assembleDebug", {
      stdio: "inherit",
      env: process.env,
      windowsHide: true,
      shell: true,
      cwd: androidDir,
    });
  } catch (e) {
    const code = e && e.status;
    process.exit(typeof code === "number" && code > 0 ? code : 1);
  }
} else if (run(path.join(androidDir, "gradlew"), ["--no-daemon", "--max-workers=1", "clean", "assembleDebug"], { cwd: androidDir })) {
  process.exit(1);
}
process.exit(0);
