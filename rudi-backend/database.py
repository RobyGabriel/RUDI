from sqlmodel import SQLModel, create_engine, Session

DATABASE_URL = "sqlite:///./rudi_database.db"

engine = create_engine(DATABASE_URL, echo=True)  # echo=True afișează query-urile SQL în terminal (util pentru debugging)

def create_db_and_tables():
    SQLModel.metadata.create_all(engine)

def get_session():
    with Session(engine) as session:
        yield session