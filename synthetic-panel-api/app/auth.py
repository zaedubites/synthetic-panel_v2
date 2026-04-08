"""
JWT Authentication module.
Validates tokens issued by auth-service using RS256 public key.
"""
import logging
from datetime import datetime
from typing import Optional
from uuid import UUID

from fastapi import Depends, HTTPException, Request, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from jose import JWTError, jwt
from pydantic import BaseModel

from app.config import settings

logger = logging.getLogger(__name__)

# Security scheme
security = HTTPBearer()


class TokenPayload(BaseModel):
    """Parsed JWT token payload."""

    sub: str  # User ID
    email: str
    first_name: Optional[str] = None
    last_name: Optional[str] = None
    organization_id: Optional[str] = None  # None = super admin
    organization_subdomain: Optional[str] = None
    roles: list[str] = []
    permissions: list[str] = []
    cohort_ids: list[str] = []
    access_type: Optional[str] = None  # admin_panel, organization_platform, both
    auth_provider: Optional[str] = None
    exp: int
    iat: int
    type: str  # access, refresh, service

    @property
    def user_id(self) -> UUID:
        """Get user ID as UUID."""
        return UUID(self.sub)

    @property
    def org_id(self) -> Optional[UUID]:
        """Get organization ID as UUID if present."""
        if self.organization_id:
            return UUID(self.organization_id)
        return None

    @property
    def is_super_admin(self) -> bool:
        """Check if user is a super admin (no organization)."""
        return self.organization_id is None or "SUPER_ADMIN" in self.roles

    def has_role(self, role: str) -> bool:
        """Check if user has a specific role."""
        return role in self.roles or "SUPER_ADMIN" in self.roles

    def has_permission(self, permission: str) -> bool:
        """Check if user has a specific permission."""
        if "*" in self.permissions or "SUPER_ADMIN" in self.roles:
            return True
        return permission in self.permissions

    def has_any_role(self, roles: list[str]) -> bool:
        """Check if user has any of the specified roles."""
        if "SUPER_ADMIN" in self.roles:
            return True
        return any(role in self.roles for role in roles)


def decode_token(token: str) -> Optional[TokenPayload]:
    """
    Decode and validate a JWT token.

    Args:
        token: The JWT token string

    Returns:
        TokenPayload if valid, None otherwise
    """
    try:
        # Handle newlines in public key (from environment variable)
        public_key = settings.JWT_PUBLIC_KEY.replace("\\n", "\n")

        # Decode token
        payload = jwt.decode(
            token,
            public_key,
            algorithms=[settings.JWT_ALGORITHM],
            options={"verify_exp": True},
        )

        # Validate token type
        if payload.get("type") != "access":
            logger.warning(f"Invalid token type: {payload.get('type')}")
            return None

        return TokenPayload(**payload)

    except JWTError as e:
        logger.warning(f"JWT decode error: {e}")
        return None
    except Exception as e:
        logger.error(f"Unexpected error decoding token: {e}")
        return None


async def get_current_user(
    credentials: HTTPAuthorizationCredentials = Depends(security),
) -> TokenPayload:
    """
    FastAPI dependency to get and validate the current user from JWT.

    Raises:
        HTTPException: If token is invalid or missing
    """
    token = credentials.credentials

    payload = decode_token(token)
    if payload is None:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid or expired token",
            headers={"WWW-Authenticate": "Bearer"},
        )

    return payload


async def get_optional_user(
    credentials: Optional[HTTPAuthorizationCredentials] = Depends(
        HTTPBearer(auto_error=False)
    ),
) -> Optional[TokenPayload]:
    """
    FastAPI dependency to optionally get the current user.
    Returns None if no token provided.
    """
    if credentials is None:
        return None

    return decode_token(credentials.credentials)


def require_roles(required_roles: list[str]):
    """
    Factory for a dependency that requires specific roles.

    Usage:
        @router.get("/admin")
        async def admin_endpoint(user: TokenPayload = Depends(require_roles(["ADMIN"]))):
            pass
    """

    async def role_checker(
        current_user: TokenPayload = Depends(get_current_user),
    ) -> TokenPayload:
        if not current_user.has_any_role(required_roles):
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail=f"Requires one of roles: {required_roles}",
            )
        return current_user

    return role_checker


def require_permissions(required_permissions: list[str]):
    """
    Factory for a dependency that requires specific permissions.

    Usage:
        @router.delete("/item/{id}")
        async def delete_item(user: TokenPayload = Depends(require_permissions(["delete_item"]))):
            pass
    """

    async def permission_checker(
        current_user: TokenPayload = Depends(get_current_user),
    ) -> TokenPayload:
        missing = [p for p in required_permissions if not current_user.has_permission(p)]
        if missing:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail=f"Missing permissions: {missing}",
            )
        return current_user

    return permission_checker


class OrganizationFilter:
    """
    Helper class for filtering queries by organization.
    Super admins can see all data, regular users only see their org's data.
    For super admins, the org can be set via X-Organization-Id header.
    """

    def __init__(self, user: TokenPayload, override_org_id: Optional[UUID] = None):
        self.user = user
        self.is_super_admin = user.is_super_admin
        self.user_id = user.user_id
        self.cohort_ids = [UUID(c) for c in user.cohort_ids]

        # Super admins: use header override if provided, else None (see all)
        if user.is_super_admin and override_org_id:
            self.organization_id = override_org_id
        else:
            self.organization_id = user.org_id

    def should_filter(self) -> bool:
        """Check if organization filtering should be applied.
        Super admins with a selected org (via header) should also filter."""
        return self.organization_id is not None


async def get_organization_filter(
    request: Request,
    current_user: TokenPayload = Depends(get_current_user),
) -> OrganizationFilter:
    """
    FastAPI dependency that provides organization-based filtering context.
    Super admins can scope to a specific org via X-Organization-Id header.
    """
    override_org_id = None

    if current_user.is_super_admin:
        # Check X-Organization-Id header (sent by frontend for super admins)
        header_org_id = request.headers.get("x-organization-id")
        if header_org_id:
            try:
                override_org_id = UUID(header_org_id)
            except ValueError:
                pass  # Invalid UUID, ignore

    return OrganizationFilter(current_user, override_org_id=override_org_id)


def require_organization_membership(
    current_user: TokenPayload = Depends(get_current_user),
) -> TokenPayload:
    """
    Dependency that requires the user to belong to an organization.
    Super admins are rejected (they must specify an org context).
    """
    if current_user.organization_id is None and not current_user.is_super_admin:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Organization context required",
        )
    return current_user


async def verify_ws_token(token: str) -> TokenPayload:
    """
    Verify a JWT token for WebSocket connections.
    Unlike HTTP, WebSocket doesn't support headers well,
    so token is passed as query parameter.

    Args:
        token: The JWT token string from query parameter

    Returns:
        TokenPayload if valid

    Raises:
        ValueError if token is invalid
    """
    payload = decode_token(token)
    if payload is None:
        raise ValueError("Invalid or expired token")

    # Super admins don't have organization_id in token — that's OK
    return payload
