#!/usr/bin/env python3
"""
RunPod API Client for DevAI Fine-tuning
Automates GPU training job submission and monitoring
"""

import os
import time
import json
import requests
import subprocess
from typing import Dict, Optional, Any
from datetime import datetime

class RunPodClient:
    def __init__(self, api_key: str = None):
        self.api_key = api_key or os.getenv('RUNPOD_API_KEY')
        if not self.api_key:
            raise ValueError("RunPod API key required. Set RUNPOD_API_KEY environment variable.")
        
        self.base_url = "https://api.runpod.io/graphql"
        self.headers = {
            "Authorization": f"Bearer {self.api_key}",
            "Content-Type": "application/json"
        }
    
    def _make_request(self, query: str, variables: Dict = None) -> Dict:
        """Make GraphQL request to RunPod API"""
        payload = {"query": query}
        if variables:
            payload["variables"] = variables
        
        response = requests.post(self.base_url, json=payload, headers=self.headers)
        
        if response.status_code != 200:
            raise Exception(f"RunPod API request failed: {response.status_code} - {response.text}")
        
        result = response.json()
        if "errors" in result:
            raise Exception(f"RunPod API error: {result['errors']}")
        
        return result.get("data", {})
    
    def list_gpu_types(self) -> list:
        """List available GPU types and pricing"""
        query = """
        query {
            gpuTypes {
                id
                displayName
                memoryInGb
                secureCloud
                communityCloud
                lowestPrice {
                    minimumBidPrice
                    uninterruptablePrice
                }
            }
        }
        """
        result = self._make_request(query)
        return result.get("gpuTypes", [])
    
    def create_pod(self, name: str, image_name: str = "runpod/pytorch:2.0.1-py3.10-cuda11.8-devel-ubuntu22.04",
                   gpu_type: str = "NVIDIA RTX A4000", volume_size: int = 20,
                   ports: str = "8888/http,6006/http") -> Dict:
        """Create a new RunPod instance for training"""
        
        # Find the GPU type ID
        gpu_types = self.list_gpu_types()
        gpu_type_id = None
        for gpu in gpu_types:
            if gpu_type in gpu["displayName"]:
                gpu_type_id = gpu["id"]
                break
        
        if not gpu_type_id:
            raise ValueError(f"GPU type '{gpu_type}' not found. Available types: {[g['displayName'] for g in gpu_types]}")
        
        query = """
        mutation createPod($input: PodRentInterruptableInput!) {
            podRentInterruptable(input: $input) {
                id
                desiredStatus
                imageName
                env
                machineId
                machine {
                    podHostId
                }
            }
        }
        """
        
        variables = {
            "input": {
                "name": name,
                "imageName": image_name,
                "gpuTypeId": gpu_type_id,
                "cloudType": "SECURE",
                "volumeInGb": volume_size,
                "containerDiskInGb": 20,
                "minVcpuCount": 2,
                "minMemoryInGb": 8,
                "dockerArgs": "",
                "ports": ports,
                "volumeMountPath": "/workspace",
                "env": [
                    {"name": "JUPYTER_DISABLE_CHECK_XSRF", "value": "1"},
                    {"name": "RUNPOD_PYTHON_DEPS", "value": "torch transformers datasets peft accelerate trl bitsandbytes"}
                ]
            }
        }
        
        result = self._make_request(query, variables)
        return result.get("podRentInterruptable", {})
    
    def get_pod_status(self, pod_id: str) -> Dict:
        """Get current status of a pod"""
        query = """
        query getPod($podId: String!) {
            pod(id: $podId) {
                id
                name
                desiredStatus
                lastStatusChange
                imageName
                machineId
                machine {
                    podHostId
                }
                runtime {
                    uptimeInSeconds
                    ports {
                        ip
                        isIpPublic
                        privatePort
                        publicPort
                        type
                    }
                }
            }
        }
        """
        
        variables = {"podId": pod_id}
        result = self._make_request(query, variables)
        return result.get("pod", {})
    
    def wait_for_pod_ready(self, pod_id: str, timeout: int = 600) -> bool:
        """Wait for pod to be ready and return connection info"""
        print(f"⏳ Waiting for pod {pod_id} to be ready...")
        
        start_time = time.time()
        while time.time() - start_time < timeout:
            status = self.get_pod_status(pod_id)
            
            if status.get("desiredStatus") == "RUNNING":
                runtime = status.get("runtime", {})
                if runtime:
                    print(f"✅ Pod {pod_id} is ready!")
                    
                    # Get connection info
                    ports = runtime.get("ports", [])
                    ssh_port = None
                    jupyter_port = None
                    
                    for port in ports:
                        if port["privatePort"] == 22:
                            ssh_port = port["publicPort"]
                        elif port["privatePort"] == 8888:
                            jupyter_port = port["publicPort"]
                    
                    print(f"🔗 Connection info:")
                    print(f"   SSH: ssh -p {ssh_port} root@{ports[0]['ip'] if ports else 'N/A'}")
                    print(f"   Jupyter: http://{ports[0]['ip'] if ports else 'N/A'}:{jupyter_port}")
                    
                    return True
            
            print(f"   Status: {status.get('desiredStatus', 'Unknown')}")
            time.sleep(10)
        
        print(f"❌ Pod {pod_id} failed to become ready within {timeout} seconds")
        return False
    
    def upload_files_to_pod(self, pod_id: str, local_files: list, remote_path: str = "/workspace/") -> bool:
        """Upload files to pod via SSH"""
        try:
            # First get pod connection info
            status = self.get_pod_status(pod_id)
            runtime = status.get("runtime", {})
            ports = runtime.get("ports", [])
            
            ssh_port = None
            host_ip = None
            
            for port in ports:
                if port["privatePort"] == 22:
                    ssh_port = port["publicPort"]
                    host_ip = port["ip"]
                    break
            
            if not ssh_port or not host_ip:
                print("❌ Could not find SSH connection info")
                return False
            
            print(f"📤 Uploading files to {host_ip}:{ssh_port}")
            
            # Upload each file
            for local_file in local_files:
                if not os.path.exists(local_file):
                    print(f"❌ Local file not found: {local_file}")
                    continue
                
                print(f"   Uploading {local_file}...")
                cmd = [
                    "scp", "-P", str(ssh_port), 
                    "-o", "StrictHostKeyChecking=no",
                    "-o", "UserKnownHostsFile=/dev/null",
                    local_file, f"root@{host_ip}:{remote_path}"
                ]
                
                result = subprocess.run(cmd, capture_output=True, text=True)
                if result.returncode != 0:
                    print(f"❌ Failed to upload {local_file}: {result.stderr}")
                    return False
                else:
                    print(f"✅ Uploaded {local_file}")
            
            return True
            
        except Exception as e:
            print(f"❌ Error uploading files: {e}")
            return False
    
    def execute_training_on_pod(self, pod_id: str, training_data_file: str, output_dir: str = "/workspace/models/fine-tuned/") -> bool:
        """Execute training script on the pod"""
        try:
            # Get SSH connection info
            status = self.get_pod_status(pod_id)
            runtime = status.get("runtime", {})
            ports = runtime.get("ports", [])
            
            ssh_port = None
            host_ip = None
            
            for port in ports:
                if port["privatePort"] == 22:
                    ssh_port = port["publicPort"]
                    host_ip = port["ip"]
                    break
            
            if not ssh_port or not host_ip:
                print("❌ Could not find SSH connection info")
                return False
            
            print(f"🚀 Starting training on pod {pod_id}")
            
            # Execute training command
            training_cmd = f"""
                cd /workspace && 
                chmod +x setup_runpod.sh && 
                ./setup_runpod.sh && 
                python3 train.py --data {training_data_file} --output {output_dir}
            """
            
            ssh_cmd = [
                "ssh", "-p", str(ssh_port),
                "-o", "StrictHostKeyChecking=no",
                "-o", "UserKnownHostsFile=/dev/null",
                f"root@{host_ip}",
                training_cmd
            ]
            
            print(f"🔧 Executing: {' '.join(ssh_cmd)}")
            result = subprocess.run(ssh_cmd, text=True)
            
            if result.returncode == 0:
                print("✅ Training completed successfully!")
                return True
            else:
                print(f"❌ Training failed with return code {result.returncode}")
                return False
                
        except Exception as e:
            print(f"❌ Error executing training: {e}")
            return False
    
    def terminate_pod(self, pod_id: str) -> bool:
        """Terminate a pod"""
        query = """
        mutation terminatePod($podId: String!) {
            podTerminate(id: $podId) {
                id
            }
        }
        """
        
        variables = {"podId": pod_id}
        try:
            result = self._make_request(query, variables)
            print(f"✅ Pod {pod_id} terminated")
            return True
        except Exception as e:
            print(f"❌ Error terminating pod: {e}")
            return False
    
    def full_training_workflow(self, job_id: str, training_data_file: str, gpu_type: str = "NVIDIA RTX A4000") -> bool:
        """Complete automated training workflow"""
        pod_name = f"devai-training-{job_id}"
        
        try:
            print(f"🚀 Starting automated RunPod training workflow")
            print(f"📊 Job ID: {job_id}")
            print(f"🖥️  GPU: {gpu_type}")
            print(f"📁 Training data: {training_data_file}")
            
            # 1. Create pod
            print("\n1️⃣ Creating RunPod instance...")
            pod_info = self.create_pod(pod_name, gpu_type=gpu_type)
            pod_id = pod_info.get("id")
            
            if not pod_id:
                print("❌ Failed to create pod")
                return False
            
            print(f"✅ Pod created: {pod_id}")
            
            # 2. Wait for pod to be ready
            print("\n2️⃣ Waiting for pod to be ready...")
            if not self.wait_for_pod_ready(pod_id):
                self.terminate_pod(pod_id)
                return False
            
            # 3. Upload training files
            print("\n3️⃣ Uploading training files...")
            files_to_upload = [
                training_data_file,
                "scripts/train.py",
                "scripts/setup_runpod.sh",
                "requirements.txt"
            ]
            
            if not self.upload_files_to_pod(pod_id, files_to_upload):
                print("❌ Failed to upload files")
                self.terminate_pod(pod_id)
                return False
            
            # 4. Execute training
            print("\n4️⃣ Starting training...")
            training_success = self.execute_training_on_pod(pod_id, os.path.basename(training_data_file))
            
            if training_success:
                print("\n5️⃣ Training completed! Download your model:")
                print(f"   Use RunPod web interface to download from pod {pod_id}")
                print(f"   Path: /workspace/models/fine-tuned/")
                
                # Keep pod running for manual download
                print(f"\n💡 Pod {pod_id} kept running for model download")
                print(f"💰 Remember to terminate pod after downloading to avoid charges")
                return True
            else:
                print("\n❌ Training failed")
                self.terminate_pod(pod_id)
                return False
                
        except Exception as e:
            print(f"❌ Workflow error: {e}")
            if 'pod_id' in locals():
                self.terminate_pod(pod_id)
            return False


def main():
    """CLI for RunPod client"""
    import argparse
    
    parser = argparse.ArgumentParser(description="RunPod Training Client")
    parser.add_argument("--api-key", help="RunPod API key")
    
    subparsers = parser.add_subparsers(dest="command", help="Commands")
    
    # List GPUs
    list_parser = subparsers.add_parser("list-gpus", help="List available GPU types")
    
    # Create pod
    create_parser = subparsers.add_parser("create-pod", help="Create training pod")
    create_parser.add_argument("--name", required=True, help="Pod name")
    create_parser.add_argument("--gpu", default="NVIDIA RTX A4000", help="GPU type")
    
    # Full workflow
    workflow_parser = subparsers.add_parser("train", help="Full training workflow")
    workflow_parser.add_argument("--job-id", required=True, help="Training job ID")
    workflow_parser.add_argument("--data", required=True, help="Training data file")
    workflow_parser.add_argument("--gpu", default="NVIDIA RTX A4000", help="GPU type")
    
    # Terminate pod
    terminate_parser = subparsers.add_parser("terminate", help="Terminate pod")
    terminate_parser.add_argument("--pod-id", required=True, help="Pod ID to terminate")
    
    args = parser.parse_args()
    
    if not args.command:
        parser.print_help()
        return
    
    try:
        client = RunPodClient(args.api_key)
        
        if args.command == "list-gpus":
            gpus = client.list_gpu_types()
            print("Available GPU types:")
            for gpu in gpus:
                price = gpu.get("lowestPrice", {})
                print(f"  {gpu['displayName']} - {gpu['memoryInGb']}GB - ${price.get('uninterruptablePrice', 'N/A')}/hr")
        
        elif args.command == "create-pod":
            pod = client.create_pod(args.name, gpu_type=args.gpu)
            print(f"Pod created: {pod.get('id', 'Unknown')}")
        
        elif args.command == "train":
            success = client.full_training_workflow(args.job_id, args.data, args.gpu)
            if success:
                print("🎉 Training workflow completed!")
            else:
                print("❌ Training workflow failed")
        
        elif args.command == "terminate":
            client.terminate_pod(args.pod_id)
        
    except Exception as e:
        print(f"❌ Error: {e}")


if __name__ == "__main__":
    main()
