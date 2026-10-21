'use strict';

/**
 * Runs the project's Claude Code subagents (.claude/agents/*.md) headlessly.
 *
 * Each call is `claude -p --agent <name>`, so the agent runs with its own system prompt,
 * tool allow-list and model from its frontmatter, in an isolated context. The prompt goes in
 * on stdin (large prompts would overflow argv). When a JSON Schema is supplied, the CLI's
 * structured output is used, so the result is parsed JSON rather than free text.
 */

const fs = require('node:fs');
const path = require('node:path');
const { spawn, spawnSync } = require('node:child_process');

function parseFrontmatter(markdown) {
  const match = /^---\r?\n([\s\S]*?)\r?\n---\r?\n?([\s\S]*)$/.exec(markdown);
  if (!match) return { meta: {}, body: markdown };
  const meta = {};
  for (const line of match[1].split(/\r?\n/)) {
    const kv = /^([A-Za-z][\w-]*):\s*(.*)$/.exec(line);
    if (kv) meta[kv[1]] = kv[2].trim();
  }
  return { meta, body: match[2] };
}

/** Loads every agent definition so the workflow can check the swarm is complete. */
function loadAgents(root) {
  const dir = path.join(root, '.claude', 'agents');
  const agents = new Map();
  if (!fs.existsSync(dir)) return agents;
  for (const file of fs.readdirSync(dir).filter((f) => f.endsWith('.md')).sort()) {
    const { meta, body } = parseFrontmatter(fs.readFileSync(path.join(dir, file), 'utf8'));
    if (!meta.name) continue;
    agents.set(meta.name, {
      name: meta.name,
      description: meta.description || '',
      tools: (meta.tools || '').split(',').map((t) => t.trim()).filter(Boolean),
      model: meta.model || 'inherit',
      file: path.relative(root, path.join(dir, file)),
      promptChars: body.length,
    });
  }
  return agents;
}

function claudeCliVersion() {
  const result = spawnSync('claude', ['--version'], { encoding: 'utf8', timeout: 20_000 });
  if (result.error || result.status !== 0) return null;
  return result.stdout.trim();
}

/** Finds the outermost JSON object in free text (fallback when structured output is absent). */
function extractJson(text) {
  if (typeof text !== 'string') return undefined;
  const fenced = /```(?:json)?\s*([\s\S]*?)```/.exec(text);
  const candidate = fenced ? fenced[1] : text;
  const start = candidate.indexOf('{');
  const end = candidate.lastIndexOf('}');
  if (start === -1 || end <= start) return undefined;
  try {
    return JSON.parse(candidate.slice(start, end + 1));
  } catch {
    return undefined;
  }
}

/**
 * @param {object} options
 * @param {string} options.agent        Agent name from .claude/agents.
 * @param {string} options.prompt       Task prompt (sent on stdin).
 * @param {string} options.cwd          Repository root.
 * @param {object} [options.jsonSchema] JSON Schema for structured output.
 * @param {string} [options.model]      Override the agent's model.
 * @param {string[]} [options.allowedTools] Tools pre-approved for this run (e.g. Edit for fixers).
 * @param {string} [options.permissionMode] e.g. "acceptEdits" for the auto-fix agent.
 * @param {number} [options.maxBudgetUsd] Hard spend cap for this call.
 * @param {number} [options.timeoutMs]
 * @returns {Promise<{ ok: boolean, data?: any, text?: string, costUsd: number, durationMs: number, error?: string }>}
 */
function runAgent(options) {
  const {
    agent, prompt, cwd, jsonSchema, model, allowedTools, permissionMode,
    maxBudgetUsd = 6, timeoutMs = 20 * 60_000,
  } = options;
  const args = ['-p', '--agent', agent, '--output-format', 'json', '--no-session-persistence'];
  if (jsonSchema) args.push('--json-schema', JSON.stringify(jsonSchema));
  if (model) args.push('--model', model);
  if (allowedTools && allowedTools.length) args.push('--allowedTools', allowedTools.join(','));
  if (permissionMode) args.push('--permission-mode', permissionMode);
  if (maxBudgetUsd) args.push('--max-budget-usd', String(maxBudgetUsd));

  const started = Date.now();
  return new Promise((resolve) => {
    const child = spawn('claude', args, { cwd, stdio: ['pipe', 'pipe', 'pipe'], env: process.env });
    let stdout = '';
    let stderr = '';
    const timer = setTimeout(() => child.kill('SIGTERM'), timeoutMs);
    child.stdout.on('data', (chunk) => { stdout += chunk; });
    child.stderr.on('data', (chunk) => { stderr += chunk; });
    child.on('error', (err) => {
      clearTimeout(timer);
      resolve({ ok: false, error: `Could not start claude CLI: ${err.message}`, costUsd: 0, durationMs: Date.now() - started });
    });
    child.on('close', (status, signal) => {
      clearTimeout(timer);
      const durationMs = Date.now() - started;
      let envelope;
      try {
        envelope = JSON.parse(stdout);
      } catch {
        const reason = signal ? `killed by ${signal} (timeout ${Math.round(timeoutMs / 1000)}s)` : `exit ${status}`;
        resolve({ ok: false, error: `claude ${reason}: ${(stderr || stdout).trim().slice(0, 400)}`, costUsd: 0, durationMs });
        return;
      }
      const costUsd = envelope.total_cost_usd || 0;
      if (envelope.is_error) {
        resolve({ ok: false, error: `${envelope.subtype || 'error'}: ${String(envelope.result || '').slice(0, 400)}`, costUsd, durationMs });
        return;
      }
      const data = envelope.structured_output !== undefined ? envelope.structured_output : extractJson(envelope.result);
      resolve({ ok: true, data, text: envelope.result, costUsd, durationMs });
    });
    child.stdin.end(prompt);
  });
}

/** Runs async tasks with bounded concurrency, preserving result order. */
async function pool(items, concurrency, worker) {
  const results = new Array(items.length);
  let next = 0;
  const runners = Array.from({ length: Math.min(concurrency, items.length) }, async () => {
    while (next < items.length) {
      const index = next++;
      results[index] = await worker(items[index], index);
    }
  });
  await Promise.all(runners);
  return results;
}

module.exports = { loadAgents, claudeCliVersion, runAgent, extractJson, parseFrontmatter, pool };
