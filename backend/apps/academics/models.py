from django.db import models


class Department(models.Model):
    name = models.CharField(max_length=120, unique=True)
    code = models.CharField(max_length=20, unique=True)

    class Meta:
        ordering = ["name"]

    def __str__(self):
        return self.name


class Section(models.Model):
    name = models.CharField(max_length=50)
    program = models.CharField(max_length=100)
    semester = models.PositiveSmallIntegerField()
    academic_year = models.CharField(max_length=9, help_text="e.g. 2025-2026")

    class Meta:
        ordering = ["academic_year", "program", "semester", "name"]
        constraints = [
            models.UniqueConstraint(
                fields=["name", "program", "semester", "academic_year"],
                name="uniq_section_identity",
            )
        ]

    def __str__(self):
        return f"{self.program} Sem {self.semester} - {self.name} ({self.academic_year})"
