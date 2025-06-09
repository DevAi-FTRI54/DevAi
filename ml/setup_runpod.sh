#!/bin/bash
# RunPod Training Setup Script
# This script sets up the complete training environment on a RunPod GPU instance

set -e

echo "🚀 DevAI RunPod Training Setup"
echo "================================="

# Check if we're on a GPU instance
if ! command -v nvidia-smi &> /dev/null; then
    echo "❌ ERROR: nvidia-smi not found. Make sure you're on a GPU instance!"
    exit 1
fi

echo "✅ GPU detected:"
nvidia-smi --query-gpu=name,memory.total --format=csv,noheader

# Install Python dependencies
echo "📦 Installing Python dependencies..."
pip install --upgrade pip
pip install -r requirements.txt

# Create necessary directories
echo "📁 Creating directories..."
mkdir -p models/fine-tuned
mkdir -p training_data
mkdir -p logs

# Download training data from local machine (will be uploaded)
echo "📊 Training data should be uploaded to /workspace/training_data.json"

# Verify GPU availability
echo "🖥️  Checking GPU availability..."
python3 -c "import torch; print(f'CUDA available: {torch.cuda.is_available()}'); print(f'GPU devices: {torch.cuda.device_count()}')"

# Run training if data exists
echo "🔥 Starting training..."
if [ -f "/workspace/training_data.json" ]; then
    python3 train.py \
        --data /workspace/training_data.json \
        --output /workspace/models/fine-tuned/devai_runpod \
        --epochs 3 \
        --batch_size 4
        
    echo "✅ Training completed!"
    echo "📁 Model saved to: /workspace/models/fine-tuned/devai_runpod"
    
    # Create download instructions
    echo "📋 Creating download instructions..."
    cat > /workspace/download_model.sh << 'EOF'
#!/bin/bash
echo "📥 To download the trained model:"
echo "rsync -avz -e 'ssh -p $RUNPOD_SSH_PORT' root@$RUNPOD_SSH_HOST:/workspace/models/fine-tuned/devai_runpod ./models/fine-tuned/"
echo ""
echo "Or use RunPod's download feature in the web interface"
EOF
    chmod +x /workspace/download_model.sh
    
    echo "🎉 Training setup complete!"
    echo "📋 Run ./download_model.sh for download instructions"
else
    echo "❌ Training data not found at /workspace/training_data.json"
    echo "💡 Upload your training data file before running this script"
    echo ""
    echo "📋 Manual setup complete! Next steps:"
    echo "   1. Upload your training_data.json file"
    echo "   2. Run: python train.py --data training_data.json --output ./models/fine-tuned/devai_runpod"
    echo "   3. Download the fine-tuned model after training"
    echo ""
    echo "💡 Monitor training with:"
    echo "   tensorboard --logdir=./models/fine-tuned/devai_runpod/logs"
fi
