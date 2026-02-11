from pydantic import BaseModel, EmailStr, field_validator, field_serializer
from datetime import datetime


class LoginRequest(BaseModel):
    email: EmailStr
    password: str


class SignupRequest(BaseModel):
    email: EmailStr
    password: str
    full_name: str

    @field_validator('password')
    @classmethod
    def validate_password(cls, v):
        if len(v) < 8:
            raise ValueError('Password must be at least 8 characters')
        if not any(c.isupper() for c in v):
            raise ValueError('Password must contain at least one uppercase letter')
        if not any(c.isdigit() for c in v):
            raise ValueError('Password must contain at least one digit')
        return v

    @field_validator('full_name')
    @classmethod
    def validate_name(cls, v):
        if not v or len(v) < 2:
            raise ValueError('Name must be at least 2 characters')
        return v


class UserResponse(BaseModel):
    id: int
    email: str
    full_name: str | None = None
    is_active: bool
    created_at: datetime
    updated_at: datetime | None = None

    class Config:
        from_attributes = True

    @field_serializer('created_at', 'updated_at')
    def serialize_datetime(self, value: datetime | None) -> str | None:
        if value is None:
            return None
        return value.isoformat()


class TokenResponse(BaseModel):
    access_token: str
    refresh_token: str
    user: UserResponse
    token_type: str = "bearer"
