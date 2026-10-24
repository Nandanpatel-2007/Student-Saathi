from django.contrib import admin

from .models import AttendanceAuditLog, AttendanceRecord, AttendanceSession

admin.site.register(AttendanceSession)
admin.site.register(AttendanceRecord)
admin.site.register(AttendanceAuditLog)
