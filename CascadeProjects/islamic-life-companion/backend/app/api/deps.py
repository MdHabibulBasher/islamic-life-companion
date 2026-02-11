from fastapi import Depends, HTTPException, status
from sqlalchemy.orm import Session
from app.core.database import get_db
from app.models.user import User


async def get_current_user(
    db: Session = Depends(get_db)
) -> User:
    """
    Get the current authenticated user.
    For now, this is a placeholder that returns the first active user.
    In production, this should verify JWT tokens.
    """
    # TODO: Implement proper JWT token verification
    # For now, return the first active user or raise an exception
    user = db.query(User).filter(User.is_active == True).first()
    if not user:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Not authenticated"
        )
    return user
