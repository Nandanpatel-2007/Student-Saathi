from django.db import models


class Department(models.Model):
    name = models.CharField(max_length=120, unique=True)
    code = models.CharField(max_length=16, unique=True)

    def __str__(self) -> str:
        return self.name


class Section(models.Model):
    name = models.CharField(max_length=32)
    program = models.CharField(max_length=120)
    semester = models.PositiveSmallIntegerField()
    academic_year = models.CharField(max_length=9, help_text="e.g. 2025-2026")

    class Meta:
        constraints = [
            models.UniqueConstraint(
                fields=["name", "program", "semester", "academic_year"],
                name="uniq_section_identity",
            )
        ]

    def __str__(self) -> str:
        return f"{self.program} {self.name} (Sem {self.semester}, {self.academic_year})"
