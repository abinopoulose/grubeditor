#!/usr/bin/env bash
set -e

if [ "$EUID" -ne 0 ]; then
    echo "Please run as root: sudo ./install_local_build.sh"
    exit 1
fi

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$SCRIPT_DIR"

echo "Building GrubEditor locally..."

# Ensure C compiler is installed for Rust
if ! command -v cc &> /dev/null; then
    echo "C compiler not found. Installing build-essential..."
    apt-get update
    DEBIAN_FRONTEND=noninteractive apt-get install -y build-essential
fi

# Drop root privileges for building steps
if [ -n "${SUDO_USER:-}" ] && [ "$SUDO_USER" != "root" ]; then
    sudo -u "$SUDO_USER" bash -c "
        [ -f \"\$HOME/.bashrc\" ] && source \"\$HOME/.bashrc\" 2>/dev/null || true
        [ -f \"\$HOME/.nvm/nvm.sh\" ] && source \"\$HOME/.nvm/nvm.sh\" 2>/dev/null
        [ -f \"\$HOME/.cargo/env\" ] && source \"\$HOME/.cargo/env\" 2>/dev/null
        export PATH=\"\$HOME/.local/bin:\$HOME/.cargo/bin:\$PATH\"
        cd \"$SCRIPT_DIR\"
        npm ci
        cd src-tauri && cargo build --release -p grub-editor-helper && cd ..
        npm run build:electron -- -l dir
    "
else
    npm ci
    cd src-tauri && cargo build --release -p grub-editor-helper && cd ..
    npm run build:electron -- -l dir
fi

echo "Installing files..."
rm -rf /opt/grubeditor
cp -r release/linux-unpacked /opt/grubeditor

mkdir -p /var/lib/grub-editor/backups
chmod 755 /var/lib/grub-editor/backups

install -m 0644 packaging/io.grubeditor.helper.policy "/usr/share/polkit-1/actions/io.grubeditor.helper.policy"
install -m 0644 packaging/grubeditor.desktop "/usr/share/applications/grubeditor.desktop"
install -m 0644 public/app_logo.png "/usr/share/icons/hicolor/scalable/apps/grubeditor.png"
install -m 0755 -o root -g root src-tauri/target/release/grub-editor-helper "/usr/bin/grub-editor-helper"

# Create execution wrapper
cat << 'EOF' > "/usr/bin/grubeditor"
#!/usr/bin/env bash
# If invoked via sudo, drop privileges back to the actual user
if [ "$EUID" -eq 0 ] && [ -n "${SUDO_USER:-}" ] && [ "$SUDO_USER" != "root" ]; then
    exec sudo -u "$SUDO_USER" -E bash "$0" "$@"
fi

exec /opt/grubeditor/grub-editor --no-sandbox "$@"
EOF

chmod 0755 "/usr/bin/grubeditor"

update-desktop-database -q /usr/share/applications || true
gtk-update-icon-cache -f -t /usr/share/icons/hicolor/ || true

echo "Local build installed successfully!"
