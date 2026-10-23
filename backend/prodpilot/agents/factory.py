"""Agent adapter factory for ProdPilot."""

import os
from typing import Optional
from contracts.agent_interface import AgentAdapter
from backend.prodpilot.agents.antigravity_adapter import AntigravityAdapter
from backend.prodpilot.agents.gemini_adapter import GeminiAdapter


def get_agent_adapter(adapter_name: Optional[str] = None) -> AgentAdapter:
    """Returns the configured agent adapter instance.
    
    Order of selection:
    1. Explicit adapter_name argument
    2. PRODPILOT_AGENT_ADAPTER environment variable ("antigravity", "gemini")
    3. If agy CLI is available on system, defaults to AntigravityAdapter
    4. Fallback to GeminiAdapter
    """
    choice = (adapter_name or os.environ.get("PRODPILOT_AGENT_ADAPTER", "auto")).lower()
    
    if choice == "antigravity":
        return AntigravityAdapter()
    elif choice == "gemini":
        return GeminiAdapter()
    elif choice == "auto":
        ag = AntigravityAdapter()
        if ag.is_available():
            return ag
        return GeminiAdapter()
    
    return GeminiAdapter()
