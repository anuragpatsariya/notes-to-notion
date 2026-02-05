# Python Setup Guide for Figure Extraction

This guide will help you set up the Python environment for the figure extraction feature.

## Prerequisites

- Python 3.8 or higher
- pip package manager
- macOS users: Xcode Command Line Tools

## Installation Steps

### Step 1: Install Basic Requirements

```bash
pip install -r requirements.txt
```

### Step 2: Install Detectron2 (Required for Layout Parser)

Detectron2 requires special installation. Choose the method based on your system:

#### Option A: Install from Pre-built Wheels (Recommended for macOS/Linux)

```bash
# For macOS with Python 3.8-3.11
python -m pip install 'git+https://github.com/facebookresearch/detectron2.git'
```

#### Option B: Build from Source (If Option A fails)

```bash
# Clone detectron2
git clone https://github.com/facebookresearch/detectron2.git
cd detectron2
pip install -e .
cd ..
```

#### Option C: Use Conda (Alternative if pip fails)

```bash
conda install -c conda-forge detectron2
```

### Step 3: Verify Installation

Test that everything is installed correctly:

```bash
python -c "import layoutparser as lp; import cv2; import detectron2; print('✅ All dependencies installed successfully!')"
```

## Troubleshooting

### Issue: `detectron2` installation fails

**Solution 1**: Install PyTorch first, then detectron2
```bash
pip install torch torchvision
python -m pip install 'git+https://github.com/facebookresearch/detectron2.git'
```

**Solution 2**: Use a specific PyTorch version compatible with your CUDA
```bash
# For CPU-only (no GPU)
pip install torch torchvision --index-url https://download.pytorch.org/whl/cpu

# Then install detectron2
python -m pip install 'git+https://github.com/facebookresearch/detectron2.git'
```

### Issue: `cv2` import error

```bash
pip uninstall opencv-python
pip install opencv-python-headless
```

### Issue: macOS architecture issues (M1/M2 Macs)

```bash
# Create a new conda environment with x86_64 architecture
conda create -n layout-env python=3.9
conda activate layout-env

# Install dependencies
pip install -r requirements.txt
python -m pip install 'git+https://github.com/facebookresearch/detectron2.git'
```

## Alternative: Use Docker (Easiest for All Platforms)

If you encounter issues, you can use Docker:

```dockerfile
# Create a Dockerfile
FROM python:3.9

WORKDIR /app
COPY requirements.txt .
RUN pip install -r requirements.txt
RUN pip install 'git+https://github.com/facebookresearch/detectron2.git'

COPY . .
CMD ["python", "find-image.py"]
```

```bash
# Build and run
docker build -t image-extractor .
docker run -v $(pwd)/temp_image_storage:/app/temp_image_storage image-extractor
```

## Testing the Setup

Once installed, test with a sample image:

```bash
# Download a test image or use your own
python find-image.py path/to/test-image.jpg temp_image_storage
```

You should see output like:
```json
{"success": true, "extracted_count": 2, "extracted_images": ["temp_image_storage/test-image_figure_0.jpg", "temp_image_storage/test-image_figure_1.jpg"]}
```

## Need Help?

If you continue to have issues:
1. Check your Python version: `python --version` (should be 3.8+)
2. Check your pip version: `pip --version`
3. Try creating a fresh virtual environment:
   ```bash
   python -m venv venv
   source venv/bin/activate  # On Windows: venv\Scripts\activate
   pip install -r requirements.txt
   python -m pip install 'git+https://github.com/facebookresearch/detectron2.git'
   ```
