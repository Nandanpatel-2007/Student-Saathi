from django.contrib import admin

from .models import Department, Enrollment, Section, Subject, TeachingAssignment

admin.site.register(Department)
admin.site.register(Section)
admin.site.register(Subject)
admin.site.register(Enrollment)
admin.site.register(TeachingAssignment)
