from django.contrib import admin
from django.contrib.auth.admin import UserAdmin as BaseUserAdmin
from .models import User, OwnerApplication, Restaurant, RestaurantPhoto


@admin.register(User)
class UserAdmin(BaseUserAdmin):
    list_display = ('email', 'name', 'role', 'is_active', 'created_at')
    list_filter = ('role', 'is_active')
    search_fields = ('email', 'name')
    ordering = ('-created_at',)
    readonly_fields = ('last_login', 'created_at', 'updated_at')
    fieldsets = (
        (None, {'fields': ('email', 'password')}),
        ('Profile', {'fields': ('name', 'phone', 'role')}),
        ('Permissions', {'fields': ('is_active', 'is_staff', 'is_superuser')}),
        ('Dates', {'fields': ('last_login', 'created_at', 'updated_at')}),
    )
    add_fieldsets = (
        (None, {'classes': ('wide',), 'fields': ('email', 'name', 'password1', 'password2')}),
    )


@admin.register(OwnerApplication)
class OwnerApplicationAdmin(admin.ModelAdmin):
    list_display = ('restaurant_name', 'user', 'status', 'submitted_at', 'reviewed_at')
    list_filter = ('status',)
    search_fields = ('restaurant_name', 'user__email')
    readonly_fields = ('submitted_at',)


class RestaurantPhotoInline(admin.TabularInline):
    model = RestaurantPhoto
    extra = 0


@admin.register(Restaurant)
class RestaurantAdmin(admin.ModelAdmin):
    list_display = ('name', 'owner', 'city', 'status', 'created_at')
    list_filter = ('status',)
    inlines = [RestaurantPhotoInline]
