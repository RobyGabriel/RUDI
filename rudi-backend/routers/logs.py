from fastapi import APIRouter, Depends
from sqlmodel import Session, select
from typing import List

from database import get_session
from models import CommandLog
from auth import verify_api_key

router = APIRouter(prefix="/logs", tags=["logs"], dependencies=[Depends(verify_api_key)])


@router.get("", response_model=List[CommandLog])
def list_logs(session: Session = Depends(get_session)):
    statement = select(CommandLog).order_by(CommandLog.timestamp.desc())
    return session.exec(statement).all()