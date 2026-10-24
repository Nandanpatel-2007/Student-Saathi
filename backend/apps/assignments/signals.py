"""Remove the stored file whenever a Submission row goes away (deleted, or cascaded from its assignment)."""

from django.db import transaction
from django.db.models.signals import post_delete
from django.dispatch import receiver

from .models import Submission


@receiver(post_delete, sender=Submission)
def delete_submission_file(sender, instance: Submission, **kwargs):
    if not instance.file:
        return
    storage, name = instance.file.storage, instance.file.name
    # After commit, so a rolled-back delete never loses the file.
    transaction.on_commit(lambda: storage.delete(name))
