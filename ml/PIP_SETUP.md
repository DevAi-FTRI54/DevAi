### Scaffold

fine-tuning/
├── data/
│ ├── raw/ # Raw extracted data
│ ├── processed/ # Processed training data
│ └── evaluation/ # Evaluation datasets
├── models/
│ ├── base/ # Base models for fine-tuning
│ └── fine_tuned/ # Fine-tuned model outputs
├── scripts/
│ ├── data_preparation.py # Data processing scripts
│ ├── train.py # Fine-tuning script
│ └── evaluate.py # Model evaluation script
├── serve/
│ ├── api.py # FastAPI service for model inference
│ └── utils.py # Utility functions for serving
└── config.py # Configuration settings

### Python environment setup

1. Install Python
   brew install python@3.10
2. Navigate to the ML -> cd ml
3. Create a virtual environment ->
   python3 --version
   python3 -m venv venv
   source venv/bin/activate

4. Activate env ->
   source venv/bin/activate
5. Setup basic dependencies && Add most common ML libraries (as per below)
   touch requirements.txt
6. Install those dependencies ->
   pip install -r requiremenets.txt
7. Create basic project structure
   mkdir -p ml/{data,models,notebooks,scripts}
   touch ml/**init**.py

8. Workflow:
   cd ml
   source .venv/bin/activate # prompt changes, e.g. (.venv) $
   python scripts/train.py ...
   deactivate # optional when you’re done

9. FastAPI uvicorn
   - pip install fastapi uvicorn

### Most common ML libraries

```
# ML/Data Science core
numpy==1.24.3
pandas==2.0.3
scikit-learn==1.3.0

# Deep Learning (if needed)
torch==2.0.1
transformers==4.31.0

# Visualization
matplotlib==3.7.2
seaborn==0.12.2

# Utilities
jupyter==1.0.0
python-dotenv==1.0.0
```
