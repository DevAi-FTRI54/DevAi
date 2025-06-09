#!/usr/bin/env python3
"""
Enhanced DevAI Training Manager
For internal team use - complete training pipeline with RunPod support
"""

import requests
import json
import argparse
import sys
import os
import subprocess
import time
from datetime import datetime

try:
    import runpod
    RUNPOD_AVAILABLE = True
except ImportError:
    RUNPOD_AVAILABLE = False

class TrainingManager:
    def __init__(self, base_url: str = "http://127.0.0.1:4000", auth_token: str = None):
        self.base_url = base_url
        self.headers = {"Authorization": f"Bearer {auth_token}"} if auth_token else {}
    
    def check_readiness(self, min_pairs: int = 200):
        """Check if we have enough data for fine-tuning"""
        try:
            response = requests.get(
                f"{self.base_url}/api/training/check-readiness?min_pairs={min_pairs}",
                headers=self.headers
            )
            
            if response.status_code == 200:
                data = response.json()
                
                print("📊 Training Readiness Check")
                print("=" * 40)
                print(f"Ready for training: {'✅ YES' if data['ready'] else '❌ NO'}")
                print(f"Current conversation pairs: {data['currentPairs']}")
                print(f"Minimum required: {data['minRequired']}")
                
                if not data['ready']:
                    print(f"Need {data['deficit']} more pairs")
                
                print(f"Total conversations: {data['totalConversations']}")
                print(f"Recommendation: {data['recommendation']}")
                
                return data['ready']
            else:
                print(f"❌ Error checking readiness: {response.status_code}")
                return False
                
        except Exception as e:
            print(f"❌ Error: {e}")
            return False
    
    def export_data(self, output_file: str = "training_data.json", min_pairs: int = 200):
        """Export training data from backend"""
        try:
            response = requests.get(
                f"{self.base_url}/api/training/export-data?min_pairs={min_pairs}",
                headers=self.headers
            )
            
            if response.status_code == 200:
                data = response.json()
                
                with open(output_file, 'w') as f:
                    json.dump(data, f, indent=2)
                
                print(f"✅ Training data exported to {output_file}")
                print(f"📊 {data['stats']['totalPairs']} training pairs")
                print(f"👥 {data['stats']['uniqueUsers']} users")
                print(f"📁 {data['stats']['uniqueRepos']} repositories")
                
                return True
                
            elif response.status_code == 400:
                error_data = response.json()
                print(f"❌ {error_data['error']}")
                print(f"💡 {error_data['suggestion']}")
                return False
            else:
                print(f"❌ Error exporting data: {response.status_code}")
                return False
                
        except Exception as e:
            print(f"❌ Error: {e}")
            return False
    
    def trigger_training(self, min_pairs: int = 200, auto_train: bool = False, use_runpod: bool = True):
        """Trigger training job with optional auto-training"""
        try:
            payload = {"min_pairs": min_pairs}
            response = requests.post(
                f"{self.base_url}/api/training/trigger-training",
                headers=self.headers,
                json=payload
            )
            
            if response.status_code == 200:
                data = response.json()
                
                print(f"🚀 Training job triggered: {data['jobId']}")
                print(f"⏱️  Estimated time: {data['estimatedTime']}")
                
                if auto_train:
                    if use_runpod:
                        print("\n🔥 Starting RunPod training...")
                        return self.run_runpod_training(data['jobId'], min_pairs)
                    else:
                        print("\n🔥 Starting local training...")
                        return self.run_local_training(data['jobId'], min_pairs)
                else:
                    print("\n📋 Manual commands (if needed):")
                    for step, command in data['manualCommands'].items():
                        print(f"  {step}: {command}")
                
                return True
            else:
                print(f"❌ Error triggering training: {response.status_code}")
                return False
                
        except Exception as e:
            print(f"❌ Error: {e}")
            return False

    def run_local_training(self, job_id: str, min_pairs: int):
        """Run training locally (requires CUDA GPU)"""
        try:
            # Check if CUDA is available
            result = subprocess.run([
                "python3", "-c", "import torch; print(torch.cuda.is_available())"
            ], capture_output=True, text=True)
            
            if result.stdout.strip() != "True":
                print("❌ CUDA GPU not available for local training")
                print("💡 Use RunPod for cloud GPU training instead")
                return False
            
            print("✅ CUDA GPU detected")
            
            # Export data with job-specific filename
            data_file = f"training_data_{job_id}.json"
            output_dir = f"./models/fine-tuned/devai_{job_id}"
            
            print(f"📊 Exporting training data to {data_file}...")
            if not self.export_data(data_file, min_pairs):
                return False
            
            # Run training
            print(f"🚀 Starting local training...")
            print(f"📁 Output directory: {output_dir}")
            
            cmd = [
                "python3", "scripts/train.py",
                "--data", data_file,
                "--output", output_dir,
                "--epochs", "3",
                "--batch_size", "4"
            ]
            
            print(f"🖥️  Running: {' '.join(cmd)}")
            result = subprocess.run(cmd, cwd=os.path.dirname(os.path.abspath(__file__)) + "/..")
            
            if result.returncode == 0:
                print("✅ Local training completed successfully!")
                print(f"📁 Model saved to: {output_dir}")
                print("\n🚀 Next steps:")
                print(f"   ollama create devai-assistant-{job_id} -f {output_dir}/Modelfile")
                return True
            else:
                print("❌ Local training failed")
                return False
                
        except Exception as e:
            print(f"❌ Local training error: {e}")
            return False

    def run_runpod_training(self, job_id: str, min_pairs: int):
        """Run training on RunPod GPU (manual setup for now)"""
        try:
            # Export data first
            data_file = f"training_data_{job_id}.json"
            print(f"📊 Exporting training data to {data_file}...")
            if not self.export_data(data_file, min_pairs):
                return False
            
            print("🚀 RunPod Training Setup")
            print("=" * 30)
            print("💡 RunPod training requires manual setup. Follow these steps:")
            print("")
            print("1️⃣ Create RunPod GPU Instance:")
            print("   - Go to https://runpod.io/console/pods")
            print("   - Choose template: 'PyTorch 2.0.1' or 'RunPod PyTorch'")
            print("   - Select GPU: RTX A4000 or better")
            print("   - Set volume: 20GB+")
            print("")
            print("2️⃣ Upload Training Files:")
            print(f"   - Upload {data_file} to /workspace/")
            print("   - Upload all files from ml/scripts/ to /workspace/")
            print("   - Upload requirements.txt to /workspace/")
            print("")
            print("3️⃣ Run Setup Script:")
            print("   cd /workspace")
            print("   chmod +x setup_runpod.sh")
            print("   ./setup_runpod.sh")
            print("")
            print("4️⃣ Start Training:")
            print(f"   python3 train.py --data {data_file} --output ./models/fine-tuned/devai_{job_id}")
            print("")
            print("5️⃣ Download Trained Model:")
            print("   - Use RunPod's download feature")
            print(f"   - Download ./models/fine-tuned/devai_{job_id}/ folder")
            print("")
            print(f"📁 Training data ready: {data_file}")
            print("📋 See RUNPOD_SETUP.md for detailed instructions")
            
            return True
            
        except Exception as e:
            print(f"❌ RunPod setup error: {e}")
            return False

def main():
    parser = argparse.ArgumentParser(description="DevAI Training Management")
    parser.add_argument("--url", default="http://127.0.0.1:4000", help="Backend URL")
    parser.add_argument("--token", help="Auth token (required for export/trigger/train)")
    parser.add_argument("--min-pairs", type=int, default=200, help="Minimum training pairs required")
    
    subparsers = parser.add_subparsers(dest="command", help="Commands")
    
    # Check readiness command
    check_parser = subparsers.add_parser("check", help="Check training readiness")
    
    # Export data command
    export_parser = subparsers.add_parser("export", help="Export training data")
    export_parser.add_argument("--output", default="training_data.json", help="Output file")
    
    # Trigger training command
    trigger_parser = subparsers.add_parser("trigger", help="Trigger training job")
    trigger_parser.add_argument("--auto", action="store_true", help="Automatically start training after trigger")
    trigger_parser.add_argument("--local", action="store_true", help="Use local GPU (requires CUDA)")
    
    # Train command (direct training)
    train_parser = subparsers.add_parser("train", help="Train model directly")
    train_parser.add_argument("--local", action="store_true", help="Use local GPU (requires CUDA)")
    
    # Full workflow command
    workflow_parser = subparsers.add_parser("workflow", help="Full workflow: check -> export -> trigger -> train")
    workflow_parser.add_argument("--output", default="training_data.json", help="Output file")
    workflow_parser.add_argument("--auto", action="store_true", help="Automatically start training")
    workflow_parser.add_argument("--local", action="store_true", help="Use local GPU (requires CUDA)")
    
    args = parser.parse_args()
    
    if not args.command:
        parser.print_help()
        return
    
    manager = TrainingManager(args.url, args.token)
    
    if args.command == "check":
        manager.check_readiness(args.min_pairs)
    
    elif args.command == "export":
        if not args.token:
            print("❌ Auth token required for export")
            return
        manager.export_data(args.output, args.min_pairs)
    
    elif args.command == "trigger":
        if not args.token:
            print("❌ Auth token required for trigger")
            return
        auto_train = getattr(args, 'auto', False)
        use_local = getattr(args, 'local', False)
        manager.trigger_training(args.min_pairs, auto_train, not use_local)
    
    elif args.command == "train":
        if not args.token:
            print("❌ Auth token required for training")
            return
        use_local = getattr(args, 'local', False)
        
        # Generate a job ID for direct training
        job_id = f"manual-{datetime.now().strftime('%Y-%m-%dT%H-%M-%S-%f')[:-3]}Z"
        
        if use_local:
            manager.run_local_training(job_id, args.min_pairs)
        else:
            manager.run_runpod_training(job_id, args.min_pairs)
    
    elif args.command == "workflow":
        if not args.token:
            print("❌ Auth token required for full workflow")
            return
        
        auto_train = getattr(args, 'auto', False)
        use_local = getattr(args, 'local', False)
        
        print("🔄 Running full training workflow...")
        print("\n1️⃣ Checking readiness...")
        if not manager.check_readiness(args.min_pairs):
            print("❌ Not ready for training. Stopping workflow.")
            return
        
        print("\n2️⃣ Exporting data...")
        if not manager.export_data(args.output, args.min_pairs):
            print("❌ Failed to export data. Stopping workflow.")
            return
        
        print("\n3️⃣ Triggering training...")
        if manager.trigger_training(args.min_pairs, auto_train, not use_local):
            if auto_train:
                print("✅ Full automated workflow completed!")
            else:
                print("✅ Workflow completed - see training instructions above")
        else:
            print("❌ Failed to trigger training.")

if __name__ == "__main__":
    print("🤖 DevAI Training Manager v2.0")
    print("=" * 35)
    main()
