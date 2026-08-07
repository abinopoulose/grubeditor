#!/usr/bin/env bash
set -e

if [ "$EUID" -ne 0 ]; then
    echo "Please run as root: sudo ./install.sh"
    exit 1
fi

echo "Installing GrubEditor..."
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

# Install dependencies
apt-get update -qq
apt-get install -y -qq libwebkit2gtk-4.1-0 policykit-1 || apt-get install -y -qq libwebkit2gtk-4.0-37 policykit-1

# Copy PolicyKit and Desktop files
install -m 0644 "${SCRIPT_DIR}/packaging/io.grubeditor.helper.policy" "/usr/share/polkit-1/actions/io.grubeditor.helper.policy"
install -m 0644 "${SCRIPT_DIR}/packaging/grubeditor.desktop" "/usr/share/applications/grubeditor.desktop"
install -m 0644 "${SCRIPT_DIR}/public/app_logo.png" "/usr/share/icons/hicolor/scalable/apps/grubeditor.png"
install -m 0755 -o root -g root "${SCRIPT_DIR}/packaging/grub-editor-helper" "/usr/bin/grub-editor-helper"

# Create execution wrapper
cat << EOF > "/usr/bin/grubeditor"
#!/usr/bin/env bash
# If invoked via sudo, drop privileges back to the actual user
if [ "\$EUID" -eq 0 ] && [ -n "\${SUDO_USER:-}" ] && [ "\$SUDO_USER" != "root" ]; then
    exec sudo -u "\$SUDO_USER" -E bash "\$0" "\$@"
fi

# Resolve Node.js environment paths for GNOME App Drawer launches
if ! command -v node >/dev/null 2>&1; then
    if [ -f "\$HOME/.bashrc" ]; then
        source "\$HOME/.bashrc" >/dev/null 2>&1 || true
    fi
fi

for dir in "\$HOME"/.nvm/versions/node/*/bin "\$HOME"/.local/share/fnm "\$HOME"/.asdf/shims "\$HOME"/.local/bin; do
    if [ -d "\$dir" ]; then
        export PATH="\$dir:\$PATH"
    fi
done

cd "${SCRIPT_DIR}"
if [ -x "./node_modules/.bin/electron" ]; then
    exec ./node_modules/.bin/electron . --no-sandbox "\$@"
else
    exec npx electron . --no-sandbox "\$@"
fi
EOF
chmod 0755 "/usr/bin/grubeditor"

update-desktop-database -q /usr/share/applications || true
gtk-update-icon-cache -f -t /usr/share/icons/hicolor/ || true

echo "GrubEditor installed successfully!"
