// Next.js awaits register before accepting requests. The opt-in local media dev
// process must prove its actual Prisma database identity before any route runs.
export async function register() {
  if (process.env.KONO_MEDIA_DEV_RUNTIME !== "1" || process.env.NEXT_RUNTIME !== "nodejs") return;
  try {
    const { verifyMediaDevelopmentRuntime } = await import("@/features/products/images/services/media-dev-runtime.service");
    const identity = await verifyMediaDevelopmentRuntime();
    console.info("KONO media development runtime verified:", identity);
  } catch (error) {
    const code = error && typeof error === "object" && "code" in error && /^[A-Z0-9_]{1,40}$/.test(String(error.code)) ? String(error.code) : "RUNTIME_CHECK_FAILED";
    console.error("KONO media development startup check:", code);
    throw new Error("Media development database verification failed. Server startup is blocked; raw error details suppressed.");
  }
}
