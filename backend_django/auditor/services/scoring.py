from typing import List, Dict, Optional, Tuple

RULE_POINTS = {
    "C": 1.0,
    "P": 0.5,
    "N": 0.0,
    "E": None,
}

RULE_LABELS = {
    "C": "cumple",
    "P": "parcial",
    "N": "no cumple",
    "E": "no evaluable",
}


def calculate_official_score(rules: List[Dict]) -> Tuple[Optional[int], Optional[str]]:
    points = 0.0
    evaluated = 0
    for rule in rules:
        status = rule.get("status")
        val = RULE_POINTS.get(status)
        if val is not None:
            points += val
            evaluated += 1

    if evaluated == 0:
        return 0, "bajo"

    pct = round((points / evaluated) * 100)
    if pct >= 85:
        classification = "alto"
    elif pct >= 50:
        classification = "parcial"
    else:
        classification = "bajo"

    return pct, classification
