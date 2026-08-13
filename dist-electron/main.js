import { app as W, BrowserWindow as Y, Menu as ne } from "electron";
import * as S from "node:path";
import * as l from "node:fs";
import * as ie from "node:http";
import { fileURLToPath as re } from "node:url";
import * as U from "node:os";
import { execSync as D, spawn as se } from "node:child_process";
const Q = "[GrubEditor API]";
function m(i, ...d) {
  console.log(`${Q} [${i}]`, ...d);
}
function P(i, ...d) {
  console.error(`${Q} [${i}] ERROR:`, ...d);
}
const _ = {};
function v(i, d = 5e3) {
  const b = Date.now();
  if (_[i] && b - _[i].timestamp < d)
    return _[i].data;
  let p = "";
  try {
    p = l.readFileSync(i, "utf8");
  } catch (f) {
    if (f.code === "ENOENT")
      throw new Error(`File not found: ${i}`);
    try {
      p = D(`pkexec /usr/bin/grub-editor-helper cat "${i}"`, { encoding: "utf8" });
    } catch {
      throw new Error(`File not found or unreadable: ${i}`);
    }
  }
  return _[i] = { data: p, timestamp: b }, p;
}
function Z(i) {
  const d = [], b = U.release().trim(), p = i.split(`
`);
  let f, e = !1;
  for (let o = 0; o < p.length; o++) {
    const r = p[o].trim();
    if (r.startsWith("submenu ") || r.startsWith("submenu	")) {
      e = !0, r.match(/^submenu\s+((?:['"])(.*?)(?:['"])|(\S+))/) && (f = `submenu-${o}`);
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
      let u = `sys-entry-${d.length}`;
      const s = r.match(/(?:--id|\$menuentry_id_option)\s+(?:['"](.*?)['"]|(\S+))/);
      s && (u = s[1] || s[2] || u);
      let a = "", g = (r.match(/\{/g) || []).length - (r.match(/\}/g) || []).length, c = o + 1;
      for (; c < p.length && (g > 0 || g === 0 && !p[c].includes("{")); ) {
        const x = p[c];
        if (a += x + `
`, g += (x.match(/\{/g) || []).length - (x.match(/\}/g) || []).length, g <= 0 && x.includes("}")) break;
        c++;
      }
      o = c;
      let h = "custom", k, y, w = !1;
      const $ = n.toLowerCase();
      $.includes("recovery") || $.includes("advanced") || $.includes("rescue") || a.toLowerCase().includes("recovery") || a.toLowerCase().includes("single") ? h = "recovery" : $.includes("windows") || a.toLowerCase().includes("chainloader") ? h = "windows" : $.includes("uefi") || $.includes("firmware") || a.toLowerCase().includes("fwsetup") ? h = "efi" : ($.includes("linux") || $.includes("ubuntu") || $.includes("debian") || $.includes("fedora") || a.includes("linux ") || a.includes("linuxefi ") || a.includes("linux16 ")) && (h = "linux");
      const E = a.match(/^\s*(?:linux|linuxefi|linux16)\s+(\S+)(.*)$/m);
      if (E) {
        const x = E[1];
        k = E[2].trim(), h !== "recovery" && h !== "windows" && h !== "efi" && (h = "linux");
        const T = x.match(/vmlinuz-([a-zA-Z0-9.\-_]+)/i) || x.match(/kernel-([a-zA-Z0-9.\-_]+)/i);
        T && (y = T[1]);
      }
      if (!y) {
        const x = n.match(/\b(\d+\.\d+(?:\.\d+)?(?:-[a-zA-Z0-9]+)*)\b/);
        x && (y = x[1]);
      }
      (y && y.includes(b) || n.includes(b) || b.length > 3 && (y === b || n.includes(b))) && (w = !0), d.push({
        id: u,
        title: n,
        type: h,
        enabled: !0,
        order: d.length,
        args: k || void 0,
        version: y || void 0,
        isCurrent: w,
        is_current: w,
        is_default: d.length === 0,
        parent_id: f,
        raw_boot_commands: a.trim()
      });
    }
  }
  return d;
}
function N() {
  const i = "/var/lib/grub-editor";
  try {
    l.existsSync(i) || process.getuid && process.getuid() === 0 && (l.mkdirSync(i, { recursive: !0 }), l.chmodSync(i, 493));
  } catch {
  }
  return S.join(i, "grub-editor-entries.json");
}
function G(i, d) {
  try {
    const b = S.dirname(i);
    l.existsSync(b) || l.mkdirSync(b, { recursive: !0 }), l.writeFileSync(i, d, "utf8");
  } catch {
    const b = S.join(U.tmpdir(), `grub-write-${Date.now()}-${Math.random().toString(36).substring(2, 8)}`);
    l.writeFileSync(b, d, "utf8");
    try {
      D(`pkexec /usr/bin/grub-editor-helper sh -c "mkdir -p '$(dirname "${i}")' && chmod 755 '$(dirname "${i}")' && cp '${b}' '${i}' && chmod 0644 '${i}'"`, { stdio: "ignore" });
    } catch (p) {
      throw console.error(`Failed to write ${i} via pkexec:`, p.message), new Error(`Cannot write to ${i}: permission denied or authentication dismissed.`);
    } finally {
      if (l.existsSync(b)) try {
        l.unlinkSync(b);
      } catch {
      }
    }
  }
  delete _[i];
}
function I() {
  try {
    const i = N(), d = v(i, 0);
    return JSON.parse(d);
  } catch {
    return [];
  }
}
function H(i, d) {
  if (m("MERGE", `Starting merge: ${i.length} system entries, ${d.length} overrides`), !d || !Array.isArray(d) || d.length === 0)
    return m("MERGE", "No overrides found, returning raw system entries"), i;
  const b = /* @__PURE__ */ new Set();
  i.forEach((e) => {
    e.originalTitle || (e.originalTitle = e.title);
  }), m("MERGE", "System entries:", i.map((e, o) => `[${o}] id="${e.id}" title="${e.title}"`).join(" | ")), m("MERGE", "Overrides:", d.map((e, o) => `[${o}] id="${e.id}" title="${e.title}" origTitle="${e.originalTitle}" deleted=${e.deleted}`).join(" | "));
  const p = [];
  d.forEach((e, o) => {
    let r = i.findIndex((t, u) => !b.has(u) && e.id && t.id === e.id && !t.id.startsWith("sys-entry-")), n = "id";
    if (r === -1 && (r = i.findIndex((t, u) => {
      if (b.has(u)) return !1;
      const s = t.originalTitle || t.title, a = e.originalTitle || e.title;
      return a === t.title || a === s || e.title === t.title;
    }), n = "title"), r === -1 && e.id && e.id.startsWith("sys-entry-")) {
      const t = parseInt(e.id.replace("sys-entry-", ""), 10);
      !isNaN(t) && t < i.length && !b.has(t) && (r = t, n = "positional");
    }
    if (r !== -1 ? (b.add(r), m("MERGE", `Override[${o}] "${e.title}" matched system[${r}] "${i[r].title}" via ${n}`)) : m("MERGE", `Override[${o}] "${e.title}" (origTitle="${e.originalTitle}", id="${e.id}") had NO match in system entries`), e.deleted) {
      if (p.some(
        (u) => e.id && u.id === e.id && !u.id.startsWith("sys-") && !e.id.startsWith("sys-") || (e.originalTitle || e.title) === (u.originalTitle || u.title)
      )) {
        m("MERGE", `Override[${o}] "${e.title}" is a DUPLICATE deleted override — skipping`);
        return;
      }
      m("MERGE", `Override[${o}] "${e.title}" is DELETED (${r !== -1 ? "matched & suppressed system entry" : "preserved deleted override from previous deploy"})`), p.push({ ...e, deleted: !0, enabled: !1 });
    } else if (r !== -1) {
      const t = i[r];
      p.push({
        ...t,
        title: e.title !== void 0 ? e.title : t.title,
        originalTitle: e.originalTitle || t.originalTitle || t.title,
        enabled: e.enabled !== void 0 ? e.enabled : t.enabled,
        deleted: !1,
        order: p.length
      });
    } else
      p.push({ ...e, deleted: !1, order: p.length });
  });
  let f = 0;
  return i.forEach((e, o) => {
    b.has(o) || (f++, m("MERGE", `System entry[${o}] "${e.title}" was UNMATCHED — adding to result`), p.push({
      ...e,
      originalTitle: e.originalTitle || e.title,
      order: p.length
    }));
  }), m("MERGE", `Merge complete: ${p.length} total entries (${f} unmatched system entries added)`), p;
}
function K(i, d) {
  if (!d || !Array.isArray(d) || d.length === 0) return i;
  const b = i.split(`
`), p = [], f = [];
  let e = -1, o = 0, r = 0;
  for (; o < b.length; ) {
    const s = b[o], a = s.trim();
    if (a.startsWith("submenu ") || a.startsWith("submenu	")) {
      e === -1 && (e = p.length), o++;
      continue;
    }
    if (a === "}" && e !== -1 && p.length >= e) {
      o++;
      continue;
    }
    if (a.startsWith("menuentry ") || a.startsWith("menuentry	")) {
      e === -1 && (e = p.length);
      let g = "Unknown Entry";
      const c = a.match(/^menuentry\s+(?:['"](.*?)['"]|(\S+))/);
      c && (g = c[1] || c[2] || g);
      let h = `sys-entry-${r}`;
      const k = a.match(/(?:--id|\$menuentry_id_option)\s+(?:['"](.*?)['"]|(\S+))/);
      k && (h = k[1] || k[2] || h);
      const y = [s];
      let w = (s.match(/\{/g) || []).length - (s.match(/\}/g) || []).length, $ = o + 1;
      for (; $ < b.length && (w > 0 || w === 0 && !b[$].includes("{")); ) {
        const E = b[$];
        if (y.push(E), w += (E.match(/\{/g) || []).length - (E.match(/\}/g) || []).length, w <= 0 && E.includes("}")) {
          $++;
          break;
        }
        $++;
      }
      f.push({ id: h, title: g, lines: y, origIdx: r }), r++, o = $;
      continue;
    }
    p.push(s), o++;
  }
  if (e === -1 || f.length === 0) return i;
  const n = [], t = /* @__PURE__ */ new Set();
  d.forEach((s, a) => {
    let g = f.findIndex((c, h) => !t.has(h) && s.id && c.id === s.id && !c.id.startsWith("sys-entry-"));
    if (g === -1 && (g = f.findIndex((c, h) => !t.has(h) && (s.originalTitle === c.title || s.title === c.title))), g === -1 && s.id && s.id.startsWith("sys-entry-")) {
      const c = parseInt(s.id.replace("sys-entry-", ""), 10);
      !isNaN(c) && !t.has(c) && (g = c);
    }
    if (g !== -1 && t.add(g), !(s.deleted || s.enabled === !1) && g !== -1) {
      const c = f[g];
      let h = c.lines[0];
      s.title && s.title !== c.title && (h = h.replace(c.title, s.title), c.lines[0] = h), n.push({ idx: a, text: c.lines.join(`
`) });
    }
  }), f.forEach((s, a) => {
    t.has(a) || n.push({ idx: n.length + 1e3, text: s.lines.join(`
`) });
  }), n.sort((s, a) => s.idx - a.idx);
  const u = n.map((s) => s.text).join(`

`);
  return p.splice(e, 0, u), p.join(`
`);
}
function M() {
  const i = "/var/lib/grub-editor/backups";
  if (process.getuid && process.getuid() === 0 && !l.existsSync(i))
    try {
      l.mkdirSync(i, { recursive: !0 }), l.chmodSync("/var/lib/grub-editor", 493), l.chmodSync(i, 493);
    } catch {
    }
  return i;
}
function V(i) {
  const d = M(), b = Date.now(), p = `snap_${b}`, f = S.join(d, p);
  try {
    l.existsSync(f) || l.mkdirSync(f, { recursive: !0 });
  } catch {
    try {
      D(`pkexec /usr/bin/grub-editor-helper mkdir -p "${f}" && pkexec /usr/bin/grub-editor-helper chmod 755 "${f}"`);
    } catch (c) {
      return P("SNAPSHOT", "Could not create snapshot dir:", c.message), null;
    }
  }
  const e = l.existsSync("/etc/default/grub") ? "/etc/default/grub" : "/boot/grub/default", o = S.join(f, "default_grub.bak");
  try {
    const c = v(e);
    G(o, c);
  } catch (c) {
    P("SNAPSHOT", "Failed to backup default grub:", c);
  }
  const r = l.existsSync("/boot/grub2/grub.cfg") ? "/boot/grub2/grub.cfg" : "/boot/grub/grub.cfg";
  let n = null;
  if (l.existsSync(r)) {
    const c = S.join(f, "grub.cfg.bak");
    try {
      const h = v(r);
      G(c, h), n = c;
    } catch (h) {
      P("SNAPSHOT", "Failed to backup grub.cfg:", h);
    }
  }
  let t = null;
  const u = N();
  if (l.existsSync(u)) {
    const c = S.join(f, "grub-editor-entries.json.bak");
    try {
      const h = v(u);
      G(c, h), t = c;
    } catch {
    }
  }
  const s = `${b} (UTC Timestamp)`, a = {
    timestamp: b,
    date_string: s,
    description: i || "Auto-backup",
    default_grub_backup: o,
    grub_cfg_backup: n,
    bls_entries_backup: t,
    warnings: []
  }, g = S.join(f, "snapshot_metadata.json");
  return G(g, JSON.stringify(a, null, 2)), m("SNAPSHOT", `Created recovery snapshot in ${f}: "${i}"`), a;
}
async function oe(i, d) {
  if (!i.url || !i.url.startsWith("/api/"))
    return !1;
  d.setHeader("Content-Type", "application/json");
  try {
    const b = new URL(i.url, `http://${i.headers.host || "localhost"}`), p = b.pathname;
    if (i.method === "GET" && p === "/api/boot-entries") {
      if (m("GET /api/boot-entries", "Fetching boot entries..."), l.existsSync("/boot/loader/entries"))
        try {
          const t = l.readdirSync("/boot/loader/entries").filter((u) => u.endsWith(".conf") || u.endsWith(".mgnix"));
          if (t.length > 0) {
            m("GET /api/boot-entries", `Found ${t.length} BLS entry files`);
            const u = [], s = U.release().trim();
            t.sort().forEach((c, h) => {
              const k = l.readFileSync(S.join("/boot/loader/entries", c), "utf8");
              let y = c, w = "", $ = "";
              k.split(`
`).forEach((x) => {
                const T = x.trim();
                T.startsWith("title ") ? y = T.substring(6).trim() : T.startsWith("version ") ? w = T.substring(8).trim() : T.startsWith("options ") && ($ = T.substring(8).trim());
              });
              const E = w.includes(s) || y.includes(s);
              u.push({
                id: c.replace(/\.[^/.]+$/, ""),
                title: y,
                type: y.toLowerCase().includes("recovery") || y.toLowerCase().includes("rescue") ? "recovery" : "linux",
                enabled: !0,
                order: h,
                args: $ || void 0,
                version: w || void 0,
                isCurrent: E,
                is_current: E,
                is_default: h === 0
              });
            });
            const a = I();
            m("GET /api/boot-entries", `Loaded ${a.length} saved overrides from ${N()}`);
            const g = H(u, a);
            return m("GET /api/boot-entries", `Returning ${g.length} entries (active: ${g.filter((c) => !c.deleted).length}, deleted: ${g.filter((c) => c.deleted).length})`), d.end(JSON.stringify(g)), !0;
          }
        } catch (t) {
          P("GET /api/boot-entries", "BLS directory read error, falling back to grub.cfg:", t);
        }
      const f = l.existsSync("/boot/grub2/grub.cfg") ? "/boot/grub2/grub.cfg" : "/boot/grub/grub.cfg";
      m("GET /api/boot-entries", `Reading grub.cfg from ${f}`);
      const e = v(f), o = Z(e);
      m("GET /api/boot-entries", `Parsed ${o.length} menuentry blocks from grub.cfg`);
      const r = I();
      m("GET /api/boot-entries", `Loaded ${r.length} saved overrides from ${N()}`);
      const n = H(o, r);
      return m("GET /api/boot-entries", `Returning ${n.length} entries (active: ${n.filter((t) => !t.deleted).length}, deleted: ${n.filter((t) => t.deleted).length})`), d.end(JSON.stringify(n)), !0;
    }
    if (i.method === "GET" && p === "/api/grub-config") {
      const f = l.existsSync("/etc/default/grub") ? "/etc/default/grub" : "/boot/grub/default", e = v(f), o = {};
      return e.split(`
`).forEach((r) => {
        const n = r.trim();
        if (n && !n.startsWith("#") && n.includes("=")) {
          const t = n.indexOf("="), u = n.substring(0, t).trim();
          let s = n.substring(t + 1).trim();
          (s.startsWith('"') && s.endsWith('"') || s.startsWith("'") && s.endsWith("'")) && (s = s.substring(1, s.length - 1)), o[u] = s;
        }
      }), d.end(JSON.stringify(o)), !0;
    }
    if (i.method === "GET" && p === "/api/distro") {
      let f = "Ubuntu 24.04.4 LTS", e = "DebianUbuntu", o = ["update-grub"];
      try {
        l.readFileSync("/etc/os-release", "utf8").split(`
`).forEach((n) => {
          if (n.startsWith("PRETTY_NAME="))
            f = n.split("=")[1].replace(/["']/g, "").trim();
          else if (n.startsWith("ID=")) {
            const t = n.split("=")[1].replace(/["']/g, "").trim().toLowerCase();
            t === "fedora" || t === "rhel" || t === "centos" || t === "rocky" ? (e = "RHEL", o = ["grub2-mkconfig", "-o", "/boot/grub2/grub.cfg"]) : (t === "arch" || t === "manjaro") && (e = "Arch", o = ["grub-mkconfig", "-o", "/boot/grub/grub.cfg"]);
          }
        });
      } catch {
      }
      return d.end(JSON.stringify({
        distro_name: f,
        family: e,
        default_grub_path: "/etc/default/grub",
        grub_dir: "/boot/grub",
        grub_cfg_path: "/boot/grub/grub.cfg",
        themes_dir: "/boot/grub/themes",
        regen_command: o,
        uses_bls: l.existsSync("/boot/loader/entries")
      })), !0;
    }
    if (i.method === "GET" && p === "/api/scan-themes") {
      const f = l.existsSync("/boot/grub2/themes") ? "/boot/grub2/themes" : "/boot/grub/themes", e = [];
      try {
        let o = [];
        try {
          o = l.readdirSync(f);
        } catch {
          o = D(`pkexec /usr/bin/grub-editor-helper find "${f}" -maxdepth 1 -mindepth 1 -type d`, { encoding: "utf8" }).split(`
`).filter(Boolean).map((n) => S.basename(n.trim()));
        }
        for (const r of o) {
          const n = S.join(f, r), t = S.join(n, "theme.txt");
          let u = !1;
          try {
            l.existsSync(t) && (u = !0);
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
      }), d.end(JSON.stringify(e)), !0;
    }
    if (i.method === "GET" && p === "/api/snapshots") {
      m("GET /api/snapshots", "Fetching recovery snapshots...");
      const f = M(), e = [];
      if (l.existsSync(f))
        try {
          const o = l.readdirSync(f);
          for (const r of o) {
            const n = S.join(f, r, "snapshot_metadata.json");
            if (l.existsSync(n))
              try {
                const t = v(n), u = JSON.parse(t);
                e.push(u);
              } catch {
              }
          }
          e.sort((r, n) => (n.timestamp || 0) - (r.timestamp || 0));
        } catch (o) {
          P("GET /api/snapshots", "Failed reading snapshot directories:", o);
        }
      return m("GET /api/snapshots", `Returning ${e.length} snapshots`), d.end(JSON.stringify(e)), !0;
    }
    if (i.method === "GET" && p === "/api/snapshot-details") {
      const f = b.searchParams.get("timestamp");
      if (!f)
        return d.statusCode = 400, d.end(JSON.stringify({ error: "Missing timestamp" })), !0;
      try {
        const e = M(), o = S.join(e, `snap_${f}`), r = S.join(o, "snapshot_metadata.json");
        if (!l.existsSync(r))
          throw new Error("Snapshot not found");
        const n = JSON.parse(v(r)), t = {};
        if (n.default_grub_backup)
          try {
            v(n.default_grub_backup).split(`
`).forEach((g) => {
              const c = g.trim();
              if (c && !c.startsWith("#") && c.includes("=")) {
                const h = c.indexOf("="), k = c.substring(0, h).trim();
                let y = c.substring(h + 1).trim();
                (y.startsWith('"') && y.endsWith('"') || y.startsWith("'") && y.endsWith("'")) && (y = y.substring(1, y.length - 1)), t[k] = y;
              }
            });
          } catch (a) {
            P("GET /api/snapshot-details", "Failed to read default_grub_backup", a);
          }
        let u = [];
        if (n.bls_entries_backup)
          try {
            u = JSON.parse(v(n.bls_entries_backup));
          } catch (a) {
            P("GET /api/snapshot-details", "Failed to read bls_entries_backup", a);
          }
        let s = [];
        if (n.grub_cfg_backup)
          try {
            const a = v(n.grub_cfg_backup), g = Z(a);
            s = H(g, u);
          } catch (a) {
            P("GET /api/snapshot-details", "Failed to parse snapshot grub_cfg", a);
          }
        d.end(JSON.stringify({ config: t, bootEntries: u, snapEntries: s }));
      } catch (e) {
        d.statusCode = 500, d.end(JSON.stringify({ error: e.message }));
      }
      return !0;
    }
    if (i.method === "POST") {
      let f = "";
      return i.on("data", (e) => {
        f += e;
      }), await new Promise((e) => {
        i.on("end", async () => {
          try {
            const o = f ? JSON.parse(f) : {};
            if (p === "/api/save-grub-config") {
              const { newConfig: r, reason: n, createSnapshot: t } = o;
              if (m("POST /api/save-grub-config", `Saving config (createSnapshot=${t}, reason="${n}")`), r) {
                const u = ["# Updated via GrubEditor GUI"];
                for (const [a, g] of Object.entries(r))
                  u.push(`${a}="${g}"`);
                const s = S.join(U.tmpdir(), `grub-config-${Date.now()}`);
                l.writeFileSync(s, u.join(`
`) + `
`, "utf8");
                try {
                  l.copyFileSync(s, "/etc/default/grub"), l.existsSync(s) && l.unlinkSync(s);
                } catch {
                  try {
                    D(`pkexec /usr/bin/grub-editor-helper cp "${s}" /etc/default/grub && rm -f "${s}"`);
                  } catch (a) {
                    throw console.warn("Failed to copy config via pkexec:", a.message), new Error("Failed to copy config via pkexec: " + a.message);
                  }
                }
                delete _["/etc/default/grub"], delete _["/boot/grub/default"];
              }
              t && V(n || "Modified GRUB general configuration"), d.end(JSON.stringify({ success: !0 })), e();
              return;
            }
            if (p === "/api/save-boot-entries") {
              const { newEntries: r, reason: n, createSnapshot: t } = o;
              if (m("POST /api/save-boot-entries", `Received ${r?.length ?? 0} entries to save (createSnapshot=${t}, reason="${n}")`), r && Array.isArray(r)) {
                const u = r.map((g) => ({ ...g, originalTitle: g.originalTitle || g.title })), s = u.filter((g) => g.deleted).length, a = u.filter((g) => !g.deleted).length;
                m("POST /api/save-boot-entries", `Saving ${u.length} entries (${a} active, ${s} deleted) to ${N()}`), u.forEach((g, c) => {
                  m("POST /api/save-boot-entries", `  [${c}] id="${g.id}" title="${g.title}" origTitle="${g.originalTitle}" deleted=${g.deleted} enabled=${g.enabled}`);
                }), G(N(), JSON.stringify(u, null, 2)), m("POST /api/save-boot-entries", "Write successful");
              }
              t && V(n || "Modified boot menu entries & ordering"), delete _["/boot/grub/grub.cfg"], delete _["/boot/grub2/grub.cfg"], d.end(JSON.stringify({ success: !0 })), e();
              return;
            }
            if (p === "/api/restore-snapshot") {
              const { timestamp: r } = o;
              m("POST /api/restore-snapshot", `Restoring snapshot timestamp ${r}...`);
              const n = M(), t = S.join(n, `snap_${r}`), u = S.join(t, "snapshot_metadata.json");
              if (!l.existsSync(u))
                throw new Error("Snapshot metadata not found for timestamp " + r);
              const s = JSON.parse(v(u));
              V(`Auto-backup before restoring snapshot from ${new Date(r).toLocaleString()}`);
              try {
                const a = process.getuid ? process.getuid() === 0 : !1, g = `/tmp/grub-editor-restore-script-${Date.now()}.sh`;
                let c = `#!/bin/bash
set -e
set -x
`;
                if (s.default_grub_backup && l.existsSync(s.default_grub_backup)) {
                  const $ = l.existsSync("/etc/default/grub") ? "/etc/default/grub" : "/boot/grub/default";
                  c += `cp "${s.default_grub_backup}" "${$}"
chmod 644 "${$}"
`;
                }
                if (s.grub_cfg_backup && l.existsSync(s.grub_cfg_backup)) {
                  const $ = l.existsSync("/boot/grub2/grub.cfg") ? "/boot/grub2/grub.cfg" : "/boot/grub/grub.cfg";
                  c += `cp "${s.grub_cfg_backup}" "${$}"
chmod 644 "${$}"
`;
                }
                const h = N(), k = S.dirname(h);
                c += `mkdir -p "${k}"
chmod 755 "${k}"
`, s.bls_entries_backup && l.existsSync(s.bls_entries_backup) ? c += `cp "${s.bls_entries_backup}" "${h}"
chmod 644 "${h}"
` : c += `echo "[]" > "${h}"
chmod 644 "${h}"
`, l.writeFileSync(g, c, "utf8"), m("POST /api/restore-snapshot", "Executing Batched Restore Script..."), D(`${a ? "bash" : "pkexec"} ${(a ? ["bash", g] : ["/usr/bin/grub-editor-helper", "bash", g]).join(" ")}`, { stdio: "ignore" });
                try {
                  l.existsSync(g) && l.unlinkSync(g);
                } catch {
                }
                delete _["/etc/default/grub"], delete _["/boot/grub/default"], delete _["/boot/grub/grub.cfg"], delete _["/boot/grub2/grub.cfg"], delete _[h], m("POST /api/restore-snapshot", "Restore completed successfully"), d.end(JSON.stringify({ success: !0 }));
              } catch (a) {
                P("POST /api/restore-snapshot", "Restore aborted due to error:", a.message), d.statusCode = 500, d.end(JSON.stringify({ success: !1, error: a.message }));
              }
              e();
              return;
            }
            if (p === "/api/trigger-regen") {
              m("POST /api/trigger-regen", "Starting GRUB regeneration...");
              let r = "";
              try {
                const n = process.getuid ? process.getuid() === 0 : !1, t = n ? "update-grub 2>&1" : "pkexec /usr/bin/grub-editor-helper update-grub 2>&1";
                m("POST /api/trigger-regen", `Running: ${t} (isRoot=${n})`), r = D(t, { encoding: "utf8" }), m("POST /api/trigger-regen", "update-grub completed successfully"), delete _["/boot/grub/grub.cfg"], delete _["/boot/grub2/grub.cfg"];
                try {
                  const u = l.existsSync("/boot/grub2/grub.cfg") ? "/boot/grub2/grub.cfg" : "/boot/grub/grub.cfg";
                  if (l.existsSync(u)) {
                    const s = v(u), a = I();
                    if (m("POST /api/trigger-regen", `Post-regen: ${a.length} overrides to apply to ${u}`), a.length > 0) {
                      const g = a.filter((h) => h.deleted);
                      m("POST /api/trigger-regen", `Overrides breakdown: ${a.length - g.length} active, ${g.length} deleted`);
                      const c = K(s, a);
                      G(u, c), m("POST /api/trigger-regen", "Successfully wrote modified grub.cfg"), r += `
[GrubEditor] Applied custom menu ordering, titles, and exclusions to grub.cfg successfully.`;
                    }
                  }
                } catch (u) {
                  P("POST /api/trigger-regen", "Failed to apply post-regeneration overrides:", u), r += `
[GrubEditor] Warning: Could not apply overrides to grub.cfg: ${u.message}`;
                }
              } catch (n) {
                throw P("POST /api/trigger-regen", "update-grub failed:", n.message), new Error(`Failed to regenerate GRUB configuration: ${n.stdout || n.stderr || n.message}`);
              }
              m("POST /api/trigger-regen", "Regeneration pipeline complete"), d.end(JSON.stringify({ success: !0, output: r })), e();
              return;
            }
            if (p === "/api/deploy-pipeline") {
              const { config: r, bootEntries: n, snapTitle: t } = o;
              m("POST /api/deploy-pipeline", `Starting batched deploy pipeline. snapTitle: ${t}`);
              const u = process.getuid ? process.getuid() === 0 : !1, s = u ? "" : "pkexec /usr/bin/grub-editor-helper ", a = `/tmp/grub-editor-deploy-config-${Date.now()}`, g = `/tmp/grub-editor-deploy-entries-${Date.now()}`;
              let c = "";
              for (const [j, C] of Object.entries(r))
                c += `${j}="${C}"
`;
              l.writeFileSync(a, c);
              const h = (n || []).map((j) => ({ ...j, originalTitle: j.originalTitle || j.title }));
              l.writeFileSync(g, JSON.stringify(h, null, 2));
              const k = Date.now(), y = S.join(M(), `snap_${k}`), w = l.existsSync("/etc/default/grub") ? "/etc/default/grub" : "/boot/grub/default", $ = l.existsSync("/boot/grub2/grub.cfg") ? "/boot/grub2/grub.cfg" : "/boot/grub/grub.cfg", E = N(), x = `/tmp/grub-editor-deploy-script-${Date.now()}.sh`, T = `/tmp/grub-editor-raw-cfg-${Date.now()}`, O = {
                timestamp: k,
                date_string: `${k} (UTC Timestamp)`,
                description: t,
                default_grub_backup: S.join(y, "default_grub.bak"),
                grub_cfg_backup: l.existsSync($) ? S.join(y, "grub.cfg.bak") : null,
                bls_entries_backup: S.join(y, "grub-editor-entries.json.bak")
              }, J = `/tmp/grub-editor-deploy-meta-${Date.now()}`;
              l.writeFileSync(J, JSON.stringify(O, null, 2));
              const F = `/tmp/grub-editor-patched-cfg-${Date.now()}`, q = `#!/bin/bash
set -e
set -x
echo "[Bash Runtime] Stage 1: Applying new GRUB configurations..."
cp "${a}" "${w}"
chmod 644 "${w}"
cp "${g}" "${E}"
chmod 644 "${E}"

echo "[Bash Runtime] Stage 2: Regenerating bootloader via update-grub..."
update-grub 2>&1

echo "[Bash Runtime] Stage 3: Exposing raw configuration for Node.js patching..."
cat "${$}" > "${T}"
chmod 666 "${T}"

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
cp "${F}" "${$}"
chmod 644 "${$}"

echo "[Bash Runtime] Stage 6: Recording final state into snapshot..."
mkdir -p "${y}"
chmod 755 "${y}"
cp "${J}" "${y}/snapshot_metadata.json"
chmod 644 "${y}/snapshot_metadata.json"

if [ -n "${O.default_grub_backup}" ] && [ "${O.default_grub_backup}" != "null" ] && [ -f "${w}" ]; then cp "${w}" "${O.default_grub_backup}"; chmod 644 "${O.default_grub_backup}"; fi
if [ -n "${O.grub_cfg_backup}" ] && [ "${O.grub_cfg_backup}" != "null" ] && [ -f "${$}" ]; then cp "${$}" "${O.grub_cfg_backup}"; chmod 644 "${O.grub_cfg_backup}"; fi
if [ -n "${O.bls_entries_backup}" ] && [ "${O.bls_entries_backup}" != "null" ] && [ -f "${E}" ]; then cp "${E}" "${O.bls_entries_backup}"; chmod 644 "${O.bls_entries_backup}"; fi

echo "[Bash Runtime] Execution completed successfully!"
`;
              l.writeFileSync(x, q), m("POST /api/deploy-pipeline", "Executing Batched Deploy Script Asynchronously...");
              try {
                const j = await new Promise((C, z) => {
                  let A = "";
                  const B = se(u ? "bash" : "pkexec", u ? ["bash", x] : ["/usr/bin/grub-editor-helper", "bash", x]);
                  B.stdout.on("data", (R) => {
                    A += R.toString();
                  }), B.stderr.on("data", (R) => {
                    A += R.toString();
                  }), B.on("close", (R) => {
                    R === 0 ? C(A) : z(new Error(`Exit code ${R}:
${A}`));
                  }), B.on("error", (R) => {
                    z(new Error(`Spawn error: ${R.message}
${A}`));
                  });
                  const ee = setInterval(() => {
                    if (l.existsSync(T)) {
                      clearInterval(ee), m("POST /api/deploy-pipeline", "Detected raw config. Applying overrides...");
                      try {
                        const R = l.readFileSync(T, "utf8"), te = K(R, h);
                        l.writeFileSync(F, te);
                      } catch (R) {
                        P("POST /api/deploy-pipeline", "Failed to patch config:", R.message);
                      }
                    }
                  }, 500);
                });
                [a, g, J, x, T, F].forEach((C) => {
                  try {
                    l.existsSync(C) && l.unlinkSync(C);
                  } catch {
                  }
                }), delete _["/boot/grub/grub.cfg"], delete _["/boot/grub2/grub.cfg"], delete _["/etc/default/grub"], m("POST /api/deploy-pipeline", "Deployment pipeline complete"), d.end(JSON.stringify({ success: !0, output: j })), e();
                return;
              } catch (j) {
                throw [a, g, J, x, T, F].forEach((C) => {
                  try {
                    l.existsSync(C) && l.unlinkSync(C);
                  } catch {
                  }
                }), P("POST /api/deploy-pipeline", "Deploy pipeline failed:", j.message), new Error(`Failed during deployment:
${j.message}`);
              }
            }
            d.end(JSON.stringify({ success: !0 })), e();
          } catch (o) {
            d.statusCode = 500, d.end(JSON.stringify({ error: o.message })), e();
          }
        });
      }), !0;
    }
    return !1;
  } catch (b) {
    return console.error("GrubBackend error:", b), d.statusCode = 500, d.end(JSON.stringify({ error: b.message || "Internal Server Error" })), !0;
  }
}
const L = S.dirname(re(import.meta.url));
W.commandLine.appendSwitch("no-sandbox");
W.commandLine.appendSwitch("disable-gpu-sandbox");
function X() {
  const i = l.existsSync(S.join(L, "preload.mjs")) ? S.join(L, "preload.mjs") : S.join(L, "preload.js"), d = new Y({
    width: 1280,
    height: 860,
    minWidth: 1024,
    minHeight: 768,
    title: "GrubEditor - Pro Bootloader Studio",
    backgroundColor: "#050811",
    icon: S.join(L, "../public/app_logo.png"),
    webPreferences: {
      preload: i,
      nodeIntegration: !1,
      contextIsolation: !0
    }
  });
  if (d.setMenuBarVisibility(!1), ne.setApplicationMenu(null), d.webContents.on("console-message", (b, p, f, e, o) => {
    console.log(`[Renderer Console] [level ${p}] ${f} (${o}:${e})`);
  }), d.webContents.on("did-fail-load", (b, p, f, e) => {
    console.error(`[Renderer Fail Load] (${p}) ${f} - ${e}`);
  }), d.webContents.on("render-process-gone", (b, p) => {
    console.error(`[Renderer Process Gone] ${p.reason} - exitCode: ${p.exitCode}`);
  }), process.env.VITE_DEV_SERVER_URL)
    d.loadURL(process.env.VITE_DEV_SERVER_URL);
  else {
    const b = S.join(L, "../dist"), p = ie.createServer(async (e, o) => {
      try {
        if (!await oe(e, o)) {
          const n = new URL(e.url || "/", `http://${e.headers.host || "localhost"}`);
          let t = S.join(b, n.pathname === "/" ? "index.html" : n.pathname);
          l.existsSync(t) || (t = S.join(b, "index.html"));
          const u = S.extname(t).toLowerCase(), a = {
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
          o.writeHead(200, { "Content-Type": a }), l.createReadStream(t).pipe(o);
        }
      } catch (r) {
        o.writeHead(500, { "Content-Type": "application/json" }), o.end(JSON.stringify({ error: r.message || "Internal Server Error" }));
      }
    }), f = (e) => {
      p.listen(e, "127.0.0.1", () => {
        const o = p.address().port;
        d.loadURL(`http://127.0.0.1:${o}`);
      });
    };
    p.on("error", (e) => {
      e.code === "EADDRINUSE" && (console.warn("Port 31415 occupied, retrying with ephemeral loopback port..."), p.close(), f(0));
    }), f(31415), d.on("closed", () => {
      try {
        p.close();
      } catch {
      }
    });
  }
}
W.whenReady().then(() => {
  X(), W.on("activate", () => {
    Y.getAllWindows().length === 0 && X();
  });
});
W.on("window-all-closed", () => {
  process.platform !== "darwin" && W.quit();
});
