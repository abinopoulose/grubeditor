import { app as G, BrowserWindow as X, Menu as te } from "electron";
import * as y from "node:path";
import * as a from "node:fs";
import * as ne from "node:http";
import { fileURLToPath as ie } from "node:url";
import * as A from "node:os";
import { execSync as N, spawn as re } from "node:child_process";
const Y = "[GrubEditor API]";
function b(s, ...c) {
  console.log(`${Y} [${s}]`, ...c);
}
function R(s, ...c) {
  console.error(`${Y} [${s}] ERROR:`, ...c);
}
const _ = {};
function O(s, c = 0) {
  const h = Date.now();
  if (_[s] && h - _[s].time < c)
    return _[s].content;
  let d = "";
  try {
    d = a.readFileSync(s, "utf8");
  } catch (g) {
    if (g.code === "ENOENT")
      throw new Error(`File not found: ${s}`);
    try {
      d = N(`sudo -n cat "${s}" 2>/dev/null`, { encoding: "utf8" });
    } catch {
      try {
        d = N(`pkexec /usr/bin/grub-editor-helper cat "${s}"`, { encoding: "utf8" });
      } catch (e) {
        throw console.error(`Failed to read ${s} via pkexec:`, e.message), new Error(`Cannot read ${s}: permission denied or authentication dismissed.`);
      }
    }
  }
  return _[s] = { time: h, content: d }, d;
}
function se(s) {
  const c = [], h = A.release().trim(), d = s.split(`
`);
  let g, e = !1;
  for (let o = 0; o < d.length; o++) {
    const i = d[o].trim();
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
      let u = "", p = (i.match(/\{/g) || []).length - (i.match(/\}/g) || []).length, f = o + 1;
      for (; f < d.length && (p > 0 || p === 0 && !d[f].includes("{")); ) {
        const x = d[f];
        if (u += x + `
`, p += (x.match(/\{/g) || []).length - (x.match(/\}/g) || []).length, p <= 0 && x.includes("}")) break;
        f++;
      }
      o = f;
      let m = "custom", w, $, E = !1;
      const S = n.toLowerCase();
      S.includes("recovery") || S.includes("advanced") || S.includes("rescue") || u.toLowerCase().includes("recovery") || u.toLowerCase().includes("single") ? m = "recovery" : S.includes("windows") || u.toLowerCase().includes("chainloader") ? m = "windows" : S.includes("uefi") || S.includes("firmware") || u.toLowerCase().includes("fwsetup") ? m = "efi" : (S.includes("linux") || S.includes("ubuntu") || S.includes("debian") || S.includes("fedora") || u.includes("linux ") || u.includes("linuxefi ") || u.includes("linux16 ")) && (m = "linux");
      const T = u.match(/^\s*(?:linux|linuxefi|linux16)\s+(\S+)(.*)$/m);
      if (T) {
        const x = T[1];
        w = T[2].trim(), m !== "recovery" && m !== "windows" && m !== "efi" && (m = "linux");
        const k = x.match(/vmlinuz-([a-zA-Z0-9.\-_]+)/i) || x.match(/kernel-([a-zA-Z0-9.\-_]+)/i);
        k && ($ = k[1]);
      }
      if (!$) {
        const x = n.match(/\b(\d+\.\d+(?:\.\d+)?(?:-[a-zA-Z0-9]+)*)\b/);
        x && ($ = x[1]);
      }
      ($ && $.includes(h) || n.includes(h) || h.length > 3 && ($ === h || n.includes(h))) && (E = !0), c.push({
        id: l,
        title: n,
        type: m,
        enabled: !0,
        order: c.length,
        args: w || void 0,
        version: $ || void 0,
        isCurrent: E,
        is_current: E,
        is_default: c.length === 0,
        parent_id: g
      });
    }
  }
  return c;
}
function D() {
  if (a.existsSync("/boot/grub2")) return "/boot/grub2/grub-editor-entries.json";
  if (a.existsSync("/boot/grub")) return "/boot/grub/grub-editor-entries.json";
  const s = y.join(A.homedir(), ".grubdeck");
  if (!a.existsSync(s)) try {
    a.mkdirSync(s, { recursive: !0 });
  } catch {
  }
  return y.join(s, "grub-editor-entries.json");
}
function C(s, c) {
  try {
    a.writeFileSync(s, c, "utf8");
  } catch {
    const h = y.join(A.tmpdir(), `grub-write-${Date.now()}-${Math.random().toString(36).substring(2, 8)}`);
    a.writeFileSync(h, c, "utf8");
    try {
      N(`sudo -n cp "${h}" "${s}" 2>/dev/null && rm -f "${h}"`, { stdio: "ignore" });
    } catch {
      try {
        N(`pkexec /usr/bin/grub-editor-helper sh -c "cp '${h}' '${s}' && chmod 0644 '${s}'"`, { stdio: "ignore" });
      } catch (d) {
        throw console.error(`Failed to write ${s} via pkexec:`, d.message), new Error(`Cannot write to ${s}: permission denied or authentication dismissed.`);
      } finally {
        if (a.existsSync(h)) try {
          a.unlinkSync(h);
        } catch {
        }
      }
    }
  }
  delete _[s];
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
  const d = [];
  c.forEach((e, o) => {
    let i = s.findIndex((t, l) => !h.has(l) && e.id && t.id === e.id && !t.id.startsWith("sys-entry-")), n = "id";
    if (i === -1 && (i = s.findIndex((t, l) => {
      if (h.has(l)) return !1;
      const r = t.originalTitle || t.title, u = e.originalTitle || e.title;
      return u === t.title || u === r || e.title === t.title;
    }), n = "title"), i === -1 && e.id && e.id.startsWith("sys-entry-")) {
      const t = parseInt(e.id.replace("sys-entry-", ""), 10);
      !isNaN(t) && t < s.length && !h.has(t) && (i = t, n = "positional");
    }
    if (i !== -1 ? (h.add(i), b("MERGE", `Override[${o}] "${e.title}" matched system[${i}] "${s[i].title}" via ${n}`)) : b("MERGE", `Override[${o}] "${e.title}" (origTitle="${e.originalTitle}", id="${e.id}") had NO match in system entries`), e.deleted) {
      if (d.some(
        (l) => e.id && l.id === e.id && !l.id.startsWith("sys-") && !e.id.startsWith("sys-") || (e.originalTitle || e.title) === (l.originalTitle || l.title)
      )) {
        b("MERGE", `Override[${o}] "${e.title}" is a DUPLICATE deleted override — skipping`);
        return;
      }
      b("MERGE", `Override[${o}] "${e.title}" is DELETED (${i !== -1 ? "matched & suppressed system entry" : "preserved deleted override from previous deploy"})`), d.push({ ...e, deleted: !0, enabled: !1 });
    } else if (i !== -1) {
      const t = s[i];
      d.push({
        ...t,
        title: e.title !== void 0 ? e.title : t.title,
        originalTitle: e.originalTitle || t.originalTitle || t.title,
        enabled: e.enabled !== void 0 ? e.enabled : t.enabled,
        deleted: !1,
        order: d.length
      });
    } else
      d.push({ ...e, deleted: !1, order: d.length });
  });
  let g = 0;
  return s.forEach((e, o) => {
    h.has(o) || (g++, b("MERGE", `System entry[${o}] "${e.title}" was UNMATCHED — adding to result`), d.push({
      ...e,
      originalTitle: e.originalTitle || e.title,
      order: d.length
    }));
  }), b("MERGE", `Merge complete: ${d.length} total entries (${g} unmatched system entries added)`), d;
}
function Z(s, c) {
  if (!c || !Array.isArray(c) || c.length === 0) return s;
  const h = s.split(`
`), d = [], g = [];
  let e = -1, o = 0, i = 0;
  for (; o < h.length; ) {
    const r = h[o], u = r.trim();
    if (u.startsWith("submenu ") || u.startsWith("submenu	")) {
      e === -1 && (e = d.length), o++;
      continue;
    }
    if (u === "}" && e !== -1 && d.length >= e) {
      o++;
      continue;
    }
    if (u.startsWith("menuentry ") || u.startsWith("menuentry	")) {
      e === -1 && (e = d.length);
      let p = "Unknown Entry";
      const f = u.match(/^menuentry\s+(?:['"](.*?)['"]|(\S+))/);
      f && (p = f[1] || f[2] || p);
      let m = `sys-entry-${i}`;
      const w = u.match(/(?:--id|\$menuentry_id_option)\s+(?:['"](.*?)['"]|(\S+))/);
      w && (m = w[1] || w[2] || m);
      const $ = [r];
      let E = (r.match(/\{/g) || []).length - (r.match(/\}/g) || []).length, S = o + 1;
      for (; S < h.length && (E > 0 || E === 0 && !h[S].includes("{")); ) {
        const T = h[S];
        if ($.push(T), E += (T.match(/\{/g) || []).length - (T.match(/\}/g) || []).length, E <= 0 && T.includes("}")) {
          S++;
          break;
        }
        S++;
      }
      g.push({ id: m, title: p, lines: $, origIdx: i }), i++, o = S;
      continue;
    }
    d.push(r), o++;
  }
  if (e === -1 || g.length === 0) return s;
  const n = [], t = /* @__PURE__ */ new Set();
  c.forEach((r, u) => {
    let p = g.findIndex((f, m) => !t.has(m) && r.id && f.id === r.id && !f.id.startsWith("sys-entry-"));
    if (p === -1 && (p = g.findIndex((f, m) => !t.has(m) && (r.originalTitle === f.title || r.title === f.title))), p === -1 && r.id && r.id.startsWith("sys-entry-")) {
      const f = parseInt(r.id.replace("sys-entry-", ""), 10);
      !isNaN(f) && !t.has(f) && (p = f);
    }
    if (p !== -1 && t.add(p), !(r.deleted || r.enabled === !1) && p !== -1) {
      const f = g[p];
      let m = f.lines[0];
      r.title && r.title !== f.title && (m = m.replace(f.title, r.title), f.lines[0] = m), n.push({ idx: u, text: f.lines.join(`
`) });
    }
  }), g.forEach((r, u) => {
    t.has(u) || n.push({ idx: n.length + 1e3, text: r.lines.join(`
`) });
  }), n.sort((r, u) => r.idx - u.idx);
  const l = n.map((r) => r.text).join(`

`);
  return d.splice(e, 0, l), d.join(`
`);
}
function M() {
  const s = "/var/lib/grub-editor/backups";
  if (process.getuid && process.getuid() === 0 && !a.existsSync(s))
    try {
      a.mkdirSync(s, { recursive: !0 });
    } catch {
    }
  return s;
}
function H(s) {
  const c = M(), h = Date.now(), d = `snap_${h}`, g = y.join(c, d);
  try {
    a.existsSync(g) || a.mkdirSync(g, { recursive: !0 });
  } catch {
    try {
      N(`pkexec /usr/bin/grub-editor-helper mkdir -p "${g}" && pkexec /usr/bin/grub-editor-helper chmod 755 "${g}"`);
    } catch (f) {
      return R("SNAPSHOT", "Could not create snapshot dir:", f.message), null;
    }
  }
  const e = a.existsSync("/etc/default/grub") ? "/etc/default/grub" : "/boot/grub/default", o = y.join(g, "default_grub.bak");
  try {
    const f = O(e);
    C(o, f);
  } catch (f) {
    R("SNAPSHOT", "Failed to backup default grub:", f);
  }
  const i = a.existsSync("/boot/grub2/grub.cfg") ? "/boot/grub2/grub.cfg" : "/boot/grub/grub.cfg";
  let n = null;
  if (a.existsSync(i)) {
    const f = y.join(g, "grub.cfg.bak");
    try {
      const m = O(i);
      C(f, m), n = f;
    } catch (m) {
      R("SNAPSHOT", "Failed to backup grub.cfg:", m);
    }
  }
  let t = null;
  const l = D();
  if (a.existsSync(l)) {
    const f = y.join(g, "grub-editor-entries.json.bak");
    try {
      const m = O(l);
      C(f, m), t = f;
    } catch {
    }
  }
  const r = `${h} (UTC Timestamp)`, u = {
    timestamp: h,
    date_string: r,
    description: s || "Auto-backup",
    default_grub_backup: o,
    grub_cfg_backup: n,
    bls_entries_backup: t,
    warnings: []
  }, p = y.join(g, "snapshot_metadata.json");
  return C(p, JSON.stringify(u, null, 2)), b("SNAPSHOT", `Created recovery snapshot in ${g}: "${s}"`), u;
}
async function oe(s, c) {
  if (!s.url || !s.url.startsWith("/api/"))
    return !1;
  c.setHeader("Content-Type", "application/json");
  try {
    const h = new URL(s.url, `http://${s.headers.host || "localhost"}`), d = h.pathname;
    if (s.method === "GET" && d === "/api/boot-entries") {
      if (b("GET /api/boot-entries", "Fetching boot entries..."), a.existsSync("/boot/loader/entries"))
        try {
          const t = a.readdirSync("/boot/loader/entries").filter((l) => l.endsWith(".conf") || l.endsWith(".mgnix"));
          if (t.length > 0) {
            b("GET /api/boot-entries", `Found ${t.length} BLS entry files`);
            const l = [], r = A.release().trim();
            t.sort().forEach((f, m) => {
              const w = a.readFileSync(y.join("/boot/loader/entries", f), "utf8");
              let $ = f, E = "", S = "";
              w.split(`
`).forEach((x) => {
                const k = x.trim();
                k.startsWith("title ") ? $ = k.substring(6).trim() : k.startsWith("version ") ? E = k.substring(8).trim() : k.startsWith("options ") && (S = k.substring(8).trim());
              });
              const T = E.includes(r) || $.includes(r);
              l.push({
                id: f.replace(/\.[^/.]+$/, ""),
                title: $,
                type: $.toLowerCase().includes("recovery") || $.toLowerCase().includes("rescue") ? "recovery" : "linux",
                enabled: !0,
                order: m,
                args: S || void 0,
                version: E || void 0,
                isCurrent: T,
                is_current: T,
                is_default: m === 0
              });
            });
            const u = U();
            b("GET /api/boot-entries", `Loaded ${u.length} saved overrides from ${D()}`);
            const p = z(l, u);
            return b("GET /api/boot-entries", `Returning ${p.length} entries (active: ${p.filter((f) => !f.deleted).length}, deleted: ${p.filter((f) => f.deleted).length})`), c.end(JSON.stringify(p)), !0;
          }
        } catch (t) {
          R("GET /api/boot-entries", "BLS directory read error, falling back to grub.cfg:", t);
        }
      const g = a.existsSync("/boot/grub2/grub.cfg") ? "/boot/grub2/grub.cfg" : "/boot/grub/grub.cfg";
      b("GET /api/boot-entries", `Reading grub.cfg from ${g}`);
      const e = O(g), o = se(e);
      b("GET /api/boot-entries", `Parsed ${o.length} menuentry blocks from grub.cfg`);
      const i = U();
      b("GET /api/boot-entries", `Loaded ${i.length} saved overrides from ${D()}`);
      const n = z(o, i);
      return b("GET /api/boot-entries", `Returning ${n.length} entries (active: ${n.filter((t) => !t.deleted).length}, deleted: ${n.filter((t) => t.deleted).length})`), c.end(JSON.stringify(n)), !0;
    }
    if (s.method === "GET" && d === "/api/grub-config") {
      const g = a.existsSync("/etc/default/grub") ? "/etc/default/grub" : "/boot/grub/default", e = O(g), o = {};
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
    if (s.method === "GET" && d === "/api/distro") {
      let g = "Ubuntu 24.04.4 LTS", e = "DebianUbuntu", o = ["update-grub"];
      try {
        a.readFileSync("/etc/os-release", "utf8").split(`
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
        uses_bls: a.existsSync("/boot/loader/entries")
      })), !0;
    }
    if (s.method === "GET" && d === "/api/scan-themes") {
      const g = a.existsSync("/boot/grub2/themes") ? "/boot/grub2/themes" : "/boot/grub/themes", e = [];
      try {
        let o = [];
        try {
          o = a.readdirSync(g);
        } catch {
          o = N(`pkexec /usr/bin/grub-editor-helper find "${g}" -maxdepth 1 -mindepth 1 -type d`, { encoding: "utf8" }).split(`
`).filter(Boolean).map((n) => y.basename(n.trim()));
        }
        for (const i of o) {
          const n = y.join(g, i), t = y.join(n, "theme.txt");
          let l = !1;
          try {
            a.existsSync(t) && (l = !0);
          } catch {
            try {
              N(`test -f "${t}"`, { stdio: "ignore" }), l = !0;
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
    if (s.method === "GET" && d === "/api/snapshots") {
      b("GET /api/snapshots", "Fetching recovery snapshots...");
      const g = M(), e = [];
      if (a.existsSync(g))
        try {
          const o = a.readdirSync(g);
          for (const i of o) {
            const n = y.join(g, i, "snapshot_metadata.json");
            if (a.existsSync(n))
              try {
                const t = O(n), l = JSON.parse(t);
                e.push(l);
              } catch {
              }
          }
          e.sort((i, n) => (n.timestamp || 0) - (i.timestamp || 0));
        } catch (o) {
          R("GET /api/snapshots", "Failed reading snapshot directories:", o);
        }
      return b("GET /api/snapshots", `Returning ${e.length} snapshots`), c.end(JSON.stringify(e)), !0;
    }
    if (s.method === "GET" && d === "/api/snapshot-details") {
      const g = h.searchParams.get("timestamp");
      if (!g)
        return c.statusCode = 400, c.end(JSON.stringify({ error: "Missing timestamp" })), !0;
      try {
        const e = M(), o = y.join(e, `snap_${g}`), i = y.join(o, "snapshot_metadata.json");
        if (!a.existsSync(i))
          throw new Error("Snapshot not found");
        const n = JSON.parse(O(i)), t = {};
        n.default_grub_backup && a.existsSync(n.default_grub_backup) && O(n.default_grub_backup).split(`
`).forEach((u) => {
          const p = u.trim();
          if (p && !p.startsWith("#") && p.includes("=")) {
            const f = p.indexOf("="), m = p.substring(0, f).trim();
            let w = p.substring(f + 1).trim();
            (w.startsWith('"') && w.endsWith('"') || w.startsWith("'") && w.endsWith("'")) && (w = w.substring(1, w.length - 1)), t[m] = w;
          }
        });
        let l = [];
        if (n.bls_entries_backup && a.existsSync(n.bls_entries_backup))
          try {
            l = JSON.parse(O(n.bls_entries_backup));
          } catch {
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
            if (d === "/api/save-grub-config") {
              const { newConfig: i, reason: n, createSnapshot: t } = o;
              if (b("POST /api/save-grub-config", `Saving config (createSnapshot=${t}, reason="${n}")`), t && H(n || "Modified GRUB general configuration"), i) {
                const l = ["# Updated via GrubEditor GUI"];
                for (const [u, p] of Object.entries(i))
                  l.push(`${u}="${p}"`);
                const r = y.join(A.tmpdir(), `grub-config-${Date.now()}`);
                a.writeFileSync(r, l.join(`
`) + `
`, "utf8");
                try {
                  a.copyFileSync(r, "/etc/default/grub"), a.existsSync(r) && a.unlinkSync(r);
                } catch {
                  try {
                    N(`pkexec /usr/bin/grub-editor-helper cp "${r}" /etc/default/grub && rm -f "${r}"`);
                  } catch (u) {
                    throw console.warn("Failed to copy config via pkexec:", u.message), new Error("Failed to copy config via pkexec: " + u.message);
                  }
                }
                delete _["/etc/default/grub"], delete _["/boot/grub/default"];
              }
              c.end(JSON.stringify({ success: !0 })), e();
              return;
            }
            if (d === "/api/save-boot-entries") {
              const { newEntries: i, reason: n, createSnapshot: t } = o;
              if (b("POST /api/save-boot-entries", `Received ${i?.length ?? 0} entries to save (createSnapshot=${t}, reason="${n}")`), t && H(n || "Modified boot menu entries & ordering"), i && Array.isArray(i)) {
                const l = i.map((p) => ({ ...p, originalTitle: p.originalTitle || p.title })), r = l.filter((p) => p.deleted).length, u = l.filter((p) => !p.deleted).length;
                b("POST /api/save-boot-entries", `Saving ${l.length} entries (${u} active, ${r} deleted) to ${D()}`), l.forEach((p, f) => {
                  b("POST /api/save-boot-entries", `  [${f}] id="${p.id}" title="${p.title}" origTitle="${p.originalTitle}" deleted=${p.deleted} enabled=${p.enabled}`);
                }), C(D(), JSON.stringify(l, null, 2)), b("POST /api/save-boot-entries", "Write successful");
              }
              delete _["/boot/grub/grub.cfg"], delete _["/boot/grub2/grub.cfg"], c.end(JSON.stringify({ success: !0 })), e();
              return;
            }
            if (d === "/api/restore-snapshot") {
              const { timestamp: i } = o;
              b("POST /api/restore-snapshot", `Restoring snapshot timestamp ${i}...`);
              const n = M(), t = y.join(n, `snap_${i}`), l = y.join(t, "snapshot_metadata.json");
              if (!a.existsSync(l))
                throw new Error("Snapshot metadata not found for timestamp " + i);
              const r = JSON.parse(O(l));
              if (H(`Auto-backup before restoring snapshot from ${new Date(i).toLocaleString()}`), r.default_grub_backup && a.existsSync(r.default_grub_backup)) {
                const u = a.existsSync("/etc/default/grub") ? "/etc/default/grub" : "/boot/grub/default";
                C(u, O(r.default_grub_backup)), delete _["/etc/default/grub"], delete _["/boot/grub/default"];
              }
              if (r.grub_cfg_backup && a.existsSync(r.grub_cfg_backup)) {
                const u = a.existsSync("/boot/grub2/grub.cfg") ? "/boot/grub2/grub.cfg" : "/boot/grub/grub.cfg";
                C(u, O(r.grub_cfg_backup)), delete _["/boot/grub/grub.cfg"], delete _["/boot/grub2/grub.cfg"];
              }
              r.bls_entries_backup && a.existsSync(r.bls_entries_backup) && C(D(), O(r.bls_entries_backup)), b("POST /api/restore-snapshot", "Restore completed successfully"), c.end(JSON.stringify({ success: !0 })), e();
              return;
            }
            if (d === "/api/trigger-regen") {
              b("POST /api/trigger-regen", "Starting GRUB regeneration...");
              let i = "";
              try {
                const n = process.getuid ? process.getuid() === 0 : !1, t = n ? "update-grub 2>&1" : "pkexec /usr/bin/grub-editor-helper update-grub 2>&1";
                b("POST /api/trigger-regen", `Running: ${t} (isRoot=${n})`), i = N(t, { encoding: "utf8" }), b("POST /api/trigger-regen", "update-grub completed successfully"), delete _["/boot/grub/grub.cfg"], delete _["/boot/grub2/grub.cfg"];
                try {
                  const l = a.existsSync("/boot/grub2/grub.cfg") ? "/boot/grub2/grub.cfg" : "/boot/grub/grub.cfg";
                  if (a.existsSync(l)) {
                    const r = O(l), u = U();
                    if (b("POST /api/trigger-regen", `Post-regen: ${u.length} overrides to apply to ${l}`), u.length > 0) {
                      const p = u.filter((m) => m.deleted);
                      b("POST /api/trigger-regen", `Overrides breakdown: ${u.length - p.length} active, ${p.length} deleted`);
                      const f = Z(r, u);
                      C(l, f), b("POST /api/trigger-regen", "Successfully wrote modified grub.cfg"), i += `
[GrubEditor] Applied custom menu ordering, titles, and exclusions to grub.cfg successfully.`;
                    }
                  }
                } catch (l) {
                  R("POST /api/trigger-regen", "Failed to apply post-regeneration overrides:", l), i += `
[GrubEditor] Warning: Could not apply overrides to grub.cfg: ${l.message}`;
                }
              } catch (n) {
                throw R("POST /api/trigger-regen", "update-grub failed:", n.message), new Error(`Failed to regenerate GRUB configuration: ${n.stdout || n.stderr || n.message}`);
              }
              b("POST /api/trigger-regen", "Regeneration pipeline complete"), c.end(JSON.stringify({ success: !0, output: i })), e();
              return;
            }
            if (d === "/api/deploy-pipeline") {
              const { config: i, bootEntries: n, snapTitle: t } = o;
              b("POST /api/deploy-pipeline", `Starting batched deploy pipeline. snapTitle: ${t}`);
              const l = process.getuid ? process.getuid() === 0 : !1, r = l ? "" : "pkexec /usr/bin/grub-editor-helper ", u = `/tmp/grub-editor-deploy-config-${Date.now()}`, p = `/tmp/grub-editor-deploy-entries-${Date.now()}`;
              let f = "";
              for (const [P, j] of Object.entries(i))
                f += `${P}="${j}"
`;
              a.writeFileSync(u, f);
              const m = (n || []).map((P) => ({ ...P, originalTitle: P.originalTitle || P.title }));
              a.writeFileSync(p, JSON.stringify(m, null, 2));
              const w = Date.now(), $ = y.join(M(), `snap_${w}`), E = a.existsSync("/etc/default/grub") ? "/etc/default/grub" : "/boot/grub/default", S = a.existsSync("/boot/grub2/grub.cfg") ? "/boot/grub2/grub.cfg" : "/boot/grub/grub.cfg", T = D(), x = `/tmp/grub-editor-deploy-script-${Date.now()}.sh`, k = `/tmp/grub-editor-raw-cfg-${Date.now()}`, J = {
                timestamp: w,
                description: t,
                default_grub_backup: y.join($, "default_grub.bak"),
                grub_cfg_backup: a.existsSync(S) ? y.join($, "grub.cfg.bak") : null,
                bls_entries_backup: y.join($, "grub-editor-entries.json.bak")
              }, B = `/tmp/grub-editor-deploy-meta-${Date.now()}`;
              a.writeFileSync(B, JSON.stringify(J, null, 2));
              const W = `/tmp/grub-editor-patched-cfg-${Date.now()}`, Q = `#!/bin/bash
set -e
set -x
echo "[Bash Runtime] Stage 1: Initializing snapshot in ${$}..."
mkdir -p "${$}"
chmod 755 "${$}"
if [ -f "${E}" ]; then cp "${E}" "${J.default_grub_backup}"; fi
if [ -f "${S}" ]; then cp "${S}" "${J.grub_cfg_backup}"; fi
if [ -f "${T}" ]; then cp "${T}" "${J.bls_entries_backup}"; fi
cp "${B}" "${$}/snapshot_metadata.json"
chmod 644 "${$}/snapshot_metadata.json"

echo "[Bash Runtime] Stage 2: Applying new GRUB configurations..."
cp "${u}" "${E}"
chmod 644 "${E}"
cp "${p}" "${T}"
chmod 644 "${T}"

echo "[Bash Runtime] Stage 3: Regenerating bootloader via update-grub..."
update-grub 2>&1

echo "[Bash Runtime] Stage 4: Exposing raw configuration for Node.js patching..."
cat "${S}" > "${k}"
chmod 666 "${k}"

echo "[Bash Runtime] Stage 5: Waiting for Node.js to apply dynamic overrides..."
COUNT=0
while [ ! -f "${W}" ]; do
  sleep 0.5
  COUNT=$((COUNT+1))
  if [ $COUNT -gt 60 ]; then
    echo "[Bash Runtime] ERROR: Timeout waiting for Node.js to patch configuration." >&2
    exit 1
  fi
done

echo "[Bash Runtime] Stage 6: Finalizing deployment..."
cp "${W}" "${S}"
chmod 644 "${S}"
echo "[Bash Runtime] Execution completed successfully!"
`;
              a.writeFileSync(x, Q), b("POST /api/deploy-pipeline", "Executing Batched Deploy Script Asynchronously...");
              try {
                const P = await new Promise((j, V) => {
                  let F = "";
                  const I = re(l ? "bash" : "pkexec", l ? ["bash", x] : ["/usr/bin/grub-editor-helper", "bash", x]);
                  I.stdout.on("data", (v) => {
                    F += v.toString();
                  }), I.stderr.on("data", (v) => {
                    F += v.toString();
                  }), I.on("close", (v) => {
                    v === 0 ? j(F) : V(new Error(`Exit code ${v}:
${F}`));
                  }), I.on("error", (v) => {
                    V(new Error(`Spawn error: ${v.message}
${F}`));
                  });
                  const q = setInterval(() => {
                    if (a.existsSync(k)) {
                      clearInterval(q), b("POST /api/deploy-pipeline", "Detected raw config. Applying overrides...");
                      try {
                        const v = a.readFileSync(k, "utf8"), ee = Z(v, m);
                        a.writeFileSync(W, ee);
                      } catch (v) {
                        R("POST /api/deploy-pipeline", "Failed to patch config:", v.message);
                      }
                    }
                  }, 500);
                });
                [u, p, B, x, k, W].forEach((j) => {
                  try {
                    a.existsSync(j) && a.unlinkSync(j);
                  } catch {
                  }
                }), delete _["/boot/grub/grub.cfg"], delete _["/boot/grub2/grub.cfg"], delete _["/etc/default/grub"], b("POST /api/deploy-pipeline", "Deployment pipeline complete"), c.end(JSON.stringify({ success: !0, output: P })), e();
                return;
              } catch (P) {
                throw [u, p, B, x, k, W].forEach((j) => {
                  try {
                    a.existsSync(j) && a.unlinkSync(j);
                  } catch {
                  }
                }), R("POST /api/deploy-pipeline", "Deploy pipeline failed:", P.message), new Error(`Failed during deployment:
${P.message}`);
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
const L = y.dirname(ie(import.meta.url));
G.commandLine.appendSwitch("no-sandbox");
G.commandLine.appendSwitch("disable-gpu-sandbox");
function K() {
  const s = a.existsSync(y.join(L, "preload.mjs")) ? y.join(L, "preload.mjs") : y.join(L, "preload.js"), c = new X({
    width: 1280,
    height: 860,
    minWidth: 1024,
    minHeight: 768,
    title: "GrubEditor - Pro Bootloader Studio",
    backgroundColor: "#050811",
    icon: y.join(L, "../public/app_logo.png"),
    webPreferences: {
      preload: s,
      nodeIntegration: !1,
      contextIsolation: !0
    }
  });
  if (c.setMenuBarVisibility(!1), te.setApplicationMenu(null), c.webContents.on("console-message", (h, d, g, e, o) => {
    console.log(`[Renderer Console] [level ${d}] ${g} (${o}:${e})`);
  }), c.webContents.on("did-fail-load", (h, d, g, e) => {
    console.error(`[Renderer Fail Load] (${d}) ${g} - ${e}`);
  }), c.webContents.on("render-process-gone", (h, d) => {
    console.error(`[Renderer Process Gone] ${d.reason} - exitCode: ${d.exitCode}`);
  }), process.env.VITE_DEV_SERVER_URL)
    c.loadURL(process.env.VITE_DEV_SERVER_URL);
  else {
    const h = y.join(L, "../dist"), d = ne.createServer(async (e, o) => {
      try {
        if (!await oe(e, o)) {
          const n = new URL(e.url || "/", `http://${e.headers.host || "localhost"}`);
          let t = y.join(h, n.pathname === "/" ? "index.html" : n.pathname);
          a.existsSync(t) || (t = y.join(h, "index.html"));
          const l = y.extname(t).toLowerCase(), u = {
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
          o.writeHead(200, { "Content-Type": u }), a.createReadStream(t).pipe(o);
        }
      } catch (i) {
        o.writeHead(500, { "Content-Type": "application/json" }), o.end(JSON.stringify({ error: i.message || "Internal Server Error" }));
      }
    }), g = (e) => {
      d.listen(e, "127.0.0.1", () => {
        const o = d.address().port;
        c.loadURL(`http://127.0.0.1:${o}`);
      });
    };
    d.on("error", (e) => {
      e.code === "EADDRINUSE" && (console.warn("Port 31415 occupied, retrying with ephemeral loopback port..."), d.close(), g(0));
    }), g(31415), c.on("closed", () => {
      try {
        d.close();
      } catch {
      }
    });
  }
}
G.whenReady().then(() => {
  K(), G.on("activate", () => {
    X.getAllWindows().length === 0 && K();
  });
});
G.on("window-all-closed", () => {
  process.platform !== "darwin" && G.quit();
});
