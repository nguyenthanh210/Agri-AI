"""
User-related use cases.
"""
from typing import Optional
from app.application.use_cases.base import BaseUseCase
from app.domain.entities.user import User
from app.domain.repositories.user_repository import UserRepository
import secrets
from app.application.dto.user_dto import CreateUserDTO, UserDTO, UserLoginDTO, TokenDTO, ChangePasswordDTO, GoogleLoginDTO
from app.infrastructure.security.jwt import get_password_hash, verify_password, create_access_token
from app.infrastructure.config.settings import get_settings


class CreateUserUseCase(BaseUseCase[CreateUserDTO, UserDTO]):
    """Use case for creating a new user (Register)."""
    
    def __init__(self, user_repository: UserRepository):
        self.user_repository = user_repository
    
    async def execute(self, input_dto: CreateUserDTO) -> UserDTO:
        """Create a new user."""
        # Check if user already exists
        existing_user = await self.user_repository.get_by_email(input_dto.email)
        if existing_user:
            raise ValueError("User with this email already exists")
        
        # Create user entity
        user = User(
            email=input_dto.email,
            username=input_dto.username,
            hashed_password=get_password_hash(input_dto.password),
            full_name=input_dto.full_name,
            is_active=True,
            is_superuser=False
        )
        
        # Save to repository
        created_user = await self.user_repository.create(user)
        
        return UserDTO.from_entity(created_user)


class LoginUserUseCase(BaseUseCase[UserLoginDTO, TokenDTO]):
    """Use case for user login."""
    
    def __init__(self, user_repository: UserRepository):
        self.user_repository = user_repository
    
    async def execute(self, input_dto: UserLoginDTO) -> TokenDTO:
        """Authenticate user and return token."""
        user = await self.user_repository.get_by_email(input_dto.email)
        if not user or not verify_password(input_dto.password, user.hashed_password):
            raise ValueError("Incorrect email or password")
        
        if not user.is_active:
            raise ValueError("Inactive user")
            
        access_token = create_access_token(subject=user.id)
        return TokenDTO(access_token=access_token, token_type="bearer")


class LogoutUserUseCase(BaseUseCase[None, bool]):
    """Use case for user logout."""
    
    async def execute(self, input_dto: None = None) -> bool:
        """
        Logout user.
        Since we use stateless JWT, we don't need to do anything on server side
        unless we implement a blacklist. For now, just return True.
        """
        return True


class GoogleLoginUseCase(BaseUseCase[GoogleLoginDTO, TokenDTO]):
    """Use case for Google OAuth2 login."""

    def __init__(self, user_repository: UserRepository):
        self.user_repository = user_repository

    async def execute(self, input_dto: GoogleLoginDTO) -> TokenDTO:
        """Verify Google ID token and return JWT."""
        try:
            from google.oauth2 import id_token as google_id_token
            from google.auth.transport import requests as google_requests

            settings = get_settings()
            id_info = google_id_token.verify_oauth2_token(
                input_dto.id_token,
                google_requests.Request(),
                settings.GOOGLE_CLIENT_ID,
            )
        except Exception as e:
            raise ValueError(f"Invalid Google token: {e}")

        email = id_info.get("email")
        if not email:
            raise ValueError("Google token does not contain an email")

        full_name = id_info.get("name")
        # Use part before @ as username base
        username_base = email.split("@")[0]

        # Find existing user or create new one
        user = await self.user_repository.get_by_email(email)
        if not user:
            # Generate a random secure password (user will never use it)
            random_password = get_password_hash(secrets.token_urlsafe(32))
            # Ensure unique username
            username = username_base
            existing = await self.user_repository.get_by_username(username)
            if existing:
                username = f"{username_base}_{secrets.token_hex(4)}"

            user = User(
                email=email,
                username=username,
                hashed_password=random_password,
                full_name=full_name,
                is_active=True,
                is_superuser=False,
            )
            user = await self.user_repository.create(user)
        elif not user.is_active:
            raise ValueError("Tài khoản đã bị vô hiệu hoá")

        access_token = create_access_token(subject=user.id)
        return TokenDTO(access_token=access_token, token_type="bearer")


class ChangePasswordUseCase(BaseUseCase[ChangePasswordDTO, bool]):
    """Use case for changing user password."""
    
    def __init__(self, user_repository: UserRepository, user_id: int):
        self.user_repository = user_repository
        self.user_id = user_id
    
    async def execute(self, input_dto: ChangePasswordDTO) -> bool:
        """Change user password."""
        user = await self.user_repository.get_by_id(self.user_id)
        if not user:
            raise ValueError("User not found")
            
        if not verify_password(input_dto.current_password, user.hashed_password):
            raise ValueError("Incorrect current password")
            
        user.hashed_password = get_password_hash(input_dto.new_password)
        await self.user_repository.update(self.user_id, user)
        return True

