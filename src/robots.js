// Minimal robots.txt parser following RFC 9309 matching rules:
// pick the group(s) naming the bot, else the "*" group; longest matching
// rule wins; on a tie, Allow wins.

export function parseRobots(text = '') {
  const groups = [];
  const sitemaps = [];
  let current = null;
  let lastWasAgent = false;
  let ruleCount = 0;
  for (const raw of String(text).split(/\r?\n/)) {
    const line = raw.replace(/#.*/, '').trim();
    if (!line) continue;
    const m = line.match(/^([A-Za-z-]+)\s*:\s*(.*)$/);
    if (!m) continue;
    const key = m[1].toLowerCase();
    const val = m[2].trim();
    if (key === 'user-agent') {
      if (!current || !lastWasAgent) {
        current = { agents: [], rules: [] };
        groups.push(current);
      }
      current.agents.push(val.split('/')[0].trim().toLowerCase());
      lastWasAgent = true;
      continue;
    }
    if (key === 'sitemap') {
      if (val) sitemaps.push(val);
      continue;
    }
    lastWasAgent = false;
    if ((key === 'allow' || key === 'disallow') && current && ruleCount++ < MAX_RULES) {
      current.rules.push({ allow: key === 'allow', path: val });
    }
  }
  return { groups, sitemaps };
}

export function rulesFor(parsed, agent) {
  const token = agent.toLowerCase();
  let matched = parsed.groups.filter((g) => g.agents.includes(token));
  if (!matched.length) matched = parsed.groups.filter((g) => g.agents.includes('*'));
  return { rules: matched.flatMap((g) => g.rules), specific: matched.some((g) => g.agents.includes(token)) };
}

// Wildcard match without regular expressions or backtracking, so a hostile
// robots.txt cannot freeze the server. Robots patterns only have "*" (anything)
// and a trailing "$" (end). Matching each piece at its leftmost spot is enough,
// which keeps the work close to linear.
const MAX_LEN = 2000;
const MAX_RULES = 1000;
function patternMatches(pattern, path) {
  const anchored = pattern.endsWith('$');
  const p = (anchored ? pattern.slice(0, -1) : pattern).slice(0, MAX_LEN);
  const s = path.slice(0, MAX_LEN);
  const segs = p.split('*');
  if (!s.startsWith(segs[0])) return false;
  let pos = segs[0].length;
  if (segs.length === 1) return anchored ? s.length === pos : true;
  for (let k = 1; k < segs.length - 1; k++) {
    if (!segs[k]) continue;
    const idx = s.indexOf(segs[k], pos);
    if (idx < 0) return false;
    pos = idx + segs[k].length;
  }
  const last = segs[segs.length - 1];
  if (!anchored) return !last || s.indexOf(last, pos) >= 0;
  return s.length - last.length >= pos && s.endsWith(last);
}

export function isAllowed(parsed, agent, path = '/') {
  const { rules } = rulesFor(parsed, agent);
  let best = null;
  for (const r of rules) {
    if (!r.path) continue; // "Disallow:" with nothing means allow everything
    if (!patternMatches(r.path, path)) continue;
    const len = r.path.length;
    if (!best || len > best.len || (len === best.len && r.allow)) best = { len, allow: r.allow };
  }
  return best ? best.allow : true;
}
