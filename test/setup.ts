import os from "node:os";
import path from "node:path";

// A throwaway config dir per worker so tests never touch the real saved login or settings, nor race each other's.
process.env.XDG_CONFIG_HOME = path.join(os.tmpdir(), `clozemaster-cli-test-${process.pid}-${process.env.VITEST_POOL_ID}`);
