import os
from sqlmodel import Session
from database import create_db_and_tables, engine
from models import Employee, RobotStatus
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
            "name": "Admin",
            "email": "admin@test.com",
            "station_id": "IT",
            "password": "admin123",
            "role": "admin"
        },
        {
            "name": "Darius Popescu",
            "email": "darius@thecon.ro",
            "station_id": "Birou 101",
            "password": "Pass123!",
            "role": "employee"
        },
        {
            "name": "Ion Marinescu",
            "email": "ion@thecon.ro",
            "station_id": "Birou 202",
            "password": "Pass123!",
            "role": "employee"
        },
        {
            "name": "Roby Gabriel",
            "email": "roby@thecon.ro",
            "station_id": "Birou 303",
            "password": "Pass123!",
            "role": "employee"
        },
        {
            "name": "Ana Ionescu",
            "email": "ana@thecon.ro",
            "station_id": "Birou 404",
            "password": "Pass123!",
            "role": "employee"
        },
        {
            "name": "Test User",
            "email": "test@test.com",
            "station_id": "Desk_1",
            "password": "test123",
            "role": "employee"
        },
        {
            "name": "Test User 2",
            "email": "test2@test.com",
            "station_id": "Desk_2",
            "password": "test123",
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

        # Seed an initial robot status row so /map/full and /robot/status
        # have something to return before the ESP32 sends its first update.
        robot = RobotStatus(
            battery=100,
            current_station=None,
            is_moving=False,
            x=0.0,
            y=0.0,
            heading=0.0,
            delivery_status='idle',
        )
        session.add(robot)

        session.commit()
    print("Database seeded successfully!")

if __name__ == "__main__":
    seed()
