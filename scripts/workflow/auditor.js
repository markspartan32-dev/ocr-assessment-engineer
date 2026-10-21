'use strict';

/**
 * Deterministic half of the security-qa-auditor: a TypeScript-AST scanner for React XSS
 * sinks and WCAG accessibility defects, with exact source edits for the issues that have
 * an unambiguous safe fix. workflow.js runs it in a loop (scan → fix → rescan) until no
 * high-severity finding remains, handing anything it cannot fix to the UI agent.
 */

const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const ts = require('typescript');

const RULES = {
  'xss/dangerously-set-inner-html': { severity: 'high', title: 'dangerouslySetInnerHTML renders raw HTML' },
  'xss/dom-html-sink': { severity: 'high', title: 'DOM HTML sink (innerHTML, outerHTML, insertAdjacentHTML, document.write)' },
  'xss/code-eval': { severity: 'high', title: 'Dynamic code evaluation' },
  'xss/javascript-url': { severity: 'high', title: 'javascript: URL' },
  'security/hardcoded-secret': { severity: 'high', title: 'Hard-coded credential' },
  'security/reverse-tabnabbing': { severity: 'medium', title: 'target="_blank" without rel="noopener noreferrer"' },
  'a11y/icon-button-name': { severity: 'high', title: 'Control has no accessible name' },
  'a11y/img-alt': { severity: 'high', title: 'Image without alt text' },
  'a11y/form-label': { severity: 'high', title: 'Form field without a label' },
  'a11y/click-events-have-key-events': { severity: 'medium', title: 'Click handler on a non-interactive element' },
  'a11y/dialog-name': { severity: 'medium', title: 'Dialog without aria-modal or an accessible name' },
  'a11y/html-lang': { severity: 'medium', title: '<html> without lang' },
  'a11y/no-positive-tabindex': { severity: 'low', title: 'Positive tabIndex breaks focus order' },
};

const SEVERITY_ORDER = { high: 0, medium: 1, low: 2 };

/** Labels for common icon-only controls; used only to auto-name buttons whose icon makes intent unambiguous. */
const ICON_LABELS = {
  X: 'Close', XIcon: 'Close', Menu: 'Open menu', Search: 'Search', Trash: 'Delete', Trash2: 'Delete',
  Settings: 'Settings', Settings2: 'Settings', ChevronLeft: 'Previous', ChevronRight: 'Next',
  ArrowLeft: 'Back', ArrowRight: 'Next', Plus: 'Add', Minus: 'Remove', Pencil: 'Edit', SquarePen: 'Edit',
  RotateCcw: 'Reset', RefreshCw: 'Refresh', Play: 'Play', Pause: 'Pause', Copy: 'Copy',
  Download: 'Download', Upload: 'Upload', Maximize2: 'Enter full screen', Minimize2: 'Exit full screen',
  Eye: 'Show', EyeOff: 'Hide', Info: 'More information', CircleHelp: 'Help', HelpCircle: 'Help',
  Undo2: 'Undo', Redo2: 'Redo', Share2: 'Share', ExternalLink: 'Open in new tab', LogOut: 'Sign out',
  Bell: 'Notifications', Filter: 'Filter', Ellipsis: 'More options', MoreHorizontal: 'More options',
};

const SECRET_PATTERNS = [
  /sk-(?:ant|live|proj)[-_][A-Za-z0-9_-]{20,}/,
  /AKIA[0-9A-Z]{16}/,
  /-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----/,
  /gh[pousr]_[A-Za-z0-9]{36}/,
  /xox[baprs]-[A-Za-z0-9-]{10,}/,
  /AIza[0-9A-Za-z_-]{35}/,
];

const NON_INTERACTIVE = new Set(['div', 'span', 'li', 'p', 'section', 'article', 'header', 'footer', 'main', 'td', 'tr', 'ul', 'ol', 'img', 'h1', 'h2', 'h3', 'aside', 'nav']);
const INTERACTIVE_ROLES = new Set(['button', 'link', 'checkbox', 'menuitem', 'option', 'tab', 'switch', 'radio', 'slider', 'gridcell', 'treeitem']);
const NAME_ATTRS = ['aria-label', 'aria-labelledby', 'title'];

// ---- JSX helpers --------------------------------------------------------------------------

const baseTag = (name) => (name.startsWith('motion.') ? name.slice('motion.'.length) : name);

function attributesOf(opening) {
  const map = new Map();
  let spread = false;
  for (const prop of opening.attributes.properties) {
    if (ts.isJsxSpreadAttribute(prop)) spread = true;
    else if (ts.isJsxAttribute(prop)) map.set(prop.name.getText(), prop);
  }
  return { map, spread };
}

/** Static attribute value: a string, `true` for a bare attribute, or undefined when dynamic. */
function staticValue(attr) {
  if (!attr) return undefined;
  const init = attr.initializer;
  if (!init) return true;
  if (ts.isStringLiteral(init)) return init.text;
  if (ts.isJsxExpression(init) && init.expression) {
    const expr = init.expression;
    if (ts.isStringLiteral(expr) || ts.isNoSubstitutionTemplateLiteral(expr)) return expr.text;
    if (ts.isNumericLiteral(expr)) return expr.text;
    if (expr.kind === ts.SyntaxKind.TrueKeyword) return true;
    if (expr.kind === ts.SyntaxKind.FalseKeyword) return false;
  }
  return undefined;
}

const hasName = (attrs) => NAME_ATTRS.some((name) => {
  if (!attrs.map.has(name)) return false;
  const value = staticValue(attrs.map.get(name));
  return value === undefined || (typeof value === 'string' && value.trim() !== '');
});

const insertAttr = (opening, text) => ({ start: opening.tagName.end, end: opening.tagName.end, text: ` ${text}` });
const jsxString = (value) => `{${JSON.stringify(value)}}`;

// ---- Scanner ------------------------------------------------------------------------------

function scanSource(fileName, text, root = process.cwd()) {
  const kind = /\.(t|j)sx$/.test(fileName) ? ts.ScriptKind.TSX : ts.ScriptKind.TS;
  const sf = ts.createSourceFile(fileName, text, ts.ScriptTarget.Latest, true, kind);
  const rel = path.relative(root, fileName) || fileName;
  const findings = [];

  // Names imported from icon libraries render an <svg> with no text.
  const iconNames = new Set();
  const labelTargets = new Set();
  let dynamicHtmlFor = false;
  for (const stmt of sf.statements) {
    if (ts.isImportDeclaration(stmt) && /lucide-react|react-icons|heroicons/.test(stmt.moduleSpecifier.getText())) {
      const bindings = stmt.importClause && stmt.importClause.namedBindings;
      if (bindings && ts.isNamedImports(bindings)) bindings.elements.forEach((el) => iconNames.add(el.name.text));
    }
  }
  const isIcon = (tag) => tag === 'svg' || iconNames.has(tag) || /Icon$/.test(tag);

  (function collectLabels(node) {
    if ((ts.isJsxSelfClosingElement(node) || ts.isJsxOpeningElement(node)) && baseTag(node.tagName.getText()) === 'label') {
      const forAttr = attributesOf(node).map.get('htmlFor');
      const value = staticValue(forAttr);
      if (typeof value === 'string') labelTargets.add(value);
      else if (forAttr) dynamicHtmlFor = true;
    }
    ts.forEachChild(node, collectLabels);
  })(sf);

  const report = (rule, node, message, fix) => {
    const { line, character } = sf.getLineAndCharacterOfPosition(node.getStart(sf));
    const evidence = node.getText(sf).split('\n')[0].trim().slice(0, 140);
    findings.push({ rule, severity: RULES[rule].severity, file: rel, line: line + 1, column: character + 1, message, evidence, ...(fix ? { fix } : {}), source: 'scanner' });
  };

  /** Could these JSX children produce an accessible name? Unknown components are assumed to. */
  function childrenHaveText(children) {
    for (const child of children) {
      if (ts.isJsxText(child)) {
        if (child.text.trim()) return true;
      } else if (ts.isJsxExpression(child)) {
        if (child.expression) return true;
      } else if (ts.isJsxFragment(child)) {
        if (childrenHaveText(child.children)) return true;
      } else if (ts.isJsxSelfClosingElement(child) || ts.isJsxElement(child)) {
        const opening = ts.isJsxElement(child) ? child.openingElement : child;
        const tag = baseTag(opening.tagName.getText());
        const attrs = attributesOf(opening);
        if (hasName(attrs) || (attrs.map.has('alt') && staticValue(attrs.map.get('alt')) !== '')) return true;
        if (staticValue(attrs.map.get('aria-hidden')) === 'true' || staticValue(attrs.map.get('aria-hidden')) === true) continue;
        if (isIcon(tag)) continue;
        if (/^[A-Z]/.test(tag)) return true;
        if (ts.isJsxElement(child) && childrenHaveText(child.children)) return true;
      }
    }
    return false;
  }

  function firstIcon(children) {
    for (const child of children) {
      if (ts.isJsxSelfClosingElement(child)) {
        const tag = child.tagName.getText();
        if (isIcon(tag)) return tag;
      } else if (ts.isJsxElement(child)) {
        const nested = firstIcon(child.children);
        if (nested) return nested;
      }
    }
    return undefined;
  }

  function insideLabel(node) {
    for (let p = node.parent; p && !ts.isSourceFile(p); p = p.parent) {
      if (ts.isJsxElement(p) && baseTag(p.openingElement.tagName.getText()) === 'label') return true;
    }
    return false;
  }

  function checkElement(element) {
    const selfClosing = ts.isJsxSelfClosingElement(element);
    const opening = selfClosing ? element : element.openingElement;
    const rawTag = opening.tagName.getText();
    const tag = baseTag(rawTag);
    const attrs = attributesOf(opening);
    const get = (name) => staticValue(attrs.map.get(name));

    // dangerouslySetInnerHTML → render the value as text instead.
    const dsih = attrs.map.get('dangerouslySetInnerHTML');
    if (dsih) {
      let fix;
      const expr = dsih.initializer && ts.isJsxExpression(dsih.initializer) ? dsih.initializer.expression : undefined;
      const emptyBody = selfClosing || element.children.every((c) => ts.isJsxText(c) && !c.text.trim());
      if (expr && ts.isObjectLiteralExpression(expr) && expr.properties.length === 1 && emptyBody) {
        const prop = expr.properties[0];
        if (ts.isPropertyAssignment(prop) && prop.name.getText() === '__html') {
          const others = opening.attributes.properties.filter((p) => p !== dsih).map((p) => ` ${p.getText(sf)}`).join('');
          fix = {
            description: 'Render the value as escaped text children instead of raw HTML.',
            edits: [{ start: element.getStart(sf), end: element.end, text: `<${rawTag}${others}>{${prop.initializer.getText(sf)}}</${rawTag}>` }],
          };
        }
      }
      report('xss/dangerously-set-inner-html', dsih, 'Raw HTML injection point. Render text, or sanitise with a vetted library.', fix);
    }

    // javascript: URLs.
    for (const name of ['href', 'src', 'action', 'formAction', 'xlinkHref']) {
      const attr = attrs.map.get(name);
      const value = staticValue(attr);
      if (typeof value === 'string' && /^\s*javascript:/i.test(value)) {
        report('xss/javascript-url', attr, `${name} uses a javascript: URL.`, {
          description: 'Replace the javascript: URL with an inert fragment link.',
          edits: [{ start: attr.initializer.getStart(sf), end: attr.initializer.end, text: '"#"' }],
        });
      }
    }

    // Reverse tabnabbing.
    if (get('target') === '_blank') {
      const relAttr = attrs.map.get('rel');
      const rel = staticValue(relAttr);
      if (!relAttr || (typeof rel === 'string' && !/noopener/.test(rel))) {
        const merged = [...new Set([...(typeof rel === 'string' ? rel.split(/\s+/) : []), 'noopener', 'noreferrer'].filter(Boolean))].join(' ');
        const target = attrs.map.get('target');
        report('security/reverse-tabnabbing', target, 'target="_blank" without rel="noopener noreferrer".', {
          description: 'Add rel="noopener noreferrer".',
          edits: relAttr
            ? [{ start: relAttr.initializer.getStart(sf), end: relAttr.initializer.end, text: JSON.stringify(merged) }]
            : [{ start: target.end, end: target.end, text: ` rel=${JSON.stringify(merged)}` }],
        });
      }
    }

    // Controls without an accessible name.
    const isLink = (tag === 'a' && attrs.map.has('href')) || tag === 'Link';
    if ((tag === 'button' || isLink) && !attrs.spread && !hasName(attrs)) {
      const empty = selfClosing || !childrenHaveText(element.children);
      if (empty) {
        const icon = selfClosing ? undefined : firstIcon(element.children);
        const label = icon && ICON_LABELS[icon.replace(/Icon$/, '')];
        report('a11y/icon-button-name', opening, `${tag === 'button' ? 'Button' : 'Link'} has no text and no aria-label.`, label && {
          description: `Add aria-label "${label}" (derived from the ${icon} icon).`,
          edits: [insertAttr(opening, `aria-label=${jsxString(label)}`)],
        });
      }
    }

    // Images.
    if ((tag === 'img' || tag === 'Image') && !attrs.spread && !attrs.map.has('alt')) {
      const decorative = get('aria-hidden') === 'true' || get('aria-hidden') === true || ['presentation', 'none'].includes(get('role'));
      report('a11y/img-alt', opening, 'Image has no alt attribute.', decorative && {
        description: 'Image is marked decorative; add alt="".',
        edits: [insertAttr(opening, 'alt=""')],
      });
    }

    // Form fields.
    if (['input', 'textarea', 'select'].includes(tag) && !attrs.spread) {
      const type = get('type');
      const exempt = tag === 'input' && ['hidden', 'submit', 'button', 'reset', 'image'].includes(type);
      const id = get('id');
      const labelled = hasName(attrs)
        || (typeof id === 'string' && labelTargets.has(id))
        || (attrs.map.has('id') && id === undefined && dynamicHtmlFor)
        || insideLabel(element);
      if (!exempt && !labelled) {
        const placeholder = get('placeholder');
        report('a11y/form-label', opening, `<${tag}> has no associated label.`, typeof placeholder === 'string' && placeholder.trim() && {
          description: `Add aria-label from the placeholder ("${placeholder}").`,
          edits: [insertAttr(opening, `aria-label=${jsxString(placeholder)}`)],
        });
      }
    }

    // Click handlers on non-interactive elements.
    if (NON_INTERACTIVE.has(tag) && attrs.map.has('onClick')) {
      const role = get('role');
      const hidden = get('aria-hidden') === 'true' || get('aria-hidden') === true || ['presentation', 'none'].includes(role);
      const keyboard = ['onKeyDown', 'onKeyUp', 'onKeyPress'].some((k) => attrs.map.has(k));
      const roleOk = role === undefined ? attrs.map.has('role') : INTERACTIVE_ROLES.has(role);
      if (!hidden && !(keyboard && roleOk && attrs.map.has('tabIndex'))) {
        report('a11y/click-events-have-key-events', opening, `<${tag} onClick> needs role, tabIndex and a key handler (or use <button>).`);
      }
    }

    // Positive tabIndex.
    const tabIndexAttr = attrs.map.get('tabIndex');
    const tabIndex = Number(staticValue(tabIndexAttr));
    if (tabIndexAttr && Number.isFinite(tabIndex) && tabIndex > 0) {
      report('a11y/no-positive-tabindex', tabIndexAttr, `tabIndex=${tabIndex} overrides the natural focus order.`, {
        description: 'Use tabIndex={0}.',
        edits: [{ start: tabIndexAttr.initializer.getStart(sf), end: tabIndexAttr.initializer.end, text: '{0}' }],
      });
    }

    // Dialogs.
    const role = get('role');
    if (role === 'dialog' || role === 'alertdialog' || tag === 'dialog') {
      const named = ['aria-label', 'aria-labelledby'].some((n) => attrs.map.has(n)) || attrs.spread;
      const modal = attrs.map.has('aria-modal') || tag === 'dialog' || attrs.spread;
      if (!named || !modal) {
        report('a11y/dialog-name', opening, `Dialog is missing ${[!modal && 'aria-modal', !named && 'an accessible name'].filter(Boolean).join(' and ')}.`, !modal && named && {
          description: 'Add aria-modal="true".',
          edits: [insertAttr(opening, 'aria-modal="true"')],
        });
      }
    }

    if (tag === 'html' && !attrs.map.has('lang') && !attrs.spread) {
      report('a11y/html-lang', opening, '<html> has no lang attribute.', {
        description: 'Add lang="en-GB".',
        edits: [insertAttr(opening, 'lang="en-GB"')],
      });
    }
  }

  function visit(node) {
    if (ts.isJsxSelfClosingElement(node) || ts.isJsxElement(node)) checkElement(node);

    if (ts.isBinaryExpression(node) && [ts.SyntaxKind.EqualsToken, ts.SyntaxKind.PlusEqualsToken].includes(node.operatorToken.kind)
      && ts.isPropertyAccessExpression(node.left) && ['innerHTML', 'outerHTML'].includes(node.left.name.text)) {
      const name = node.left.name;
      report('xss/dom-html-sink', node, `Assignment to ${name.text}.`, name.text === 'innerHTML' && {
        description: 'Assign to textContent so the value is treated as text.',
        edits: [{ start: name.getStart(sf), end: name.end, text: 'textContent' }],
      });
    }

    if (ts.isCallExpression(node)) {
      const callee = node.expression;
      if (ts.isPropertyAccessExpression(callee)) {
        const method = callee.name.text;
        if (method === 'insertAdjacentHTML') {
          report('xss/dom-html-sink', node, 'insertAdjacentHTML parses its argument as HTML.', {
            description: 'Use insertAdjacentText.',
            edits: [{ start: callee.name.getStart(sf), end: callee.name.end, text: 'insertAdjacentText' }],
          });
        }
        if ((method === 'write' || method === 'writeln') && callee.expression.getText(sf) === 'document') {
          report('xss/dom-html-sink', node, `document.${method} writes raw HTML.`);
        }
      }
      const calleeName = ts.isIdentifier(callee) ? callee.text : ts.isPropertyAccessExpression(callee) ? callee.name.text : '';
      if (ts.isIdentifier(callee) && (calleeName === 'eval' || calleeName === 'Function')) {
        report('xss/code-eval', node, `${calleeName}() executes strings as code.`);
      }
      const first = node.arguments[0];
      if ((calleeName === 'setTimeout' || calleeName === 'setInterval') && first
        && (ts.isStringLiteral(first) || ts.isNoSubstitutionTemplateLiteral(first) || ts.isTemplateExpression(first))) {
        report('xss/code-eval', node, `${calleeName} with a string argument evaluates code.`);
      }
    }
    if (ts.isNewExpression(node) && ts.isIdentifier(node.expression) && node.expression.text === 'Function') {
      report('xss/code-eval', node, 'new Function() executes strings as code.');
    }

    if (ts.isStringLiteral(node) || ts.isNoSubstitutionTemplateLiteral(node) || ts.isTemplateHead(node)
      || ts.isTemplateMiddle(node) || ts.isTemplateTail(node)) {
      if (SECRET_PATTERNS.some((pattern) => pattern.test(node.text))) {
        report('security/hardcoded-secret', node, 'String looks like a credential. Move it to an environment variable.');
      }
    }

    ts.forEachChild(node, visit);
  }

  visit(sf);
  return findings;
}

// ---- File system ---------------------------------------------------------------------------

function listSourceFiles(root, dirs) {
  const out = [];
  const walk = (dir) => {
    if (!fs.existsSync(dir)) return;
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      const full = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        if (entry.name !== 'node_modules' && !entry.name.startsWith('.')) walk(full);
      } else if (/\.(tsx?|jsx?)$/.test(entry.name) && !/\.(test|spec)\.[tj]sx?$/.test(entry.name) && !entry.name.endsWith('.d.ts')) {
        out.push(full);
      }
    }
  };
  dirs.forEach((dir) => walk(path.resolve(root, dir)));
  return out.sort();
}

function scanDirs(root, dirs) {
  const files = listSourceFiles(root, dirs);
  const findings = files.flatMap((file) => scanSource(file, fs.readFileSync(file, 'utf8'), root));
  findings.sort((a, b) => SEVERITY_ORDER[a.severity] - SEVERITY_ORDER[b.severity] || a.file.localeCompare(b.file) || a.line - b.line);
  return { files, findings };
}

function syntaxErrors(fileName, text) {
  const out = ts.transpileModule(text, {
    fileName,
    reportDiagnostics: true,
    compilerOptions: { jsx: ts.JsxEmit.Preserve, target: ts.ScriptTarget.Latest, module: ts.ModuleKind.ESNext },
  });
  return (out.diagnostics || []).filter((d) => d.category === ts.DiagnosticCategory.Error);
}

/** Applies the edits attached to findings. Files whose result no longer parses are left untouched. */
function applyFixes(root, findings) {
  const byFile = new Map();
  for (const finding of findings) {
    if (!finding.fix) continue;
    if (!byFile.has(finding.file)) byFile.set(finding.file, []);
    byFile.get(finding.file).push(finding);
  }
  const applied = [];
  const rejected = [];
  for (const [rel, list] of byFile) {
    const file = path.resolve(root, rel);
    const original = fs.readFileSync(file, 'utf8');
    const edits = list.flatMap((f) => f.fix.edits.map((e) => ({ ...e, finding: f }))).sort((a, b) => b.start - a.start || b.end - a.end);
    let text = original;
    let floor = Infinity;
    const used = new Set();
    for (const edit of edits) {
      if (edit.end > floor) continue; // overlaps an edit already applied; the next iteration rescans.
      text = text.slice(0, edit.start) + edit.text + text.slice(edit.end);
      floor = edit.start;
      used.add(edit.finding);
    }
    if (syntaxErrors(file, text).length) {
      rejected.push(...used);
      continue;
    }
    fs.writeFileSync(file, text);
    applied.push(...used);
  }
  return { applied, rejected };
}

function hashFiles(files) {
  return new Map(files.map((f) => [f, fs.existsSync(f) ? crypto.createHash('sha1').update(fs.readFileSync(f)).digest('hex') : null]));
}

const countBySeverity = (findings) => ({
  high: findings.filter((f) => f.severity === 'high').length,
  medium: findings.filter((f) => f.severity === 'medium').length,
  low: findings.filter((f) => f.severity === 'low').length,
});

/** Keeps agent findings only when the cited line exists and contains the quoted evidence. */
function verifyAgentFindings(root, agentFindings, scannerFindings) {
  const verified = [];
  const unverified = [];
  for (const raw of Array.isArray(agentFindings) ? agentFindings : []) {
    const finding = { ...raw, source: 'agent', severity: ['high', 'medium', 'low'].includes(raw.severity) ? raw.severity : 'medium' };
    const file = typeof finding.file === 'string' ? path.resolve(root, finding.file) : null;
    if (!file || !file.startsWith(path.resolve(root)) || !fs.existsSync(file) || !Number.isInteger(finding.line)) {
      unverified.push(finding);
      continue;
    }
    const lines = fs.readFileSync(file, 'utf8').split('\n');
    const window = lines.slice(Math.max(0, finding.line - 3), finding.line + 2).join('\n').replace(/\s+/g, ' ');
    const evidence = String(finding.evidence || '').replace(/\s+/g, ' ').trim().slice(0, 60);
    if (!evidence || !window.includes(evidence)) {
      unverified.push(finding);
      continue;
    }
    finding.file = path.relative(root, file);
    const duplicate = scannerFindings.some((s) => s.rule === finding.rule && s.file === finding.file && Math.abs(s.line - finding.line) <= 2);
    if (!duplicate) verified.push(finding);
  }
  return { verified, unverified };
}

/**
 * The quality gate: scan → (auto-fix high findings → rescan)* until clean or out of iterations.
 *
 * @param {object} options
 * @param {string} options.root
 * @param {string[]} options.dirs
 * @param {number} [options.maxIterations=3]
 * @param {boolean} [options.fixAll=false] Also apply safe fixes for medium/low findings.
 * @param {() => Promise<object[]>} [options.liveAuditor] Runs the security-qa-auditor agent.
 * @param {(findings: object[]) => Promise<void>} [options.fixer] Runs the UI agent on findings with no deterministic fix.
 * @param {(msg: string) => void} [options.log]
 */
async function runAuditGate(options) {
  const { root, dirs, maxIterations = 3, fixAll = false, liveAuditor, fixer, log = () => {} } = options;
  const iterations = [];
  const fixed = [];
  let unverified = [];
  let runAgent = Boolean(liveAuditor);

  for (let iteration = 0; ; iteration += 1) {
    const { files, findings } = scanDirs(root, dirs);
    if (runAgent) {
      const agentFindings = await liveAuditor();
      const checked = verifyAgentFindings(root, agentFindings, findings);
      findings.push(...checked.verified);
      unverified = checked.unverified;
      runAgent = false;
    }
    const counts = countBySeverity(findings);
    iterations.push({ iteration, files: files.length, ...counts });
    const high = findings.filter((f) => f.severity === 'high');
    if (high.length === 0) return { ok: true, files, findings, iterations, fixed, unverified };
    if (iteration >= maxIterations) {
      return { ok: false, reason: `${high.length} high-severity finding(s) remain after ${maxIterations} auto-fix iteration(s).`, files, findings, iterations, fixed, unverified };
    }

    log(`auto-fix iteration ${iteration + 1}: ${high.length} high-severity finding(s)`);
    const targets = fixAll ? findings : high;
    const { applied, rejected } = applyFixes(root, targets.filter((f) => f.fix));
    applied.forEach((f) => log(`  fixed   ${f.rule} ${f.file}:${f.line} (${f.fix.description})`));
    rejected.forEach((f) => log(`  skipped ${f.rule} ${f.file}:${f.line} (fix would not parse)`));
    fixed.push(...applied.map(({ fix, ...f }) => ({ ...f, fixDescription: fix.description, fixedBy: 'scanner' })));

    const remaining = high.filter((f) => !applied.includes(f));
    let agentChanged = false;
    if (remaining.length && fixer) {
      log(`  delegating ${remaining.length} finding(s) to the ui-ux-gamification agent`);
      const before = hashFiles(files);
      await fixer(remaining.map(({ fix, ...f }) => f));
      const after = hashFiles(files);
      agentChanged = [...before].some(([file, hash]) => after.get(file) !== hash);
      if (agentChanged) {
        fixed.push(...remaining.map(({ fix, ...f }) => ({ ...f, fixedBy: 'ui-ux-gamification' })));
        runAgent = Boolean(liveAuditor); // re-verify agent edits with the agent auditor
      }
    }
    if (!applied.length && !agentChanged) {
      const why = fixer ? 'the fixer agent made no changes' : 'no deterministic fix exists (run with --live to delegate to the UI agent)';
      return { ok: false, reason: `${remaining.length} high-severity finding(s) cannot be fixed automatically: ${why}.`, files, findings, iterations, fixed, unverified };
    }
  }
}

module.exports = { RULES, scanSource, scanDirs, applyFixes, runAuditGate, countBySeverity, verifyAgentFindings, syntaxErrors };
