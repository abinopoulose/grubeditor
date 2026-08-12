import { app as W, BrowserWindow as X, Menu as te } from "electron";
import * as y from "node:path";
import * as d from "node:fs";
import * as ne from "node:http";
import { fileURLToPath as ie } from "node:url";
import * as J from "node:os";
import { execSync as D, spawn as re } from "node:child_process";
const Y = "[GrubEditor API]";
function b(o, ...a) {
  console.log(`${Y} [${o}]`, ...a);
}
function j(o, ...a) {
  console.error(`${Y} [${o}] ERROR:`, ...a);
}
const x = {};
function O(o, a = 5e3) {
  const h = Date.now();
  if (x[o] && h - x[o].timestamp < a)
    return x[o].data;
  let g = "";
  try {
    g = d.readFileSync(o, "utf8");
  } catch {
    try {
      g = D(`pkexec /usr/bin/grub-editor-helper cat "${o}"`, { encoding: "utf8" });
    } catch {
      throw new Error(`File not found or unreadable: ${o}`);
    }
  }
  return x[o] = { data: g, timestamp: h }, g;
}
function se(o) {
  const a = [], h = J.release().trim(), g = o.split(`
`);
  let f, e = !1;
  for (let s = 0; s < g.length; s++) {
    const r = g[s].trim();
    if (r.startsWith("submenu ") || r.startsWith("submenu	")) {
      e = !0, r.match(/^submenu\s+((?:['"])(.*?)(?:['"])|(\S+))/) && (f = `submenu-${s}`);
      continue;
    }
    if (e && r === "}") {
      e = !1, f = void 0;
      continue;
    }
    if (r.startsWith("menuentry ") || r.startsWith("menuentry	")) {
      let n = "Unknown Entry";
      const t = r.match(/^menuentry\s+(?:['"](.*?)['"]|(\S+))/);
      t && (n = t[1] || t[2] || "Unknown Entry");
      let u = `sys-entry-${a.length}`;
      const i = r.match(/(?:--id|\$menuentry_id_option)\s+(?:['"](.*?)['"]|(\S+))/);
      i && (u = i[1] || i[2] || u);
      let c = "", l = (r.match(/\{/g) || []).length - (r.match(/\}/g) || []).length, p = s + 1;
      for (; p < g.length && (l > 0 || l === 0 && !g[p].includes("{")); ) {
        const w = g[p];
        if (c += w + `
`, l += (w.match(/\{/g) || []).length - (w.match(/\}/g) || []).length, l <= 0 && w.includes("}")) break;
        p++;
      }
      s = p;
      let m = "custom", _, $, k = !1;
      const S = n.toLowerCase();
      S.includes("recovery") || S.includes("advanced") || S.includes("rescue") || c.toLowerCase().includes("recovery") || c.toLowerCase().includes("single") ? m = "recovery" : S.includes("windows") || c.toLowerCase().includes("chainloader") ? m = "windows" : S.includes("uefi") || S.includes("firmware") || c.toLowerCase().includes("fwsetup") ? m = "efi" : (S.includes("linux") || S.includes("ubuntu") || S.includes("debian") || S.includes("fedora") || c.includes("linux ") || c.includes("linuxefi ") || c.includes("linux16 ")) && (m = "linux");
      const T = c.match(/^\s*(?:linux|linuxefi|linux16)\s+(\S+)(.*)$/m);
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
      ($ && $.includes(h) || n.includes(h) || h.length > 3 && ($ === h || n.includes(h))) && (k = !0), a.push({
        id: u,
        title: n,
        type: m,
        enabled: !0,
        order: a.length,
        args: _ || void 0,
        version: $ || void 0,
        isCurrent: k,
        is_current: k,
        is_default: a.length === 0,
        parent_id: f,
        raw_boot_commands: c.trim()
      });
    }
  }
  return a;
}
function G() {
  if (d.existsSync("/boot/grub2")) return "/boot/grub2/grub-editor-entries.json";
  if (d.existsSync("/boot/grub")) return "/boot/grub/grub-editor-entries.json";
  const o = y.join(J.homedir(), ".grubdeck");
  if (!d.existsSync(o)) try {
    d.mkdirSync(o, { recursive: !0 });
  } catch {
  }
  return y.join(o, "grub-editor-entries.json");
}
function C(o, a) {
  try {
    d.writeFileSync(o, a, "utf8");
  } catch {
    const h = y.join(J.tmpdir(), `grub-write-${Date.now()}-${Math.random().toString(36).substring(2, 8)}`);
    d.writeFileSync(h, a, "utf8");
    try {
      D(`pkexec /usr/bin/grub-editor-helper sh -c "cp '${h}' '${o}' && chmod 0644 '${o}'"`, { stdio: "ignore" });
    } catch (g) {
      throw console.error(`Failed to write ${o} via pkexec:`, g.message), new Error(`Cannot write to ${o}: permission denied or authentication dismissed.`);
    } finally {
      if (d.existsSync(h)) try {
        d.unlinkSync(h);
      } catch {
      }
    }
  }
  delete x[o];
}
function I() {
  try {
    const o = G(), a = O(o, 0);
    return JSON.parse(a);
  } catch {
    return [];
  }
}
function z(o, a) {
  if (b("MERGE", `Starting merge: ${o.length} system entries, ${a.length} overrides`), !a || !Array.isArray(a) || a.length === 0)
    return b("MERGE", "No overrides found, returning raw system entries"), o;
  const h = /* @__PURE__ */ new Set();
  o.forEach((e) => {
    e.originalTitle || (e.originalTitle = e.title);
  }), b("MERGE", "System entries:", o.map((e, s) => `[${s}] id="${e.id}" title="${e.title}"`).join(" | ")), b("MERGE", "Overrides:", a.map((e, s) => `[${s}] id="${e.id}" title="${e.title}" origTitle="${e.originalTitle}" deleted=${e.deleted}`).join(" | "));
  const g = [];
  a.forEach((e, s) => {
    let r = o.findIndex((t, u) => !h.has(u) && e.id && t.id === e.id && !t.id.startsWith("sys-entry-")), n = "id";
    if (r === -1 && (r = o.findIndex((t, u) => {
      if (h.has(u)) return !1;
      const i = t.originalTitle || t.title, c = e.originalTitle || e.title;
      return c === t.title || c === i || e.title === t.title;
    }), n = "title"), r === -1 && e.id && e.id.startsWith("sys-entry-")) {
      const t = parseInt(e.id.replace("sys-entry-", ""), 10);
      !isNaN(t) && t < o.length && !h.has(t) && (r = t, n = "positional");
    }
    if (r !== -1 ? (h.add(r), b("MERGE", `Override[${s}] "${e.title}" matched system[${r}] "${o[r].title}" via ${n}`)) : b("MERGE", `Override[${s}] "${e.title}" (origTitle="${e.originalTitle}", id="${e.id}") had NO match in system entries`), e.deleted) {
      if (g.some(
        (u) => e.id && u.id === e.id && !u.id.startsWith("sys-") && !e.id.startsWith("sys-") || (e.originalTitle || e.title) === (u.originalTitle || u.title)
      )) {
        b("MERGE", `Override[${s}] "${e.title}" is a DUPLICATE deleted override — skipping`);
        return;
      }
      b("MERGE", `Override[${s}] "${e.title}" is DELETED (${r !== -1 ? "matched & suppressed system entry" : "preserved deleted override from previous deploy"})`), g.push({ ...e, deleted: !0, enabled: !1 });
    } else if (r !== -1) {
      const t = o[r];
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
  let f = 0;
  return o.forEach((e, s) => {
    h.has(s) || (f++, b("MERGE", `System entry[${s}] "${e.title}" was UNMATCHED — adding to result`), g.push({
      ...e,
      originalTitle: e.originalTitle || e.title,
      order: g.length
    }));
  }), b("MERGE", `Merge complete: ${g.length} total entries (${f} unmatched system entries added)`), g;
}
function Z(o, a) {
  if (!a || !Array.isArray(a) || a.length === 0) return o;
  const h = o.split(`
`), g = [], f = [];
  let e = -1, s = 0, r = 0;
  for (; s < h.length; ) {
    const i = h[s], c = i.trim();
    if (c.startsWith("submenu ") || c.startsWith("submenu	")) {
      e === -1 && (e = g.length), s++;
      continue;
    }
    if (c === "}" && e !== -1 && g.length >= e) {
      s++;
      continue;
    }
    if (c.startsWith("menuentry ") || c.startsWith("menuentry	")) {
      e === -1 && (e = g.length);
      let l = "Unknown Entry";
      const p = c.match(/^menuentry\s+(?:['"](.*?)['"]|(\S+))/);
      p && (l = p[1] || p[2] || l);
      let m = `sys-entry-${r}`;
      const _ = c.match(/(?:--id|\$menuentry_id_option)\s+(?:['"](.*?)['"]|(\S+))/);
      _ && (m = _[1] || _[2] || m);
      const $ = [i];
      let k = (i.match(/\{/g) || []).length - (i.match(/\}/g) || []).length, S = s + 1;
      for (; S < h.length && (k > 0 || k === 0 && !h[S].includes("{")); ) {
        const T = h[S];
        if ($.push(T), k += (T.match(/\{/g) || []).length - (T.match(/\}/g) || []).length, k <= 0 && T.includes("}")) {
          S++;
          break;
        }
        S++;
      }
      f.push({ id: m, title: l, lines: $, origIdx: r }), r++, s = S;
      continue;
    }
    g.push(i), s++;
  }
  if (e === -1 || f.length === 0) return o;
  const n = [], t = /* @__PURE__ */ new Set();
  a.forEach((i, c) => {
    let l = f.findIndex((p, m) => !t.has(m) && i.id && p.id === i.id && !p.id.startsWith("sys-entry-"));
    if (l === -1 && (l = f.findIndex((p, m) => !t.has(m) && (i.originalTitle === p.title || i.title === p.title))), l === -1 && i.id && i.id.startsWith("sys-entry-")) {
      const p = parseInt(i.id.replace("sys-entry-", ""), 10);
      !isNaN(p) && !t.has(p) && (l = p);
    }
    if (l !== -1 && t.add(l), !(i.deleted || i.enabled === !1) && l !== -1) {
      const p = f[l];
      let m = p.lines[0];
      i.title && i.title !== p.title && (m = m.replace(p.title, i.title), p.lines[0] = m), n.push({ idx: c, text: p.lines.join(`
`) });
    }
  }), f.forEach((i, c) => {
    t.has(c) || n.push({ idx: n.length + 1e3, text: i.lines.join(`
`) });
  }), n.sort((i, c) => i.idx - c.idx);
  const u = n.map((i) => i.text).join(`

`);
  return g.splice(e, 0, u), g.join(`
`);
}
function A() {
  const o = "/var/lib/grub-editor/backups";
  if (process.getuid && process.getuid() === 0 && !d.existsSync(o))
    try {
      d.mkdirSync(o, { recursive: !0 });
    } catch {
    }
  return o;
}
function H(o) {
  const a = A(), h = Date.now(), g = `snap_${h}`, f = y.join(a, g);
  try {
    d.existsSync(f) || d.mkdirSync(f, { recursive: !0 });
  } catch {
    try {
      D(`pkexec /usr/bin/grub-editor-helper mkdir -p "${f}" && pkexec /usr/bin/grub-editor-helper chmod 755 "${f}"`);
    } catch (p) {
      return j("SNAPSHOT", "Could not create snapshot dir:", p.message), null;
    }
  }
  const e = d.existsSync("/etc/default/grub") ? "/etc/default/grub" : "/boot/grub/default", s = y.join(f, "default_grub.bak");
  try {
    const p = O(e);
    C(s, p);
  } catch (p) {
    j("SNAPSHOT", "Failed to backup default grub:", p);
  }
  const r = d.existsSync("/boot/grub2/grub.cfg") ? "/boot/grub2/grub.cfg" : "/boot/grub/grub.cfg";
  let n = null;
  if (d.existsSync(r)) {
    const p = y.join(f, "grub.cfg.bak");
    try {
      const m = O(r);
      C(p, m), n = p;
    } catch (m) {
      j("SNAPSHOT", "Failed to backup grub.cfg:", m);
    }
  }
  let t = null;
  const u = G();
  if (d.existsSync(u)) {
    const p = y.join(f, "grub-editor-entries.json.bak");
    try {
      const m = O(u);
      C(p, m), t = p;
    } catch {
    }
  }
  const i = `${h} (UTC Timestamp)`, c = {
    timestamp: h,
    date_string: i,
    description: o || "Auto-backup",
    default_grub_backup: s,
    grub_cfg_backup: n,
    bls_entries_backup: t,
    warnings: []
  }, l = y.join(f, "snapshot_metadata.json");
  return C(l, JSON.stringify(c, null, 2)), b("SNAPSHOT", `Created recovery snapshot in ${f}: "${o}"`), c;
}
async function oe(o, a) {
  if (!o.url || !o.url.startsWith("/api/"))
    return !1;
  a.setHeader("Content-Type", "application/json");
  try {
    const h = new URL(o.url, `http://${o.headers.host || "localhost"}`), g = h.pathname;
    if (o.method === "GET" && g === "/api/boot-entries") {
      if (b("GET /api/boot-entries", "Fetching boot entries..."), d.existsSync("/boot/loader/entries"))
        try {
          const t = d.readdirSync("/boot/loader/entries").filter((u) => u.endsWith(".conf") || u.endsWith(".mgnix"));
          if (t.length > 0) {
            b("GET /api/boot-entries", `Found ${t.length} BLS entry files`);
            const u = [], i = J.release().trim();
            t.sort().forEach((p, m) => {
              const _ = d.readFileSync(y.join("/boot/loader/entries", p), "utf8");
              let $ = p, k = "", S = "";
              _.split(`
`).forEach((w) => {
                const E = w.trim();
                E.startsWith("title ") ? $ = E.substring(6).trim() : E.startsWith("version ") ? k = E.substring(8).trim() : E.startsWith("options ") && (S = E.substring(8).trim());
              });
              const T = k.includes(i) || $.includes(i);
              u.push({
                id: p.replace(/\.[^/.]+$/, ""),
                title: $,
                type: $.toLowerCase().includes("recovery") || $.toLowerCase().includes("rescue") ? "recovery" : "linux",
                enabled: !0,
                order: m,
                args: S || void 0,
                version: k || void 0,
                isCurrent: T,
                is_current: T,
                is_default: m === 0
              });
            });
            const c = I();
            b("GET /api/boot-entries", `Loaded ${c.length} saved overrides from ${G()}`);
            const l = z(u, c);
            return b("GET /api/boot-entries", `Returning ${l.length} entries (active: ${l.filter((p) => !p.deleted).length}, deleted: ${l.filter((p) => p.deleted).length})`), a.end(JSON.stringify(l)), !0;
          }
        } catch (t) {
          j("GET /api/boot-entries", "BLS directory read error, falling back to grub.cfg:", t);
        }
      const f = d.existsSync("/boot/grub2/grub.cfg") ? "/boot/grub2/grub.cfg" : "/boot/grub/grub.cfg";
      b("GET /api/boot-entries", `Reading grub.cfg from ${f}`);
      const e = O(f), s = se(e);
      b("GET /api/boot-entries", `Parsed ${s.length} menuentry blocks from grub.cfg`);
      const r = I();
      b("GET /api/boot-entries", `Loaded ${r.length} saved overrides from ${G()}`);
      const n = z(s, r);
      return b("GET /api/boot-entries", `Returning ${n.length} entries (active: ${n.filter((t) => !t.deleted).length}, deleted: ${n.filter((t) => t.deleted).length})`), a.end(JSON.stringify(n)), !0;
    }
    if (o.method === "GET" && g === "/api/grub-config") {
      const f = d.existsSync("/etc/default/grub") ? "/etc/default/grub" : "/boot/grub/default", e = O(f), s = {};
      return e.split(`
`).forEach((r) => {
        const n = r.trim();
        if (n && !n.startsWith("#") && n.includes("=")) {
          const t = n.indexOf("="), u = n.substring(0, t).trim();
          let i = n.substring(t + 1).trim();
          (i.startsWith('"') && i.endsWith('"') || i.startsWith("'") && i.endsWith("'")) && (i = i.substring(1, i.length - 1)), s[u] = i;
        }
      }), a.end(JSON.stringify(s)), !0;
    }
    if (o.method === "GET" && g === "/api/distro") {
      let f = "Ubuntu 24.04.4 LTS", e = "DebianUbuntu", s = ["update-grub"];
      try {
        d.readFileSync("/etc/os-release", "utf8").split(`
`).forEach((n) => {
          if (n.startsWith("PRETTY_NAME="))
            f = n.split("=")[1].replace(/["']/g, "").trim();
          else if (n.startsWith("ID=")) {
            const t = n.split("=")[1].replace(/["']/g, "").trim().toLowerCase();
            t === "fedora" || t === "rhel" || t === "centos" || t === "rocky" ? (e = "RHEL", s = ["grub2-mkconfig", "-o", "/boot/grub2/grub.cfg"]) : (t === "arch" || t === "manjaro") && (e = "Arch", s = ["grub-mkconfig", "-o", "/boot/grub/grub.cfg"]);
          }
        });
      } catch {
      }
      return a.end(JSON.stringify({
        distro_name: f,
        family: e,
        default_grub_path: "/etc/default/grub",
        grub_dir: "/boot/grub",
        grub_cfg_path: "/boot/grub/grub.cfg",
        themes_dir: "/boot/grub/themes",
        regen_command: s,
        uses_bls: d.existsSync("/boot/loader/entries")
      })), !0;
    }
    if (o.method === "GET" && g === "/api/scan-themes") {
      const f = d.existsSync("/boot/grub2/themes") ? "/boot/grub2/themes" : "/boot/grub/themes", e = [];
      try {
        let s = [];
        try {
          s = d.readdirSync(f);
        } catch {
          s = D(`pkexec /usr/bin/grub-editor-helper find "${f}" -maxdepth 1 -mindepth 1 -type d`, { encoding: "utf8" }).split(`
`).filter(Boolean).map((n) => y.basename(n.trim()));
        }
        for (const r of s) {
          const n = y.join(f, r), t = y.join(n, "theme.txt");
          let u = !1;
          try {
            d.existsSync(t) && (u = !0);
          } catch {
            try {
              D(`test -f "${t}"`, { stdio: "ignore" }), u = !0;
            } catch {
            }
          }
          u && e.push({
            name: r,
            path: n,
            is_valid: !0,
            validation_errors: [],
            has_pf2_fonts: !0,
            background_image: "background.png",
            title_text: `${r} Theme`
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
      }), a.end(JSON.stringify(e)), !0;
    }
    if (o.method === "GET" && g === "/api/snapshots") {
      b("GET /api/snapshots", "Fetching recovery snapshots...");
      const f = A(), e = [];
      if (d.existsSync(f))
        try {
          const s = d.readdirSync(f);
          for (const r of s) {
            const n = y.join(f, r, "snapshot_metadata.json");
            if (d.existsSync(n))
              try {
                const t = O(n), u = JSON.parse(t);
                e.push(u);
              } catch {
              }
          }
          e.sort((r, n) => (n.timestamp || 0) - (r.timestamp || 0));
        } catch (s) {
          j("GET /api/snapshots", "Failed reading snapshot directories:", s);
        }
      return b("GET /api/snapshots", `Returning ${e.length} snapshots`), a.end(JSON.stringify(e)), !0;
    }
    if (o.method === "GET" && g === "/api/snapshot-details") {
      const f = h.searchParams.get("timestamp");
      if (!f)
        return a.statusCode = 400, a.end(JSON.stringify({ error: "Missing timestamp" })), !0;
      try {
        const e = A(), s = y.join(e, `snap_${f}`), r = y.join(s, "snapshot_metadata.json");
        if (!d.existsSync(r))
          throw new Error("Snapshot not found");
        const n = JSON.parse(O(r)), t = {};
        if (n.default_grub_backup)
          try {
            O(n.default_grub_backup).split(`
`).forEach((c) => {
              const l = c.trim();
              if (l && !l.startsWith("#") && l.includes("=")) {
                const p = l.indexOf("="), m = l.substring(0, p).trim();
                let _ = l.substring(p + 1).trim();
                (_.startsWith('"') && _.endsWith('"') || _.startsWith("'") && _.endsWith("'")) && (_ = _.substring(1, _.length - 1)), t[m] = _;
              }
            });
          } catch (i) {
            j("GET /api/snapshot-details", "Failed to read default_grub_backup", i);
          }
        let u = [];
        if (n.bls_entries_backup)
          try {
            u = JSON.parse(O(n.bls_entries_backup));
          } catch (i) {
            j("GET /api/snapshot-details", "Failed to read bls_entries_backup", i);
          }
        a.end(JSON.stringify({ config: t, bootEntries: u }));
      } catch (e) {
        a.statusCode = 500, a.end(JSON.stringify({ error: e.message }));
      }
      return !0;
    }
    if (o.method === "POST") {
      let f = "";
      return o.on("data", (e) => {
        f += e;
      }), await new Promise((e) => {
        o.on("end", async () => {
          try {
            const s = f ? JSON.parse(f) : {};
            if (g === "/api/save-grub-config") {
              const { newConfig: r, reason: n, createSnapshot: t } = s;
              if (b("POST /api/save-grub-config", `Saving config (createSnapshot=${t}, reason="${n}")`), t && H(n || "Modified GRUB general configuration"), r) {
                const u = ["# Updated via GrubEditor GUI"];
                for (const [c, l] of Object.entries(r))
                  u.push(`${c}="${l}"`);
                const i = y.join(J.tmpdir(), `grub-config-${Date.now()}`);
                d.writeFileSync(i, u.join(`
`) + `
`, "utf8");
                try {
                  d.copyFileSync(i, "/etc/default/grub"), d.existsSync(i) && d.unlinkSync(i);
                } catch {
                  try {
                    D(`pkexec /usr/bin/grub-editor-helper cp "${i}" /etc/default/grub && rm -f "${i}"`);
                  } catch (c) {
                    throw console.warn("Failed to copy config via pkexec:", c.message), new Error("Failed to copy config via pkexec: " + c.message);
                  }
                }
                delete x["/etc/default/grub"], delete x["/boot/grub/default"];
              }
              a.end(JSON.stringify({ success: !0 })), e();
              return;
            }
            if (g === "/api/save-boot-entries") {
              const { newEntries: r, reason: n, createSnapshot: t } = s;
              if (b("POST /api/save-boot-entries", `Received ${r?.length ?? 0} entries to save (createSnapshot=${t}, reason="${n}")`), t && H(n || "Modified boot menu entries & ordering"), r && Array.isArray(r)) {
                const u = r.map((l) => ({ ...l, originalTitle: l.originalTitle || l.title })), i = u.filter((l) => l.deleted).length, c = u.filter((l) => !l.deleted).length;
                b("POST /api/save-boot-entries", `Saving ${u.length} entries (${c} active, ${i} deleted) to ${G()}`), u.forEach((l, p) => {
                  b("POST /api/save-boot-entries", `  [${p}] id="${l.id}" title="${l.title}" origTitle="${l.originalTitle}" deleted=${l.deleted} enabled=${l.enabled}`);
                }), C(G(), JSON.stringify(u, null, 2)), b("POST /api/save-boot-entries", "Write successful");
              }
              delete x["/boot/grub/grub.cfg"], delete x["/boot/grub2/grub.cfg"], a.end(JSON.stringify({ success: !0 })), e();
              return;
            }
            if (g === "/api/restore-snapshot") {
              const { timestamp: r } = s;
              b("POST /api/restore-snapshot", `Restoring snapshot timestamp ${r}...`);
              const n = A(), t = y.join(n, `snap_${r}`), u = y.join(t, "snapshot_metadata.json");
              if (!d.existsSync(u))
                throw new Error("Snapshot metadata not found for timestamp " + r);
              const i = JSON.parse(O(u));
              H(`Auto-backup before restoring snapshot from ${new Date(r).toLocaleString()}`);
              try {
                if (i.default_grub_backup && d.existsSync(i.default_grub_backup)) {
                  const l = d.existsSync("/etc/default/grub") ? "/etc/default/grub" : "/boot/grub/default";
                  C(l, O(i.default_grub_backup)), delete x["/etc/default/grub"], delete x["/boot/grub/default"];
                }
                if (i.grub_cfg_backup && d.existsSync(i.grub_cfg_backup)) {
                  const l = d.existsSync("/boot/grub2/grub.cfg") ? "/boot/grub2/grub.cfg" : "/boot/grub/grub.cfg";
                  C(l, O(i.grub_cfg_backup)), delete x["/boot/grub/grub.cfg"], delete x["/boot/grub2/grub.cfg"];
                }
                let c = !1;
                if (i.bls_entries_backup && d.existsSync(i.bls_entries_backup)) {
                  const l = O(i.bls_entries_backup);
                  C(G(), l), c = !0;
                }
                c || C(G(), "[]"), b("POST /api/restore-snapshot", "Restore completed successfully"), a.end(JSON.stringify({ success: !0 }));
              } catch (c) {
                j("POST /api/restore-snapshot", "Restore aborted due to error:", c.message), a.statusCode = 500, a.end(JSON.stringify({ success: !1, error: c.message }));
              }
              e();
              return;
            }
            if (g === "/api/trigger-regen") {
              b("POST /api/trigger-regen", "Starting GRUB regeneration...");
              let r = "";
              try {
                const n = process.getuid ? process.getuid() === 0 : !1, t = n ? "update-grub 2>&1" : "pkexec /usr/bin/grub-editor-helper update-grub 2>&1";
                b("POST /api/trigger-regen", `Running: ${t} (isRoot=${n})`), r = D(t, { encoding: "utf8" }), b("POST /api/trigger-regen", "update-grub completed successfully"), delete x["/boot/grub/grub.cfg"], delete x["/boot/grub2/grub.cfg"];
                try {
                  const u = d.existsSync("/boot/grub2/grub.cfg") ? "/boot/grub2/grub.cfg" : "/boot/grub/grub.cfg";
                  if (d.existsSync(u)) {
                    const i = O(u), c = I();
                    if (b("POST /api/trigger-regen", `Post-regen: ${c.length} overrides to apply to ${u}`), c.length > 0) {
                      const l = c.filter((m) => m.deleted);
                      b("POST /api/trigger-regen", `Overrides breakdown: ${c.length - l.length} active, ${l.length} deleted`);
                      const p = Z(i, c);
                      C(u, p), b("POST /api/trigger-regen", "Successfully wrote modified grub.cfg"), r += `
[GrubEditor] Applied custom menu ordering, titles, and exclusions to grub.cfg successfully.`;
                    }
                  }
                } catch (u) {
                  j("POST /api/trigger-regen", "Failed to apply post-regeneration overrides:", u), r += `
[GrubEditor] Warning: Could not apply overrides to grub.cfg: ${u.message}`;
                }
              } catch (n) {
                throw j("POST /api/trigger-regen", "update-grub failed:", n.message), new Error(`Failed to regenerate GRUB configuration: ${n.stdout || n.stderr || n.message}`);
              }
              b("POST /api/trigger-regen", "Regeneration pipeline complete"), a.end(JSON.stringify({ success: !0, output: r })), e();
              return;
            }
            if (g === "/api/deploy-pipeline") {
              const { config: r, bootEntries: n, snapTitle: t } = s;
              b("POST /api/deploy-pipeline", `Starting batched deploy pipeline. snapTitle: ${t}`);
              const u = process.getuid ? process.getuid() === 0 : !1, i = u ? "" : "pkexec /usr/bin/grub-editor-helper ", c = `/tmp/grub-editor-deploy-config-${Date.now()}`, l = `/tmp/grub-editor-deploy-entries-${Date.now()}`;
              let p = "";
              for (const [v, N] of Object.entries(r))
                p += `${v}="${N}"
`;
              d.writeFileSync(c, p);
              const m = (n || []).map((v) => ({ ...v, originalTitle: v.originalTitle || v.title }));
              d.writeFileSync(l, JSON.stringify(m, null, 2));
              const _ = Date.now(), $ = y.join(A(), `snap_${_}`), k = d.existsSync("/etc/default/grub") ? "/etc/default/grub" : "/boot/grub/default", S = d.existsSync("/boot/grub2/grub.cfg") ? "/boot/grub2/grub.cfg" : "/boot/grub/grub.cfg", T = G(), w = `/tmp/grub-editor-deploy-script-${Date.now()}.sh`, E = `/tmp/grub-editor-raw-cfg-${Date.now()}`, P = {
                timestamp: _,
                date_string: `${_} (UTC Timestamp)`,
                description: t,
                default_grub_backup: y.join($, "default_grub.bak"),
                grub_cfg_backup: d.existsSync(S) ? y.join($, "grub.cfg.bak") : null,
                bls_entries_backup: y.join($, "grub-editor-entries.json.bak")
              }, B = `/tmp/grub-editor-deploy-meta-${Date.now()}`;
              d.writeFileSync(B, JSON.stringify(P, null, 2));
              const F = `/tmp/grub-editor-patched-cfg-${Date.now()}`, Q = `#!/bin/bash
set -e
set -x
echo "[Bash Runtime] Stage 1: Initializing snapshot in ${$}..."
mkdir -p "${$}"
chmod 755 "${$}"
cp "${B}" "${$}/snapshot_metadata.json"
chmod 644 "${$}/snapshot_metadata.json"

if [ -n "${P.default_grub_backup}" ] && [ "${P.default_grub_backup}" != "null" ] && [ -f "${k}" ]; then cp "${k}" "${P.default_grub_backup}"; chmod 644 "${P.default_grub_backup}"; fi
if [ -n "${P.grub_cfg_backup}" ] && [ "${P.grub_cfg_backup}" != "null" ] && [ -f "${S}" ]; then cp "${S}" "${P.grub_cfg_backup}"; chmod 644 "${P.grub_cfg_backup}"; fi
if [ -n "${P.bls_entries_backup}" ] && [ "${P.bls_entries_backup}" != "null" ] && [ -f "${T}" ]; then cp "${T}" "${P.bls_entries_backup}"; chmod 644 "${P.bls_entries_backup}"; fi

echo "[Bash Runtime] Stage 2: Applying new GRUB configurations..."
cp "${c}" "${k}"
chmod 644 "${k}"
cp "${l}" "${T}"
chmod 644 "${T}"

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

echo "[Bash Runtime] Stage 6: Finalizing deployment..."
cp "${F}" "${S}"
chmod 644 "${S}"

echo "[Bash Runtime] Execution completed successfully!"
`;
              d.writeFileSync(w, Q), b("POST /api/deploy-pipeline", "Executing Batched Deploy Script Asynchronously...");
              try {
                const v = await new Promise((N, V) => {
                  let L = "";
                  const U = re(u ? "bash" : "pkexec", u ? ["bash", w] : ["/usr/bin/grub-editor-helper", "bash", w]);
                  U.stdout.on("data", (R) => {
                    L += R.toString();
                  }), U.stderr.on("data", (R) => {
                    L += R.toString();
                  }), U.on("close", (R) => {
                    R === 0 ? N(L) : V(new Error(`Exit code ${R}:
${L}`));
                  }), U.on("error", (R) => {
                    V(new Error(`Spawn error: ${R.message}
${L}`));
                  });
                  const q = setInterval(() => {
                    if (d.existsSync(E)) {
                      clearInterval(q), b("POST /api/deploy-pipeline", "Detected raw config. Applying overrides...");
                      try {
                        const R = d.readFileSync(E, "utf8"), ee = Z(R, m);
                        d.writeFileSync(F, ee);
                      } catch (R) {
                        j("POST /api/deploy-pipeline", "Failed to patch config:", R.message);
                      }
                    }
                  }, 500);
                });
                [c, l, B, w, E, F].forEach((N) => {
                  try {
                    d.existsSync(N) && d.unlinkSync(N);
                  } catch {
                  }
                }), delete x["/boot/grub/grub.cfg"], delete x["/boot/grub2/grub.cfg"], delete x["/etc/default/grub"], b("POST /api/deploy-pipeline", "Deployment pipeline complete"), a.end(JSON.stringify({ success: !0, output: v })), e();
                return;
              } catch (v) {
                throw [c, l, B, w, E, F].forEach((N) => {
                  try {
                    d.existsSync(N) && d.unlinkSync(N);
                  } catch {
                  }
                }), j("POST /api/deploy-pipeline", "Deploy pipeline failed:", v.message), new Error(`Failed during deployment:
${v.message}`);
              }
            }
            a.end(JSON.stringify({ success: !0 })), e();
          } catch (s) {
            a.statusCode = 500, a.end(JSON.stringify({ error: s.message })), e();
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
  const o = d.existsSync(y.join(M, "preload.mjs")) ? y.join(M, "preload.mjs") : y.join(M, "preload.js"), a = new X({
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
  if (a.setMenuBarVisibility(!1), te.setApplicationMenu(null), a.webContents.on("console-message", (h, g, f, e, s) => {
    console.log(`[Renderer Console] [level ${g}] ${f} (${s}:${e})`);
  }), a.webContents.on("did-fail-load", (h, g, f, e) => {
    console.error(`[Renderer Fail Load] (${g}) ${f} - ${e}`);
  }), a.webContents.on("render-process-gone", (h, g) => {
    console.error(`[Renderer Process Gone] ${g.reason} - exitCode: ${g.exitCode}`);
  }), process.env.VITE_DEV_SERVER_URL)
    a.loadURL(process.env.VITE_DEV_SERVER_URL);
  else {
    const h = y.join(M, "../dist"), g = ne.createServer(async (e, s) => {
      try {
        if (!await oe(e, s)) {
          const n = new URL(e.url || "/", `http://${e.headers.host || "localhost"}`);
          let t = y.join(h, n.pathname === "/" ? "index.html" : n.pathname);
          d.existsSync(t) || (t = y.join(h, "index.html"));
          const u = y.extname(t).toLowerCase(), c = {
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
          s.writeHead(200, { "Content-Type": c }), d.createReadStream(t).pipe(s);
        }
      } catch (r) {
        s.writeHead(500, { "Content-Type": "application/json" }), s.end(JSON.stringify({ error: r.message || "Internal Server Error" }));
      }
    }), f = (e) => {
      g.listen(e, "127.0.0.1", () => {
        const s = g.address().port;
        a.loadURL(`http://127.0.0.1:${s}`);
      });
    };
    g.on("error", (e) => {
      e.code === "EADDRINUSE" && (console.warn("Port 31415 occupied, retrying with ephemeral loopback port..."), g.close(), f(0));
    }), f(31415), a.on("closed", () => {
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
