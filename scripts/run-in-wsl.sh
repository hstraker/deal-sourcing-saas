#!/bin/bash
# Helper script to run commands in WSL from Windows
# Usage: wsl bash scripts/run-in-wsl.sh "command to run"

cd /mnt/c/Users/henry/Projects/deal-sourcing-saas
eval "$@"

