"""Configuration loader service for domain trust scores."""

import os
import json
import logging
from typing import Dict

logger = logging.getLogger(__name__)


def load_domain_weights() -> Dict[str, float]:
    """
    Load domain trust scores from predefined weights and optional JSON file.
    
    Loads predefined domain weights for 9 trusted domains, then attempts to load
    additional weights from data/domain_trust_scores.json if it exists. File weights
    override predefined weights. All weights are validated to be in the range [0.0, 1.0].
    
    Returns:
        Dict[str, float]: Mapping of domain names to trust scores (0.0-1.0).
                         Unknown domains default to 0.5.
    
    Raises:
        None - All errors are logged and handled gracefully.
    """
    # Predefined domain weights for 9 trusted domains
    weights = {
        "reuters.com": 0.95,
        "apnews.com": 0.95,
        "bbc.com": 0.92,
        "isro.gov.in": 0.96,
        "rbi.org.in": 0.97,
        "who.int": 0.93,
        "snopes.com": 0.85,
        "wikipedia.org": 0.60,
        "reddit.com": 0.25
    }
    
    # Attempt to load additional weights from JSON file
    project_root = os.path.abspath(os.path.join(os.path.dirname(__file__), "../../.."))
    json_path = os.path.join(project_root, "data", "domain_trust_scores.json")
    
    try:
        with open(json_path, "r", encoding="utf-8") as f:
            file_weights = json.load(f)
            weights.update(file_weights)
            logger.info(f"Loaded additional domain weights from {json_path}")
    except FileNotFoundError:
        logger.debug(f"Domain weights file not found at {json_path}, using predefined weights only")
    except json.JSONDecodeError as e:
        logger.warning(f"Invalid JSON in domain weights file {json_path}: {e}")
    except Exception as e:
        logger.warning(f"Could not load domain weights from {json_path}: {e}")
    
    # Validate weights - ensure all values are floats in range [0.0, 1.0]
    for domain, weight in list(weights.items()):
        if not isinstance(weight, (int, float)) or not (0.0 <= weight <= 1.0):
            logger.warning(
                f"Invalid weight for domain '{domain}': {weight} (must be 0.0-1.0), "
                f"using default weight of 0.5"
            )
            weights[domain] = 0.5
    
    logger.info(f"Loaded {len(weights)} domain weights")
    return weights
