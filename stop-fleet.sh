#!/usr/bin/env bash
# Stop and remove the freqtrade fleet pod (keeps volumes / user_data intact).
set -euo pipefail
POD_NAME="ft-fleet"
if podman pod exists "${POD_NAME}"; then
    podman pod stop "${POD_NAME}"
    podman pod rm   "${POD_NAME}"
    echo "Pod ${POD_NAME} stopped and removed."
else
    echo "Pod ${POD_NAME} not found."
fi
