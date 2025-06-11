#!/usr/bin/env python3
"""
Upload DevAI Fine-tuned Model to Hugging Face Hub
Uploads the adapter and necessary files for public sharing
"""

import os
import sys
from huggingface_hub import HfApi, HfFolder, create_repo
from pathlib import Path
import json
import shutil
import tempfile

def upload_devai_model():
    """Upload the fine-tuned DevAI model to Hugging Face Hub"""
    
    # Configuration
    repo_name = "devai-assistant-starcoder2-7b"  # Change this to your desired repo name
    organization = None  # Set to your HF org if needed, otherwise uses your username
    
    # Paths
    model_dir = Path(__file__).parent.parent / "models" / "fine-tuned"
    
    # Check if logged in to HF
    try:
        api = HfApi()
        user = api.whoami()
        print(f"✅ Logged in as: {user['name']}")
    except Exception as e:
        print("❌ Not logged in to Hugging Face. Run: huggingface-cli login")
        return False
    
    # Verify model files exist
    required_files = [
        "adapter_model.safetensors",
        "adapter_config.json", 
        "tokenizer.json",
        "tokenizer_config.json"
    ]
    
    missing_files = []
    for file in required_files:
        if not (model_dir / file).exists():
            missing_files.append(file)
    
    if missing_files:
        print(f"❌ Missing required files: {missing_files}")
        print(f"📁 Looking in: {model_dir}")
        return False
    
    print("✅ All required model files found")
    
    try:
        # Create repository
        full_repo_name = f"{organization}/{repo_name}" if organization else repo_name
        
        print(f"🚀 Creating repository: {full_repo_name}")
        repo_url = create_repo(
            repo_id=full_repo_name,
            exist_ok=True,
            private=False,  # Set to True if you want private repo
            repo_type="model"
        )
        print(f"✅ Repository created/exists: {repo_url}")
        
        # Create model card
        model_card = f"""---
license: bigcode-openrail-m
base_model: bigcode/starcoder2-7b
tags:
- code
- assistant
- fine-tuned
- peft
- lora
library_name: peft
language:
- en
pipeline_tag: text-generation
---

# DevAI Assistant - StarCoder2 7B Fine-tuned

This is a fine-tuned version of StarCoder2-7B specialized for developer assistance tasks.

## Model Details

- **Base Model**: bigcode/starcoder2-7b
- **Fine-tuning Method**: QLoRA (4-bit quantization + LoRA adapters)
- **Training Data**: Real developer conversations and code explanations
- **Trainable Parameters**: 14.68M (0.20% of total 7.18B parameters)
- **Final Training Accuracy**: 82.3%

## Usage

### With Transformers + PEFT

```python
from transformers import AutoTokenizer, AutoModelForCausalLM
from peft import PeftModel

# Load base model
base_model = AutoModelForCausalLM.from_pretrained(
    "bigcode/starcoder2-7b",
    torch_dtype=torch.float16,
    device_map="auto"
)

# Load tokenizer
tokenizer = AutoTokenizer.from_pretrained("bigcode/starcoder2-7b")

# Load fine-tuned adapter
model = PeftModel.from_pretrained(base_model, "{full_repo_name}")

# Generate code explanation
prompt = "Explain this Python function: def factorial(n): return 1 if n <= 1 else n * factorial(n-1)"
inputs = tokenizer(prompt, return_tensors="pt")
outputs = model.generate(**inputs, max_length=200)
print(tokenizer.decode(outputs[0]))
```

### With Ollama (Local Deployment)

1. Save the Modelfile:
```
FROM bigcode/starcoder2:7b
ADAPTER ./adapter_model.safetensors

SYSTEM "You are DevAI Assistant, a helpful coding assistant..."
```

2. Create and run:
```bash
ollama create devai-assistant -f Modelfile
ollama run devai-assistant
```

## Training Details

- **Epochs**: 3
- **Batch Size**: 2 (with gradient accumulation)
- **Learning Rate**: 2e-4
- **LoRA Rank**: 16
- **LoRA Alpha**: 32
- **Target Modules**: q_proj, k_proj, v_proj, o_proj, gate_proj, up_proj, down_proj

## Intended Use

This model is designed to help developers:
- Understand code structure and functionality
- Get explanations of complex algorithms
- Receive coding best practice suggestions
- Navigate and work with codebases more effectively

## Limitations

- Specialized for code assistance tasks
- May not perform as well on general text generation
- Requires base StarCoder2-7B model for inference

## Training Data

Trained on curated developer conversations focusing on:
- Code explanations and analysis
- Repository navigation assistance
- Programming best practices
- Debugging help and suggestions
"""
        
        # Save model card temporarily
        with tempfile.NamedTemporaryFile(mode='w', suffix='.md', delete=False) as f:
            f.write(model_card)
            model_card_path = f.name
        
        # Upload files
        print("📤 Uploading model files...")
        
        # Upload the adapter and config files
        files_to_upload = [
            ("adapter_model.safetensors", "adapter_model.safetensors"),
            ("adapter_config.json", "adapter_config.json"),
            ("tokenizer.json", "tokenizer.json"), 
            ("tokenizer_config.json", "tokenizer_config.json"),
            ("special_tokens_map.json", "special_tokens_map.json")
        ]
        
        # Upload each file
        for local_file, hub_file in files_to_upload:
            local_path = model_dir / local_file
            if local_path.exists():
                print(f"📤 Uploading {local_file}...")
                api.upload_file(
                    path_or_fileobj=str(local_path),
                    path_in_repo=hub_file,
                    repo_id=full_repo_name,
                    repo_type="model"
                )
            else:
                print(f"⚠️  Skipping missing file: {local_file}")
        
        # Upload model card
        print("📤 Uploading README.md...")
        api.upload_file(
            path_or_fileobj=model_card_path,
            path_in_repo="README.md",
            repo_id=full_repo_name,
            repo_type="model"
        )
        
        # Upload Modelfile for Ollama users
        if (model_dir / "Modelfile").exists():
            print("📤 Uploading Modelfile...")
            api.upload_file(
                path_or_fileobj=str(model_dir / "Modelfile"),
                path_in_repo="Modelfile",
                repo_id=full_repo_name,
                repo_type="model"
            )
        
        # Cleanup
        os.unlink(model_card_path)
        
        print(f"🎉 Successfully uploaded model to: https://huggingface.co/{full_repo_name}")
        print("\n📋 Next steps for users:")
        print(f"1. Install: pip install transformers peft")
        print(f"2. Load: PeftModel.from_pretrained(base_model, '{full_repo_name}')")
        print(f"3. Or use with Ollama using the provided Modelfile")
        
        return True
        
    except Exception as e:
        print(f"❌ Upload failed: {e}")
        return False

if __name__ == "__main__":
    print("🚀 DevAI Model Upload to Hugging Face Hub")
    print("=" * 50)
    
    if upload_devai_model():
        print("\n✅ Upload completed successfully!")
    else:
        print("\n❌ Upload failed. Check the errors above.")
        sys.exit(1)
