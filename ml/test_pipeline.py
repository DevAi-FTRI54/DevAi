#!/usr/bin/env python3
"""
DevAI Training Pipeline Integration Tests
Comprehensive test suite for the fine-tuning pipeline
"""

import os
import sys
import json
import time
import requests
import subprocess
from pathlib import Path
from datetime import datetime

class PipelineTests:
    def __init__(self, base_path: str = None):
        self.base_path = Path(base_path) if base_path else Path(__file__).parent.parent
        self.backend_url = "http://localhost:4000"
        self.token = os.getenv('FINE_TUNING_TOKEN')
        self.results = []
        
        print(f"🧪 DevAI Training Pipeline Tests")
        print(f"📁 Base path: {self.base_path}")
        print(f"🔗 Backend: {self.backend_url}")
        print(f"🎫 Token: {'✅ Set' if self.token else '❌ Missing'}")
        print("=" * 50)
    
    def test_result(self, test_name: str, success: bool, message: str = ""):
        """Record test result"""
        result = {
            "test": test_name,
            "success": success,
            "message": message,
            "timestamp": datetime.now().isoformat()
        }
        self.results.append(result)
        
        status = "✅ PASS" if success else "❌ FAIL"
        print(f"{status} {test_name}")
        if message:
            print(f"    {message}")
    
    def test_environment_setup(self):
        """Test 1: Environment and dependencies"""
        try:
            # Check Python virtual environment
            venv_path = self.base_path / "venv"
            if venv_path.exists():
                self.test_result("Python virtual environment", True, f"Found at {venv_path}")
            else:
                self.test_result("Python virtual environment", False, "venv/ directory not found")
            
            # Check requirements
            try:
                import torch
                import transformers
                import requests
                self.test_result("Python dependencies", True, f"PyTorch {torch.__version__}, Transformers {transformers.__version__}")
            except ImportError as e:
                self.test_result("Python dependencies", False, f"Missing dependency: {e}")
            
            # Check CUDA availability
            try:
                import torch
                cuda_available = torch.cuda.is_available()
                self.test_result("CUDA GPU", cuda_available, f"CUDA: {cuda_available}")
            except:
                self.test_result("CUDA GPU", False, "Unable to check CUDA")
            
            # Check environment variables
            required_vars = ['FINE_TUNING_TOKEN', 'RUNPOD_API_KEY']
            for var in required_vars:
                value = os.getenv(var)
                self.test_result(f"Environment variable {var}", bool(value), 
                               "Set" if value else "Missing")
        
        except Exception as e:
            self.test_result("Environment setup", False, str(e))
    
    def test_backend_connectivity(self):
        """Test 2: Backend server connectivity"""
        try:
            # Test health endpoint
            response = requests.get(f"{self.backend_url}/api/health", timeout=5)
            if response.status_code == 200:
                self.test_result("Backend health", True, f"Status: {response.status_code}")
            else:
                self.test_result("Backend health", False, f"Status: {response.status_code}")
        except requests.exceptions.ConnectionError:
            self.test_result("Backend health", False, "Connection refused - is server running?")
        except Exception as e:
            self.test_result("Backend health", False, str(e))
        
        try:
            # Test training readiness endpoint
            response = requests.get(f"{self.backend_url}/api/training/check-readiness?min_pairs=10", timeout=5)
            if response.status_code == 200:
                data = response.json()
                self.test_result("Training readiness endpoint", True, 
                               f"Current pairs: {data.get('currentPairs', 'Unknown')}")
            else:
                self.test_result("Training readiness endpoint", False, f"Status: {response.status_code}")
        except Exception as e:
            self.test_result("Training readiness endpoint", False, str(e))
    
    def test_database_connectivity(self):
        """Test 3: MongoDB database"""
        try:
            # Test through backend API
            response = requests.get(f"{self.backend_url}/api/training/check-readiness?min_pairs=1", timeout=5)
            if response.status_code == 200:
                data = response.json()
                total_conversations = data.get('totalConversations', 0)
                current_pairs = data.get('currentPairs', 0)
                
                self.test_result("Database connectivity", True, 
                               f"Conversations: {total_conversations}, Pairs: {current_pairs}")
                
                if current_pairs > 0:
                    self.test_result("Training data availability", True, f"{current_pairs} pairs found")
                else:
                    self.test_result("Training data availability", False, "No training pairs found")
            else:
                self.test_result("Database connectivity", False, f"API error: {response.status_code}")
        except Exception as e:
            self.test_result("Database connectivity", False, str(e))
    
    def test_training_manager_cli(self):
        """Test 4: Training manager CLI"""
        try:
            training_manager = self.base_path / "scripts" / "training_manager.py"
            
            # Test help command
            result = subprocess.run([
                "python3", str(training_manager), "--help"
            ], capture_output=True, text=True, cwd=self.base_path)
            
            if result.returncode == 0:
                self.test_result("Training manager help", True, "CLI working")
            else:
                self.test_result("Training manager help", False, f"Exit code: {result.returncode}")
            
            # Test check command (if token available)
            if self.token:
                result = subprocess.run([
                    "python3", str(training_manager),
                    "--token", self.token,
                    "--min-pairs", "10",
                    "check"
                ], capture_output=True, text=True, cwd=self.base_path)
                
                if result.returncode == 0:
                    self.test_result("Training manager check", True, "Check command working")
                else:
                    self.test_result("Training manager check", False, 
                                   f"Exit code: {result.returncode}, Error: {result.stderr}")
            else:
                self.test_result("Training manager check", False, "No token available")
        
        except Exception as e:
            self.test_result("Training manager CLI", False, str(e))
    
    def test_training_data_export(self):
        """Test 5: Training data export"""
        if not self.token:
            self.test_result("Training data export", False, "No token available")
            return
        
        try:
            training_manager = self.base_path / "scripts" / "training_manager.py"
            output_file = self.base_path / "test_export.json"
            
            # Clean up any existing test file
            if output_file.exists():
                output_file.unlink()
            
            # Run export command
            result = subprocess.run([
                "python3", str(training_manager),
                "--token", self.token,
                "--min-pairs", "1",  # Low threshold for testing
                "export",
                "--output", str(output_file)
            ], capture_output=True, text=True, cwd=self.base_path)
            
            if result.returncode == 0 and output_file.exists():
                # Check file content
                with open(output_file, 'r') as f:
                    data = json.load(f)
                
                pairs_count = data.get('stats', {}).get('totalPairs', 0)
                self.test_result("Training data export", True, f"Exported {pairs_count} pairs")
                
                # Clean up
                output_file.unlink()
            else:
                self.test_result("Training data export", False, 
                               f"Export failed: {result.stderr}")
        
        except Exception as e:
            self.test_result("Training data export", False, str(e))
    
    def test_runpod_client(self):
        """Test 6: RunPod client functionality"""
        try:
            runpod_client = self.base_path / "scripts" / "runpod_client.py"
            
            # Test help command
            result = subprocess.run([
                "python3", str(runpod_client), "--help"
            ], capture_output=True, text=True, cwd=self.base_path)
            
            if result.returncode == 0:
                self.test_result("RunPod client CLI", True, "CLI working")
            else:
                self.test_result("RunPod client CLI", False, f"Exit code: {result.returncode}")
            
            # Test GPU list (if API key available)
            runpod_key = os.getenv('RUNPOD_API_KEY')
            if runpod_key:
                result = subprocess.run([
                    "python3", str(runpod_client), 
                    "--api-key", runpod_key,
                    "list-gpus"
                ], capture_output=True, text=True, cwd=self.base_path, timeout=10)
                
                if result.returncode == 0:
                    self.test_result("RunPod API connectivity", True, "API working")
                else:
                    self.test_result("RunPod API connectivity", False, 
                                   f"API error: {result.stderr}")
            else:
                self.test_result("RunPod API connectivity", False, "No API key available")
        
        except Exception as e:
            self.test_result("RunPod client", False, str(e))
    
    def test_training_scheduler(self):
        """Test 7: Training scheduler"""
        try:
            scheduler = self.base_path / "scripts" / "training_scheduler.py"
            
            # Test help command
            result = subprocess.run([
                "python3", str(scheduler), "--help"
            ], capture_output=True, text=True, cwd=self.base_path)
            
            if result.returncode == 0:
                self.test_result("Training scheduler CLI", True, "CLI working")
            else:
                self.test_result("Training scheduler CLI", False, f"Exit code: {result.returncode}")
            
            # Test check-only mode
            if self.token:
                result = subprocess.run([
                    "python3", str(scheduler),
                    "--check-only"
                ], capture_output=True, text=True, cwd=self.base_path, timeout=10)
                
                if result.returncode == 0:
                    self.test_result("Training scheduler check", True, "Check working")
                else:
                    self.test_result("Training scheduler check", False, 
                                   f"Check failed: {result.stderr}")
            else:
                self.test_result("Training scheduler check", False, "No token available")
        
        except Exception as e:
            self.test_result("Training scheduler", False, str(e))
    
    def test_file_structure(self):
        """Test 8: Required files and directories"""
        required_files = [
            "scripts/training_manager.py",
            "scripts/train.py",
            "scripts/runpod_client.py",
            "scripts/training_scheduler.py",
            "requirements.txt",
            "setup_runpod.sh",
            "RUNPOD_SETUP.md"
        ]
        
        required_dirs = [
            "models",
            "scripts",
            "data"
        ]
        
        for file_path in required_files:
            full_path = self.base_path / file_path
            exists = full_path.exists()
            self.test_result(f"Required file: {file_path}", exists, 
                           "Found" if exists else "Missing")
        
        for dir_path in required_dirs:
            full_path = self.base_path / dir_path
            exists = full_path.exists() and full_path.is_dir()
            self.test_result(f"Required directory: {dir_path}", exists, 
                           "Found" if exists else "Missing")
    
    def generate_sample_data(self):
        """Test 9: Generate sample data for testing"""
        try:
            # Run sample data creation script
            sample_script = self.base_path.parent / "server" / "src" / "features" / "training" / "createSampleData.ts"
            
            if sample_script.exists():
                result = subprocess.run([
                    "npx", "tsx", str(sample_script)
                ], capture_output=True, text=True, cwd=sample_script.parent.parent.parent)
                
                if result.returncode == 0:
                    self.test_result("Sample data generation", True, "Sample data created")
                else:
                    self.test_result("Sample data generation", False, 
                                   f"Script failed: {result.stderr}")
            else:
                self.test_result("Sample data generation", False, "Script not found")
        
        except Exception as e:
            self.test_result("Sample data generation", False, str(e))
    
    def run_all_tests(self):
        """Run all tests in order"""
        tests = [
            self.test_environment_setup,
            self.test_file_structure,
            self.test_backend_connectivity,
            self.test_database_connectivity,
            self.test_training_manager_cli,
            self.test_training_data_export,
            self.test_runpod_client,
            self.test_training_scheduler,
            self.generate_sample_data
        ]
        
        for test in tests:
            try:
                test()
            except Exception as e:
                self.test_result(test.__name__, False, f"Test error: {e}")
            print()  # Empty line between tests
        
        self.print_summary()
    
    def print_summary(self):
        """Print test summary"""
        total_tests = len(self.results)
        passed_tests = sum(1 for r in self.results if r['success'])
        failed_tests = total_tests - passed_tests
        
        print("🏁 TEST SUMMARY")
        print("=" * 50)
        print(f"Total tests: {total_tests}")
        print(f"✅ Passed: {passed_tests}")
        print(f"❌ Failed: {failed_tests}")
        print(f"Success rate: {(passed_tests/total_tests)*100:.1f}%")
        print()
        
        if failed_tests > 0:
            print("❌ FAILED TESTS:")
            for result in self.results:
                if not result['success']:
                    print(f"  • {result['test']}: {result['message']}")
            print()
        
        # Overall status
        if failed_tests == 0:
            print("🎉 ALL TESTS PASSED! Pipeline is ready.")
        elif failed_tests <= 2:
            print("⚠️  Minor issues found. Pipeline mostly functional.")
        else:
            print("🚨 Major issues found. Pipeline needs attention.")
        
        # Save results to file
        results_file = self.base_path / "test_results.json"
        with open(results_file, 'w') as f:
            json.dump({
                "summary": {
                    "total": total_tests,
                    "passed": passed_tests,
                    "failed": failed_tests,
                    "timestamp": datetime.now().isoformat()
                },
                "results": self.results
            }, f, indent=2)
        
        print(f"📋 Detailed results saved to: {results_file}")


def main():
    import argparse
    
    parser = argparse.ArgumentParser(description="DevAI Training Pipeline Tests")
    parser.add_argument("--base-path", help="Base path to DevAI ML directory")
    parser.add_argument("--test", help="Run specific test", choices=[
        "env", "backend", "database", "cli", "export", "runpod", "scheduler", "files", "sample"
    ])
    
    args = parser.parse_args()
    
    tester = PipelineTests(args.base_path)
    
    if args.test:
        test_mapping = {
            "env": tester.test_environment_setup,
            "backend": tester.test_backend_connectivity,
            "database": tester.test_database_connectivity,
            "cli": tester.test_training_manager_cli,
            "export": tester.test_training_data_export,
            "runpod": tester.test_runpod_client,
            "scheduler": tester.test_training_scheduler,
            "files": tester.test_file_structure,
            "sample": tester.generate_sample_data
        }
        
        if args.test in test_mapping:
            test_mapping[args.test]()
            tester.print_summary()
        else:
            print(f"Unknown test: {args.test}")
    else:
        tester.run_all_tests()


if __name__ == "__main__":
    main()
