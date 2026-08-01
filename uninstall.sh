#!/usr/bin/env bash
# ==============================================================================
# GrubEditor - System Uninstaller & Cleanup Script
# Usage: sudo ./uninstall.sh
# ==============================================================================

set -euo pipefail

RED='\033[0;31m'
GREEN='\033[0;32m'
CYAN='\033[0;36m'
BOLD='\033[1m'
NC='\033[0m'

if [ "$EUID" -ne 0 ]; then
    echo -e "Please run the uninstaller as root: ${CYAN}sudo ./uninstall.sh${NC}"
    exit 1
fi

echo -e "${CYAN}==>${NC} ${BOLD}Removing GrubEditor system binaries, desktop launchers, and PolicyKit authorizations...${NC}"

rm -f /usr/bin/grubeditor
rm -f /usr/bin/grub-editor-helper
rm -f /usr/share/polkit-1/actions/io.grubeditor.helper.policy
rm -f /usr/share/applications/grubeditor.desktop
rm -f /usr/share/icons/hicolor/scalable/apps/grubeditor.svg
rm -rf /usr/lib/grubeditor

if command -v update-desktop-database >/dev/null 2>&1; then
    update-desktop-database -q /usr/share/applications 2>/dev/null || true
fi
if command -v gtk-update-icon-cache >/dev/null 2>&1; then
    gtk-update-icon-cache -f -t /usr/share/icons/hicolor/ 2>/dev/null || true
fi

echo -e "${GREEN}✓ GrubEditor has been completely uninstalled and removed from your Linux system.${NC}"
echo -e "Note: Historical recovery backups stored in /var/lib/grub-editor/backups/ were preserved for your safety. To delete them, run: rm -rf /var/lib/grub-editor/"
