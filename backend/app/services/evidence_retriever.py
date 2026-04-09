import os
import json
import requests
from urllib.parse import urlparse
from dotenv import load_dotenv

# Resolve project root dir (3 levels up from this file)
project_root = os.path.abspath(os.path.join(os.path.dirname(__file__), "../../../"))
env_path = os.path.join(project_root, ".env")
load_dotenv(env_path)

TAVILY_API_KEY = os.getenv("TAVILY_API_KEY")
TRUST_SCORES_PATH = os.path.join(project_root, "data", "domain_trust_scores.json")

def load_trust_scores():
    try:
        with open(TRUST_SCORES_PATH, "r", encoding="utf-8") as f:
            return json.load(f)
    except Exception as e:
        print(f"Warning: Failed to load trust scores from {TRUST_SCORES_PATH} - {e}")
        return {}

TRUST_SCORES = load_trust_scores()

def get_domain(url: str) -> str:
    try:
        domain = urlparse(url).netloc
        if domain.startswith("www."):
            domain = domain[4:]
        return domain
    except:
        return "unknown"

def get_trust_score(domain: str) -> float:
    domain = domain.lower()
    if domain in TRUST_SCORES:
        return TRUST_SCORES[domain]
    
    parts = domain.split(".")
    if len(parts) > 2:
        root_domain = ".".join(parts[-2:])
        if root_domain in TRUST_SCORES:
            return TRUST_SCORES[root_domain]
            
    return TRUST_SCORES.get("unknown", 0.15)

def search_tavily(query: str):
    if not TAVILY_API_KEY:
        print("Error: TAVILY_API_KEY is not set. Searching capabilities might be impacted.")
        
    url = "https://api.tavily.com/search"
    tavily_query = query[:350].strip()
    
    payload = {
        "api_key": TAVILY_API_KEY,
        "query": tavily_query,
        "search_depth": "basic",
        "include_answer": False,
        "include_raw_content": False,
        "max_results": 5
    }
    try:
        if TAVILY_API_KEY:
            response = requests.post(url, json=payload, timeout=12)
            response.raise_for_status()
            data = response.json()
            results = data.get("results", [])
        else:
            return []
        
        parsed_results = []
        for res in results:
            domain = get_domain(res["url"])
            parsed_results.append({
                "title": res.get("title", "No Title Provided"),
                "url": res["url"],
                "content": res.get("content", ""),
                "domain": domain,
                "trust_score": get_trust_score(domain)
            })
        return parsed_results
    except Exception as e:
        print(f"Tavily search error: {e}")
        return []
