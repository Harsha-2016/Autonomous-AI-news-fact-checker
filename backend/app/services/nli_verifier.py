import torch
from transformers import AutoModelForSequenceClassification, AutoTokenizer

model_name = "cross-encoder/nli-distilroberta-base"
tokenizer = None
model = None

def get_model():
    global tokenizer, model
    if tokenizer is None or model is None:
        print("Loading NLI model (this might take a few moments on the first run)...")
        tokenizer = AutoTokenizer.from_pretrained(model_name)
        model = AutoModelForSequenceClassification.from_pretrained(model_name)
    return tokenizer, model

def verify_claim(claim: str, evidence: str) -> float:
    """
    Checks the evidence against the claim using NLI. 
    Returns a verdict score from 0.0 (contradiction) to 1.0 (entailment).
    """
    tk, md = get_model()
    # Tokenize with safety truncation limits
    features = tk([claim], [evidence], padding=True, truncation=True, max_length=512, return_tensors="pt")
    
    with torch.no_grad():
        scores = md(**features).logits
        probs = torch.nn.functional.softmax(scores, dim=1)[0]
        
        # label mapping for cross-encoder/nli-distilroberta-base:
        # 0: contradiction, 1: entailment, 2: neutral
        contradiction_prob = probs[0].item()
        entailment_prob = probs[1].item()
        neutral_prob = probs[2].item()
        
        # Calculate a weighted verdict
        verdict = entailment_prob * 1.0 + neutral_prob * 0.5 + contradiction_prob * 0.0
        return verdict
