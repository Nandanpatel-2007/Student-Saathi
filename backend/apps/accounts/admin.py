from django.contrib import admin
from django.contrib.auth.admin import UserAdmin

from .models import FacultyProfile, StudentProfile, User


@admin.register(User)
class CustomUserAdmin(UserAdmin):
    fieldsets = UserAdmin.fieldsets + (("Role", {"fields": ("role",)}),)
    add_fieldsets = UserAdmin.add_fieldsets + (("Role", {"fields": ("role",)}),)
    list_display = ("username", "email", "first_name", "last_name", "role", "is_staff")
    list_filter = UserAdmin.list_filter + ("role",)


admin.site.register(StudentProfile)
admin.site.register(FacultyProfile)
