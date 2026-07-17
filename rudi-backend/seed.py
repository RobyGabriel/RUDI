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
    users = [
        {
            "name": "Administrator",
            "email": "admin@thecon.ro",
            "station_id": "IT",
            "password": "Admin123!",
            "role": "admin"
        },
        {
            "name": "Darius Stoica",
            "email": "darius@thecon.ro",
            "station_id": "Birou 101",
            "password": "Pass123!",
            "role": "employee"
        },
        {
            "name": "Ionut Ichim",
            "email": "ionut@thecon.ro",
            "station_id": "Birou 202",
            "password": "Pass123!",
            "role": "employee"
        },
        {
            "name": "Roby Gabriel",
            "email": "robert@thecon.ro",
            "station_id": "Birou 303",
            "password": "Pass123!",
            "role": "employee"
        },
        {
            "name": "Cristi Campeanu",
            "email": "cristi@thecon.ro",
            "station_id": "Birou 404",
            "password": "Pass123!",
            "role": "employee"
        }
    ]

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
