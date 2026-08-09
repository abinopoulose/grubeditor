import { app as W, BrowserWindow as X, Menu as te } from "electron";
import * as y from "node:path";
import * as d from "node:fs";
import * as ne from "node:http";
import { fileURLToPath as ie } from "node:url";
import * as J from "node:os";
import { execSync as G, spawn as re } from "node:child_process";
const Y = "[GrubEditor API]";
function b(s, ...c) {
  console.log(`${Y} [${s}]`, ...c);
}
function P(s, ...c) {
  console.error(`${Y} [${s}] ERROR:`, ...c);
}
const T = {};
function O(s, c = 0) {
  const h = Date.now();
  if (T[s] && h - T[s].time < c)
    return T[s].content;
  let u = "";
  try {
    u = d.readFileSync(s, "utf8");
  } catch (g) {
    if (g.code === "ENOENT")
      throw new Error(`File not found: ${s}`);
    try {
      u = G(`sudo -n cat "${s}" 2>/dev/null`, { encoding: "utf8" });
    } catch {
      try {
        u = G(`pkexec /usr/bin/grub-editor-helper cat "${s}"`, { encoding: "utf8" });
      } catch (e) {
        throw console.error(`Failed to read ${s} via pkexec:`, e.message), new Error(`Cannot read ${s}: permission denied or authentication dismissed.`);
      }
    }
  }
  return T[s] = { time: h, content: u }, u;
}
function se(s) {
  const c = [], h = J.release().trim(), u = s.split(`
`);
  let g, e = !1;
  for (let o = 0; o < u.length; o++) {
    const i = u[o].trim();
    if (i.startsWith("submenu ") || i.startsWith("submenu	")) {
      e = !0, i.match(/^submenu\s+((?:['"])(.*?)(?:['"])|(\S+))/) && (g = `submenu-${o}`);
      continue;
    }
    if (e && i === "}") {
      e = !1, g = void 0;
      continue;
    }
    if (i.startsWith("menuentry ") || i.startsWith("menuentry	")) {
      let n = "Unknown Entry";
      const t = i.match(/^menuentry\s+(?:['"](.*?)['"]|(\S+))/);
      t && (n = t[1] || t[2] || "Unknown Entry");
      let l = `sys-entry-${c.length}`;
      const r = i.match(/(?:--id|\$menuentry_id_option)\s+(?:['"](.*?)['"]|(\S+))/);
      r && (l = r[1] || r[2] || l);
      let a = "", p = (i.match(/\{/g) || []).length - (i.match(/\}/g) || []).length, f = o + 1;
      for (; f < u.length && (p > 0 || p === 0 && !u[f].includes("{")); ) {
        const _ = u[f];
        if (a += _ + `
`, p += (_.match(/\{/g) || []).length - (_.match(/\}/g) || []).length, p <= 0 && _.includes("}")) break;
        f++;
      }
      o = f;
      let m = "custom", w, $, x = !1;
      const S = n.toLowerCase();
      S.includes("recovery") || S.includes("advanced") || S.includes("rescue") || a.toLowerCase().includes("recovery") || a.toLowerCase().includes("single") ? m = "recovery" : S.includes("windows") || a.toLowerCase().includes("chainloader") ? m = "windows" : S.includes("uefi") || S.includes("firmware") || a.toLowerCase().includes("fwsetup") ? m = "efi" : (S.includes("linux") || S.includes("ubuntu") || S.includes("debian") || S.includes("fedora") || a.includes("linux ") || a.includes("linuxefi ") || a.includes("linux16 ")) && (m = "linux");
      const k = a.match(/^\s*(?:linux|linuxefi|linux16)\s+(\S+)(.*)$/m);
      if (k) {
        const _ = k[1];
        w = k[2].trim(), m !== "recovery" && m !== "windows" && m !== "efi" && (m = "linux");
        const E = _.match(/vmlinuz-([a-zA-Z0-9.\-_]+)/i) || _.match(/kernel-([a-zA-Z0-9.\-_]+)/i);
        E && ($ = E[1]);
      }
      if (!$) {
        const _ = n.match(/\b(\d+\.\d+(?:\.\d+)?(?:-[a-zA-Z0-9]+)*)\b/);
        _ && ($ = _[1]);
      }
      ($ && $.includes(h) || n.includes(h) || h.length > 3 && ($ === h || n.includes(h))) && (x = !0), c.push({
        id: l,
        title: n,
        type: m,
        enabled: !0,
        order: c.length,
        args: w || void 0,
        version: $ || void 0,
        isCurrent: x,
        is_current: x,
        is_default: c.length === 0,
        parent_id: g
      });
    }
  }
  return c;
}
function D() {
  if (d.existsSync("/boot/grub2")) return "/boot/grub2/grub-editor-entries.json";
  if (d.existsSync("/boot/grub")) return "/boot/grub/grub-editor-entries.json";
  const s = y.join(J.homedir(), ".grubdeck");
  if (!d.existsSync(s)) try {
    d.mkdirSync(s, { recursive: !0 });
  } catch {
  }
  return y.join(s, "grub-editor-entries.json");
}
function N(s, c) {
  try {
    d.writeFileSync(s, c, "utf8");
  } catch {
    const h = y.join(J.tmpdir(), `grub-write-${Date.now()}-${Math.random().toString(36).substring(2, 8)}`);
    d.writeFileSync(h, c, "utf8");
    try {
      G(`sudo -n cp "${h}" "${s}" 2>/dev/null && rm -f "${h}"`, { stdio: "ignore" });
    } catch {
      try {
        G(`pkexec /usr/bin/grub-editor-helper sh -c "cp '${h}' '${s}' && chmod 0644 '${s}'"`, { stdio: "ignore" });
      } catch (u) {
        throw console.error(`Failed to write ${s} via pkexec:`, u.message), new Error(`Cannot write to ${s}: permission denied or authentication dismissed.`);
      } finally {
        if (d.existsSync(h)) try {
          d.unlinkSync(h);
        } catch {
        }
      }
    }
  }
  delete T[s];
}
function U() {
  try {
    const s = D(), c = O(s, 0);
    return JSON.parse(c);
  } catch {
    return [];
  }
}
function z(s, c) {
  if (b("MERGE", `Starting merge: ${s.length} system entries, ${c.length} overrides`), !c || !Array.isArray(c) || c.length === 0)
    return b("MERGE", "No overrides found, returning raw system entries"), s;
  const h = /* @__PURE__ */ new Set();
  s.forEach((e) => {
    e.originalTitle || (e.originalTitle = e.title);
  }), b("MERGE", "System entries:", s.map((e, o) => `[${o}] id="${e.id}" title="${e.title}"`).join(" | ")), b("MERGE", "Overrides:", c.map((e, o) => `[${o}] id="${e.id}" title="${e.title}" origTitle="${e.originalTitle}" deleted=${e.deleted}`).join(" | "));
  const u = [];
  c.forEach((e, o) => {
    let i = s.findIndex((t, l) => !h.has(l) && e.id && t.id === e.id && !t.id.startsWith("sys-entry-")), n = "id";
    if (i === -1 && (i = s.findIndex((t, l) => {
      if (h.has(l)) return !1;
      const r = t.originalTitle || t.title, a = e.originalTitle || e.title;
      return a === t.title || a === r || e.title === t.title;
    }), n = "title"), i === -1 && e.id && e.id.startsWith("sys-entry-")) {
      const t = parseInt(e.id.replace("sys-entry-", ""), 10);
      !isNaN(t) && t < s.length && !h.has(t) && (i = t, n = "positional");
    }
    if (i !== -1 ? (h.add(i), b("MERGE", `Override[${o}] "${e.title}" matched system[${i}] "${s[i].title}" via ${n}`)) : b("MERGE", `Override[${o}] "${e.title}" (origTitle="${e.originalTitle}", id="${e.id}") had NO match in system entries`), e.deleted) {
      if (u.some(
        (l) => e.id && l.id === e.id && !l.id.startsWith("sys-") && !e.id.startsWith("sys-") || (e.originalTitle || e.title) === (l.originalTitle || l.title)
      )) {
        b("MERGE", `Override[${o}] "${e.title}" is a DUPLICATE deleted override — skipping`);
        return;
      }
      b("MERGE", `Override[${o}] "${e.title}" is DELETED (${i !== -1 ? "matched & suppressed system entry" : "preserved deleted override from previous deploy"})`), u.push({ ...e, deleted: !0, enabled: !1 });
    } else if (i !== -1) {
      const t = s[i];
      u.push({
        ...t,
        title: e.title !== void 0 ? e.title : t.title,
        originalTitle: e.originalTitle || t.originalTitle || t.title,
        enabled: e.enabled !== void 0 ? e.enabled : t.enabled,
        deleted: !1,
        order: u.length
      });
    } else
      u.push({ ...e, deleted: !1, order: u.length });
  });
  let g = 0;
  return s.forEach((e, o) => {
    h.has(o) || (g++, b("MERGE", `System entry[${o}] "${e.title}" was UNMATCHED — adding to result`), u.push({
      ...e,
      originalTitle: e.originalTitle || e.title,
      order: u.length
    }));
  }), b("MERGE", `Merge complete: ${u.length} total entries (${g} unmatched system entries added)`), u;
}
function Z(s, c) {
  if (!c || !Array.isArray(c) || c.length === 0) return s;
  const h = s.split(`
`), u = [], g = [];
  let e = -1, o = 0, i = 0;
  for (; o < h.length; ) {
    const r = h[o], a = r.trim();
    if (a.startsWith("submenu ") || a.startsWith("submenu	")) {
      e === -1 && (e = u.length), o++;
      continue;
    }
    if (a === "}" && e !== -1 && u.length >= e) {
      o++;
      continue;
    }
    if (a.startsWith("menuentry ") || a.startsWith("menuentry	")) {
      e === -1 && (e = u.length);
      let p = "Unknown Entry";
      const f = a.match(/^menuentry\s+(?:['"](.*?)['"]|(\S+))/);
      f && (p = f[1] || f[2] || p);
      let m = `sys-entry-${i}`;
      const w = a.match(/(?:--id|\$menuentry_id_option)\s+(?:['"](.*?)['"]|(\S+))/);
      w && (m = w[1] || w[2] || m);
      const $ = [r];
      let x = (r.match(/\{/g) || []).length - (r.match(/\}/g) || []).length, S = o + 1;
      for (; S < h.length && (x > 0 || x === 0 && !h[S].includes("{")); ) {
        const k = h[S];
        if ($.push(k), x += (k.match(/\{/g) || []).length - (k.match(/\}/g) || []).length, x <= 0 && k.includes("}")) {
          S++;
          break;
        }
        S++;
      }
      g.push({ id: m, title: p, lines: $, origIdx: i }), i++, o = S;
      continue;
    }
    u.push(r), o++;
  }
  if (e === -1 || g.length === 0) return s;
  const n = [], t = /* @__PURE__ */ new Set();
  c.forEach((r, a) => {
    let p = g.findIndex((f, m) => !t.has(m) && r.id && f.id === r.id && !f.id.startsWith("sys-entry-"));
    if (p === -1 && (p = g.findIndex((f, m) => !t.has(m) && (r.originalTitle === f.title || r.title === f.title))), p === -1 && r.id && r.id.startsWith("sys-entry-")) {
      const f = parseInt(r.id.replace("sys-entry-", ""), 10);
      !isNaN(f) && !t.has(f) && (p = f);
    }
    if (p !== -1 && t.add(p), !(r.deleted || r.enabled === !1) && p !== -1) {
      const f = g[p];
      let m = f.lines[0];
      r.title && r.title !== f.title && (m = m.replace(f.title, r.title), f.lines[0] = m), n.push({ idx: a, text: f.lines.join(`
`) });
    }
  }), g.forEach((r, a) => {
    t.has(a) || n.push({ idx: n.length + 1e3, text: r.lines.join(`
`) });
  }), n.sort((r, a) => r.idx - a.idx);
  const l = n.map((r) => r.text).join(`

`);
  return u.splice(e, 0, l), u.join(`
`);
}
function A() {
  const s = "/var/lib/grub-editor/backups";
  if (process.getuid && process.getuid() === 0 && !d.existsSync(s))
    try {
      d.mkdirSync(s, { recursive: !0 });
    } catch {
    }
  return s;
}
function H(s) {
  const c = A(), h = Date.now(), u = `snap_${h}`, g = y.join(c, u);
  try {
    d.existsSync(g) || d.mkdirSync(g, { recursive: !0 });
  } catch {
    try {
      G(`pkexec /usr/bin/grub-editor-helper mkdir -p "${g}" && pkexec /usr/bin/grub-editor-helper chmod 755 "${g}"`);
    } catch (f) {
      return P("SNAPSHOT", "Could not create snapshot dir:", f.message), null;
    }
  }
  const e = d.existsSync("/etc/default/grub") ? "/etc/default/grub" : "/boot/grub/default", o = y.join(g, "default_grub.bak");
  try {
    const f = O(e);
    N(o, f);
  } catch (f) {
    P("SNAPSHOT", "Failed to backup default grub:", f);
  }
  const i = d.existsSync("/boot/grub2/grub.cfg") ? "/boot/grub2/grub.cfg" : "/boot/grub/grub.cfg";
  let n = null;
  if (d.existsSync(i)) {
    const f = y.join(g, "grub.cfg.bak");
    try {
      const m = O(i);
      N(f, m), n = f;
    } catch (m) {
      P("SNAPSHOT", "Failed to backup grub.cfg:", m);
    }
  }
  let t = null;
  const l = D();
  if (d.existsSync(l)) {
    const f = y.join(g, "grub-editor-entries.json.bak");
    try {
      const m = O(l);
      N(f, m), t = f;
    } catch {
    }
  }
  const r = `${h} (UTC Timestamp)`, a = {
    timestamp: h,
    date_string: r,
    description: s || "Auto-backup",
    default_grub_backup: o,
    grub_cfg_backup: n,
    bls_entries_backup: t,
    warnings: []
  }, p = y.join(g, "snapshot_metadata.json");
  return N(p, JSON.stringify(a, null, 2)), b("SNAPSHOT", `Created recovery snapshot in ${g}: "${s}"`), a;
}
async function oe(s, c) {
  if (!s.url || !s.url.startsWith("/api/"))
    return !1;
  c.setHeader("Content-Type", "application/json");
  try {
    const h = new URL(s.url, `http://${s.headers.host || "localhost"}`), u = h.pathname;
    if (s.method === "GET" && u === "/api/boot-entries") {
      if (b("GET /api/boot-entries", "Fetching boot entries..."), d.existsSync("/boot/loader/entries"))
        try {
          const t = d.readdirSync("/boot/loader/entries").filter((l) => l.endsWith(".conf") || l.endsWith(".mgnix"));
          if (t.length > 0) {
            b("GET /api/boot-entries", `Found ${t.length} BLS entry files`);
            const l = [], r = J.release().trim();
            t.sort().forEach((f, m) => {
              const w = d.readFileSync(y.join("/boot/loader/entries", f), "utf8");
              let $ = f, x = "", S = "";
              w.split(`
`).forEach((_) => {
                const E = _.trim();
                E.startsWith("title ") ? $ = E.substring(6).trim() : E.startsWith("version ") ? x = E.substring(8).trim() : E.startsWith("options ") && (S = E.substring(8).trim());
              });
              const k = x.includes(r) || $.includes(r);
              l.push({
                id: f.replace(/\.[^/.]+$/, ""),
                title: $,
                type: $.toLowerCase().includes("recovery") || $.toLowerCase().includes("rescue") ? "recovery" : "linux",
                enabled: !0,
                order: m,
                args: S || void 0,
                version: x || void 0,
                isCurrent: k,
                is_current: k,
                is_default: m === 0
              });
            });
            const a = U();
            b("GET /api/boot-entries", `Loaded ${a.length} saved overrides from ${D()}`);
            const p = z(l, a);
            return b("GET /api/boot-entries", `Returning ${p.length} entries (active: ${p.filter((f) => !f.deleted).length}, deleted: ${p.filter((f) => f.deleted).length})`), c.end(JSON.stringify(p)), !0;
          }
        } catch (t) {
          P("GET /api/boot-entries", "BLS directory read error, falling back to grub.cfg:", t);
        }
      const g = d.existsSync("/boot/grub2/grub.cfg") ? "/boot/grub2/grub.cfg" : "/boot/grub/grub.cfg";
      b("GET /api/boot-entries", `Reading grub.cfg from ${g}`);
      const e = O(g), o = se(e);
      b("GET /api/boot-entries", `Parsed ${o.length} menuentry blocks from grub.cfg`);
      const i = U();
      b("GET /api/boot-entries", `Loaded ${i.length} saved overrides from ${D()}`);
      const n = z(o, i);
      return b("GET /api/boot-entries", `Returning ${n.length} entries (active: ${n.filter((t) => !t.deleted).length}, deleted: ${n.filter((t) => t.deleted).length})`), c.end(JSON.stringify(n)), !0;
    }
    if (s.method === "GET" && u === "/api/grub-config") {
      const g = d.existsSync("/etc/default/grub") ? "/etc/default/grub" : "/boot/grub/default", e = O(g), o = {};
      return e.split(`
`).forEach((i) => {
        const n = i.trim();
        if (n && !n.startsWith("#") && n.includes("=")) {
          const t = n.indexOf("="), l = n.substring(0, t).trim();
          let r = n.substring(t + 1).trim();
          (r.startsWith('"') && r.endsWith('"') || r.startsWith("'") && r.endsWith("'")) && (r = r.substring(1, r.length - 1)), o[l] = r;
        }
      }), c.end(JSON.stringify(o)), !0;
    }
    if (s.method === "GET" && u === "/api/distro") {
      let g = "Ubuntu 24.04.4 LTS", e = "DebianUbuntu", o = ["update-grub"];
      try {
        d.readFileSync("/etc/os-release", "utf8").split(`
`).forEach((n) => {
          if (n.startsWith("PRETTY_NAME="))
            g = n.split("=")[1].replace(/["']/g, "").trim();
          else if (n.startsWith("ID=")) {
            const t = n.split("=")[1].replace(/["']/g, "").trim().toLowerCase();
            t === "fedora" || t === "rhel" || t === "centos" || t === "rocky" ? (e = "RHEL", o = ["grub2-mkconfig", "-o", "/boot/grub2/grub.cfg"]) : (t === "arch" || t === "manjaro") && (e = "Arch", o = ["grub-mkconfig", "-o", "/boot/grub/grub.cfg"]);
          }
        });
      } catch {
      }
      return c.end(JSON.stringify({
        distro_name: g,
        family: e,
        default_grub_path: "/etc/default/grub",
        grub_dir: "/boot/grub",
        grub_cfg_path: "/boot/grub/grub.cfg",
        themes_dir: "/boot/grub/themes",
        regen_command: o,
        uses_bls: d.existsSync("/boot/loader/entries")
      })), !0;
    }
    if (s.method === "GET" && u === "/api/scan-themes") {
      const g = d.existsSync("/boot/grub2/themes") ? "/boot/grub2/themes" : "/boot/grub/themes", e = [];
      try {
        let o = [];
        try {
          o = d.readdirSync(g);
        } catch {
          o = G(`pkexec /usr/bin/grub-editor-helper find "${g}" -maxdepth 1 -mindepth 1 -type d`, { encoding: "utf8" }).split(`
`).filter(Boolean).map((n) => y.basename(n.trim()));
        }
        for (const i of o) {
          const n = y.join(g, i), t = y.join(n, "theme.txt");
          let l = !1;
          try {
            d.existsSync(t) && (l = !0);
          } catch {
            try {
              G(`test -f "${t}"`, { stdio: "ignore" }), l = !0;
            } catch {
            }
          }
          l && e.push({
            name: i,
            path: n,
            is_valid: !0,
            validation_errors: [],
            has_pf2_fonts: !0,
            background_image: "background.png",
            title_text: `${i} Theme`
          });
        }
      } catch (o) {
        console.warn("Could not scan system themes, fallback empty or default:", o);
      }
      return e.length === 0 && e.push({
        name: "ubuntu-theme",
        path: "/boot/grub/themes/ubuntu-theme",
        is_valid: !0,
        validation_errors: [],
        has_pf2_fonts: !0,
        background_image: "background.png",
        title_text: "Ubuntu Default Theme"
      }), c.end(JSON.stringify(e)), !0;
    }
    if (s.method === "GET" && u === "/api/snapshots") {
      b("GET /api/snapshots", "Fetching recovery snapshots...");
      const g = A(), e = [];
      if (d.existsSync(g))
        try {
          const o = d.readdirSync(g);
          for (const i of o) {
            const n = y.join(g, i, "snapshot_metadata.json");
            if (d.existsSync(n))
              try {
                const t = O(n), l = JSON.parse(t);
                e.push(l);
              } catch {
              }
          }
          e.sort((i, n) => (n.timestamp || 0) - (i.timestamp || 0));
        } catch (o) {
          P("GET /api/snapshots", "Failed reading snapshot directories:", o);
        }
      return b("GET /api/snapshots", `Returning ${e.length} snapshots`), c.end(JSON.stringify(e)), !0;
    }
    if (s.method === "GET" && u === "/api/snapshot-details") {
      const g = h.searchParams.get("timestamp");
      if (!g)
        return c.statusCode = 400, c.end(JSON.stringify({ error: "Missing timestamp" })), !0;
      try {
        const e = A(), o = y.join(e, `snap_${g}`), i = y.join(o, "snapshot_metadata.json");
        if (!d.existsSync(i))
          throw new Error("Snapshot not found");
        const n = JSON.parse(O(i)), t = {};
        if (n.default_grub_backup)
          try {
            O(n.default_grub_backup).split(`
`).forEach((a) => {
              const p = a.trim();
              if (p && !p.startsWith("#") && p.includes("=")) {
                const f = p.indexOf("="), m = p.substring(0, f).trim();
                let w = p.substring(f + 1).trim();
                (w.startsWith('"') && w.endsWith('"') || w.startsWith("'") && w.endsWith("'")) && (w = w.substring(1, w.length - 1)), t[m] = w;
              }
            });
          } catch (r) {
            P("GET /api/snapshot-details", "Failed to read default_grub_backup", r);
          }
        let l = [];
        if (n.bls_entries_backup)
          try {
            l = JSON.parse(O(n.bls_entries_backup));
          } catch (r) {
            P("GET /api/snapshot-details", "Failed to read bls_entries_backup", r);
          }
        c.end(JSON.stringify({ config: t, bootEntries: l }));
      } catch (e) {
        c.statusCode = 500, c.end(JSON.stringify({ error: e.message }));
      }
      return !0;
    }
    if (s.method === "POST") {
      let g = "";
      return s.on("data", (e) => {
        g += e;
      }), await new Promise((e) => {
        s.on("end", async () => {
          try {
            const o = g ? JSON.parse(g) : {};
            if (u === "/api/save-grub-config") {
              const { newConfig: i, reason: n, createSnapshot: t } = o;
              if (b("POST /api/save-grub-config", `Saving config (createSnapshot=${t}, reason="${n}")`), t && H(n || "Modified GRUB general configuration"), i) {
                const l = ["# Updated via GrubEditor GUI"];
                for (const [a, p] of Object.entries(i))
                  l.push(`${a}="${p}"`);
                const r = y.join(J.tmpdir(), `grub-config-${Date.now()}`);
                d.writeFileSync(r, l.join(`
`) + `
`, "utf8");
                try {
                  d.copyFileSync(r, "/etc/default/grub"), d.existsSync(r) && d.unlinkSync(r);
                } catch {
                  try {
                    G(`pkexec /usr/bin/grub-editor-helper cp "${r}" /etc/default/grub && rm -f "${r}"`);
                  } catch (a) {
                    throw console.warn("Failed to copy config via pkexec:", a.message), new Error("Failed to copy config via pkexec: " + a.message);
                  }
                }
                delete T["/etc/default/grub"], delete T["/boot/grub/default"];
              }
              c.end(JSON.stringify({ success: !0 })), e();
              return;
            }
            if (u === "/api/save-boot-entries") {
              const { newEntries: i, reason: n, createSnapshot: t } = o;
              if (b("POST /api/save-boot-entries", `Received ${i?.length ?? 0} entries to save (createSnapshot=${t}, reason="${n}")`), t && H(n || "Modified boot menu entries & ordering"), i && Array.isArray(i)) {
                const l = i.map((p) => ({ ...p, originalTitle: p.originalTitle || p.title })), r = l.filter((p) => p.deleted).length, a = l.filter((p) => !p.deleted).length;
                b("POST /api/save-boot-entries", `Saving ${l.length} entries (${a} active, ${r} deleted) to ${D()}`), l.forEach((p, f) => {
                  b("POST /api/save-boot-entries", `  [${f}] id="${p.id}" title="${p.title}" origTitle="${p.originalTitle}" deleted=${p.deleted} enabled=${p.enabled}`);
                }), N(D(), JSON.stringify(l, null, 2)), b("POST /api/save-boot-entries", "Write successful");
              }
              delete T["/boot/grub/grub.cfg"], delete T["/boot/grub2/grub.cfg"], c.end(JSON.stringify({ success: !0 })), e();
              return;
            }
            if (u === "/api/restore-snapshot") {
              const { timestamp: i } = o;
              b("POST /api/restore-snapshot", `Restoring snapshot timestamp ${i}...`);
              const n = A(), t = y.join(n, `snap_${i}`), l = y.join(t, "snapshot_metadata.json");
              if (!d.existsSync(l))
                throw new Error("Snapshot metadata not found for timestamp " + i);
              const r = JSON.parse(O(l));
              if (H(`Auto-backup before restoring snapshot from ${new Date(i).toLocaleString()}`), r.default_grub_backup)
                try {
                  const a = d.existsSync("/etc/default/grub") ? "/etc/default/grub" : "/boot/grub/default";
                  N(a, O(r.default_grub_backup)), delete T["/etc/default/grub"], delete T["/boot/grub/default"];
                } catch (a) {
                  P("POST /api/restore-snapshot", "Failed to restore default_grub_backup", a);
                }
              if (r.grub_cfg_backup)
                try {
                  const a = d.existsSync("/boot/grub2/grub.cfg") ? "/boot/grub2/grub.cfg" : "/boot/grub/grub.cfg";
                  N(a, O(r.grub_cfg_backup)), delete T["/boot/grub/grub.cfg"], delete T["/boot/grub2/grub.cfg"];
                } catch (a) {
                  P("POST /api/restore-snapshot", "Failed to restore grub_cfg_backup", a);
                }
              if (r.bls_entries_backup)
                try {
                  N(D(), O(r.bls_entries_backup));
                } catch (a) {
                  P("POST /api/restore-snapshot", "Failed to restore bls_entries_backup", a);
                }
              b("POST /api/restore-snapshot", "Restore completed successfully"), c.end(JSON.stringify({ success: !0 })), e();
              return;
            }
            if (u === "/api/trigger-regen") {
              b("POST /api/trigger-regen", "Starting GRUB regeneration...");
              let i = "";
              try {
                const n = process.getuid ? process.getuid() === 0 : !1, t = n ? "update-grub 2>&1" : "pkexec /usr/bin/grub-editor-helper update-grub 2>&1";
                b("POST /api/trigger-regen", `Running: ${t} (isRoot=${n})`), i = G(t, { encoding: "utf8" }), b("POST /api/trigger-regen", "update-grub completed successfully"), delete T["/boot/grub/grub.cfg"], delete T["/boot/grub2/grub.cfg"];
                try {
                  const l = d.existsSync("/boot/grub2/grub.cfg") ? "/boot/grub2/grub.cfg" : "/boot/grub/grub.cfg";
                  if (d.existsSync(l)) {
                    const r = O(l), a = U();
                    if (b("POST /api/trigger-regen", `Post-regen: ${a.length} overrides to apply to ${l}`), a.length > 0) {
                      const p = a.filter((m) => m.deleted);
                      b("POST /api/trigger-regen", `Overrides breakdown: ${a.length - p.length} active, ${p.length} deleted`);
                      const f = Z(r, a);
                      N(l, f), b("POST /api/trigger-regen", "Successfully wrote modified grub.cfg"), i += `
[GrubEditor] Applied custom menu ordering, titles, and exclusions to grub.cfg successfully.`;
                    }
                  }
                } catch (l) {
                  P("POST /api/trigger-regen", "Failed to apply post-regeneration overrides:", l), i += `
[GrubEditor] Warning: Could not apply overrides to grub.cfg: ${l.message}`;
                }
              } catch (n) {
                throw P("POST /api/trigger-regen", "update-grub failed:", n.message), new Error(`Failed to regenerate GRUB configuration: ${n.stdout || n.stderr || n.message}`);
              }
              b("POST /api/trigger-regen", "Regeneration pipeline complete"), c.end(JSON.stringify({ success: !0, output: i })), e();
              return;
            }
            if (u === "/api/deploy-pipeline") {
              const { config: i, bootEntries: n, snapTitle: t } = o;
              b("POST /api/deploy-pipeline", `Starting batched deploy pipeline. snapTitle: ${t}`);
              const l = process.getuid ? process.getuid() === 0 : !1, r = l ? "" : "pkexec /usr/bin/grub-editor-helper ", a = `/tmp/grub-editor-deploy-config-${Date.now()}`, p = `/tmp/grub-editor-deploy-entries-${Date.now()}`;
              let f = "";
              for (const [R, C] of Object.entries(i))
                f += `${R}="${C}"
`;
              d.writeFileSync(a, f);
              const m = (n || []).map((R) => ({ ...R, originalTitle: R.originalTitle || R.title }));
              d.writeFileSync(p, JSON.stringify(m, null, 2));
              const w = Date.now(), $ = y.join(A(), `snap_${w}`), x = d.existsSync("/etc/default/grub") ? "/etc/default/grub" : "/boot/grub/default", S = d.existsSync("/boot/grub2/grub.cfg") ? "/boot/grub2/grub.cfg" : "/boot/grub/grub.cfg", k = D(), _ = `/tmp/grub-editor-deploy-script-${Date.now()}.sh`, E = `/tmp/grub-editor-raw-cfg-${Date.now()}`, j = {
                timestamp: w,
                description: t,
                default_grub_backup: y.join($, "default_grub.bak"),
                grub_cfg_backup: d.existsSync(S) ? y.join($, "grub.cfg.bak") : null,
                bls_entries_backup: y.join($, "grub-editor-entries.json.bak")
              }, B = `/tmp/grub-editor-deploy-meta-${Date.now()}`;
              d.writeFileSync(B, JSON.stringify(j, null, 2));
              const F = `/tmp/grub-editor-patched-cfg-${Date.now()}`, Q = `#!/bin/bash
set -e
set -x
echo "[Bash Runtime] Stage 1: Initializing snapshot in ${$}..."
mkdir -p "${$}"
chmod 755 "${$}"
cp "${B}" "${$}/snapshot_metadata.json"
chmod 644 "${$}/snapshot_metadata.json"

echo "[Bash Runtime] Stage 2: Applying new GRUB configurations..."
cp "${a}" "${x}"
chmod 644 "${x}"
cp "${p}" "${k}"
chmod 644 "${k}"

echo "[Bash Runtime] Stage 3: Regenerating bootloader via update-grub..."
update-grub 2>&1

echo "[Bash Runtime] Stage 4: Exposing raw configuration for Node.js patching..."
cat "${S}" > "${E}"
chmod 666 "${E}"

echo "[Bash Runtime] Stage 5: Waiting for Node.js to apply dynamic overrides..."
COUNT=0
while [ ! -f "${F}" ]; do
  sleep 0.5
  COUNT=$((COUNT+1))
  if [ $COUNT -gt 60 ]; then
    echo "[Bash Runtime] ERROR: Timeout waiting for Node.js to patch configuration." >&2
    exit 1
  fi
done

echo "[Bash Runtime] Stage 6: Finalizing deployment & capturing snapshot..."
cp "${F}" "${S}"
chmod 644 "${S}"

if [ -n "${j.default_grub_backup}" ] && [ "${j.default_grub_backup}" != "null" ]; then cp "${x}" "${j.default_grub_backup}"; fi
if [ -n "${j.grub_cfg_backup}" ] && [ "${j.grub_cfg_backup}" != "null" ]; then cp "${S}" "${j.grub_cfg_backup}"; fi
if [ -n "${j.bls_entries_backup}" ] && [ "${j.bls_entries_backup}" != "null" ]; then cp "${k}" "${j.bls_entries_backup}"; fi

echo "[Bash Runtime] Execution completed successfully!"
`;
              d.writeFileSync(_, Q), b("POST /api/deploy-pipeline", "Executing Batched Deploy Script Asynchronously...");
              try {
                const R = await new Promise((C, V) => {
                  let L = "";
                  const I = re(l ? "bash" : "pkexec", l ? ["bash", _] : ["/usr/bin/grub-editor-helper", "bash", _]);
                  I.stdout.on("data", (v) => {
                    L += v.toString();
                  }), I.stderr.on("data", (v) => {
                    L += v.toString();
                  }), I.on("close", (v) => {
                    v === 0 ? C(L) : V(new Error(`Exit code ${v}:
${L}`));
                  }), I.on("error", (v) => {
                    V(new Error(`Spawn error: ${v.message}
${L}`));
                  });
                  const q = setInterval(() => {
                    if (d.existsSync(E)) {
                      clearInterval(q), b("POST /api/deploy-pipeline", "Detected raw config. Applying overrides...");
                      try {
                        const v = d.readFileSync(E, "utf8"), ee = Z(v, m);
                        d.writeFileSync(F, ee);
                      } catch (v) {
                        P("POST /api/deploy-pipeline", "Failed to patch config:", v.message);
                      }
                    }
                  }, 500);
                });
                [a, p, B, _, E, F].forEach((C) => {
                  try {
                    d.existsSync(C) && d.unlinkSync(C);
                  } catch {
                  }
                }), delete T["/boot/grub/grub.cfg"], delete T["/boot/grub2/grub.cfg"], delete T["/etc/default/grub"], b("POST /api/deploy-pipeline", "Deployment pipeline complete"), c.end(JSON.stringify({ success: !0, output: R })), e();
                return;
              } catch (R) {
                throw [a, p, B, _, E, F].forEach((C) => {
                  try {
                    d.existsSync(C) && d.unlinkSync(C);
                  } catch {
                  }
                }), P("POST /api/deploy-pipeline", "Deploy pipeline failed:", R.message), new Error(`Failed during deployment:
${R.message}`);
              }
            }
            c.end(JSON.stringify({ success: !0 })), e();
          } catch (o) {
            c.statusCode = 500, c.end(JSON.stringify({ error: o.message })), e();
          }
        });
      }), !0;
    }
    return !1;
  } catch (h) {
    return console.error("GrubBackend error:", h), c.statusCode = 500, c.end(JSON.stringify({ error: h.message || "Internal Server Error" })), !0;
  }
}
const M = y.dirname(ie(import.meta.url));
W.commandLine.appendSwitch("no-sandbox");
W.commandLine.appendSwitch("disable-gpu-sandbox");
function K() {
  const s = d.existsSync(y.join(M, "preload.mjs")) ? y.join(M, "preload.mjs") : y.join(M, "preload.js"), c = new X({
    width: 1280,
    height: 860,
    minWidth: 1024,
    minHeight: 768,
    title: "GrubEditor - Pro Bootloader Studio",
    backgroundColor: "#050811",
    icon: y.join(M, "../public/app_logo.png"),
    webPreferences: {
      preload: s,
      nodeIntegration: !1,
      contextIsolation: !0
    }
  });
  if (c.setMenuBarVisibility(!1), te.setApplicationMenu(null), c.webContents.on("console-message", (h, u, g, e, o) => {
    console.log(`[Renderer Console] [level ${u}] ${g} (${o}:${e})`);
  }), c.webContents.on("did-fail-load", (h, u, g, e) => {
    console.error(`[Renderer Fail Load] (${u}) ${g} - ${e}`);
  }), c.webContents.on("render-process-gone", (h, u) => {
    console.error(`[Renderer Process Gone] ${u.reason} - exitCode: ${u.exitCode}`);
  }), process.env.VITE_DEV_SERVER_URL)
    c.loadURL(process.env.VITE_DEV_SERVER_URL);
  else {
    const h = y.join(M, "../dist"), u = ne.createServer(async (e, o) => {
      try {
        if (!await oe(e, o)) {
          const n = new URL(e.url || "/", `http://${e.headers.host || "localhost"}`);
          let t = y.join(h, n.pathname === "/" ? "index.html" : n.pathname);
          d.existsSync(t) || (t = y.join(h, "index.html"));
          const l = y.extname(t).toLowerCase(), a = {
            ".html": "text/html",
            ".js": "text/javascript",
            ".mjs": "text/javascript",
            ".css": "text/css",
            ".json": "application/json",
            ".png": "image/png",
            ".jpg": "image/jpeg",
            ".svg": "image/svg+xml",
            ".ico": "image/x-icon",
            ".woff": "font/woff",
            ".woff2": "font/woff2"
          }[l] || "application/octet-stream";
          o.writeHead(200, { "Content-Type": a }), d.createReadStream(t).pipe(o);
        }
      } catch (i) {
        o.writeHead(500, { "Content-Type": "application/json" }), o.end(JSON.stringify({ error: i.message || "Internal Server Error" }));
      }
    }), g = (e) => {
      u.listen(e, "127.0.0.1", () => {
        const o = u.address().port;
        c.loadURL(`http://127.0.0.1:${o}`);
      });
    };
    u.on("error", (e) => {
      e.code === "EADDRINUSE" && (console.warn("Port 31415 occupied, retrying with ephemeral loopback port..."), u.close(), g(0));
    }), g(31415), c.on("closed", () => {
      try {
        u.close();
      } catch {
      }
    });
  }
}
W.whenReady().then(() => {
  K(), W.on("activate", () => {
    X.getAllWindows().length === 0 && K();
  });
});
W.on("window-all-closed", () => {
  process.platform !== "darwin" && W.quit();
});
