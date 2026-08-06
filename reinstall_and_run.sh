#!/usr/bin/env bash
# ==============================================================================
# GrubEditor - Uninstall, Reinstall, and Launch Script
# Usage: ./reinstall_and_run.sh
# ==============================================================================

set -euo pipefail

CYAN='\033[0;36m'
GREEN='\033[0;32m'
BOLD='\033[1m'
NC='\033[0m'

# Get the directory where this script is located
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$SCRIPT_DIR"

echo -e "${CYAN}==>${NC} ${BOLD}Step 1: Uninstalling existing GrubEditor installation...${NC}"
if [ "$EUID" -ne 0 ]; then
    sudo ./uninstall.sh
else
    ./uninstall.sh
fi

echo -e "${CYAN}==>${NC} ${BOLD}Step 2: Reinstalling GrubEditor...${NC}"
if [ "$EUID" -ne 0 ]; then
    sudo ./install.sh
else
    ./install.sh
fi

echo -e "${GREEN}${BOLD}✓ Uninstallation and Reinstallation Complete!${NC}"
echo -e "${CYAN}==>${NC} ${BOLD}Step 3: Launching GrubEditor...${NC}\n"

# Launch grubeditor under normal user privileges (drop root if invoked with sudo)
if [ "$EUID" -eq 0 ] && [ -n "${SUDO_USER:-}" ]; then
    exec sudo -u "$SUDO_USER" -E grubeditor "$@"
else
    exec grubeditor "$@"
fi
