"""
Admin API router.
"""
from fastapi import APIRouter
from app.presentation.api.admin.endpoints import admin_users, admin_farms

admin_router = APIRouter()

# Include admin user management endpoints
admin_router.include_router(admin_users.router, tags=["admin-users"])

# Include admin farm management endpoints
admin_router.include_router(admin_farms.router, tags=["admin-farms"])
