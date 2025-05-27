import os 
import sys 
import numpy as np 
import pandas as pd 
import torch
from datasets import Dataset
from transformers import AutoModelForCausalLM, AutoTokenizer, TrainingArguments
from peft import LoraConfig, get_peft_model
from trl import SFTTrainer

# 1. Load model and tokenizer
# 2. Configure LoRA
# 3. Load & format the data
# 4. Define training parameters
# 5. Create trainer (SFTT / Trainer)

# 6. Train the model
def train_model():
    print("Hello world")

train_model()

# 7. Save the fine-tuned model
