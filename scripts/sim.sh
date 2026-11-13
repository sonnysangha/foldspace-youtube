#!/bin/sh
# Runs an agent-device command against the current EAS cloud simulator session.
# Usage: scripts/sim.sh screenshot ./shot.png
exec npx --yes eas-cli@latest simulator:exec npx agent-device@latest "$@"
