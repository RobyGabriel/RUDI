import os
from sqlmodel import Session
from database import create_db_and_tables, engine
from models import Employee
from security import hash_password

def seed():
    # Remove existing DB file to ensure clean schema update
    db_file = "rudi_database.db"
    if os.path.exists(db_file):
        os.remove(db_file)
        print(f"Removed old database file: {db_file}")

    print("Creating tables...")
    create_db_and_tables()

    print("Seeding database...")
    # S-au șters conturile mock (thecon.ro). 
    # Dacă dorești să adaugi un administrator inițial, o poți face aici.
    users = []

    with Session(engine) as session:
        for u in users:
            emp = Employee(
                name=u["name"],
                email=u["email"],
                station_id=u["station_id"],
                hashed_password=hash_password(u["password"]),
                role=u["role"]
            )
            session.add(emp)
        session.commit()
    print("Database seeded successfully!")

if __name__ == "__main__":
    seed()
