from fastapi import APIRouter, Depends, HTTPException
from sqlmodel import Session, select
from typing import List, Optional
from pydantic import BaseModel

from database import get_session
from models import Employee
from security import hash_password, verify_password
from auth import verify_api_key

router = APIRouter(prefix="/employees", tags=["employees"], dependencies=[Depends(verify_api_key)])


class EmployeeCreate(BaseModel):
    name: str
    email: str
    station_id: str
    department: Optional[str] = None
    password: str
    x: Optional[float] = None
    y: Optional[float] = None
    role: Optional[str] = "employee"


class EmployeeRead(BaseModel):
    id: int
    name: str
    email: str
    station_id: str
    department: Optional[str] = None
    x: Optional[float] = None 
    y: Optional[float] = None 
    role: str


class EmployeeUpdate(BaseModel):
    name: Optional[str] = None
    email: Optional[str] = None
    station_id: Optional[str] = None
    department: Optional[str] = None
    x: Optional[float] = None
    y: Optional[float] = None
    role: Optional[str] = None


class LoginRequest(BaseModel):
    email: str
    password: str


class ChangePasswordRequest(BaseModel):
    new_password: str


@router.post("", response_model=EmployeeRead)
def create_employee(data: EmployeeCreate, session: Session = Depends(get_session)):
    employee = Employee(
        name=data.name,
        email=data.email,
        station_id=data.station_id,
        department=data.department,
        hashed_password=hash_password(data.password),
        x=data.x,
        y=data.y,
        role=data.role or "employee",
    )
    session.add(employee)
    session.commit()
    session.refresh(employee)
    return employee


@router.get("", response_model=List[EmployeeRead])
def list_employees(session: Session = Depends(get_session)):
    return session.exec(select(Employee)).all()


@router.get("/{employee_id}", response_model=EmployeeRead)
def get_employee(employee_id: int, session: Session = Depends(get_session)):
    employee = session.get(Employee, employee_id)
    if not employee:
        raise HTTPException(status_code=404, detail="Angajat inexistent")
    return employee


@router.put("/{employee_id}", response_model=EmployeeRead)
def update_employee(employee_id: int, data: EmployeeUpdate, session: Session = Depends(get_session)):
    employee = session.get(Employee, employee_id)
    if not employee:
        raise HTTPException(status_code=404, detail="Angajat inexistent")
    
    update_data = data.model_dump(exclude_unset=True)
    for key, value in update_data.items():
        setattr(employee, key, value)
    
    session.add(employee)
    session.commit()
    session.refresh(employee)
    return employee


@router.delete("/{employee_id}")
def delete_employee(employee_id: int, session: Session = Depends(get_session)):
    employee = session.get(Employee, employee_id)
    if not employee:
        raise HTTPException(status_code=404, detail="Angajat inexistent")
    session.delete(employee)
    session.commit()
    return {"message": f"Angajatul {employee.name} a fost șters"}


@router.post("/login", response_model=EmployeeRead)
def login(data: LoginRequest, session: Session = Depends(get_session)):
    statement = select(Employee).where(Employee.email == data.email)
    employee = session.exec(statement).first()

    if not employee or not verify_password(data.password, employee.hashed_password):
        raise HTTPException(status_code=401, detail="Email sau parolă incorectă")

    return employee


@router.post("/{employee_id}/change-password")
def change_password(employee_id: int, data: ChangePasswordRequest, session: Session = Depends(get_session)):
    employee = session.get(Employee, employee_id)
    if not employee:
        raise HTTPException(status_code=404, detail="Angajat inexistent")
    
    employee.hashed_password = hash_password(data.new_password)
    session.add(employee)
    session.commit()
    return {"message": "Parola a fost modificată cu succes"}


@router.post("/{employee_id}/reset-password")
def reset_password(employee_id: int, session: Session = Depends(get_session)):
    employee = session.get(Employee, employee_id)
    if not employee:
        raise HTTPException(status_code=404, detail="Angajat inexistent")
    
    default_password = "Pass123!"
    employee.hashed_password = hash_password(default_password)
    session.add(employee)
    session.commit()
    return {"default_password": default_password}