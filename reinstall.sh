#!/usr/bin/env bash
set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$SCRIPT_DIR"

echo "Uninstalling GrubEditor..."
if [ "$EUID" -ne 0 ]; then
    sudo ./uninstall.sh
else
    ./uninstall.sh
fi

echo "Reinstalling GrubEditor..."
if [ "$EUID" -ne 0 ]; then
    sudo ./install.sh
else
    ./install.sh
fi

echo "GrubEditor reinstallation complete!"
clear
