from rest_framework import permissions
from .models import Role


class IsSuperAdmin(permissions.BasePermission):
    def has_permission(self, request, view):
        return request.user and request.user.is_authenticated and request.user.role == Role.SUPER_ADMIN


class IsAdmin(permissions.BasePermission):
    def has_permission(self, request, view):
        return request.user and request.user.is_authenticated and request.user.role in (Role.ADMIN, Role.SUPER_ADMIN)


class IsOwner(permissions.BasePermission):
    def has_permission(self, request, view):
        return request.user and request.user.is_authenticated and request.user.role == Role.OWNER


class IsAdminOrReadOnly(permissions.BasePermission):
    def has_permission(self, request, view):
        if request.method in permissions.SAFE_METHODS:
            return request.user and request.user.is_authenticated
        return request.user and request.user.is_authenticated and request.user.role == Role.ADMIN


class IsAdminOrAuditor(permissions.BasePermission):
    """Admin or Auditor for evidence review and scoring."""
    def has_permission(self, request, view):
        return (
            request.user
            and request.user.is_authenticated
            and request.user.role in (Role.ADMIN, Role.AUDITOR, Role.SUPER_ADMIN)
        )


class IsOwnerWithRestaurant(permissions.BasePermission):
    """Owner who has an associated restaurant (for evidence upload)."""
    def has_permission(self, request, view):
        if not request.user or not request.user.is_authenticated or request.user.role != Role.OWNER:
            return False
        return hasattr(request.user, 'restaurant') and request.user.restaurant is not None
