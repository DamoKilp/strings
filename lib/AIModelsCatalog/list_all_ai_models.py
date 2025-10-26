# /Ventiam/lib/AIModelsCatalog/list_all_ai_models.py
import os
from dotenv import load_dotenv
import json
import datetime
import traceback
import re

# Attempt to import provider SDKs
try:
    from google import genai as google_genai
except ImportError:
    google_genai = None
    print("Warning: Google GenAI SDK ('google-genai') not found. Skipping Google models.")

try:
    from openai import OpenAI
except ImportError:
    OpenAI = None
    print("Warning: OpenAI SDK ('openai') not found. Skipping OpenAI models.")

try:
    from anthropic import Anthropic, APIStatusError, APIConnectionError, RateLimitError, APIError
except ImportError:
    Anthropic = None
    print("Warning: Anthropic SDK ('anthropic') not found. Skipping Anthropic models.")

# --- Path Configuration ---
SCRIPT_DIR = os.path.dirname(os.path.abspath(__file__))  # /Ventiam/lib/AIModelsCatalog
AI_MODELS_CATALOG_DIR = SCRIPT_DIR 
LIB_DIR = os.path.dirname(AI_MODELS_CATALOG_DIR) # /Ventiam/lib
PROJECT_ROOT_DIR = os.path.dirname(LIB_DIR)  # /Ventiam

# Path to .env in the project root
DOTENV_PATH = os.path.join(PROJECT_ROOT_DIR, '.env')
# Path to the target models.json file in the /Ventiam/lib/ directory
MODELS_JSON_PATH = os.path.join(LIB_DIR, 'models.json')


# --- Custom JSON Encoder for Datetime objects ---
class DateTimeEncoder(json.JSONEncoder):
    def default(self, obj):
        if isinstance(obj, (datetime.date, datetime.datetime)):
            return obj.isoformat()
        return super().default(obj)

# --- Load Environment Variables ---
def load_envs():
    if os.path.exists(DOTENV_PATH):
        load_dotenv(DOTENV_PATH)
        print(f"Loaded .env from: {DOTENV_PATH}")
    else:
        print(f"Warning: .env file not found at {DOTENV_PATH}. API keys must be in environment.")

load_envs()

# --- Helper Functions ---
def apply_heuristics_for_new_model(model_id, display_name, provider_short_id, api_data=None):
    """
    Applies heuristics to determine boolean capability flags for NEWLY discovered models.
    This is a best-effort approximation.
    """
    api_data = api_data or {}
    model_id_lower = model_id.lower()
    name_lower = (display_name or model_id).lower()

    # Default capabilities for a new model
    capabilities = {
        "multiModal": False,
        "canSearch": False,
        "canGenerateImages": False,
        "isAdvancedReasoner": False,
        "canAccessInternet": False,
        "supportsReasoning": True 
    }

    if provider_short_id == "google":
        if "gemini" in model_id_lower or "gemini" in name_lower:
            capabilities["multiModal"] = True
            if "pro" in model_id_lower or "ultra" in model_id_lower or re.search(r'exp.*(pro|advanced)', model_id_lower) or "gemini-1.5" in model_id_lower or "gemini-2.5" in model_id_lower:
                capabilities["isAdvancedReasoner"] = True
            if "flash" in model_id_lower and not ("2.5" in model_id_lower or "exp" in model_id_lower): # Newer flash might be better
                capabilities["isAdvancedReasoner"] = False
        
        if "imagen" in model_id_lower:
            capabilities["multiModal"] = True
            capabilities["canGenerateImages"] = True
            capabilities["supportsReasoning"] = False
        
        supported_actions = api_data.get("supportedActions", [])
        if not supported_actions and not ("gemini" in model_id_lower or "imagen" in model_id_lower):
            capabilities["supportsReasoning"] = False
        
        # Mimic your existing data for newer Gemini models
        if "gemini" in model_id_lower and ("1.5" in model_id_lower or "2.0" in model_id_lower or "2.5" in model_id_lower or "exp" in model_id_lower or "preview" in model_id_lower):
            capabilities["canSearch"] = True
            capabilities["canAccessInternet"] = True
            # some newer Gemini can generate images (e.g. through tools, or future direct capabilities)
            if "2.5" in model_id_lower or "pro" in model_id_lower: # Example: newer Pro might imply broader capabilities
                 capabilities["canGenerateImages"] = True


    elif provider_short_id == "openai":
        # Baselines by family
        if model_id_lower.startswith("gpt-3.5"):
            capabilities["multiModal"] = False
            capabilities["isAdvancedReasoner"] = False
        elif model_id_lower.startswith("gpt-4o"):
            capabilities["multiModal"] = True
            # mini tiers are less reasoning focused
            capabilities["isAdvancedReasoner"] = not ("mini" in model_id_lower or "nano" in model_id_lower)
        elif model_id_lower.startswith("gpt-4"):
            # 4.1 family often multimodal via 4o variants; plain 4 preview entries treated non-multimodal unless 4o
            capabilities["multiModal"] = ("gpt-4o" in model_id_lower or "4.1" in model_id_lower or "4o" in model_id_lower)
            capabilities["isAdvancedReasoner"] = True
        elif model_id_lower.startswith("gpt-5"):
            # Conservative default: don't assume multimodal unless probed; keep reasoning true
            capabilities["multiModal"] = False
            capabilities["isAdvancedReasoner"] = True
        elif model_id_lower.startswith("o"):
            # o* families (o1, o3, o4) typically multimodal
            capabilities["multiModal"] = True
            capabilities["isAdvancedReasoner"] = True and ("mini" not in model_id_lower)

        # Image generation family
        if model_id_lower.startswith("dall-e") or model_id_lower.startswith("gpt-image"):
            capabilities["multiModal"] = True
            capabilities["canGenerateImages"] = True
            capabilities["supportsReasoning"] = False


    elif provider_short_id == "anthropic":
        if "claude-3" in model_id_lower:
            capabilities["multiModal"] = True
        
        if "opus" in model_id_lower or "claude-3-5-sonnet" in model_id_lower or "claude-3.7-sonnet" in model_id_lower: # 3.7 is hypothetical for future
            capabilities["isAdvancedReasoner"] = True
        elif "sonnet" in model_id_lower and "claude-3" in model_id_lower:
             capabilities["isAdvancedReasoner"] = True
        elif "haiku" in model_id_lower or "instant" in model_id_lower:
            capabilities["isAdvancedReasoner"] = False
        
        if "claude-3-5-sonnet" in model_id_lower or "claude-3.7-sonnet" in model_id_lower : # Future-proofing for 3.7
            capabilities["canSearch"] = True 
            capabilities["canAccessInternet"] = True
            capabilities["canGenerateImages"] = True # This capability is often via tools/integrations for Claude

    if not capabilities["supportsReasoning"]:
        capabilities["isAdvancedReasoner"] = False

    return capabilities

# --- Provider Specific Fetchers ---
def fetch_and_transform_models(fetch_function, provider_name, provider_short_id):
    print(f"\nFetching {provider_name} models...")
    transformed_models = []
    try:
        raw_api_models = fetch_function()
        for api_model_data in raw_api_models:
            model_id = api_model_data.get("id", f"unknown_{provider_short_id}_id")
            display_name_from_api = api_model_data.get("displayName", model_id)
            
            # Construct a more human-readable name if it's just an ID
            name = display_name_from_api
            if provider_short_id == "openai" and not model_id.startswith("dall-e") and model_id == display_name_from_api:
                name = model_id.replace('-', ' ').replace('_', ' ').title()
                if "Gpt" in name: name = name.replace("Gpt", "GPT")
                if " Dall E" in name: name = name.replace(" Dall E", " DALL·E") # For Dall-E if ID was used
            elif provider_short_id == "google" and model_id.startswith("models/"): # Clean up Google IDs for name
                name = display_name_from_api.replace("models/", "").replace("-", " ").title()

            schema_entry = {
                "id": model_id,
                "provider": provider_name,
                "providerId": provider_short_id,
                "name": name,
                # Default flags will be applied or overridden by existing data later
                **apply_heuristics_for_new_model(model_id, name, provider_short_id, api_model_data)
            }
            transformed_models.append(schema_entry)
            print(f"  Fetched & Transformed {provider_name} Model: {model_id} as {name}")
        print(f"Fetched and transformed {len(transformed_models)} {provider_name} models.")
    except Exception as e:
        print(f"Error during {provider_name} model processing: {e}")
        # traceback.print_exc() # Uncomment for full trace
    return transformed_models

def raw_fetch_google():
    if not google_genai: return []
    api_key = os.getenv("GOOGLE_API_KEY")
    if not api_key: return []
    client = google_genai.Client(api_key=api_key)
    models = []
    for m in client.models.list():
        models.append({
            "id": m.name, "displayName": m.display_name, 
            "description": m.description, "version": m.version,
            "supportedActions": m.supported_actions
        })
    return models

def raw_fetch_openai():
    if not OpenAI: return []
    api_key = os.getenv("OPENAI_API_KEY")
    if not api_key: return []
    client = OpenAI(api_key=api_key)
    models = []
    for m in client.models.list().data:
        models.append({
            "id": m.id,
            "displayName": m.id,
            "created": m.created,
            "owned_by": getattr(m, 'owned_by', ''),
            "object": getattr(m, 'object', ''),
            "permissions": [p.__dict__ for p in getattr(m, 'permission', [])] if hasattr(m, 'permission') else []
        })
    return models

def probe_openai_model_supports_image(model_id: str) -> bool:
    """Try a tiny vision request against the chat/completions API with a 1x1 data URI.
    Returns True if the request doesn't error on image content type.
    Controlled by ENABLE_OPENAI_PROBES env var.
    """
    if not OpenAI: return False
    api_key = os.getenv("OPENAI_API_KEY")
    if not api_key: return False
    client = OpenAI(api_key=api_key)
    # 1x1 transparent PNG
    data_uri = "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR4nGNgYAAAAAMAASsJTYQAAAAASUVORK5CYII="
    try:
        client.chat.completions.create(
            model=model_id,
            messages=[{
                "role": "user",
                "content": [
                    {"type": "text", "text": "describe"},
                    {"type": "image_url", "image_url": {"url": data_uri}}
                ]
            }],
            max_tokens=5
        )
        return True
    except Exception:
        return False

def raw_fetch_anthropic():
    if not Anthropic: return []
    api_key = os.getenv("CLAUDE_API_KEY")
    if not api_key: return []
    client = Anthropic(api_key=api_key)
    models = []
    for m in client.models.list(limit=100).data:
        models.append({"id": m.id, "displayName": m.display_name, "created_at": m.created_at})
    return models

# --- Main Execution ---
def main():
    print(f"Script location: {SCRIPT_DIR}")
    print(f"Project root: {PROJECT_ROOT_DIR}")
    print(f".env file path: {DOTENV_PATH}")
    print(f"Target models.json file: {MODELS_JSON_PATH}")
    
    managed_provider_ids = ["google", "openai", "anthropic"]
    refresh_caps = os.getenv("REFRESH_CAPS", "0") in ("1", "true", "True")
    enable_openai_probes = os.getenv("ENABLE_OPENAI_PROBES", "0") in ("1", "true", "True")
    
    # 1. Load existing models.json
    current_models_list = []
    if os.path.exists(MODELS_JSON_PATH):
        try:
            with open(MODELS_JSON_PATH, 'r', encoding='utf-8') as f:
                data = json.load(f)
                current_models_list = data.get("models", [])
                print(f"Loaded {len(current_models_list)} models from existing {MODELS_JSON_PATH}")
        except json.JSONDecodeError:
            print(f"Error decoding JSON from {MODELS_JSON_PATH}. Starting with an empty list.")
        except Exception as e:
            print(f"Error loading {MODELS_JSON_PATH}: {e}. Starting with an empty list.")
    else:
        print(f"{MODELS_JSON_PATH} not found. A new file will be created.")

    # Create a dictionary for quick lookup and update of managed provider models
    # Key: (providerId, modelId), Value: model_dict
    existing_managed_models_map = {
        (m["providerId"], m["id"]): m 
        for m in current_models_list if m["providerId"] in managed_provider_ids
    }
    
    # Separate models from other providers to preserve them
    other_provider_models = [
        m for m in current_models_list if m["providerId"] not in managed_provider_ids
    ]
    print(f"Preserving {len(other_provider_models)} models from other providers.")

    # 2. Fetch fresh model data from APIs and transform
    all_fetched_api_models = []
    all_fetched_api_models.extend(fetch_and_transform_models(raw_fetch_google, "Google Generative AI", "google"))
    all_fetched_api_models.extend(fetch_and_transform_models(raw_fetch_openai, "OpenAI", "openai"))
    all_fetched_api_models.extend(fetch_and_transform_models(raw_fetch_anthropic, "Anthropic", "anthropic"))

    updated_managed_models_list = []
    
    # 3. Update existing managed models or add new ones
    for fetched_model in all_fetched_api_models:
        lookup_key = (fetched_model["providerId"], fetched_model["id"])
        if lookup_key in existing_managed_models_map:
            # Model exists, update it; preserve flags unless REFRESH_CAPS=1
            existing_model_entry = existing_managed_models_map[lookup_key]
            updated_entry = fetched_model.copy() # Start with fresh API data (like name)
            
            # Preserve or refresh boolean flags
            for flag in ["multiModal", "canSearch", "canGenerateImages", "isAdvancedReasoner", "canAccessInternet", "supportsReasoning"]:
                if not refresh_caps and flag in existing_model_entry:
                    updated_entry[flag] = existing_model_entry[flag]
                elif flag not in updated_entry:
                    updated_entry[flag] = apply_heuristics_for_new_model(fetched_model["id"], fetched_model["name"], fetched_model["providerId"]).get(flag, False)


            updated_managed_models_list.append(updated_entry)
            del existing_managed_models_map[lookup_key] # Remove from map as it's processed
        else:
            # New model from managed provider, heuristics already applied
            updated_managed_models_list.append(fetched_model)

    # Optional: probe select OpenAI models to confirm image support
    if enable_openai_probes:
        candidates = [m for m in updated_managed_models_list if m.get("providerId") == "openai"]
        for m in candidates:
            mid = m.get("id", "").lower()
            # Probe only a small subset to keep fast
            if mid.startswith("gpt-4o") or mid.startswith("o") or mid.startswith("gpt-5"):
                try:
                    if probe_openai_model_supports_image(m["id"]):
                        m["multiModal"] = True
                except Exception:
                    pass
            
    # Add back any managed models from the original file that were NOT found in the API list
    # This handles cases where a model might have been temporarily unavailable from API but you want to keep its entry
    # However, typically, if an API doesn't list it, it's no longer available.
    # For now, we'll assume that if it's not in the API list, it shouldn't be in the updated managed list.
    # If you want to keep stale entries, you'd add existing_managed_models_map.values() here.

    # 4. Combine lists: updated managed models + preserved other provider models
    final_models_list = sorted(
        updated_managed_models_list + other_provider_models, 
        key=lambda x: (x["providerId"], x["id"]) # Sort for consistency
    )
    
    # 5. Write to models.json
    output_data = {"models": final_models_list}
    
    try:
        with open(MODELS_JSON_PATH, 'w', encoding='utf-8') as f:
            json.dump(output_data, f, indent=2, cls=DateTimeEncoder) # Using indent=2 to match your example
        print(f"\nSuccessfully updated {MODELS_JSON_PATH} with {len(final_models_list)} models.")
    except Exception as e:
        print(f"Error writing to {MODELS_JSON_PATH}: {e}")
        traceback.print_exc()

if __name__ == "__main__":
    main()