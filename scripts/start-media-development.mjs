import fs from "node:fs";
import dotenv from "dotenv";
import { spawn } from "node:child_process";

const settings = dotenv.parse(fs.readFileSync(".env"));
const source = process.env.KONO_MEDIA_DEV_DATABASE_URL ?? settings.KONO_MEDIA_DEV_DATABASE_URL;
if (!source || process.env.NODE_TLS_REJECT_UNAUTHORIZED === "0") throw new Error("Missing or unsafe development configuration.");
const dev = new URL(source);
if (!dev.hostname.endsWith(".neon.tech") || dev.hostname.split(".")[0].replace(/-pooler$/, "") !== "ep-lucky-fire-b3froe7u"
  || decodeURIComponent(dev.pathname.slice(1)) !== "neondb" || !["postgres:", "postgresql:"].includes(dev.protocol)) {
  throw new Error("Wrong media development endpoint/database.");
}
dev.searchParams.set("sslmode", "verify-full");
const child = spawn(process.execPath, ["node_modules/next/dist/bin/next", "dev", "--hostname", "127.0.0.1", "--port", "3001"], {
  stdio: "inherit", env: { ...process.env, DATABASE_URL: dev.toString(), KONO_MEDIA_DEV_RUNTIME: "1" },
});
child.on("error", () => { console.error("Could not start the media development server."); process.exitCode = 1; });
child.on("exit", code => { process.exitCode = code ?? 1; });
