import os
import json
import time
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

def insert_user(email, name):
    # Create the next user ID based on the lenth of existing users
    users = supabase.table('usuario').select('user_id').execute().data
    user_id = f"U{len(users) + 1}"
    supabase.table('usuario').insert({
        "user_id": user_id,
        "email": email,
        "name": name
    }).execute()
    
def insert_ringing(bird_sci_name, email, ring_number, date, location, weight, max_wingspan, third_primary, tail, tarsus, beak, underskin_fat, brood_patch, sex, age, notes, ringed, origin):
    # Get user_id from email
    user = supabase.table('usuario').select('user_id').eq('email', email).execute().data
    if not user:
        raise ValueError("User with the provided email does not exist")
    user_id = user[0]['user_id']
    
    # Create the next ringing ID based on the length of existing ringings
    ringings = supabase.table('anillamiento').select('ringing_id').execute().data
    ringing_id = f"R{len(ringings) + 1}"
    
    # Get bird_id from bird_sci_name
    bird = supabase.table('ave').select('bird_id').eq('sci_name', bird_sci_name).execute().data
    if not bird:
        raise ValueError("Bird with the provided scientific name does not exist")
    bird_id = bird[0]['bird_id']

    supabase.table('anillamiento').insert({
        "ringing_id": ringing_id,
        "ring_number": ring_number,
        "date": date,
        "location": location,
        "weight": weight,
        "max_wingspan": max_wingspan,
        "third_primary": third_primary,
        "tail": tail,
        "tarsus": tarsus,
        "beak": beak,
        "underskin_fat": underskin_fat,
        "brood_patch": brood_patch,
        "sex": sex,
        "age": age,
        "notes": notes,
        "ringed": ringed,
        "origin": origin,
        "bird_id": bird_id,
        "user_id": user_id
    }).execute()
    
def get_ringings_made_by_user(email):
    # Do a natural join between usuario and anillamiento tables, and project only ringing fields
    result = supabase.table('usuario').select('*, anillamiento(*)').eq('email', email).execute().data
    return result

def get_ringings_by_user_of_bird(email, bird_sci_name):
    # Do a natural join between usuario, anillamiento and ave tables, and filter by email and bird scientific name
    result = supabase.table('usuario').select('*, anillamiento(*, ave(*))').eq('email', email).execute().data
    if not result:
        return []
    ringings = result[0].get('anillamiento', [])
    filtered_ringings = [r for r in ringings if r.get('ave', {}).get('sci_name') == bird_sci_name]
    return filtered_ringings

def add_descriptions_to_birds():
    with open('descriptions.json', 'r', encoding='utf-8') as file:
        descriptions = json.load(file)

    for bird, description in descriptions.items():
        supabase.table('ave').update({
            "description": description
        }).eq('sci_name', bird).execute()
        print(f"Updated description for {bird}")
        time.sleep(0.1)  # to avoid overwhelming the database
    print("All descriptions updated.")
    
if __name__ == "__main__":
    add_descriptions_to_birds()
