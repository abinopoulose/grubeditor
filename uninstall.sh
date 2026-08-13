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

response="N"
if [ -t 0 ]; then
    read -p "Do you want to delete all cached or created files made by GrubEditor? (y/N): " -r response
elif [ -c /dev/tty ]; then
    read -p "Do you want to delete all cached or created files made by GrubEditor? (y/N): " -r response < /dev/tty
else
    echo "Non-interactive environment detected, keeping cached files."
fi
if [[ "$response" =~ ^[Yy]$ ]]; then
    echo "Deleting cached and created files..."
    rm -rf /var/lib/grub-editor
    # Delete from all user homes
    for user_home in /home/* /root; do
        if [ -d "$user_home" ]; then
            rm -rf "$user_home/.config/GrubEditor"
            rm -rf "$user_home/.local/share/GrubEditor"
            rm -rf "$user_home/.cache/GrubEditor"
        fi
    done
    echo "Files deleted."
else
    echo "Keeping cached and created files."
fi

echo "GrubEditor uninstalled successfully!"
