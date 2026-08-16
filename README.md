# GrubEditor ⚡

[![GitHub release](https://img.shields.io/github/v/release/abinopoulose/grubeditor?style=flat-square&color=06b6d4)](https://github.com/abinopoulose/grubeditor/releases)
[![Wayland Native](https://img.shields.io/badge/Wayland-Native-10b981?style=flat-square)](https://wayland.freedesktop.org/)
[![PolicyKit Secured](https://img.shields.io/badge/Polkit-Zero_Root_GUI-3b82f6?style=flat-square)](https://github.com/abinopoulose/grubeditor)

A modern, distribution-aware, and Wayland-safe Linux GRUB bootloader customization app. 

**GrubEditor** eliminates legacy shell-script mangling, prevents boot failures with an automated theme verification engine, and guarantees system recoverability via atomic configuration snapshots. Built securely with **Tauri v2 (Rust)** and **React**.

---

## 📦 Install

```bash
curl -sSL https://raw.githubusercontent.com/abinopoulose/grubeditor/refs/heads/dev/scripts/install.sh | sudo bash
```

## 🧹 Uninstall

```bash
curl -sSL https://raw.githubusercontent.com/abinopoulose/grubeditor/refs/heads/dev/scripts/uninstall.sh | sudo bash
```

---

## ✨ Key Features

- **Safe for Modern Linux**: Works perfectly on Wayland without requiring you to run the app as root.
- **Keeps Your Comments**: Safely edits your boot settings without deleting your existing notes in `/etc/default/grub`.
- **Smart Theme Checks**: Automatically checks fonts, screen sizes, and file permissions before applying a theme to prevent boot issues.
- **Live Preview**: See exactly what your boot menu will look like before you save it.
- **Easy Recovery**: Automatically saves backups of your settings so you can undo mistakes with a single click.

---
*Built by [abinopoulose](https://github.com/abinopoulose) • Licensed under the [GNU General Public License v3.0](LICENSE)*
