# GrubEditor ⚡

[![GitHub release](https://img.shields.io/github/v/release/abinopoulose/grubeditor?style=flat-square&color=06b6d4)](https://github.com/abinopoulose/grubeditor/releases)
[![Wayland Native](https://img.shields.io/badge/Wayland-Native-10b981?style=flat-square)](https://wayland.freedesktop.org/)
[![PolicyKit Secured](https://img.shields.io/badge/Polkit-Zero_Root_GUI-3b82f6?style=flat-square)](https://github.com/abinopoulose/grubeditor)
[![License: MIT](https://img.shields.io/badge/License-MIT-f59e0b?style=flat-square)](https://opensource.org/licenses/MIT)

**GrubEditor** is a modern, distribution-aware, and Wayland-safe Linux GRUB bootloader customization desktop application built with **Tauri v2 (Rust)** and **React + Tailwind CSS**. It eliminates legacy shell-script mangling, prevents boot failures with an automated theme verification engine, and guarantees system recoverability via atomic configuration snapshots.

---

## 🚀 One-Command Ubuntu & Debian Installation

You can install and integrate GrubEditor into your Ubuntu or Debian desktop using a single terminal command:

```bash
curl -sSL https://raw.githubusercontent.com/abinopoulose/grubeditor/refs/heads/dev/install.sh | sudo bash
```
*(Or if you have cloned this repository locally, run: `sudo ./install.sh`)*

Once complete, open your **GNOME / Ubuntu Application Overview** and search for **GrubEditor**, or simply type `grubeditor` in any terminal! You **never** need to run `sudo grubeditor`—our privileged helper elevates safely when applying modifications!

To uninstall completely at any time, run:
```bash
curl -sSL https://raw.githubusercontent.com/abinopoulose/grubeditor/refs/heads/dev/uninstall.sh | sudo bash
```

---

## ✨ Why GrubEditor?

Legacy tools like GRUB Customizer create fragile wrapper scripts in `/etc/grub.d/` and demand running graphical X11 apps as root (`sudo`), which breaks modern Wayland sessions and frequently causes GRUB to fall back to an unstyled text console during OS boot.

| Feature | Legacy Tools | GrubEditor ⚡ |
| :--- | :--- | :--- |
| **Wayland & Compositor Safety** | ❌ Fails under sudo GUI block | ✅ Runs under normal user session via Polkit daemon |
| **Config Editing Engine** | ❌ Mangles `/etc/grub.d/` scripts | ✅ Non-destructive AST parser preserves comments in `/etc/default/grub` |
| **Theme Verification** | ❌ None (Boot screen flickers or breaks) | ✅ Pre-checks bitmap fonts (`.pf2`), resolutions, and directory permissions |
| **Interactive Boot Previewer** | ❌ None | ✅ Live interactive boot monitor simulator with keyboard arrow test |
| **Rollback Shield** | ❌ Manual recovery required | ✅ Automatic timestamped snapshots & one-click fallback |

---

## 💻 Developer & Local Testing Quickstart

To experience the interactive visual desktop experience immediately in your browser simulation mode without root modification permissions:

```bash
# Clone the repository
git clone https://github.com/abinopoulose/grubeditor.git
cd grubeditor

# Launch simulated browser UI
npm run dev

# Or launch as a native desktop application (requires Rust toolchain)
npm run tauri dev
```

---

## 🔒 Security Architecture (Zero Root GUI)

GrubEditor isolates all administrative tasks (`/boot` writes, theme installations, and `update-grub` generator executions) into a privileged command-line helper daemon (`grub-editor-helper`) securely authorized through PolicyKit (`io.grubeditor.helper.policy`). Your React GUI operates completely unprivileged in userspace.

---
*Built by [abinopoulose](https://github.com/abinopoulose) • Licensed under MIT*
