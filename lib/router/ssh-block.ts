import { Client } from "ssh2";
import type { RouterConfig } from "@/lib/types";

export type BlockResult = { success: true } | { success: false; error: string };

export function blockMacOnRouter(
  config: Pick<
    RouterConfig,
    "router_ip" | "username" | "password" | "block_command_template"
  >,
  mac: string
): Promise<BlockResult> {
  const command = config.block_command_template.replaceAll("{mac}", mac);

  return new Promise((resolve) => {
    const conn = new Client();

    conn
      .on("ready", () => {
        conn.exec(command, (err, stream) => {
          if (err) {
            conn.end();
            resolve({ success: false, error: err.message });
            return;
          }

          let stderr = "";
          stream
            .on("close", (code: number) => {
              conn.end();
              if (code === 0) {
                resolve({ success: true });
              } else {
                resolve({
                  success: false,
                  error: stderr || `Router command exited with code ${code}`,
                });
              }
            })
            .on("data", () => {
              // stdout ignored; only exit code + stderr matter here
            })
            .stderr.on("data", (data: Buffer) => {
              stderr += data.toString();
            });
        });
      })
      .on("error", (err) => {
        resolve({ success: false, error: err.message });
      })
      .connect({
        host: config.router_ip,
        username: config.username,
        password: config.password,
        readyTimeout: 10_000,
      });
  });
}
