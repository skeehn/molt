/**
 * Codex Plugin
 * 
 * Integrates OpenAI's Codex CLI as an agent plugin.
 * Uses exec mode for one-shot tasks.
 */

import { spawn } from "child_process";
import type { AgentPlugin, AgentTask, AgentResult, AgentCapability } from "./types.ts";

export class CodexPlugin implements AgentPlugin {
  name = "codex";
  version = "1.x";
  capabilities: AgentCapability[] = [
    "feature-dev",
    "bug-fixing",
    "refactoring",
    "testing",
  ];
  
  supportsPrintMode = true;
  supportsInteractive = false;
  supportsPTY = true;

  private binaryPath: string;

  constructor(binaryPath = "codex") {
    this.binaryPath = binaryPath;
  }

  async isInstalled(): Promise<boolean> {
    return new Promise((resolve) => {
      const proc = spawn(this.binaryPath, ["--version"], {
        stdio: "ignore",
        shell: true,
      });
      proc.on("close", (code: number) => resolve(code === 0));
      proc.on("error", () => resolve(false));
    });
  }

  async getVersion(): Promise<string> {
    return new Promise((resolve, reject) => {
      let output = "";
      const proc = spawn(this.binaryPath, ["--version"], {
        stdio: ["ignore", "pipe", "ignore"],
        shell: true,
      });
      
      proc.stdout.on("data", (chunk: Buffer) => {
        output += chunk.toString();
      });
      
      proc.on("close", (code: number) => {
        if (code === 0) {
          resolve(output.trim());
        } else {
          reject(new Error(`Failed to get version: exit code ${code}`));
        }
      });
      
      proc.on("error", (err: Error) => reject(err));
    });
  }

  async execute(task: AgentTask): Promise<AgentResult> {
    if (task.mode !== "oneshot") {
      throw new Error("Only oneshot mode supported for Codex");
    }

    return this.executeExecMode(task);
  }

  private async executeExecMode(task: AgentTask): Promise<AgentResult> {
    const args = [
      "exec",
      "--json",  // Output JSONL events for structured parsing
      "--skip-git-repo-check",  // Allow running outside git repos
      task.prompt,
    ];

    const startTime = Date.now();

    return new Promise((resolve) => {
      let stdout = "";
      let stderr = "";
      
      const proc = spawn(this.binaryPath, args, {
        cwd: task.workdir,
        stdio: ["ignore", "pipe", "pipe"],
        shell: true,
        timeout: task.constraints?.timeoutSeconds
          ? task.constraints.timeoutSeconds * 1000
          : 180_000,
      });

      proc.stdout.on("data", (chunk: Buffer) => {
        stdout += chunk.toString();
      });

      proc.stderr.on("data", (chunk: Buffer) => {
        stderr += chunk.toString();
      });

      proc.on("close", (code: number) => {
        const durationMs = Date.now() - startTime;
        
        resolve({
          success: code === 0,
          output: stdout || stderr || `Codex exited with code ${code}`,
          durationMs,
          exitReason: code === 0 ? "completed" : "error",
          metadata: {
            exitCode: code,
            rawStderr: stderr.slice(0, 1000), // Truncate
          },
        });
      });

      proc.on("error", (err: Error) => {
        const durationMs = Date.now() - startTime;
        resolve({
          success: false,
          output: `Failed to spawn codex: ${err.message}`,
          durationMs,
          exitReason: "error",
        });
      });
    });
  }
}
