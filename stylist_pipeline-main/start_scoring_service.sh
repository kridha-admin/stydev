#!/bin/bash
# Start the Kridha scoring service
# Run from the stylist_pipeline-main directory or provide the correct path

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ENGINE_DIR="$(dirname "$SCRIPT_DIR")/engine"

cd "$(dirname "$SCRIPT_DIR")"
export PYTHONPATH="${PYTHONPATH}:$(pwd)"

echo "Starting Kridha Scoring Service..."
echo "Engine dir: $ENGINE_DIR"
echo "PYTHONPATH: $PYTHONPATH"

uvicorn engine.scoring_service:app --host 0.0.0.0 --port 8000 --workers 2
