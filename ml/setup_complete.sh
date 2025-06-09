#!/bin/bash
# DevAI Fine-tuning Complete Setup Script
# Sets up the complete training pipeline with automation

set -e

echo "🤖 DevAI Fine-tuning Complete Setup"
echo "===================================="

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Function to print colored output
print_status() {
    echo -e "${GREEN}✅ $1${NC}"
}

print_warning() {
    echo -e "${YELLOW}⚠️  $1${NC}"
}

print_error() {
    echo -e "${RED}❌ $1${NC}"
}

print_info() {
    echo -e "${BLUE}ℹ️  $1${NC}"
}

# Check if we're in the right directory
if [ ! -f "requirements.txt" ]; then
    print_error "Please run this script from the ml/ directory"
    exit 1
fi

print_info "Setting up in: $(pwd)"

# 1. Check Python version
print_info "Checking Python version..."
python_version=$(python3 --version 2>&1 | cut -d' ' -f2)
print_status "Python version: $python_version"

# 2. Create virtual environment if it doesn't exist
if [ ! -d "venv" ]; then
    print_info "Creating Python virtual environment..."
    python3 -m venv venv
    print_status "Virtual environment created"
else
    print_info "Virtual environment already exists"
fi

# 3. Activate virtual environment and install dependencies
print_info "Installing Python dependencies..."
source venv/bin/activate
pip install --upgrade pip
pip install -r requirements.txt
print_status "Dependencies installed"

# 4. Check required environment variables
print_info "Checking environment variables..."

if [ -z "$FINE_TUNING_TOKEN" ]; then
    print_warning "FINE_TUNING_TOKEN not set"
    echo "export FINE_TUNING_TOKEN=your_token_here" >> ~/.bashrc
    print_info "Added FINE_TUNING_TOKEN to ~/.bashrc"
fi

if [ -z "$RUNPOD_API_KEY" ]; then
    print_warning "RUNPOD_API_KEY not set"
    echo "export RUNPOD_API_KEY=your_runpod_key_here" >> ~/.bashrc
    print_info "Added RUNPOD_API_KEY to ~/.bashrc"
fi

if [ -z "$MONGO_URI" ]; then
    print_warning "MONGO_URI not set"
    echo "export MONGO_URI=your_mongo_uri_here" >> ~/.bashrc
    print_info "Added MONGO_URI to ~/.bashrc"
fi

# 5. Create necessary directories
print_info "Creating directories..."
mkdir -p models/fine-tuned
mkdir -p data
mkdir -p logs
print_status "Directories created"

# 6. Set permissions
print_info "Setting permissions..."
chmod +x scripts/training_manager.py
chmod +x scripts/training_scheduler.py
chmod +x scripts/runpod_client.py
chmod +x setup_runpod.sh
print_status "Permissions set"

# 7. Test the training manager
print_info "Testing training manager..."
if python3 scripts/training_manager.py --help > /dev/null 2>&1; then
    print_status "Training manager working"
else
    print_error "Training manager test failed"
    exit 1
fi

# 8. Check GPU availability (if local)
print_info "Checking GPU availability..."
if python3 -c "import torch; print('CUDA available:', torch.cuda.is_available())" 2>/dev/null | grep -q "True"; then
    print_status "CUDA GPU detected - local training available"
else
    print_warning "No CUDA GPU - RunPod required for training"
fi

# 9. Create systemd service (if running on Linux)
if command -v systemctl >/dev/null 2>&1; then
    print_info "Setting up systemd service..."
    
    # Copy service file to system location
    sudo cp devai-scheduler.service /etc/systemd/system/
    
    # Update service file with current path
    current_path=$(pwd)
    sudo sed -i "s|/opt/devai/ml|$current_path|g" /etc/systemd/system/devai-scheduler.service
    
    # Reload systemd and enable service
    sudo systemctl daemon-reload
    sudo systemctl enable devai-scheduler.service
    print_status "Systemd service configured"
    
    print_info "To start the scheduler service:"
    print_info "sudo systemctl start devai-scheduler"
    print_info "sudo systemctl status devai-scheduler"
else
    print_warning "Systemd not available - manual scheduling required"
fi

# 10. Create cron job (alternative to systemd)
print_info "Setting up cron job..."
crontab_line="0 2 * * 0 cd $(pwd) && source venv/bin/activate && python3 scripts/training_scheduler.py --run-once >> logs/training.log 2>&1"

# Check if cron job already exists
if crontab -l 2>/dev/null | grep -q "training_scheduler.py"; then
    print_info "Cron job already exists"
else
    # Add cron job
    (crontab -l 2>/dev/null; echo "$crontab_line") | crontab -
    print_status "Weekly cron job added (Sundays at 2 AM)"
fi

# 11. Test backend connection
print_info "Testing backend connection..."
if curl -s http://localhost:4000/api/health >/dev/null 2>&1; then
    print_status "Backend server is running"
else
    print_warning "Backend server not running - start it for full functionality"
fi

# 12. Display completion summary
echo ""
echo "🎉 DevAI Fine-tuning Setup Complete!"
echo "====================================="
echo ""
print_status "Components installed:"
echo "  • Python virtual environment with dependencies"
echo "  • Training manager with RunPod automation"
echo "  • Automated scheduler with weekly jobs"
echo "  • Required directories and permissions"
echo ""
print_info "Quick test commands:"
echo "  # Activate environment"
echo "  source venv/bin/activate"
echo ""
echo "  # Check if ready for training"
echo "  python3 scripts/training_manager.py --token \$FINE_TUNING_TOKEN check"
echo ""
echo "  # Run full workflow (when ready)"
echo "  python3 scripts/training_manager.py --token \$FINE_TUNING_TOKEN workflow --auto"
echo ""
echo "  # Start scheduler daemon"
echo "  python3 scripts/training_scheduler.py"
echo ""
echo "  # Manual training trigger"
echo "  touch trigger_training_now"
echo ""
print_info "Configuration files:"
echo "  • Environment variables: ~/.bashrc"
echo "  • Systemd service: /etc/systemd/system/devai-scheduler.service"
echo "  • Cron job: crontab -l"
echo ""
print_warning "Next steps:"
echo "1. Set your actual tokens in ~/.bashrc and reload: source ~/.bashrc"
echo "2. Start the backend server: cd ../server && npm run dev"
echo "3. Test the training pipeline with sample data"
echo "4. Start the scheduler: systemctl start devai-scheduler (or run manually)"
echo ""
print_status "Setup complete! 🚀"
