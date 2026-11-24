#!/usr/bin/env bash
# =============================================================================
# Freqtrade multi-bot fleet + FreqUI dashboard, all inside ONE podman pod.
#
# Pod network = shared namespace, so each bot must listen on a UNIQUE port.
# All ports + dashboard published to host loopback only.
#
#   Bot 1 NexusForge (FreqAI) ........... 127.0.0.1:9020
#   Bot 2 ECRV31 (DCA) .................. 127.0.0.1:9060
#   Bot 3 BandSniperV6431 (sniper) ...... 127.0.0.1:9050
#   Bot 4 ECRV2 (legacy DCA, OPTIONAL) .. 127.0.0.1:9061  (set START_BOT4=1)
#   FreqUI dashboard .................... http://127.0.0.1:8500
#
# Inside the pod every container reaches the others via 127.0.0.1.
# In FreqUI add bots as: http://127.0.0.1:9020 / :9060 / :9050 / :9061
# =============================================================================
set -euo pipefail

POD_NAME="ft-fleet"
PROJECT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
USER_DATA="${PROJECT_DIR}/user_data"
START_BOT4="${START_BOT4:-0}"

FT_FREQAI_IMAGE="freqtradeorg/freqtrade:stable_freqai"
FT_IMAGE="freqtradeorg/freqtrade:stable"
FREQUI_IMAGE="freqtradeorg/frequi:latest"

# ---- sanity ----------------------------------------------------------------
command -v podman >/dev/null || { echo "podman not installed"; exit 1; }
mkdir -p "${USER_DATA}/logs" "${USER_DATA}/data" "${USER_DATA}/freqaimodels"

REQUIRED=(AlexNexusForgeV8AI.py ECRV31.py AlexBandSniperV6431.py)
[[ "${START_BOT4}" == "1" ]] && REQUIRED+=(ECRV2.py)
for s in "${REQUIRED[@]}"; do
    [[ -f "${USER_DATA}/strategies/${s}" ]] \
        || echo "WARN: missing user_data/strategies/${s}"
done

# ---- (re)create the pod ----------------------------------------------------
if podman pod exists "${POD_NAME}"; then
    echo "Stopping & removing existing pod ${POD_NAME}..."
    podman pod stop "${POD_NAME}" || true
    podman pod rm   "${POD_NAME}" || true
fi

echo "Creating pod ${POD_NAME}..."
PUBLISH_ARGS=(
    --publish 127.0.0.1:9020:9020
    --publish 127.0.0.1:9060:9060
    --publish 127.0.0.1:9050:9050
    --publish 127.0.0.1:8500:80
)
[[ "${START_BOT4}" == "1" ]] && PUBLISH_ARGS+=(--publish 127.0.0.1:9061:9061)

podman pod create --name "${POD_NAME}" --userns=keep-id "${PUBLISH_ARGS[@]}"

# ---- pull images (idempotent) ---------------------------------------------
podman pull "${FT_FREQAI_IMAGE}"
podman pull "${FT_IMAGE}"
podman pull "${FREQUI_IMAGE}"

# ---- bot 1: NexusForge (FreqAI) -------------------------------------------
podman run -d --pod "${POD_NAME}" \
    --name ft-nexusforge --restart unless-stopped \
    -v "${USER_DATA}:/freqtrade/user_data:Z" \
    "${FT_FREQAI_IMAGE}" \
    trade \
    --db-url sqlite:////freqtrade/user_data/nexusforge.sqlite \
    --config /freqtrade/user_data/configs/config_bot1_nexusforge.json \
    --strategy AlexNexusForgeV8AI \
    --freqaimodel LightGBMRegressor

# ---- bot 2: ECRV31 (DCA) ---------------------------------------------------
podman run -d --pod "${POD_NAME}" \
    --name ft-ecrv31 --restart unless-stopped \
    -v "${USER_DATA}:/freqtrade/user_data:Z" \
    "${FT_IMAGE}" \
    trade \
    --db-url sqlite:////freqtrade/user_data/ecrv31.sqlite \
    --config /freqtrade/user_data/configs/config_bot2_ecrv32.json \
    --strategy ECRV31

# ---- bot 3: AlexBandSniperV6431 (sniper) ----------------------------------
podman run -d --pod "${POD_NAME}" \
    --name ft-bandsniper --restart unless-stopped \
    -v "${USER_DATA}:/freqtrade/user_data:Z" \
    "${FT_IMAGE}" \
    trade \
    --db-url sqlite:////freqtrade/user_data/bandsniper.sqlite \
    --config /freqtrade/user_data/configs/config_bot3_bandsniper.json \
    --strategy AlexBandSniperV6431

# ---- bot 4: ECRV2 (legacy DCA, optional) ----------------------------------
if [[ "${START_BOT4}" == "1" ]]; then
    podman run -d --pod "${POD_NAME}" \
        --name ft-ecrv2 --restart unless-stopped \
        -v "${USER_DATA}:/freqtrade/user_data:Z" \
        "${FT_IMAGE}" \
        trade \
        --db-url sqlite:////freqtrade/user_data/ecrv2.sqlite \
        --config /freqtrade/user_data/configs/config_bot4_ecrv2.json \
        --strategy ECRV2
fi

# ---- FreqUI dashboard (multibot — add each bot in Settings) ---------------
podman run -d --pod "${POD_NAME}" \
    --name ft-frequi --restart unless-stopped \
    --user root \
    "${FREQUI_IMAGE}"

# ---- summary ---------------------------------------------------------------
echo ""
echo "Pod status:"
podman pod ps --filter "name=${POD_NAME}"
echo ""
echo "Containers:"
podman ps --pod --filter "pod=${POD_NAME}"
echo ""
echo "Open http://127.0.0.1:8500 and add the bots:"
echo "  http://127.0.0.1:9020   (AlexNexusForgeV8AI)"
echo "  http://127.0.0.1:9060   (ECRV31)"
echo "  http://127.0.0.1:9050   (AlexBandSniperV6431)"
[[ "${START_BOT4}" == "1" ]] && echo "  http://127.0.0.1:9061   (ECRV2 legacy)"
echo "Login = freqtrade / <api_server.password from each config>"
