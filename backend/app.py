import os
import json
from dotenv import load_dotenv
from supabase import create_client, Client

load_dotenv()

url: str = os.environ.get("SUPABASE_URL")
key: str = os.environ.get("SUPABASE_KEY")
if not url or not key:
    raise ValueError("SUPABASE_URL and SUPABASE_KEY must be set in environment variables")

supabase: Client = create_client(url, key)

def insert_birds():
    with open('birds_spain.json', 'r', encoding='utf-8') as file:
        birds_data = json.load(file)
    
    i = 1
    for bird in birds_data:
        bird_id = f"A{i}"
        common_name = bird.get('especie', 'Unknown')
        sci_name = bird.get('sciName', 'Unknown')
        family = bird.get('familia', 'Unknown')
        peninsule = bool(bird.get('PB', False))
        canary_islands = bool(bird.get('CA', False))
        north_africa = bool(bird.get('NA', False))

        supabase.table('ave').insert({
            "bird_id": bird_id,
            "common_name": common_name,
            "sci_name": sci_name,
            "family": family,
            "description": "",
            "peninsule": peninsule,
            "canary_islands": canary_islands,
            "north_africa": north_africa
        }).execute()
        i += 1

if __name__ == "__main__":
    insert_birds()