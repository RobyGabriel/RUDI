import asyncio
import math
from sqlmodel import Session, select
from database import engine
from models import RobotStatus

async def start_mock_ros():
    # --- Circle Parameters ---
    theta = 0.0              # Starting angle in radians
    center_x = 2.5
    center_y = 2.5
    radius = 1.5      # Radius of the circle in meters
    angular_velocity = 0.5   # How fast it turns (radians per second)

    while True:
        await asyncio.sleep(1.0)  # Updates position every 1 second
        
        # 1. Calculate the new X and Y coordinates on the circle
        new_x = center_x + radius * math.cos(theta)
        new_y = center_y + radius * math.sin(theta)
        
        # 2. Calculate heading (the robot should face tangent to the circle, which is theta + 90 degrees)
        new_heading = theta + (math.pi / 2)
        
        # Normalize heading to keep it between -PI and PI (standard ROS convention)
        new_heading = (new_heading + math.pi) % (2 * math.pi) - math.pi

        # 3. Update the database
        with Session(engine) as session:
            robot = session.exec(select(RobotStatus)).first()
            
            if not robot:
                # Initialize robot if it doesn't exist in DB yet
                robot = RobotStatus(
                    x=new_x, 
                    y=new_y, 
                    heading=new_heading, 
                    is_moving=True, 
                    current_state="idle"
                )
                session.add(robot)
            else:
                # Update existing robot
                robot.x = new_x
                robot.y = new_y
                robot.heading = new_heading
                robot.is_moving = True
                
            session.commit()
            
        # 4. Advance the angle for the next tick
        theta += angular_velocity
        
        # Reset theta after a full circle to prevent the number from growing infinitely
        if theta >= 2 * math.pi:
            theta -= 2 * math.pi