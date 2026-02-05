#!/bin/bash

echo "🔧 Installing Python dependencies for figure extraction..."
echo ""

# Step 1: Install PyTorch first (required by detectron2)
echo "📦 Step 1/3: Installing PyTorch..."
pip install torch torchvision --quiet

if [ $? -ne 0 ]; then
    echo "❌ Failed to install PyTorch"
    exit 1
fi

echo "✅ PyTorch installed successfully"
echo ""

# Step 2: Install other requirements
echo "📦 Step 2/3: Installing other dependencies..."
pip install opencv-python Pillow "layoutparser[layoutmodels]" --quiet

if [ $? -ne 0 ]; then
    echo "❌ Failed to install dependencies"
    exit 1
fi

echo "✅ Dependencies installed successfully"
echo ""

# Step 3: Install detectron2 from GitHub
echo "📦 Step 3/3: Installing detectron2 (this may take a few minutes)..."
python -m pip install 'git+https://github.com/facebookresearch/detectron2.git'

if [ $? -ne 0 ]; then
    echo "❌ Failed to install detectron2"
    echo ""
    echo "💡 If this continues to fail, you have two options:"
    echo "   1. Skip figure extraction - the app will still work for text extraction"
    echo "   2. Try the Docker setup (see PYTHON_SETUP.md)"
    exit 1
fi

echo "✅ detectron2 installed successfully"
echo ""

# Verify installation
echo "🧪 Verifying installation..."
python -c "import layoutparser as lp; import cv2; import detectron2; print('✅ All dependencies installed and working!')"

if [ $? -eq 0 ]; then
    echo ""
    echo "🎉 Setup complete! You can now use the figure extraction feature."
else
    echo "⚠️  Installation completed but verification failed."
    echo "   The feature may still work, or you may need to troubleshoot."
fi
