#!/usr/bin/env bash
set -e

if [ "$EUID" -ne 0 ]; then
    echo "Please run as root. You can run this command directly:"
    echo "sudo curl -sSL https://raw.githubusercontent.com/abinopoulose/grubeditor/dev/install.sh | sudo bash"
    exit 1
fi

echo "Installing GrubEditor..."

# Determine latest release URL
LATEST_RELEASE_URL="https://github.com/abinopoulose/grubeditor/releases/download/latest/grubeditor.tar.gz"
TMP_DIR=$(mktemp -d)

echo "Downloading latest build from GitHub..."
curl -sSL "$LATEST_RELEASE_URL" -o "$TMP_DIR/grubeditor.tar.gz"

echo "Extracting release payload..."
cd "$TMP_DIR"
tar -xzf grubeditor.tar.gz

echo "Installing files to system directories..."
# Remove old install if exists
rm -rf /opt/grubeditor
mv grubeditor /opt/grubeditor

install -m 0644 packaging/io.grubeditor.helper.policy "/usr/share/polkit-1/actions/io.grubeditor.helper.policy"
install -m 0644 packaging/grubeditor.desktop "/usr/share/applications/grubeditor.desktop"
install -m 0644 public/app_logo.png "/usr/share/icons/hicolor/scalable/apps/grubeditor.png"
install -m 0755 -o root -g root packaging/grub-editor-helper "/usr/bin/grub-editor-helper"

# Create execution wrapper
cat << 'EOF' > "/usr/bin/grubeditor"
#!/usr/bin/env bash
# If invoked via sudo, drop privileges back to the actual user
if [ "$EUID" -eq 0 ] && [ -n "${SUDO_USER:-}" ] && [ "$SUDO_USER" != "root" ]; then
    exec sudo -u "$SUDO_USER" -E bash "$0" "$@"
fi

# We run the grub-editor executable without a sandbox
exec /opt/grubeditor/grub-editor --no-sandbox "$@"
EOF
chmod 0755 "/usr/bin/grubeditor"

update-desktop-database -q /usr/share/applications || true
gtk-update-icon-cache -f -t /usr/share/icons/hicolor/ || true

rm -rf "$TMP_DIR"

echo "GrubEditor installed successfully!"
echo "You can launch it from your application menu or by running 'grubeditor' in the terminal."
