import { createRequire } from "node:module";
import { describe, expect, it } from "vitest";

const require = createRequire(import.meta.url);
const { scanSource, scanDirs } = require("../scripts/workflow/auditor.js");

type Finding = { rule: string; severity: string; fix?: unknown };
const rules = (code: string) => (scanSource("Fixture.tsx", code) as Finding[]).map((f) => f.rule);

describe("security-qa-auditor scanner", () => {
  it("flags XSS sinks", () => {
    expect(rules(`export const A = ({ h }: { h: string }) => <div dangerouslySetInnerHTML={{ __html: h }} />;`)).toContain("xss/dangerously-set-inner-html");
    expect(rules(`export function f(el: HTMLElement, s: string) { el.innerHTML = s; el.insertAdjacentHTML("beforeend", s); }`)).toEqual(["xss/dom-html-sink", "xss/dom-html-sink"]);
    expect(rules(`export const run = (s: string) => eval(s);`)).toEqual(["xss/code-eval"]);
    expect(rules(`export const A = () => <a href="javascript:void(0)">x</a>;`)).toContain("xss/javascript-url");
  });

  it("flags unnamed controls but accepts text, aria-label and sr-only names", () => {
    const head = `import { X } from "lucide-react";\n`;
    expect(rules(`${head}export const A = () => <button><X /></button>;`)).toEqual(["a11y/icon-button-name"]);
    expect(rules(`${head}export const A = () => <button aria-label="Close"><X /></button>;`)).toEqual([]);
    expect(rules(`${head}export const A = () => <button><X aria-hidden /><span className="sr-only">Close</span></button>;`)).toEqual([]);
    expect(rules(`${head}export const A = ({ label }: { label: string }) => <button><X />{label}</button>;`)).toEqual([]);
  });

  it("checks form labels via htmlFor, wrapping labels and aria-label", () => {
    expect(rules(`export const A = () => <input type="text" />;`)).toEqual(["a11y/form-label"]);
    expect(rules(`export const A = () => <><label htmlFor="n">Name</label><input id="n" /></>;`)).toEqual([]);
    expect(rules(`export const A = () => <label>Name <input /></label>;`)).toEqual([]);
    expect(rules(`export const A = () => <input type="hidden" />;`)).toEqual([]);
  });

  it("does not report anything high-severity in the shipped UI", () => {
    const { findings } = scanDirs(process.cwd(), ["src/app", "src/components"]) as { findings: Finding[] };
    expect(findings.filter((f) => f.severity === "high")).toEqual([]);
  });
});
