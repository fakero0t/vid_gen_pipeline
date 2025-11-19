# Modal Functions for NeRF Processing

This directory contains Modal functions for cloud-based NeRF processing, including COLMAP, training, and rendering.

## Overview

The Modal functions provide serverless GPU computing for:
- **COLMAP Processing**: Camera pose estimation from product photos
- **NeRF Training**: Training neural radiance fields using NeRF Studio
- **Frame Rendering**: Rendering 1440 transparent PNG frames

All processing runs in the cloud, no local GPU required.

## Directory Structure

```
modal_functions/
├── nerf_app.py              # Main Modal app definition
├── colmap_processing.py     # COLMAP Modal function (PR #3)
├── nerf_training.py         # NeRF training functions (PR #4)
├── frame_rendering.py       # Frame rendering function (PR #5)
├── shared/
│   ├── __init__.py
│   ├── config.py            # NeRF Studio config templates
│   ├── utils.py             # Shared utilities
│   └── progress.py          # Progress tracking
├── requirements.txt         # Modal function dependencies
├── test_data/               # Sample data for testing
└── README.md                # This file
```

## Setup

### 1. Install Modal CLI

```bash
pip install modal
```

### 2. Authenticate with Modal

```bash
modal token new
```

This will open a browser window to authenticate. Your credentials will be saved locally.

### 3. Set Environment Variables

Modal credentials are automatically used from your local Modal configuration. For the backend to call Modal functions, you need:

```bash
# Backend .env file
MODAL_TOKEN_ID=your_token_id
MODAL_TOKEN_SECRET=your_token_secret
```

You can find these in your Modal settings: https://modal.com/settings

## Deployment

### Deploy to Development

```bash
# From project root
ENVIRONMENT=development modal deploy modal_functions/nerf_app.py --name nerf-dev
```

### Deploy to Production

```bash
# From project root
ENVIRONMENT=production modal deploy modal_functions/nerf_app.py --name nerf-prod
```

### Verify Deployment

```bash
# Check app status
modal app list

# Test health check
modal run modal_functions/nerf_app.py
```

## Local Testing

### Run Functions Locally

```bash
# Test a specific function locally
modal run modal_functions/nerf_app.py::health_check

# Run with parameters (once functions are implemented)
modal run modal_functions/colmap_processing.py::process_colmap --job-id="test_001"
```

### Use Modal's Local Mode

Modal functions can be tested locally without deploying:

```python
# In your function code
if __name__ == "__main__":
    with modal.enable_output():
        result = process_colmap.local(job_id="test_001", ...)
        print(result)
```

## Modal Volume Structure

All job data is stored in a shared Modal volume named `nerf-data`:

```
/volumes/nerf-data/
└── jobs/
    └── {job_id}/
        ├── images.zip          # Uploaded product photos
        ├── colmap/             # COLMAP output
        │   ├── cameras.bin
        │   ├── images.bin
        │   └── points3D.bin
        ├── dataset/            # NeRF Studio dataset
        │   └── transforms.json
        ├── model/              # Trained NeRF model
        │   ├── model.pth
        │   └── config.json
        ├── frames/             # Rendered frames
        │   ├── batch_00.zip
        │   ├── batch_01.zip
        │   └── ...
        └── progress.json       # Progress tracking
```

### Volume Cleanup

- Job data is automatically cleaned up after **48 hours**
- Or manually cleaned up after successful download
- Configure cleanup in `backend/app/config.py`: `MODAL_VOLUME_CLEANUP_HOURS`

## GPU Configuration

### Available GPU Types

- **T4**: ~$0.35/hour (development)
  - 16 GB VRAM
  - Good for testing and development
  - ~25 min for 15k iterations

- **A10G**: ~$1.10/hour (production)
  - 24 GB VRAM
  - Faster training
  - ~15 min for 15k iterations

- **A100**: ~$4.00/hour (high-end)
  - 40 GB VRAM
  - Fastest training
  - ~7-10 min for 15k iterations

### GPU Selection

GPU is automatically selected based on `ENVIRONMENT` variable:
- `development` → T4
- `production` → A10G

Override in Modal function call:
```python
result = await modal_service.call_function(
    "train_nerf",
    gpu_type="A100"  # Override
)
```

## Cost Estimation

### Typical Costs per Job

**Development (T4):**
- COLMAP: ~10 min → $0.06
- Training: ~25 min → $0.15
- Rendering: ~18 min → $0.11
- **Total: ~$0.30**

**Production (A10G):**
- COLMAP: ~7 min → $0.13
- Training: ~15 min → $0.28
- Rendering: ~12 min → $0.22
- **Total: ~$0.70**

### Cost Optimization

1. **Use Test Dataset**: 10-15 images, 1000-2000 iterations (~80% cost reduction)
2. **Dev Environment**: Use T4 GPUs for development
3. **Batch Processing**: Process multiple products together
4. **Monitor Usage**: Check Modal dashboard regularly

## Environment Variables

### Backend Configuration

```bash
# Required
MODAL_TOKEN_ID=your_token_id
MODAL_TOKEN_SECRET=your_token_secret
ENVIRONMENT=development  # or production

# Optional (with defaults)
FRAME_STORAGE_PATH=backend/nerf/renders
MODEL_STORAGE_PATH=backend/nerf/models
UPLOAD_STORAGE_PATH=backend/uploads/temp
NERF_DEFAULT_ITERATIONS=15000
GPU_TYPE_DEV=T4
GPU_TYPE_PROD=A10G
```

## Development Workflow

### 1. Develop Functions Locally

```bash
# Create/modify function in modal_functions/
# Test locally
modal run modal_functions/nerf_app.py
```

### 2. Test with Sample Data

```bash
# Use small test dataset
modal run modal_functions/colmap_processing.py::process_colmap \
  --job-id="test_001" \
  --images-zip-path="/test_data/images.zip"
```

### 3. Deploy to Dev

```bash
ENVIRONMENT=development modal deploy modal_functions/nerf_app.py --name nerf-dev
```

### 4. Test End-to-End

```bash
# Run backend locally
cd backend
uvicorn app.main:app --reload

# Test from frontend or API
curl -X POST http://localhost:8000/api/nerf/colmap \
  -H "Content-Type: application/json" \
  -d '{"job_id": "test_001", "image_paths": [...]}'
```

### 5. Deploy to Production

```bash
ENVIRONMENT=production modal deploy modal_functions/nerf_app.py --name nerf-prod
```

## Monitoring

### Modal Dashboard

View real-time function execution:
```bash
# Open Modal dashboard
open https://modal.com/apps

# View logs for specific function
modal logs nerf-dev
```

### Check Function Status

```bash
# List active functions
modal app list

# View function details
modal app describe nerf-dev
```

### Volume Usage

```bash
# Check volume size
modal volume list

# View volume contents (requires Modal CLI)
# Note: This is for debugging, normally accessed via Modal SDK
```

## Troubleshooting

### Function Deployment Fails

```bash
# Check Modal credentials
modal token current

# Re-authenticate if needed
modal token new

# Check for syntax errors
python modal_functions/nerf_app.py
```

### GPU Unavailable

- Modal automatically queues jobs when GPUs unavailable
- Backend implements fallback: T4 → A10G → A100
- Check Modal dashboard for current GPU availability

### Import Errors

```bash
# Ensure all dependencies in requirements.txt
# Modal installs from requirements.txt in image definition

# Test imports locally
python -c "import modal; print(modal.__version__)"
```

### Volume Access Errors

- Ensure volume name matches: `nerf-data`
- Check volume permissions in Modal dashboard
- Verify volume created: `modal volume list`

## Testing

### Unit Tests

```bash
# Test utility functions
cd modal_functions
python -m pytest shared/test_*.py
```

### Integration Tests

```bash
# Test with real Modal (requires credentials)
ENVIRONMENT=development python -m pytest tests/test_integration.py
```

### Mock Mode

For testing without Modal:
```bash
# Backend testing with mocked Modal responses
cd backend
MOCK_MODAL=true pytest tests/test_nerf_endpoints.py
```

## Additional Resources

- [Modal Documentation](https://modal.com/docs)
- [NeRF Studio Documentation](https://docs.nerf.studio/)
- [COLMAP Documentation](https://colmap.github.io/)

## Support

For issues:
1. Check Modal dashboard for function logs
2. Review backend logs for API errors
3. Verify Modal credentials are correct
4. Check GPU availability in Modal dashboard

## Next Steps

After completing PR #1 (Foundation):
- **PR #2**: Product upload and validation
- **PR #3**: Implement COLMAP processing function
- **PR #4**: Implement NeRF training functions
- **PR #5**: Implement frame rendering function

