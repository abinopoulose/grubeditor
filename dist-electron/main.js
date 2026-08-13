import { app as W, BrowserWindow as X, Menu as te } from "electron";
import * as y from "node:path";
import * as c from "node:fs";
import * as ne from "node:http";
import { fileURLToPath as ie } from "node:url";
import * as U from "node:os";
import { execSync as D, spawn as re } from "node:child_process";
const Y = "[GrubEditor API]";
function b(r, ...a) {
  console.log(`${Y} [${r}]`, ...a);
}
function R(r, ...a) {
  console.error(`${Y} [${r}] ERROR:`, ...a);
}
const k = {};
function O(r, a = 5e3) {
  const h = Date.now();
  if (k[r] && h - k[r].timestamp < a)
    return k[r].data;
  let g = "";
  try {
    g = c.readFileSync(r, "utf8");
  } catch (p) {
    if (p.code === "ENOENT")
      throw new Error(`File not found: ${r}`);
    try {
      g = D(`pkexec /usr/bin/grub-editor-helper cat "${r}"`, { encoding: "utf8" });
    } catch {
      throw new Error(`File not found or unreadable: ${r}`);
    }
  }
  return k[r] = { data: g, timestamp: h }, g;
}
function se(r) {
  const a = [], h = U.release().trim(), g = r.split(`
`);
  let p, e = !1;
  for (let o = 0; o < g.length; o++) {
    const s = g[o].trim();
    if (s.startsWith("submenu ") || s.startsWith("submenu	")) {
      e = !0, s.match(/^submenu\s+((?:['"])(.*?)(?:['"])|(\S+))/) && (p = `submenu-${o}`);
      continue;
    }
    if (e && s === "}") {
      e = !1, p = void 0;
      continue;
    }
    if (s.startsWith("menuentry ") || s.startsWith("menuentry	")) {
      let n = "Unknown Entry";
      const t = s.match(/^menuentry\s+(?:['"](.*?)['"]|(\S+))/);
      t && (n = t[1] || t[2] || "Unknown Entry");
      let u = `sys-entry-${a.length}`;
      const i = s.match(/(?:--id|\$menuentry_id_option)\s+(?:['"](.*?)['"]|(\S+))/);
      i && (u = i[1] || i[2] || u);
      let l = "", d = (s.match(/\{/g) || []).length - (s.match(/\}/g) || []).length, f = o + 1;
      for (; f < g.length && (d > 0 || d === 0 && !g[f].includes("{")); ) {
        const w = g[f];
        if (l += w + `
`, d += (w.match(/\{/g) || []).length - (w.match(/\}/g) || []).length, d <= 0 && w.includes("}")) break;
        f++;
      }
      o = f;
      let m = "custom", _, $, x = !1;
      const S = n.toLowerCase();
      S.includes("recovery") || S.includes("advanced") || S.includes("rescue") || l.toLowerCase().includes("recovery") || l.toLowerCase().includes("single") ? m = "recovery" : S.includes("windows") || l.toLowerCase().includes("chainloader") ? m = "windows" : S.includes("uefi") || S.includes("firmware") || l.toLowerCase().includes("fwsetup") ? m = "efi" : (S.includes("linux") || S.includes("ubuntu") || S.includes("debian") || S.includes("fedora") || l.includes("linux ") || l.includes("linuxefi ") || l.includes("linux16 ")) && (m = "linux");
      const T = l.match(/^\s*(?:linux|linuxefi|linux16)\s+(\S+)(.*)$/m);
      if (T) {
        const w = T[1];
        _ = T[2].trim(), m !== "recovery" && m !== "windows" && m !== "efi" && (m = "linux");
        const E = w.match(/vmlinuz-([a-zA-Z0-9.\-_]+)/i) || w.match(/kernel-([a-zA-Z0-9.\-_]+)/i);
        E && ($ = E[1]);
      }
      if (!$) {
        const w = n.match(/\b(\d+\.\d+(?:\.\d+)?(?:-[a-zA-Z0-9]+)*)\b/);
        w && ($ = w[1]);
      }
      ($ && $.includes(h) || n.includes(h) || h.length > 3 && ($ === h || n.includes(h))) && (x = !0), a.push({
        id: u,
        title: n,
        type: m,
        enabled: !0,
        order: a.length,
        args: _ || void 0,
        version: $ || void 0,
        isCurrent: x,
        is_current: x,
        is_default: a.length === 0,
        parent_id: p,
        raw_boot_commands: l.trim()
      });
    }
  }
  return a;
}
function G() {
  const r = "/var/lib/grub-editor";
  try {
    c.existsSync(r) || process.getuid && process.getuid() === 0 && (c.mkdirSync(r, { recursive: !0 }), c.chmodSync(r, 493));
  } catch {
  }
  return y.join(r, "grub-editor-entries.json");
}
function C(r, a) {
  try {
    const h = y.dirname(r);
    c.existsSync(h) || c.mkdirSync(h, { recursive: !0 }), c.writeFileSync(r, a, "utf8");
  } catch {
    const h = y.join(U.tmpdir(), `grub-write-${Date.now()}-${Math.random().toString(36).substring(2, 8)}`);
    c.writeFileSync(h, a, "utf8");
    try {
      D(`pkexec /usr/bin/grub-editor-helper sh -c "mkdir -p '$(dirname "${r}")' && chmod 755 '$(dirname "${r}")' && cp '${h}' '${r}' && chmod 0644 '${r}'"`, { stdio: "ignore" });
    } catch (g) {
      throw console.error(`Failed to write ${r} via pkexec:`, g.message), new Error(`Cannot write to ${r}: permission denied or authentication dismissed.`);
    } finally {
      if (c.existsSync(h)) try {
        c.unlinkSync(h);
      } catch {
      }
    }
  }
  delete k[r];
}
function I() {
  try {
    const r = G(), a = O(r, 0);
    return JSON.parse(a);
  } catch {
    return [];
  }
}
function z(r, a) {
  if (b("MERGE", `Starting merge: ${r.length} system entries, ${a.length} overrides`), !a || !Array.isArray(a) || a.length === 0)
    return b("MERGE", "No overrides found, returning raw system entries"), r;
  const h = /* @__PURE__ */ new Set();
  r.forEach((e) => {
    e.originalTitle || (e.originalTitle = e.title);
  }), b("MERGE", "System entries:", r.map((e, o) => `[${o}] id="${e.id}" title="${e.title}"`).join(" | ")), b("MERGE", "Overrides:", a.map((e, o) => `[${o}] id="${e.id}" title="${e.title}" origTitle="${e.originalTitle}" deleted=${e.deleted}`).join(" | "));
  const g = [];
  a.forEach((e, o) => {
    let s = r.findIndex((t, u) => !h.has(u) && e.id && t.id === e.id && !t.id.startsWith("sys-entry-")), n = "id";
    if (s === -1 && (s = r.findIndex((t, u) => {
      if (h.has(u)) return !1;
      const i = t.originalTitle || t.title, l = e.originalTitle || e.title;
      return l === t.title || l === i || e.title === t.title;
    }), n = "title"), s === -1 && e.id && e.id.startsWith("sys-entry-")) {
      const t = parseInt(e.id.replace("sys-entry-", ""), 10);
      !isNaN(t) && t < r.length && !h.has(t) && (s = t, n = "positional");
    }
    if (s !== -1 ? (h.add(s), b("MERGE", `Override[${o}] "${e.title}" matched system[${s}] "${r[s].title}" via ${n}`)) : b("MERGE", `Override[${o}] "${e.title}" (origTitle="${e.originalTitle}", id="${e.id}") had NO match in system entries`), e.deleted) {
      if (g.some(
        (u) => e.id && u.id === e.id && !u.id.startsWith("sys-") && !e.id.startsWith("sys-") || (e.originalTitle || e.title) === (u.originalTitle || u.title)
      )) {
        b("MERGE", `Override[${o}] "${e.title}" is a DUPLICATE deleted override — skipping`);
        return;
      }
      b("MERGE", `Override[${o}] "${e.title}" is DELETED (${s !== -1 ? "matched & suppressed system entry" : "preserved deleted override from previous deploy"})`), g.push({ ...e, deleted: !0, enabled: !1 });
    } else if (s !== -1) {
      const t = r[s];
      g.push({
        ...t,
        title: e.title !== void 0 ? e.title : t.title,
        originalTitle: e.originalTitle || t.originalTitle || t.title,
        enabled: e.enabled !== void 0 ? e.enabled : t.enabled,
        deleted: !1,
        order: g.length
      });
    } else
      g.push({ ...e, deleted: !1, order: g.length });
  });
  let p = 0;
  return r.forEach((e, o) => {
    h.has(o) || (p++, b("MERGE", `System entry[${o}] "${e.title}" was UNMATCHED — adding to result`), g.push({
      ...e,
      originalTitle: e.originalTitle || e.title,
      order: g.length
    }));
  }), b("MERGE", `Merge complete: ${g.length} total entries (${p} unmatched system entries added)`), g;
}
function Z(r, a) {
  if (!a || !Array.isArray(a) || a.length === 0) return r;
  const h = r.split(`
`), g = [], p = [];
  let e = -1, o = 0, s = 0;
  for (; o < h.length; ) {
    const i = h[o], l = i.trim();
    if (l.startsWith("submenu ") || l.startsWith("submenu	")) {
      e === -1 && (e = g.length), o++;
      continue;
    }
    if (l === "}" && e !== -1 && g.length >= e) {
      o++;
      continue;
    }
    if (l.startsWith("menuentry ") || l.startsWith("menuentry	")) {
      e === -1 && (e = g.length);
      let d = "Unknown Entry";
      const f = l.match(/^menuentry\s+(?:['"](.*?)['"]|(\S+))/);
      f && (d = f[1] || f[2] || d);
      let m = `sys-entry-${s}`;
      const _ = l.match(/(?:--id|\$menuentry_id_option)\s+(?:['"](.*?)['"]|(\S+))/);
      _ && (m = _[1] || _[2] || m);
      const $ = [i];
      let x = (i.match(/\{/g) || []).length - (i.match(/\}/g) || []).length, S = o + 1;
      for (; S < h.length && (x > 0 || x === 0 && !h[S].includes("{")); ) {
        const T = h[S];
        if ($.push(T), x += (T.match(/\{/g) || []).length - (T.match(/\}/g) || []).length, x <= 0 && T.includes("}")) {
          S++;
          break;
        }
        S++;
      }
      p.push({ id: m, title: d, lines: $, origIdx: s }), s++, o = S;
      continue;
    }
    g.push(i), o++;
  }
  if (e === -1 || p.length === 0) return r;
  const n = [], t = /* @__PURE__ */ new Set();
  a.forEach((i, l) => {
    let d = p.findIndex((f, m) => !t.has(m) && i.id && f.id === i.id && !f.id.startsWith("sys-entry-"));
    if (d === -1 && (d = p.findIndex((f, m) => !t.has(m) && (i.originalTitle === f.title || i.title === f.title))), d === -1 && i.id && i.id.startsWith("sys-entry-")) {
      const f = parseInt(i.id.replace("sys-entry-", ""), 10);
      !isNaN(f) && !t.has(f) && (d = f);
    }
    if (d !== -1 && t.add(d), !(i.deleted || i.enabled === !1) && d !== -1) {
      const f = p[d];
      let m = f.lines[0];
      i.title && i.title !== f.title && (m = m.replace(f.title, i.title), f.lines[0] = m), n.push({ idx: l, text: f.lines.join(`
`) });
    }
  }), p.forEach((i, l) => {
    t.has(l) || n.push({ idx: n.length + 1e3, text: i.lines.join(`
`) });
  }), n.sort((i, l) => i.idx - l.idx);
  const u = n.map((i) => i.text).join(`

`);
  return g.splice(e, 0, u), g.join(`
`);
}
function A() {
  const r = "/var/lib/grub-editor/backups";
  if (process.getuid && process.getuid() === 0 && !c.existsSync(r))
    try {
      c.mkdirSync(r, { recursive: !0 }), c.chmodSync("/var/lib/grub-editor", 493), c.chmodSync(r, 493);
    } catch {
    }
  return r;
}
function H(r) {
  const a = A(), h = Date.now(), g = `snap_${h}`, p = y.join(a, g);
  try {
    c.existsSync(p) || c.mkdirSync(p, { recursive: !0 });
  } catch {
    try {
      D(`pkexec /usr/bin/grub-editor-helper mkdir -p "${p}" && pkexec /usr/bin/grub-editor-helper chmod 755 "${p}"`);
    } catch (f) {
      return R("SNAPSHOT", "Could not create snapshot dir:", f.message), null;
    }
  }
  const e = c.existsSync("/etc/default/grub") ? "/etc/default/grub" : "/boot/grub/default", o = y.join(p, "default_grub.bak");
  try {
    const f = O(e);
    C(o, f);
  } catch (f) {
    R("SNAPSHOT", "Failed to backup default grub:", f);
  }
  const s = c.existsSync("/boot/grub2/grub.cfg") ? "/boot/grub2/grub.cfg" : "/boot/grub/grub.cfg";
  let n = null;
  if (c.existsSync(s)) {
    const f = y.join(p, "grub.cfg.bak");
    try {
      const m = O(s);
      C(f, m), n = f;
    } catch (m) {
      R("SNAPSHOT", "Failed to backup grub.cfg:", m);
    }
  }
  let t = null;
  const u = G();
  if (c.existsSync(u)) {
    const f = y.join(p, "grub-editor-entries.json.bak");
    try {
      const m = O(u);
      C(f, m), t = f;
    } catch {
    }
  }
  const i = `${h} (UTC Timestamp)`, l = {
    timestamp: h,
    date_string: i,
    description: r || "Auto-backup",
    default_grub_backup: o,
    grub_cfg_backup: n,
    bls_entries_backup: t,
    warnings: []
  }, d = y.join(p, "snapshot_metadata.json");
  return C(d, JSON.stringify(l, null, 2)), b("SNAPSHOT", `Created recovery snapshot in ${p}: "${r}"`), l;
}
async function oe(r, a) {
  if (!r.url || !r.url.startsWith("/api/"))
    return !1;
  a.setHeader("Content-Type", "application/json");
  try {
    const h = new URL(r.url, `http://${r.headers.host || "localhost"}`), g = h.pathname;
    if (r.method === "GET" && g === "/api/boot-entries") {
      if (b("GET /api/boot-entries", "Fetching boot entries..."), c.existsSync("/boot/loader/entries"))
        try {
          const t = c.readdirSync("/boot/loader/entries").filter((u) => u.endsWith(".conf") || u.endsWith(".mgnix"));
          if (t.length > 0) {
            b("GET /api/boot-entries", `Found ${t.length} BLS entry files`);
            const u = [], i = U.release().trim();
            t.sort().forEach((f, m) => {
              const _ = c.readFileSync(y.join("/boot/loader/entries", f), "utf8");
              let $ = f, x = "", S = "";
              _.split(`
`).forEach((w) => {
                const E = w.trim();
                E.startsWith("title ") ? $ = E.substring(6).trim() : E.startsWith("version ") ? x = E.substring(8).trim() : E.startsWith("options ") && (S = E.substring(8).trim());
              });
              const T = x.includes(i) || $.includes(i);
              u.push({
                id: f.replace(/\.[^/.]+$/, ""),
                title: $,
                type: $.toLowerCase().includes("recovery") || $.toLowerCase().includes("rescue") ? "recovery" : "linux",
                enabled: !0,
                order: m,
                args: S || void 0,
                version: x || void 0,
                isCurrent: T,
                is_current: T,
                is_default: m === 0
              });
            });
            const l = I();
            b("GET /api/boot-entries", `Loaded ${l.length} saved overrides from ${G()}`);
            const d = z(u, l);
            return b("GET /api/boot-entries", `Returning ${d.length} entries (active: ${d.filter((f) => !f.deleted).length}, deleted: ${d.filter((f) => f.deleted).length})`), a.end(JSON.stringify(d)), !0;
          }
        } catch (t) {
          R("GET /api/boot-entries", "BLS directory read error, falling back to grub.cfg:", t);
        }
      const p = c.existsSync("/boot/grub2/grub.cfg") ? "/boot/grub2/grub.cfg" : "/boot/grub/grub.cfg";
      b("GET /api/boot-entries", `Reading grub.cfg from ${p}`);
      const e = O(p), o = se(e);
      b("GET /api/boot-entries", `Parsed ${o.length} menuentry blocks from grub.cfg`);
      const s = I();
      b("GET /api/boot-entries", `Loaded ${s.length} saved overrides from ${G()}`);
      const n = z(o, s);
      return b("GET /api/boot-entries", `Returning ${n.length} entries (active: ${n.filter((t) => !t.deleted).length}, deleted: ${n.filter((t) => t.deleted).length})`), a.end(JSON.stringify(n)), !0;
    }
    if (r.method === "GET" && g === "/api/grub-config") {
      const p = c.existsSync("/etc/default/grub") ? "/etc/default/grub" : "/boot/grub/default", e = O(p), o = {};
      return e.split(`
`).forEach((s) => {
        const n = s.trim();
        if (n && !n.startsWith("#") && n.includes("=")) {
          const t = n.indexOf("="), u = n.substring(0, t).trim();
          let i = n.substring(t + 1).trim();
          (i.startsWith('"') && i.endsWith('"') || i.startsWith("'") && i.endsWith("'")) && (i = i.substring(1, i.length - 1)), o[u] = i;
        }
      }), a.end(JSON.stringify(o)), !0;
    }
    if (r.method === "GET" && g === "/api/distro") {
      let p = "Ubuntu 24.04.4 LTS", e = "DebianUbuntu", o = ["update-grub"];
      try {
        c.readFileSync("/etc/os-release", "utf8").split(`
`).forEach((n) => {
          if (n.startsWith("PRETTY_NAME="))
            p = n.split("=")[1].replace(/["']/g, "").trim();
          else if (n.startsWith("ID=")) {
            const t = n.split("=")[1].replace(/["']/g, "").trim().toLowerCase();
            t === "fedora" || t === "rhel" || t === "centos" || t === "rocky" ? (e = "RHEL", o = ["grub2-mkconfig", "-o", "/boot/grub2/grub.cfg"]) : (t === "arch" || t === "manjaro") && (e = "Arch", o = ["grub-mkconfig", "-o", "/boot/grub/grub.cfg"]);
          }
        });
      } catch {
      }
      return a.end(JSON.stringify({
        distro_name: p,
        family: e,
        default_grub_path: "/etc/default/grub",
        grub_dir: "/boot/grub",
        grub_cfg_path: "/boot/grub/grub.cfg",
        themes_dir: "/boot/grub/themes",
        regen_command: o,
        uses_bls: c.existsSync("/boot/loader/entries")
      })), !0;
    }
    if (r.method === "GET" && g === "/api/scan-themes") {
      const p = c.existsSync("/boot/grub2/themes") ? "/boot/grub2/themes" : "/boot/grub/themes", e = [];
      try {
        let o = [];
        try {
          o = c.readdirSync(p);
        } catch {
          o = D(`pkexec /usr/bin/grub-editor-helper find "${p}" -maxdepth 1 -mindepth 1 -type d`, { encoding: "utf8" }).split(`
`).filter(Boolean).map((n) => y.basename(n.trim()));
        }
        for (const s of o) {
          const n = y.join(p, s), t = y.join(n, "theme.txt");
          let u = !1;
          try {
            c.existsSync(t) && (u = !0);
          } catch {
            try {
              D(`test -f "${t}"`, { stdio: "ignore" }), u = !0;
            } catch {
            }
          }
          u && e.push({
            name: s,
            path: n,
            is_valid: !0,
            validation_errors: [],
            has_pf2_fonts: !0,
            background_image: "background.png",
            title_text: `${s} Theme`
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
      }), a.end(JSON.stringify(e)), !0;
    }
    if (r.method === "GET" && g === "/api/snapshots") {
      b("GET /api/snapshots", "Fetching recovery snapshots...");
      const p = A(), e = [];
      if (c.existsSync(p))
        try {
          const o = c.readdirSync(p);
          for (const s of o) {
            const n = y.join(p, s, "snapshot_metadata.json");
            if (c.existsSync(n))
              try {
                const t = O(n), u = JSON.parse(t);
                e.push(u);
              } catch {
              }
          }
          e.sort((s, n) => (n.timestamp || 0) - (s.timestamp || 0));
        } catch (o) {
          R("GET /api/snapshots", "Failed reading snapshot directories:", o);
        }
      return b("GET /api/snapshots", `Returning ${e.length} snapshots`), a.end(JSON.stringify(e)), !0;
    }
    if (r.method === "GET" && g === "/api/snapshot-details") {
      const p = h.searchParams.get("timestamp");
      if (!p)
        return a.statusCode = 400, a.end(JSON.stringify({ error: "Missing timestamp" })), !0;
      try {
        const e = A(), o = y.join(e, `snap_${p}`), s = y.join(o, "snapshot_metadata.json");
        if (!c.existsSync(s))
          throw new Error("Snapshot not found");
        const n = JSON.parse(O(s)), t = {};
        if (n.default_grub_backup)
          try {
            O(n.default_grub_backup).split(`
`).forEach((l) => {
              const d = l.trim();
              if (d && !d.startsWith("#") && d.includes("=")) {
                const f = d.indexOf("="), m = d.substring(0, f).trim();
                let _ = d.substring(f + 1).trim();
                (_.startsWith('"') && _.endsWith('"') || _.startsWith("'") && _.endsWith("'")) && (_ = _.substring(1, _.length - 1)), t[m] = _;
              }
            });
          } catch (i) {
            R("GET /api/snapshot-details", "Failed to read default_grub_backup", i);
          }
        let u = [];
        if (n.bls_entries_backup)
          try {
            u = JSON.parse(O(n.bls_entries_backup));
          } catch (i) {
            R("GET /api/snapshot-details", "Failed to read bls_entries_backup", i);
          }
        a.end(JSON.stringify({ config: t, bootEntries: u }));
      } catch (e) {
        a.statusCode = 500, a.end(JSON.stringify({ error: e.message }));
      }
      return !0;
    }
    if (r.method === "POST") {
      let p = "";
      return r.on("data", (e) => {
        p += e;
      }), await new Promise((e) => {
        r.on("end", async () => {
          try {
            const o = p ? JSON.parse(p) : {};
            if (g === "/api/save-grub-config") {
              const { newConfig: s, reason: n, createSnapshot: t } = o;
              if (b("POST /api/save-grub-config", `Saving config (createSnapshot=${t}, reason="${n}")`), s) {
                const u = ["# Updated via GrubEditor GUI"];
                for (const [l, d] of Object.entries(s))
                  u.push(`${l}="${d}"`);
                const i = y.join(U.tmpdir(), `grub-config-${Date.now()}`);
                c.writeFileSync(i, u.join(`
`) + `
`, "utf8");
                try {
                  c.copyFileSync(i, "/etc/default/grub"), c.existsSync(i) && c.unlinkSync(i);
                } catch {
                  try {
                    D(`pkexec /usr/bin/grub-editor-helper cp "${i}" /etc/default/grub && rm -f "${i}"`);
                  } catch (l) {
                    throw console.warn("Failed to copy config via pkexec:", l.message), new Error("Failed to copy config via pkexec: " + l.message);
                  }
                }
                delete k["/etc/default/grub"], delete k["/boot/grub/default"];
              }
              t && H(n || "Modified GRUB general configuration"), a.end(JSON.stringify({ success: !0 })), e();
              return;
            }
            if (g === "/api/save-boot-entries") {
              const { newEntries: s, reason: n, createSnapshot: t } = o;
              if (b("POST /api/save-boot-entries", `Received ${s?.length ?? 0} entries to save (createSnapshot=${t}, reason="${n}")`), s && Array.isArray(s)) {
                const u = s.map((d) => ({ ...d, originalTitle: d.originalTitle || d.title })), i = u.filter((d) => d.deleted).length, l = u.filter((d) => !d.deleted).length;
                b("POST /api/save-boot-entries", `Saving ${u.length} entries (${l} active, ${i} deleted) to ${G()}`), u.forEach((d, f) => {
                  b("POST /api/save-boot-entries", `  [${f}] id="${d.id}" title="${d.title}" origTitle="${d.originalTitle}" deleted=${d.deleted} enabled=${d.enabled}`);
                }), C(G(), JSON.stringify(u, null, 2)), b("POST /api/save-boot-entries", "Write successful");
              }
              t && H(n || "Modified boot menu entries & ordering"), delete k["/boot/grub/grub.cfg"], delete k["/boot/grub2/grub.cfg"], a.end(JSON.stringify({ success: !0 })), e();
              return;
            }
            if (g === "/api/restore-snapshot") {
              const { timestamp: s } = o;
              b("POST /api/restore-snapshot", `Restoring snapshot timestamp ${s}...`);
              const n = A(), t = y.join(n, `snap_${s}`), u = y.join(t, "snapshot_metadata.json");
              if (!c.existsSync(u))
                throw new Error("Snapshot metadata not found for timestamp " + s);
              const i = JSON.parse(O(u));
              H(`Auto-backup before restoring snapshot from ${new Date(s).toLocaleString()}`);
              try {
                if (i.default_grub_backup && c.existsSync(i.default_grub_backup)) {
                  const d = c.existsSync("/etc/default/grub") ? "/etc/default/grub" : "/boot/grub/default";
                  C(d, O(i.default_grub_backup)), delete k["/etc/default/grub"], delete k["/boot/grub/default"];
                }
                if (i.grub_cfg_backup && c.existsSync(i.grub_cfg_backup)) {
                  const d = c.existsSync("/boot/grub2/grub.cfg") ? "/boot/grub2/grub.cfg" : "/boot/grub/grub.cfg";
                  C(d, O(i.grub_cfg_backup)), delete k["/boot/grub/grub.cfg"], delete k["/boot/grub2/grub.cfg"];
                }
                let l = !1;
                if (i.bls_entries_backup && c.existsSync(i.bls_entries_backup)) {
                  const d = O(i.bls_entries_backup);
                  C(G(), d), l = !0;
                }
                l || C(G(), "[]"), b("POST /api/restore-snapshot", "Restore completed successfully"), a.end(JSON.stringify({ success: !0 }));
              } catch (l) {
                R("POST /api/restore-snapshot", "Restore aborted due to error:", l.message), a.statusCode = 500, a.end(JSON.stringify({ success: !1, error: l.message }));
              }
              e();
              return;
            }
            if (g === "/api/trigger-regen") {
              b("POST /api/trigger-regen", "Starting GRUB regeneration...");
              let s = "";
              try {
                const n = process.getuid ? process.getuid() === 0 : !1, t = n ? "update-grub 2>&1" : "pkexec /usr/bin/grub-editor-helper update-grub 2>&1";
                b("POST /api/trigger-regen", `Running: ${t} (isRoot=${n})`), s = D(t, { encoding: "utf8" }), b("POST /api/trigger-regen", "update-grub completed successfully"), delete k["/boot/grub/grub.cfg"], delete k["/boot/grub2/grub.cfg"];
                try {
                  const u = c.existsSync("/boot/grub2/grub.cfg") ? "/boot/grub2/grub.cfg" : "/boot/grub/grub.cfg";
                  if (c.existsSync(u)) {
                    const i = O(u), l = I();
                    if (b("POST /api/trigger-regen", `Post-regen: ${l.length} overrides to apply to ${u}`), l.length > 0) {
                      const d = l.filter((m) => m.deleted);
                      b("POST /api/trigger-regen", `Overrides breakdown: ${l.length - d.length} active, ${d.length} deleted`);
                      const f = Z(i, l);
                      C(u, f), b("POST /api/trigger-regen", "Successfully wrote modified grub.cfg"), s += `
[GrubEditor] Applied custom menu ordering, titles, and exclusions to grub.cfg successfully.`;
                    }
                  }
                } catch (u) {
                  R("POST /api/trigger-regen", "Failed to apply post-regeneration overrides:", u), s += `
[GrubEditor] Warning: Could not apply overrides to grub.cfg: ${u.message}`;
                }
              } catch (n) {
                throw R("POST /api/trigger-regen", "update-grub failed:", n.message), new Error(`Failed to regenerate GRUB configuration: ${n.stdout || n.stderr || n.message}`);
              }
              b("POST /api/trigger-regen", "Regeneration pipeline complete"), a.end(JSON.stringify({ success: !0, output: s })), e();
              return;
            }
            if (g === "/api/deploy-pipeline") {
              const { config: s, bootEntries: n, snapTitle: t } = o;
              b("POST /api/deploy-pipeline", `Starting batched deploy pipeline. snapTitle: ${t}`);
              const u = process.getuid ? process.getuid() === 0 : !1, i = u ? "" : "pkexec /usr/bin/grub-editor-helper ", l = `/tmp/grub-editor-deploy-config-${Date.now()}`, d = `/tmp/grub-editor-deploy-entries-${Date.now()}`;
              let f = "";
              for (const [j, N] of Object.entries(s))
                f += `${j}="${N}"
`;
              c.writeFileSync(l, f);
              const m = (n || []).map((j) => ({ ...j, originalTitle: j.originalTitle || j.title }));
              c.writeFileSync(d, JSON.stringify(m, null, 2));
              const _ = Date.now(), $ = y.join(A(), `snap_${_}`), x = c.existsSync("/etc/default/grub") ? "/etc/default/grub" : "/boot/grub/default", S = c.existsSync("/boot/grub2/grub.cfg") ? "/boot/grub2/grub.cfg" : "/boot/grub/grub.cfg", T = G(), w = `/tmp/grub-editor-deploy-script-${Date.now()}.sh`, E = `/tmp/grub-editor-raw-cfg-${Date.now()}`, v = {
                timestamp: _,
                date_string: `${_} (UTC Timestamp)`,
                description: t,
                default_grub_backup: y.join($, "default_grub.bak"),
                grub_cfg_backup: c.existsSync(S) ? y.join($, "grub.cfg.bak") : null,
                bls_entries_backup: y.join($, "grub-editor-entries.json.bak")
              }, J = `/tmp/grub-editor-deploy-meta-${Date.now()}`;
              c.writeFileSync(J, JSON.stringify(v, null, 2));
              const F = `/tmp/grub-editor-patched-cfg-${Date.now()}`, Q = `#!/bin/bash
set -e
set -x
echo "[Bash Runtime] Stage 1: Applying new GRUB configurations..."
cp "${l}" "${x}"
chmod 644 "${x}"
cp "${d}" "${T}"
chmod 644 "${T}"

echo "[Bash Runtime] Stage 2: Regenerating bootloader via update-grub..."
update-grub 2>&1

echo "[Bash Runtime] Stage 3: Exposing raw configuration for Node.js patching..."
cat "${S}" > "${E}"
chmod 666 "${E}"

echo "[Bash Runtime] Stage 4: Waiting for Node.js to apply dynamic overrides..."
COUNT=0
while [ ! -f "${F}" ]; do
  sleep 0.5
  COUNT=$((COUNT+1))
  if [ $COUNT -gt 60 ]; then
    echo "[Bash Runtime] ERROR: Timeout waiting for Node.js to patch configuration." >&2
    exit 1
  fi
done

echo "[Bash Runtime] Stage 5: Finalizing deployment..."
cp "${F}" "${S}"
chmod 644 "${S}"

echo "[Bash Runtime] Stage 6: Recording final state into snapshot..."
mkdir -p "${$}"
chmod 755 "${$}"
cp "${J}" "${$}/snapshot_metadata.json"
chmod 644 "${$}/snapshot_metadata.json"

if [ -n "${v.default_grub_backup}" ] && [ "${v.default_grub_backup}" != "null" ] && [ -f "${x}" ]; then cp "${x}" "${v.default_grub_backup}"; chmod 644 "${v.default_grub_backup}"; fi
if [ -n "${v.grub_cfg_backup}" ] && [ "${v.grub_cfg_backup}" != "null" ] && [ -f "${S}" ]; then cp "${S}" "${v.grub_cfg_backup}"; chmod 644 "${v.grub_cfg_backup}"; fi
if [ -n "${v.bls_entries_backup}" ] && [ "${v.bls_entries_backup}" != "null" ] && [ -f "${T}" ]; then cp "${T}" "${v.bls_entries_backup}"; chmod 644 "${v.bls_entries_backup}"; fi

echo "[Bash Runtime] Execution completed successfully!"
`;
              c.writeFileSync(w, Q), b("POST /api/deploy-pipeline", "Executing Batched Deploy Script Asynchronously...");
              try {
                const j = await new Promise((N, V) => {
                  let L = "";
                  const B = re(u ? "bash" : "pkexec", u ? ["bash", w] : ["/usr/bin/grub-editor-helper", "bash", w]);
                  B.stdout.on("data", (P) => {
                    L += P.toString();
                  }), B.stderr.on("data", (P) => {
                    L += P.toString();
                  }), B.on("close", (P) => {
                    P === 0 ? N(L) : V(new Error(`Exit code ${P}:
${L}`));
                  }), B.on("error", (P) => {
                    V(new Error(`Spawn error: ${P.message}
${L}`));
                  });
                  const q = setInterval(() => {
                    if (c.existsSync(E)) {
                      clearInterval(q), b("POST /api/deploy-pipeline", "Detected raw config. Applying overrides...");
                      try {
                        const P = c.readFileSync(E, "utf8"), ee = Z(P, m);
                        c.writeFileSync(F, ee);
                      } catch (P) {
                        R("POST /api/deploy-pipeline", "Failed to patch config:", P.message);
                      }
                    }
                  }, 500);
                });
                [l, d, J, w, E, F].forEach((N) => {
                  try {
                    c.existsSync(N) && c.unlinkSync(N);
                  } catch {
                  }
                }), delete k["/boot/grub/grub.cfg"], delete k["/boot/grub2/grub.cfg"], delete k["/etc/default/grub"], b("POST /api/deploy-pipeline", "Deployment pipeline complete"), a.end(JSON.stringify({ success: !0, output: j })), e();
                return;
              } catch (j) {
                throw [l, d, J, w, E, F].forEach((N) => {
                  try {
                    c.existsSync(N) && c.unlinkSync(N);
                  } catch {
                  }
                }), R("POST /api/deploy-pipeline", "Deploy pipeline failed:", j.message), new Error(`Failed during deployment:
${j.message}`);
              }
            }
            a.end(JSON.stringify({ success: !0 })), e();
          } catch (o) {
            a.statusCode = 500, a.end(JSON.stringify({ error: o.message })), e();
          }
        });
      }), !0;
    }
    return !1;
  } catch (h) {
    return console.error("GrubBackend error:", h), a.statusCode = 500, a.end(JSON.stringify({ error: h.message || "Internal Server Error" })), !0;
  }
}
const M = y.dirname(ie(import.meta.url));
W.commandLine.appendSwitch("no-sandbox");
W.commandLine.appendSwitch("disable-gpu-sandbox");
function K() {
  const r = c.existsSync(y.join(M, "preload.mjs")) ? y.join(M, "preload.mjs") : y.join(M, "preload.js"), a = new X({
    width: 1280,
    height: 860,
    minWidth: 1024,
    minHeight: 768,
    title: "GrubEditor - Pro Bootloader Studio",
    backgroundColor: "#050811",
    icon: y.join(M, "../public/app_logo.png"),
    webPreferences: {
      preload: r,
      nodeIntegration: !1,
      contextIsolation: !0
    }
  });
  if (a.setMenuBarVisibility(!1), te.setApplicationMenu(null), a.webContents.on("console-message", (h, g, p, e, o) => {
    console.log(`[Renderer Console] [level ${g}] ${p} (${o}:${e})`);
  }), a.webContents.on("did-fail-load", (h, g, p, e) => {
    console.error(`[Renderer Fail Load] (${g}) ${p} - ${e}`);
  }), a.webContents.on("render-process-gone", (h, g) => {
    console.error(`[Renderer Process Gone] ${g.reason} - exitCode: ${g.exitCode}`);
  }), process.env.VITE_DEV_SERVER_URL)
    a.loadURL(process.env.VITE_DEV_SERVER_URL);
  else {
    const h = y.join(M, "../dist"), g = ne.createServer(async (e, o) => {
      try {
        if (!await oe(e, o)) {
          const n = new URL(e.url || "/", `http://${e.headers.host || "localhost"}`);
          let t = y.join(h, n.pathname === "/" ? "index.html" : n.pathname);
          c.existsSync(t) || (t = y.join(h, "index.html"));
          const u = y.extname(t).toLowerCase(), l = {
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
          }[u] || "application/octet-stream";
          o.writeHead(200, { "Content-Type": l }), c.createReadStream(t).pipe(o);
        }
      } catch (s) {
        o.writeHead(500, { "Content-Type": "application/json" }), o.end(JSON.stringify({ error: s.message || "Internal Server Error" }));
      }
    }), p = (e) => {
      g.listen(e, "127.0.0.1", () => {
        const o = g.address().port;
        a.loadURL(`http://127.0.0.1:${o}`);
      });
    };
    g.on("error", (e) => {
      e.code === "EADDRINUSE" && (console.warn("Port 31415 occupied, retrying with ephemeral loopback port..."), g.close(), p(0));
    }), p(31415), a.on("closed", () => {
      try {
        g.close();
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
