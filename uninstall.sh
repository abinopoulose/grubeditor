#!/usr/bin/env bash
set -e

if [ "$EUID" -ne 0 ]; then
    echo "Please run as root: sudo ./uninstall.sh"
    exit 1
fi

echo "Uninstalling GrubEditor..."

rm -rf /opt/grubeditor
rm -f /usr/bin/grubeditor
rm -f /usr/bin/grub-editor-helper
rm -f /usr/share/polkit-1/actions/io.grubeditor.helper.policy
rm -f /usr/share/applications/grubeditor.desktop
rm -f /usr/share/icons/hicolor/scalable/apps/grubeditor.png

update-desktop-database -q /usr/share/applications || true
gtk-update-icon-cache -f -t /usr/share/icons/hicolor/ || true

echo "GrubEditor uninstalled successfully!"
