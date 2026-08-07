import { app as D, BrowserWindow as X, Menu as te } from "electron";
import * as y from "node:path";
import * as a from "node:fs";
import * as ne from "node:http";
import { fileURLToPath as ie } from "node:url";
import * as W from "node:os";
import { execSync as N, spawn as re } from "node:child_process";
const Y = "[GrubEditor API]";
function b(o, ...c) {
  console.log(`${Y} [${o}]`, ...c);
}
function j(o, ...c) {
  console.error(`${Y} [${o}] ERROR:`, ...c);
}
const x = {};
function O(o, c = 15e3) {
  const h = Date.now();
  if (x[o] && h - x[o].time < c)
    return x[o].content;
  let l = "";
  try {
    l = a.readFileSync(o, "utf8");
  } catch {
    try {
      l = N(`sudo -n cat "${o}" 2>/dev/null`, { encoding: "utf8" });
    } catch {
      try {
        l = N(`pkexec /usr/bin/grub-editor-helper cat "${o}"`, { encoding: "utf8" });
      } catch (g) {
        throw console.error(`Failed to read ${o} via pkexec:`, g.message), new Error(`Cannot read ${o}: permission denied or authentication dismissed.`);
      }
    }
  }
  return x[o] = { time: h, content: l }, l;
}
function oe(o) {
  const c = [], h = W.release().trim(), l = o.split(`
`);
  let g, e = !1;
  for (let s = 0; s < l.length; s++) {
    const i = l[s].trim();
    if (i.startsWith("submenu ") || i.startsWith("submenu	")) {
      e = !0, i.match(/^submenu\s+((?:['"])(.*?)(?:['"])|(\S+))/) && (g = `submenu-${s}`);
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
      let u = `sys-entry-${c.length}`;
      const r = i.match(/(?:--id|\$menuentry_id_option)\s+(?:['"](.*?)['"]|(\S+))/);
      r && (u = r[1] || r[2] || u);
      let d = "", f = (i.match(/\{/g) || []).length - (i.match(/\}/g) || []).length, p = s + 1;
      for (; p < l.length && (f > 0 || f === 0 && !l[p].includes("{")); ) {
        const w = l[p];
        if (d += w + `
`, f += (w.match(/\{/g) || []).length - (w.match(/\}/g) || []).length, f <= 0 && w.includes("}")) break;
        p++;
      }
      s = p;
      let m = "custom", v, $, T = !1;
      const S = n.toLowerCase();
      S.includes("recovery") || S.includes("advanced") || S.includes("rescue") || d.toLowerCase().includes("recovery") || d.toLowerCase().includes("single") ? m = "recovery" : S.includes("windows") || d.toLowerCase().includes("chainloader") ? m = "windows" : S.includes("uefi") || S.includes("firmware") || d.toLowerCase().includes("fwsetup") ? m = "efi" : (S.includes("linux") || S.includes("ubuntu") || S.includes("debian") || S.includes("fedora") || d.includes("linux ") || d.includes("linuxefi ") || d.includes("linux16 ")) && (m = "linux");
      const E = d.match(/^\s*(?:linux|linuxefi|linux16)\s+(\S+)(.*)$/m);
      if (E) {
        const w = E[1];
        v = E[2].trim(), m !== "recovery" && m !== "windows" && m !== "efi" && (m = "linux");
        const _ = w.match(/vmlinuz-([a-zA-Z0-9.\-_]+)/i) || w.match(/kernel-([a-zA-Z0-9.\-_]+)/i);
        _ && ($ = _[1]);
      }
      if (!$) {
        const w = n.match(/\b(\d+\.\d+(?:\.\d+)?(?:-[a-zA-Z0-9]+)*)\b/);
        w && ($ = w[1]);
      }
      ($ && $.includes(h) || n.includes(h) || h.length > 3 && ($ === h || n.includes(h))) && (T = !0), c.push({
        id: u,
        title: n,
        type: m,
        enabled: !0,
        order: c.length,
        args: v || void 0,
        version: $ || void 0,
        isCurrent: T,
        is_current: T,
        is_default: c.length === 0,
        parent_id: g
      });
    }
  }
  return c;
}
function G() {
  if (a.existsSync("/boot/grub2")) return "/boot/grub2/grub-editor-entries.json";
  if (a.existsSync("/boot/grub")) return "/boot/grub/grub-editor-entries.json";
  const o = y.join(W.homedir(), ".grubdeck");
  if (!a.existsSync(o)) try {
    a.mkdirSync(o, { recursive: !0 });
  } catch {
  }
  return y.join(o, "grub-editor-entries.json");
}
function C(o, c) {
  try {
    a.writeFileSync(o, c, "utf8");
  } catch {
    const h = y.join(W.tmpdir(), `grub-write-${Date.now()}-${Math.random().toString(36).substring(2, 8)}`);
    a.writeFileSync(h, c, "utf8");
    try {
      N(`sudo -n cp "${h}" "${o}" 2>/dev/null && rm -f "${h}"`, { stdio: "ignore" });
    } catch {
      try {
        N(`pkexec /usr/bin/grub-editor-helper sh -c "cp '${h}' '${o}' && chmod 0644 '${o}'"`, { stdio: "ignore" });
      } catch (l) {
        throw console.error(`Failed to write ${o} via pkexec:`, l.message), new Error(`Cannot write to ${o}: permission denied or authentication dismissed.`);
      } finally {
        if (a.existsSync(h)) try {
          a.unlinkSync(h);
        } catch {
        }
      }
    }
  }
  delete x[o];
}
function J() {
  try {
    const o = G(), c = O(o, 1e3);
    return JSON.parse(c);
  } catch {
    return [];
  }
}
function z(o, c) {
  if (b("MERGE", `Starting merge: ${o.length} system entries, ${c.length} overrides`), !c || !Array.isArray(c) || c.length === 0)
    return b("MERGE", "No overrides found, returning raw system entries"), o;
  const h = /* @__PURE__ */ new Set();
  o.forEach((e) => {
    e.originalTitle || (e.originalTitle = e.title);
  }), b("MERGE", "System entries:", o.map((e, s) => `[${s}] id="${e.id}" title="${e.title}"`).join(" | ")), b("MERGE", "Overrides:", c.map((e, s) => `[${s}] id="${e.id}" title="${e.title}" origTitle="${e.originalTitle}" deleted=${e.deleted}`).join(" | "));
  const l = [];
  c.forEach((e, s) => {
    let i = o.findIndex((t, u) => !h.has(u) && e.id && t.id === e.id && !t.id.startsWith("sys-entry-")), n = "id";
    if (i === -1 && (i = o.findIndex((t, u) => {
      if (h.has(u)) return !1;
      const r = t.originalTitle || t.title, d = e.originalTitle || e.title;
      return d === t.title || d === r || e.title === t.title;
    }), n = "title"), i === -1 && e.id && e.id.startsWith("sys-entry-")) {
      const t = parseInt(e.id.replace("sys-entry-", ""), 10);
      !isNaN(t) && t < o.length && !h.has(t) && (i = t, n = "positional");
    }
    if (i !== -1 ? (h.add(i), b("MERGE", `Override[${s}] "${e.title}" matched system[${i}] "${o[i].title}" via ${n}`)) : b("MERGE", `Override[${s}] "${e.title}" (origTitle="${e.originalTitle}", id="${e.id}") had NO match in system entries`), e.deleted) {
      if (l.some(
        (u) => e.id && u.id === e.id && !u.id.startsWith("sys-") && !e.id.startsWith("sys-") || (e.originalTitle || e.title) === (u.originalTitle || u.title)
      )) {
        b("MERGE", `Override[${s}] "${e.title}" is a DUPLICATE deleted override — skipping`);
        return;
      }
      b("MERGE", `Override[${s}] "${e.title}" is DELETED (${i !== -1 ? "matched & suppressed system entry" : "preserved deleted override from previous deploy"})`), l.push({ ...e, deleted: !0, enabled: !1 });
    } else if (i !== -1) {
      const t = o[i];
      l.push({
        ...t,
        title: e.title !== void 0 ? e.title : t.title,
        originalTitle: e.originalTitle || t.originalTitle || t.title,
        enabled: e.enabled !== void 0 ? e.enabled : t.enabled,
        deleted: !1,
        order: l.length
      });
    } else
      l.push({ ...e, deleted: !1, order: l.length });
  });
  let g = 0;
  return o.forEach((e, s) => {
    h.has(s) || (g++, b("MERGE", `System entry[${s}] "${e.title}" was UNMATCHED — adding to result`), l.push({
      ...e,
      originalTitle: e.originalTitle || e.title,
      order: l.length
    }));
  }), b("MERGE", `Merge complete: ${l.length} total entries (${g} unmatched system entries added)`), l;
}
function Z(o, c) {
  if (!c || !Array.isArray(c) || c.length === 0) return o;
  const h = o.split(`
`), l = [], g = [];
  let e = -1, s = 0, i = 0;
  for (; s < h.length; ) {
    const r = h[s], d = r.trim();
    if (d.startsWith("submenu ") || d.startsWith("submenu	")) {
      e === -1 && (e = l.length), s++;
      continue;
    }
    if (d === "}" && e !== -1 && l.length >= e) {
      s++;
      continue;
    }
    if (d.startsWith("menuentry ") || d.startsWith("menuentry	")) {
      e === -1 && (e = l.length);
      let f = "Unknown Entry";
      const p = d.match(/^menuentry\s+(?:['"](.*?)['"]|(\S+))/);
      p && (f = p[1] || p[2] || f);
      let m = `sys-entry-${i}`;
      const v = d.match(/(?:--id|\$menuentry_id_option)\s+(?:['"](.*?)['"]|(\S+))/);
      v && (m = v[1] || v[2] || m);
      const $ = [r];
      let T = (r.match(/\{/g) || []).length - (r.match(/\}/g) || []).length, S = s + 1;
      for (; S < h.length && (T > 0 || T === 0 && !h[S].includes("{")); ) {
        const E = h[S];
        if ($.push(E), T += (E.match(/\{/g) || []).length - (E.match(/\}/g) || []).length, T <= 0 && E.includes("}")) {
          S++;
          break;
        }
        S++;
      }
      g.push({ id: m, title: f, lines: $, origIdx: i }), i++, s = S;
      continue;
    }
    l.push(r), s++;
  }
  if (e === -1 || g.length === 0) return o;
  const n = [], t = /* @__PURE__ */ new Set();
  c.forEach((r, d) => {
    let f = g.findIndex((p, m) => !t.has(m) && r.id && p.id === r.id && !p.id.startsWith("sys-entry-"));
    if (f === -1 && (f = g.findIndex((p, m) => !t.has(m) && (r.originalTitle === p.title || r.title === p.title))), f === -1 && r.id && r.id.startsWith("sys-entry-")) {
      const p = parseInt(r.id.replace("sys-entry-", ""), 10);
      !isNaN(p) && !t.has(p) && (f = p);
    }
    if (f !== -1 && t.add(f), !(r.deleted || r.enabled === !1) && f !== -1) {
      const p = g[f];
      let m = p.lines[0];
      r.title && r.title !== p.title && (m = m.replace(p.title, r.title), p.lines[0] = m), n.push({ idx: d, text: p.lines.join(`
`) });
    }
  }), g.forEach((r, d) => {
    t.has(d) || n.push({ idx: n.length + 1e3, text: r.lines.join(`
`) });
  }), n.sort((r, d) => r.idx - d.idx);
  const u = n.map((r) => r.text).join(`

`);
  return l.splice(e, 0, u), l.join(`
`);
}
function U() {
  if (process.getuid && process.getuid() === 0) {
    const c = "/var/lib/grub-editor/backups";
    return a.existsSync(c) || a.mkdirSync(c, { recursive: !0 }), c;
  }
  if (a.existsSync("/var/lib/grub-editor/backups"))
    return "/var/lib/grub-editor/backups";
  const o = y.join(W.homedir(), ".local", "share", "grub-editor", "backups");
  if (!a.existsSync(o))
    try {
      a.mkdirSync(o, { recursive: !0 });
    } catch {
    }
  return o;
}
function H(o) {
  const c = U(), h = Date.now(), l = `snap_${h}`, g = y.join(c, l);
  try {
    a.existsSync(g) || a.mkdirSync(g, { recursive: !0 });
  } catch {
    try {
      N(`pkexec /usr/bin/grub-editor-helper mkdir -p "${g}" && pkexec /usr/bin/grub-editor-helper chmod 755 "${g}"`);
    } catch (p) {
      return j("SNAPSHOT", "Could not create snapshot dir:", p.message), null;
    }
  }
  const e = a.existsSync("/etc/default/grub") ? "/etc/default/grub" : "/boot/grub/default", s = y.join(g, "default_grub.bak");
  try {
    const p = O(e);
    C(s, p);
  } catch (p) {
    j("SNAPSHOT", "Failed to backup default grub:", p);
  }
  const i = a.existsSync("/boot/grub2/grub.cfg") ? "/boot/grub2/grub.cfg" : "/boot/grub/grub.cfg";
  let n = null;
  if (a.existsSync(i)) {
    const p = y.join(g, "grub.cfg.bak");
    try {
      const m = O(i);
      C(p, m), n = p;
    } catch (m) {
      j("SNAPSHOT", "Failed to backup grub.cfg:", m);
    }
  }
  let t = null;
  const u = G();
  if (a.existsSync(u)) {
    const p = y.join(g, "grub-editor-entries.json.bak");
    try {
      const m = O(u);
      C(p, m), t = p;
    } catch {
    }
  }
  const r = `${h} (UTC Timestamp)`, d = {
    timestamp: h,
    date_string: r,
    description: o || "Auto-backup",
    default_grub_backup: s,
    grub_cfg_backup: n,
    bls_entries_backup: t,
    warnings: []
  }, f = y.join(g, "snapshot_metadata.json");
  return C(f, JSON.stringify(d, null, 2)), b("SNAPSHOT", `Created recovery snapshot in ${g}: "${o}"`), d;
}
async function se(o, c) {
  if (!o.url || !o.url.startsWith("/api/"))
    return !1;
  c.setHeader("Content-Type", "application/json");
  try {
    const l = new URL(o.url, `http://${o.headers.host || "localhost"}`).pathname;
    if (o.method === "GET" && l === "/api/boot-entries") {
      if (b("GET /api/boot-entries", "Fetching boot entries..."), a.existsSync("/boot/loader/entries"))
        try {
          const t = a.readdirSync("/boot/loader/entries").filter((u) => u.endsWith(".conf") || u.endsWith(".mgnix"));
          if (t.length > 0) {
            b("GET /api/boot-entries", `Found ${t.length} BLS entry files`);
            const u = [], r = W.release().trim();
            t.sort().forEach((p, m) => {
              const v = a.readFileSync(y.join("/boot/loader/entries", p), "utf8");
              let $ = p, T = "", S = "";
              v.split(`
`).forEach((w) => {
                const _ = w.trim();
                _.startsWith("title ") ? $ = _.substring(6).trim() : _.startsWith("version ") ? T = _.substring(8).trim() : _.startsWith("options ") && (S = _.substring(8).trim());
              });
              const E = T.includes(r) || $.includes(r);
              u.push({
                id: p.replace(/\.[^/.]+$/, ""),
                title: $,
                type: $.toLowerCase().includes("recovery") || $.toLowerCase().includes("rescue") ? "recovery" : "linux",
                enabled: !0,
                order: m,
                args: S || void 0,
                version: T || void 0,
                isCurrent: E,
                is_current: E,
                is_default: m === 0
              });
            });
            const d = J();
            b("GET /api/boot-entries", `Loaded ${d.length} saved overrides from ${G()}`);
            const f = z(u, d);
            return b("GET /api/boot-entries", `Returning ${f.length} entries (active: ${f.filter((p) => !p.deleted).length}, deleted: ${f.filter((p) => p.deleted).length})`), c.end(JSON.stringify(f)), !0;
          }
        } catch (t) {
          j("GET /api/boot-entries", "BLS directory read error, falling back to grub.cfg:", t);
        }
      const g = a.existsSync("/boot/grub2/grub.cfg") ? "/boot/grub2/grub.cfg" : "/boot/grub/grub.cfg";
      b("GET /api/boot-entries", `Reading grub.cfg from ${g}`);
      const e = O(g), s = oe(e);
      b("GET /api/boot-entries", `Parsed ${s.length} menuentry blocks from grub.cfg`);
      const i = J();
      b("GET /api/boot-entries", `Loaded ${i.length} saved overrides from ${G()}`);
      const n = z(s, i);
      return b("GET /api/boot-entries", `Returning ${n.length} entries (active: ${n.filter((t) => !t.deleted).length}, deleted: ${n.filter((t) => t.deleted).length})`), c.end(JSON.stringify(n)), !0;
    }
    if (o.method === "GET" && l === "/api/grub-config") {
      const g = a.existsSync("/etc/default/grub") ? "/etc/default/grub" : "/boot/grub/default", e = O(g), s = {};
      return e.split(`
`).forEach((i) => {
        const n = i.trim();
        if (n && !n.startsWith("#") && n.includes("=")) {
          const t = n.indexOf("="), u = n.substring(0, t).trim();
          let r = n.substring(t + 1).trim();
          (r.startsWith('"') && r.endsWith('"') || r.startsWith("'") && r.endsWith("'")) && (r = r.substring(1, r.length - 1)), s[u] = r;
        }
      }), c.end(JSON.stringify(s)), !0;
    }
    if (o.method === "GET" && l === "/api/distro") {
      let g = "Ubuntu 24.04.4 LTS", e = "DebianUbuntu", s = ["update-grub"];
      try {
        a.readFileSync("/etc/os-release", "utf8").split(`
`).forEach((n) => {
          if (n.startsWith("PRETTY_NAME="))
            g = n.split("=")[1].replace(/["']/g, "").trim();
          else if (n.startsWith("ID=")) {
            const t = n.split("=")[1].replace(/["']/g, "").trim().toLowerCase();
            t === "fedora" || t === "rhel" || t === "centos" || t === "rocky" ? (e = "RHEL", s = ["grub2-mkconfig", "-o", "/boot/grub2/grub.cfg"]) : (t === "arch" || t === "manjaro") && (e = "Arch", s = ["grub-mkconfig", "-o", "/boot/grub/grub.cfg"]);
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
        regen_command: s,
        uses_bls: a.existsSync("/boot/loader/entries")
      })), !0;
    }
    if (o.method === "GET" && l === "/api/scan-themes") {
      const g = a.existsSync("/boot/grub2/themes") ? "/boot/grub2/themes" : "/boot/grub/themes", e = [];
      try {
        let s = [];
        try {
          s = a.readdirSync(g);
        } catch {
          s = N(`pkexec /usr/bin/grub-editor-helper find "${g}" -maxdepth 1 -mindepth 1 -type d`, { encoding: "utf8" }).split(`
`).filter(Boolean).map((n) => y.basename(n.trim()));
        }
        for (const i of s) {
          const n = y.join(g, i), t = y.join(n, "theme.txt");
          let u = !1;
          try {
            a.existsSync(t) && (u = !0);
          } catch {
            try {
              N(`test -f "${t}"`, { stdio: "ignore" }), u = !0;
            } catch {
            }
          }
          u && e.push({
            name: i,
            path: n,
            is_valid: !0,
            validation_errors: [],
            has_pf2_fonts: !0,
            background_image: "background.png",
            title_text: `${i} Theme`
          });
        }
      } catch (s) {
        console.warn("Could not scan system themes, fallback empty or default:", s);
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
    if (o.method === "GET" && l === "/api/snapshots") {
      b("GET /api/snapshots", "Fetching recovery snapshots...");
      const g = U(), e = [];
      if (a.existsSync(g))
        try {
          const s = a.readdirSync(g);
          for (const i of s) {
            const n = y.join(g, i, "snapshot_metadata.json");
            if (a.existsSync(n))
              try {
                const t = O(n), u = JSON.parse(t);
                e.push(u);
              } catch {
              }
          }
          e.sort((i, n) => (n.timestamp || 0) - (i.timestamp || 0));
        } catch (s) {
          j("GET /api/snapshots", "Failed reading snapshot directories:", s);
        }
      return b("GET /api/snapshots", `Returning ${e.length} snapshots`), c.end(JSON.stringify(e)), !0;
    }
    if (o.method === "POST") {
      let g = "";
      return o.on("data", (e) => {
        g += e;
      }), await new Promise((e) => {
        o.on("end", async () => {
          try {
            const s = g ? JSON.parse(g) : {};
            if (l === "/api/save-grub-config") {
              const { newConfig: i, reason: n, createSnapshot: t } = s;
              if (b("POST /api/save-grub-config", `Saving config (createSnapshot=${t}, reason="${n}")`), t && H(n || "Modified GRUB general configuration"), i) {
                const u = ["# Updated via GrubEditor GUI"];
                for (const [d, f] of Object.entries(i))
                  u.push(`${d}="${f}"`);
                const r = y.join(W.tmpdir(), `grub-config-${Date.now()}`);
                a.writeFileSync(r, u.join(`
`) + `
`, "utf8");
                try {
                  a.copyFileSync(r, "/etc/default/grub"), a.existsSync(r) && a.unlinkSync(r);
                } catch {
                  try {
                    N(`pkexec /usr/bin/grub-editor-helper cp "${r}" /etc/default/grub && rm -f "${r}"`);
                  } catch (d) {
                    throw console.warn("Failed to copy config via pkexec:", d.message), new Error("Failed to copy config via pkexec: " + d.message);
                  }
                }
                delete x["/etc/default/grub"], delete x["/boot/grub/default"];
              }
              c.end(JSON.stringify({ success: !0 })), e();
              return;
            }
            if (l === "/api/save-boot-entries") {
              const { newEntries: i, reason: n, createSnapshot: t } = s;
              if (b("POST /api/save-boot-entries", `Received ${i?.length ?? 0} entries to save (createSnapshot=${t}, reason="${n}")`), t && H(n || "Modified boot menu entries & ordering"), i && Array.isArray(i)) {
                const u = i.map((f) => ({ ...f, originalTitle: f.originalTitle || f.title })), r = u.filter((f) => f.deleted).length, d = u.filter((f) => !f.deleted).length;
                b("POST /api/save-boot-entries", `Saving ${u.length} entries (${d} active, ${r} deleted) to ${G()}`), u.forEach((f, p) => {
                  b("POST /api/save-boot-entries", `  [${p}] id="${f.id}" title="${f.title}" origTitle="${f.originalTitle}" deleted=${f.deleted} enabled=${f.enabled}`);
                }), C(G(), JSON.stringify(u, null, 2)), b("POST /api/save-boot-entries", "Write successful");
              }
              delete x["/boot/grub/grub.cfg"], delete x["/boot/grub2/grub.cfg"], c.end(JSON.stringify({ success: !0 })), e();
              return;
            }
            if (l === "/api/restore-snapshot") {
              const { timestamp: i } = s;
              b("POST /api/restore-snapshot", `Restoring snapshot timestamp ${i}...`);
              const n = U(), t = y.join(n, `snap_${i}`), u = y.join(t, "snapshot_metadata.json");
              if (!a.existsSync(u))
                throw new Error("Snapshot metadata not found for timestamp " + i);
              const r = JSON.parse(O(u));
              if (H(`Auto-backup before restoring snapshot from ${new Date(i).toLocaleString()}`), r.default_grub_backup && a.existsSync(r.default_grub_backup)) {
                const d = a.existsSync("/etc/default/grub") ? "/etc/default/grub" : "/boot/grub/default";
                C(d, O(r.default_grub_backup)), delete x["/etc/default/grub"], delete x["/boot/grub/default"];
              }
              if (r.grub_cfg_backup && a.existsSync(r.grub_cfg_backup)) {
                const d = a.existsSync("/boot/grub2/grub.cfg") ? "/boot/grub2/grub.cfg" : "/boot/grub/grub.cfg";
                C(d, O(r.grub_cfg_backup)), delete x["/boot/grub/grub.cfg"], delete x["/boot/grub2/grub.cfg"];
              }
              r.bls_entries_backup && a.existsSync(r.bls_entries_backup) && C(G(), O(r.bls_entries_backup)), b("POST /api/restore-snapshot", "Restore completed successfully"), c.end(JSON.stringify({ success: !0 })), e();
              return;
            }
            if (l === "/api/trigger-regen") {
              b("POST /api/trigger-regen", "Starting GRUB regeneration...");
              let i = "";
              try {
                const n = process.getuid ? process.getuid() === 0 : !1, t = n ? "update-grub 2>&1" : "pkexec /usr/bin/grub-editor-helper update-grub 2>&1";
                b("POST /api/trigger-regen", `Running: ${t} (isRoot=${n})`), i = N(t, { encoding: "utf8" }), b("POST /api/trigger-regen", "update-grub completed successfully"), delete x["/boot/grub/grub.cfg"], delete x["/boot/grub2/grub.cfg"];
                try {
                  const u = a.existsSync("/boot/grub2/grub.cfg") ? "/boot/grub2/grub.cfg" : "/boot/grub/grub.cfg";
                  if (a.existsSync(u)) {
                    const r = O(u), d = J();
                    if (b("POST /api/trigger-regen", `Post-regen: ${d.length} overrides to apply to ${u}`), d.length > 0) {
                      const f = d.filter((m) => m.deleted);
                      b("POST /api/trigger-regen", `Overrides breakdown: ${d.length - f.length} active, ${f.length} deleted`);
                      const p = Z(r, d);
                      C(u, p), b("POST /api/trigger-regen", "Successfully wrote modified grub.cfg"), i += `
[GrubEditor] Applied custom menu ordering, titles, and exclusions to grub.cfg successfully.`;
                    }
                  }
                } catch (u) {
                  j("POST /api/trigger-regen", "Failed to apply post-regeneration overrides:", u), i += `
[GrubEditor] Warning: Could not apply overrides to grub.cfg: ${u.message}`;
                }
              } catch (n) {
                throw j("POST /api/trigger-regen", "update-grub failed:", n.message), new Error(`Failed to regenerate GRUB configuration: ${n.stdout || n.stderr || n.message}`);
              }
              b("POST /api/trigger-regen", "Regeneration pipeline complete"), c.end(JSON.stringify({ success: !0, output: i })), e();
              return;
            }
            if (l === "/api/deploy-pipeline") {
              const { config: i, bootEntries: n, snapTitle: t } = s;
              b("POST /api/deploy-pipeline", `Starting batched deploy pipeline. snapTitle: ${t}`);
              const u = process.getuid ? process.getuid() === 0 : !1, r = u ? "" : "pkexec /usr/bin/grub-editor-helper ", d = `/tmp/grub-editor-deploy-config-${Date.now()}`, f = `/tmp/grub-editor-deploy-entries-${Date.now()}`;
              let p = "";
              for (const [P, R] of Object.entries(i))
                p += `${P}="${R}"
`;
              a.writeFileSync(d, p);
              const m = (n || []).map((P) => ({ ...P, originalTitle: P.originalTitle || P.title }));
              a.writeFileSync(f, JSON.stringify(m, null, 2));
              const v = Date.now(), $ = y.join(U(), `snap_${v}`), T = a.existsSync("/etc/default/grub") ? "/etc/default/grub" : "/boot/grub/default", S = a.existsSync("/boot/grub2/grub.cfg") ? "/boot/grub2/grub.cfg" : "/boot/grub/grub.cfg", E = G(), w = `/tmp/grub-editor-deploy-script-${Date.now()}.sh`, _ = `/tmp/grub-editor-raw-cfg-${Date.now()}`, A = {
                timestamp: v,
                description: t,
                default_grub_backup: y.join($, "default_grub.bak"),
                grub_cfg_backup: a.existsSync(S) ? y.join($, "grub.cfg.bak") : null,
                bls_entries_backup: y.join($, "grub-editor-entries.json.bak")
              }, B = `/tmp/grub-editor-deploy-meta-${Date.now()}`;
              a.writeFileSync(B, JSON.stringify(A, null, 2));
              const F = `/tmp/grub-editor-patched-cfg-${Date.now()}`, Q = `#!/bin/bash
set -e
set -x
echo "[Bash Runtime] Stage 1: Initializing snapshot in ${$}..."
mkdir -p "${$}"
chmod 755 "${$}"
if [ -f "${T}" ]; then cp "${T}" "${A.default_grub_backup}"; fi
if [ -f "${S}" ]; then cp "${S}" "${A.grub_cfg_backup}"; fi
if [ -f "${E}" ]; then cp "${E}" "${A.bls_entries_backup}"; fi
cp "${B}" "${$}/snapshot_metadata.json"
chmod 644 "${$}/snapshot_metadata.json"

echo "[Bash Runtime] Stage 2: Applying new GRUB configurations..."
cp "${d}" "${T}"
chmod 644 "${T}"
cp "${f}" "${E}"
chmod 644 "${E}"

echo "[Bash Runtime] Stage 3: Regenerating bootloader via update-grub..."
update-grub 2>&1

echo "[Bash Runtime] Stage 4: Exposing raw configuration for Node.js patching..."
cat "${S}" > "${_}"
chmod 666 "${_}"

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

echo "[Bash Runtime] Stage 6: Finalizing deployment..."
cp "${F}" "${S}"
chmod 644 "${S}"
echo "[Bash Runtime] Execution completed successfully!"
`;
              a.writeFileSync(w, Q), b("POST /api/deploy-pipeline", "Executing Batched Deploy Script Asynchronously...");
              try {
                const P = await new Promise((R, V) => {
                  let L = "";
                  const I = re(u ? "bash" : "pkexec", u ? ["bash", w] : ["/usr/bin/grub-editor-helper", "bash", w]);
                  I.stdout.on("data", (k) => {
                    L += k.toString();
                  }), I.stderr.on("data", (k) => {
                    L += k.toString();
                  }), I.on("close", (k) => {
                    k === 0 ? R(L) : V(new Error(`Exit code ${k}:
${L}`));
                  }), I.on("error", (k) => {
                    V(new Error(`Spawn error: ${k.message}
${L}`));
                  });
                  const q = setInterval(() => {
                    if (a.existsSync(_)) {
                      clearInterval(q), b("POST /api/deploy-pipeline", "Detected raw config. Applying overrides...");
                      try {
                        const k = a.readFileSync(_, "utf8"), ee = Z(k, m);
                        a.writeFileSync(F, ee);
                      } catch (k) {
                        j("POST /api/deploy-pipeline", "Failed to patch config:", k.message);
                      }
                    }
                  }, 500);
                });
                [d, f, B, w, _, F].forEach((R) => {
                  try {
                    a.existsSync(R) && a.unlinkSync(R);
                  } catch {
                  }
                }), delete x["/boot/grub/grub.cfg"], delete x["/boot/grub2/grub.cfg"], delete x["/etc/default/grub"], b("POST /api/deploy-pipeline", "Deployment pipeline complete"), c.end(JSON.stringify({ success: !0, output: P })), e();
                return;
              } catch (P) {
                throw [d, f, B, w, _, F].forEach((R) => {
                  try {
                    a.existsSync(R) && a.unlinkSync(R);
                  } catch {
                  }
                }), j("POST /api/deploy-pipeline", "Deploy pipeline failed:", P.message), new Error(`Failed during deployment:
${P.message}`);
              }
              c.end(JSON.stringify({ success: !0, output })), e();
              return;
            }
            c.end(JSON.stringify({ success: !0 })), e();
          } catch (s) {
            c.statusCode = 500, c.end(JSON.stringify({ error: s.message })), e();
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
D.commandLine.appendSwitch("no-sandbox");
D.commandLine.appendSwitch("disable-gpu-sandbox");
function K() {
  const o = a.existsSync(y.join(M, "preload.mjs")) ? y.join(M, "preload.mjs") : y.join(M, "preload.js"), c = new X({
    width: 1280,
    height: 860,
    minWidth: 1024,
    minHeight: 768,
    title: "GrubEditor - Pro Bootloader Studio",
    backgroundColor: "#050811",
    icon: y.join(M, "../public/app_logo.png"),
    webPreferences: {
      preload: o,
      nodeIntegration: !1,
      contextIsolation: !0
    }
  });
  if (c.setMenuBarVisibility(!1), te.setApplicationMenu(null), c.webContents.on("console-message", (h, l, g, e, s) => {
    console.log(`[Renderer Console] [level ${l}] ${g} (${s}:${e})`);
  }), c.webContents.on("did-fail-load", (h, l, g, e) => {
    console.error(`[Renderer Fail Load] (${l}) ${g} - ${e}`);
  }), c.webContents.on("render-process-gone", (h, l) => {
    console.error(`[Renderer Process Gone] ${l.reason} - exitCode: ${l.exitCode}`);
  }), process.env.VITE_DEV_SERVER_URL)
    c.loadURL(process.env.VITE_DEV_SERVER_URL);
  else {
    const h = y.join(M, "../dist"), l = ne.createServer(async (e, s) => {
      try {
        if (!await se(e, s)) {
          const n = new URL(e.url || "/", `http://${e.headers.host || "localhost"}`);
          let t = y.join(h, n.pathname === "/" ? "index.html" : n.pathname);
          a.existsSync(t) || (t = y.join(h, "index.html"));
          const u = y.extname(t).toLowerCase(), d = {
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
          s.writeHead(200, { "Content-Type": d }), a.createReadStream(t).pipe(s);
        }
      } catch (i) {
        s.writeHead(500, { "Content-Type": "application/json" }), s.end(JSON.stringify({ error: i.message || "Internal Server Error" }));
      }
    }), g = (e) => {
      l.listen(e, "127.0.0.1", () => {
        const s = l.address().port;
        c.loadURL(`http://127.0.0.1:${s}`);
      });
    };
    l.on("error", (e) => {
      e.code === "EADDRINUSE" && (console.warn("Port 31415 occupied, retrying with ephemeral loopback port..."), l.close(), g(0));
    }), g(31415), c.on("closed", () => {
      try {
        l.close();
      } catch {
      }
    });
  }
}
D.whenReady().then(() => {
  K(), D.on("activate", () => {
    X.getAllWindows().length === 0 && K();
  });
});
D.on("window-all-closed", () => {
  process.platform !== "darwin" && D.quit();
});
