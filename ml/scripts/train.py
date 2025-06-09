import os 
import sys 
import numpy as np 
import pandas as pd 
import torch
import json
import argparse
from datasets import Dataset
from transformers import BitsAndBytesConfig, AutoModelForCausalLM, AutoTokenizer, TrainingArguments
from peft import LoraConfig, get_peft_model, prepare_model_for_kbit_training
from trl import SFTTrainer

# --- 1. Load a Quantized model ------------------------------------------------
# Article: https://huggingface.co/blog/dvgodoy/fine-tuning-llm-hugging-face
# QLoRA: https://arxiv.org/pdf/2305.14314

bnb_config = BitsAndBytesConfig(
    load_in_4bit=True,
    bnb_4bit_quant_type="nf4", # Reducing the weights from 32 to 4 bits
    bnb_4bit_use_double_quant=True, # Another feature of QLoRA
    bnb_4bit_compute_dtype=torch.float32
)

repo_id = 'bigcode/starcoder2-7b' # Good coding reasoning
model = AutoModelForCausalLM.from_pretrained(
    repo_id, device_map="cuda:0", quantization_config=bnb_config
)

print(model.get_memory_footprint()/1e6)
# Even after quantization, the model still takes up a bit more than 2 gigabytes of RAM. 
# The quantization procedure focuses on the linear layers within the Transformer decoder blocks (also referred to as "layers" in some cases):
# Quantized model can be used for inference but not for any further training.
# So we reduce the space those layers take, but we can't update them -> LoRA.

# --- 2. Configure LoRA ---------------------------------------------------------
# Low-rank adapters can be attached to each and every quantized layer.
# The adapters are (mostly) regular Linear layers that can be updated.
# The trick: They're significantly smaller than the quantized layers.

model = prepare_model_for_kbit_training(model)

config = LoraConfig(
    r=8, # the rank of the adopter, the lower the fewer parameters we'll need to train
    lora_alpha=16, # multiplier, typically 2x
    bias="none",
    lora_dropout=0.05,
    task_type="CAUSAL_LM",
    target_modules=['o_proj', 'qkv_proj', 'gate_up_proj', 'down_proj'],
)

model = get_peft_model(model, config)

# The quantized layers (Linear4bit) have turned into lora.Linear4bit modules 
# There the quantized layer itself became the base_layer with some regular Linear layers (lora_A and lora_B) added to the mix.

# Since most parameters are frozen, only a tiny fraction of the total number of parameters are currently trainable, thanks to LoRA!
train_p, tot_p = model.get_nb_trainable_parameters()
print(f'Trainable parameters:      {train_p/1e6:.2f}M')
print(f'Total parameters:          {tot_p/1e6:.2f}M')
print(f'% of trainable parameters: {100*train_p/tot_p:.2f}%')


# 3. Load & format the data
def load_training_data(data_file):
    """Load training data from TypeScript backend export"""
    print(f"📊 Loading training data from: {data_file}")
    
    with open(data_file, 'r') as f:
        data = json.load(f)
    
    training_pairs = data['trainingPairs']
    print(f"✅ Found {len(training_pairs)} training pairs")
    print(f"📈 Stats: {data['stats']}")
    
    # Format for SFTTrainer - instruction-response format
    formatted_data = []
    for pair in training_pairs:
        # Create conversational format
        conversation = f"### Instruction:\n{pair['instruction']}\n\n### Response:\n{pair['response']}"
        formatted_data.append(conversation)
    
    return formatted_data

# 4. Tokenizer  
tokenizer = AutoTokenizer.from_pretrained(repo_id)
tokenizer.pad_token = tokenizer.eos_token
tokenizer.padding_side = "right"

def main():
    parser = argparse.ArgumentParser(description="Fine-tune DevAI Assistant on RunPod")
    parser.add_argument("--data", required=True, help="Path to training data JSON file from backend")
    parser.add_argument("--output", default="./devai_model", help="Output directory for fine-tuned model")
    parser.add_argument("--epochs", type=int, default=3, help="Number of training epochs")
    parser.add_argument("--batch_size", type=int, default=4, help="Training batch size")
    
    args = parser.parse_args()
    
    print("🔥 DevAI Fine-tuning on RunPod")
    print("=" * 50)
    print(f"🎯 Base model: {repo_id}")
    print(f"📊 Training data: {args.data}")
    print(f"💾 Output directory: {args.output}")
    print(f"🖥️  Device: {'CUDA' if torch.cuda.is_available() else 'CPU'}")
    
    if not torch.cuda.is_available():
        print("❌ ERROR: CUDA not available. This script requires GPU!")
        return
    
    # Load training data
    conversations = load_training_data(args.data)
    
    # Create dataset
    dataset = Dataset.from_dict({"text": conversations})
    print(f"📦 Dataset created with {len(dataset)} examples")
    
    # 5. Fine-tuning with SFTTrainer
    training_arguments = TrainingArguments(
        output_dir=args.output,
        num_train_epochs=args.epochs,
        per_device_train_batch_size=args.batch_size,
        gradient_accumulation_steps=2,
        optim="adamw_bnb_8bit",
        save_steps=100,
        logging_steps=25,
        learning_rate=2e-4,
        weight_decay=0.001,
        fp16=True,
        bf16=False,
        max_grad_norm=0.3,
        max_steps=-1,
        warmup_ratio=0.03,
        group_by_length=True,
        lr_scheduler_type="constant",
        report_to="tensorboard"
    )
    
    # SFT Trainer
    trainer = SFTTrainer(
        model=model,
        train_dataset=dataset,
        peft_config=config,
        dataset_text_field="text",
        tokenizer=tokenizer,
        args=training_arguments,
        packing=False,
        max_seq_length=1024,
    )
    
    # 6. Train the model
    print("🚀 Starting training...")
    trainer.train()
    
    # 7. Save the model
    trainer.model.save_pretrained(args.output)
    tokenizer.save_pretrained(args.output)
    
    print(f"✅ Training complete! Model saved to: {args.output}")
    
    # 8. Test the model
    print("\n🧪 Testing the fine-tuned model...")
    
    # Switch to eval mode
    model.eval()
    
    # Test prompt
    test_prompt = "### Instruction:\nUser: How do I create a React component?\n\n### Response:\n"
    
    inputs = tokenizer(test_prompt, return_tensors="pt").to("cuda")
    
    with torch.no_grad():
        outputs = model.generate(
            **inputs,
            max_new_tokens=200,
            do_sample=True,
            temperature=0.7,
            top_p=0.9,
            pad_token_id=tokenizer.eos_token_id
        )
    
    response = tokenizer.decode(outputs[0][inputs['input_ids'].shape[1]:], skip_special_tokens=True)
    print(f"🤖 Model response: {response}")
    
    # 9. Create Ollama Modelfile
    create_ollama_modelfile(args.output)
    
    print("\n🎉 Fine-tuning complete!")
    print("\n📋 Next steps:")
    print(f"   1. Download the model directory: {args.output}")
    print("   2. Load into Ollama: ollama create devai-assistant -f ./Modelfile")
    print("   3. Test: ollama run devai-assistant")
    print("   4. Update your RAG service to use 'devai-assistant'")

def create_ollama_modelfile(model_dir):
    """Create Ollama Modelfile for the fine-tuned model"""
    modelfile_content = f"""FROM {model_dir}

    SYSTEM You are DevAI Assistant, a helpful coding assistant specialized in helping developers understand and work with their codebase. You provide clear, concise answers about code structure, functionality, and best practices.

    You can reference specific files and line numbers when providing explanations. Format your responses to be helpful for developers working on their projects.

    PARAMETER temperature 0.7
    PARAMETER top_p 0.9
    PARAMETER stop "### Instruction:"
    PARAMETER stop "User:"

    TEMPLATE \"\"\"### Instruction:
    {{{{ .Prompt }}}}

    ### Response:
    {{{{ .Response }}}}\"\"\"
    """
    
    modelfile_path = os.path.join(model_dir, "Modelfile")
    with open(modelfile_path, 'w') as f:
        f.write(modelfile_content)
    
    print(f"✅ Ollama Modelfile created: {modelfile_path}")

if __name__ == "__main__":
    main()