def calculate_truth_score(verdicts_and_trust: list) -> int:
    """
    Calculates the final truth score (1 to 100) based on formula:
    w1 * weighted_verdict + w2 * source_reliability
    """
    if not verdicts_and_trust:
        return 50  # Default middle ground if unverifiable

    # Defined weights
    w1 = 0.65 # Weight placed on the AI verdict of the claim
    w2 = 0.35 # Weight placed on the source's baseline reliability
    
    total_score = 0
    total_weight = 0

    for verdict, trust in verdicts_and_trust:
        # Score calculation per source
        source_score = (w1 * verdict) + (w2 * trust)
        total_score += source_score
        total_weight += 1

    avg_score = total_score / total_weight
    
    # Map from float [0, 1] to integer [1, 100]
    final_score = int(avg_score * 100)
    
    # Cap boundaries
    return max(1, min(100, final_score))
