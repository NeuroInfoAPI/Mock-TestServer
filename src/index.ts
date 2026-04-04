import { NiaTestCli } from "./cli";
import { NiaTestServer } from "./server";

export namespace Index {}

function getPortFromEnv(): number {
  const raw = Number(process.env.PORT ?? "8787");
  if (!Number.isFinite(raw) || raw <= 0) return 8787;
  return Math.floor(raw);
}

async function main(): Promise<void> {
  const server = NiaTestServer.start({
    host: process.env.HOST || "0.0.0.0",
    port: getPortFromEnv(),
  });

  await NiaTestCli.run({ server });
}

void main().catch((error) => {
  console.error(error);
  process.exit(1);
});
