import sys
from sqlmodel import Session, select
from database import engine
from models import RobotStatus
from datetime import datetime

with Session(engine) as session:
    status = session.exec(select(RobotStatus)).first()
    if not status:
        print("RobotStatus e gol. Inserez un rand default.")
        status = RobotStatus(battery=100, is_moving=False, delivery_status='idle')
        session.add(status)
        session.commit()
    else:
        print(f"Exista status activ: {status.delivery_status}, sender={status.sender_data}")

