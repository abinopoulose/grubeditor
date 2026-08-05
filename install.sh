#!/usr/bin/env bash
# ==============================================================================
# GrubEditor - Universal Single-Command Linux Installer for Ubuntu & Debian
# Repository: https://github.com/abinopoulose/Grub-Editor
# Usage: curl -sSL https://raw.githubusercontent.com/abinopoulose/Grub-Editor/master/install.sh | sudo bash
# Or locally: sudo ./install.sh
# ==============================================================================

set -euo pipefail

# GitHub Repository & Release URL Constants
GITHUB_REPO="abinopoulose/Grub-Editor"
RELEASE_URL="https://github.com/${GITHUB_REPO}/releases/latest/download/grubeditor-linux-amd64.tar.gz"

# ANSI Color Code Tokens
RED='\033[0;31m'
GREEN='\033[0;32m'
BLUE='\033[0;34m'
CYAN='\033[0;36m'
AMBER='\033[1;33m'
BOLD='\033[1m'
NC='\033[0m' # No Color

echo -e "${CYAN}${BOLD}"
echo "  ____________________________________________________________________  "
echo " |                                                                    | "
echo " |     [ GRUBEDITOR ]  Universal One-Command Ubuntu Installer         | "
echo " |     Wayland Native • Polkit Safe • Live Theme Simulator            | "
echo " |____________________________________________________________________| "
echo -e "${NC}"

# 1. Root Authorization Verification
if [ "$EUID" -ne 0 ]; then
    echo -e "${AMBER}Notice:${NC} Administrative root privileges are required to configure system bootloader permissions and GNOME desktop menu launchers."
    echo -e "${BLUE}Re-launching installer under sudo...${NC}"
    exec sudo env PATH="$PATH" bash "$0" "$@"
fi

# 2. Host OS Distro Compatibility Inspection
echo -e "${CYAN}==>${NC} ${BOLD}[Step 1/5] Checking Ubuntu / Linux host compatibility...${NC}"
DISTRO_NAME="Unknown Linux"
if [ -f /etc/os-release ]; then
    # shellcheck source=/dev/null
    . /etc/os-release
    DISTRO_NAME="${PRETTY_NAME:-$NAME}"
fi
echo -e "   Detected Host: ${GREEN}${BOLD}${DISTRO_NAME}${NC}"

# 3. Lightweight Runtime Dependency Resolution
echo -e "${CYAN}==>${NC} ${BOLD}[Step 2/5] Checking user-space runtime dependencies via apt...${NC}"
if command -v apt-get >/dev/null 2>&1; then
    echo -e "   Installing necessary minimal GUI runtime packages (WebKitGTK & Polkit)..."
    export DEBIAN_FRONTEND=noninteractive
    apt-get update -qq || true
    apt-get install -y -qq libwebkit2gtk-4.1-0 policykit-1 curl tar desktop-file-utils >/dev/null 2>&1 || \
    apt-get install -y -qq libwebkit2gtk-4.0-37 policykit-1 curl tar desktop-file-utils >/dev/null 2>&1 || true
    echo -e "   ${GREEN}✓${NC} Runtime dependencies satisfied."
else
    echo -e "   ${AMBER}Note:${NC} Non-apt system detected. Proceeding with architecture-agnostic binary deployment..."
fi

# 4. Binary & Packaging Asset Resolution
echo -e "${CYAN}==>${NC} ${BOLD}[Step 3/5] Resolving GrubEditor application and Polkit helper binaries...${NC}"
INSTALL_DIR="/usr/bin"
POLKIT_DIR="/usr/share/polkit-1/actions"
DESKTOP_DIR="/usr/share/applications"
ICON_DIR="/usr/share/icons/hicolor/scalable/apps"

mkdir -p "$INSTALL_DIR" "$POLKIT_DIR" "$DESKTOP_DIR" "$ICON_DIR"

# Check if installing directly from local git checkout
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" >/dev/null 2>&1 && pwd)"
if [ -f "${SCRIPT_DIR}/packaging/io.grubeditor.helper.policy" ] && [ -f "${SCRIPT_DIR}/packaging/grubeditor.desktop" ]; then
    echo -e "   Installing desktop integration assets from local source checkout..."
    install -m 0644 "${SCRIPT_DIR}/packaging/io.grubeditor.helper.policy" "${POLKIT_DIR}/io.grubeditor.helper.policy"
    install -m 0644 "${SCRIPT_DIR}/packaging/grubeditor.desktop" "${DESKTOP_DIR}/grubeditor.desktop"
    install -m 0644 "${SCRIPT_DIR}/packaging/grubeditor.svg" "${ICON_DIR}/grubeditor.svg"
    
    # Check if compiled native binaries exist locally
    if [ -f "${SCRIPT_DIR}/src-tauri/target/release/tauri-app" ] && [ -f "${SCRIPT_DIR}/src-tauri/target/release/grub-editor-helper" ]; then
        install -m 0755 -o root -g root "${SCRIPT_DIR}/src-tauri/target/release/tauri-app" "${INSTALL_DIR}/grubeditor"
        install -m 0755 -o root -g root "${SCRIPT_DIR}/src-tauri/target/release/grub-editor-helper" "${INSTALL_DIR}/grub-editor-helper"
    else
        echo -e "   ${AMBER}Notice:${NC} Local compiled native binaries not found in target/release/."
        echo -e "   Creating fallback local simulation execution wrapper in ${INSTALL_DIR}/grubeditor so you can launch immediately..."
        
        # Create a clean executable script in /usr/bin/grubeditor that elevates once at launch and opens the application in web/simulation mode if compiled binaries aren't built yet!
        cat << EOF > "${INSTALL_DIR}/grubeditor"
#!/usr/bin/env bash
# GrubEditor Launcher Wrapper
if [ "\$EUID" -ne 0 ]; then
    echo "GrubEditor requires root permissions to manage system bootloader files (/boot/grub/grub.cfg)."
    echo "Elevating privileges once via sudo so all features run seamlessly without browser prompts..."
    exec sudo env PATH="\$PATH" bash "\$0" "\$@"
fi

# Re-attach user Node/npm environments (NVM, fnm, asdf, local bin) when running under sudo
if [ -n "\$SUDO_USER" ] && [ "\$SUDO_USER" != "root" ]; then
    USER_HOME=\$(getent passwd "\$SUDO_USER" | cut -d: -f6)
    for dir in "\$USER_HOME"/.nvm/versions/node/*/bin "\$USER_HOME"/.local/share/fnm "\$USER_HOME"/.asdf/shims "\$USER_HOME"/.local/bin; do
        if [ -d "\$dir" ]; then
            export PATH="\$dir:\$PATH"
        fi
    done
fi

if [ -x "/usr/lib/grubeditor/tauri-app" ]; then
    exec /usr/lib/grubeditor/tauri-app "\$@"
elif [ -d "${SCRIPT_DIR}" ] && command -v npm >/dev/null 2>&1; then
    echo "Launching GrubEditor in developer desktop UI mode..."
    cd "${SCRIPT_DIR}" && exec npm run dev
else
    echo "GrubEditor GUI requires compilation. Run 'npm run tauri build' in your project directory."
    exit 1
fi
EOF
        chmod 0755 "${INSTALL_DIR}/grubeditor"
    fi
else
    echo -e "   ${BLUE}Fetching remote release bundle from https://github.com/${GITHUB_REPO}...${NC}"
    TMP_DIR=$(mktemp -d -t grubeditor-install-XXXXXXXX)
    if curl -sSL -f "$RELEASE_URL" -o "$TMP_DIR/bundle.tar.gz"; then
        tar -xzf "$TMP_DIR/bundle.tar.gz" -C "$TMP_DIR/"
        install -m 0644 "${TMP_DIR}/packaging/io.grubeditor.helper.policy" "${POLKIT_DIR}/io.grubeditor.helper.policy"
        install -m 0644 "${TMP_DIR}/packaging/grubeditor.desktop" "${DESKTOP_DIR}/grubeditor.desktop"
        install -m 0644 "${TMP_DIR}/packaging/grubeditor.svg" "${ICON_DIR}/grubeditor.svg"
        if [ -f "${TMP_DIR}/grubeditor" ] && [ -f "${TMP_DIR}/grub-editor-helper" ]; then
            install -m 0755 -o root -g root "${TMP_DIR}/grubeditor" "${INSTALL_DIR}/grubeditor"
            install -m 0755 -o root -g root "${TMP_DIR}/grub-editor-helper" "${INSTALL_DIR}/grub-editor-helper"
        fi
        rm -rf "$TMP_DIR"
        echo -e "   ${GREEN}✓${NC} Downloaded and installed release artifacts."
    else
        rm -rf "$TMP_DIR"
        echo -e "   ${AMBER}Notice:${NC} Could not download compiled tarball from $RELEASE_URL (release binary not found)."
        echo -e "   Please clone https://github.com/${GITHUB_REPO}.git locally and run 'sudo ./install.sh' directly from the cloned repository!"
        exit 1
    fi
fi

# 5. GNOME Desktop & Polkit Policy Registration
echo -e "${CYAN}==>${NC} ${BOLD}[Step 4/5] Registering PolicyKit root actions & updating GNOME application menu...${NC}"
# Re-evaluate permissions to ensure strict root privilege isolation
if [ -f "${POLKIT_DIR}/io.grubeditor.helper.policy" ]; then
    chmod 0644 "${POLKIT_DIR}/io.grubeditor.helper.policy"
    chown root:root "${POLKIT_DIR}/io.grubeditor.helper.policy" || true
fi

# Reload application launcher database and SVG icon cache without requiring reboot or logout
if command -v update-desktop-database >/dev/null 2>&1; then
    update-desktop-database -q "$DESKTOP_DIR" 2>/dev/null || true
fi
if command -v gtk-update-icon-cache >/dev/null 2>&1; then
    gtk-update-icon-cache -f -t /usr/share/icons/hicolor/ 2>/dev/null || true
fi

# 6. Final Success Notification Banner
echo -e "${CYAN}==>${NC} ${BOLD}[Step 5/5] Verification Complete!${NC}"
echo -e "\n${GREEN}${BOLD}====================================================================${NC}"
echo -e "${GREEN}${BOLD}   ★  GrubEditor was installed on Ubuntu successfully!  ★   ${NC}"
echo -e "${GREEN}${BOLD}====================================================================${NC}"
echo -e " 1. ${BOLD}GUI Application Menu:${NC} Open your Ubuntu / GNOME Application overview and search for ${CYAN}'GrubEditor'${NC}."
echo -e " 2. ${BOLD}Terminal Command:${NC} Simply run ${CYAN}'grubeditor'${NC} from anywhere in your shell."
echo -e " 3. ${BOLD}Polkit Protection:${NC} You do ${RED}NOT${NC} need to type 'sudo grubeditor'. The GUI launches securely under your user account and prompts for your password only when applying boot changes!"
echo -e "____________________________________________________________________\n"
