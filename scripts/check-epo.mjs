import {
  EpoOpsClient,
  formatEpoOpsError,
} from "../lib/patents/epo-client.ts";

try {
  const client = new EpoOpsClient();
  await client.checkConnection();
  console.log("EPO OPS connection successful");
} catch (error) {
  console.error(formatEpoOpsError(error));
  process.exitCode = 1;
}
