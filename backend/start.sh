#!/bin/bash
# Start the FastAPI backend server

# Activate virtual environment
source venv/bin/activate

# Start uvicorn server
echo "Starting FastAPI server on http://localhost:8000"
echo "Press CTRL+C to stop"
uvicorn app.main:app --reload --port 8000

