import hashlib
import json
from django.db import models
from django.utils import timezone
from .catalog import TOTAL_STEPS


class Scan(models.Model):
    STATUS_CHOICES = [
        ('running', 'En curso'),
        ('done', 'Completado'),
        ('error', 'Error'),
        ('cancelled', 'Interrumpido'),
    ]

    CLASSIFICATION_CHOICES = [
        ('bajo', 'Bajo'),
        ('parcial', 'Parcial'),
        ('alto', 'Alto'),
    ]

    id = models.CharField(max_length=32, primary_key=True)
    url = models.URLField(max_length=500)
    scope = models.IntegerField(default=10)
    status = models.CharField(max_length=16, choices=STATUS_CHOICES, default='running')
    started_at = models.DateTimeField(default=timezone.now)
    finished_at = models.DateTimeField(null=True, blank=True)
    step = models.IntegerField(default=0)
    total = models.IntegerField(default=TOTAL_STEPS)
    retries = models.IntegerField(default=0)
    score = models.IntegerField(null=True, blank=True)
    classification = models.CharField(max_length=16, choices=CLASSIFICATION_CHOICES, null=True, blank=True)
    rules = models.JSONField(default=list)
    log = models.JSONField(default=list)
    error_message = models.TextField(null=True, blank=True)
    error_code = models.CharField(max_length=64, null=True, blank=True)
    integrity_hash = models.CharField(max_length=64, null=True, blank=True)

    class Meta:
        ordering = ['-started_at']

    def compute_integrity_hash(self) -> str:
        payload = {
            "id": self.id,
            "url": self.url,
            "scope": self.scope,
            "startedAt": self.started_at.isoformat() if self.started_at else None,
            "finishedAt": self.finished_at.isoformat() if self.finished_at else None,
            "score": self.score,
            "classification": self.classification,
            "rules": self.rules,
        }
        serialized = json.dumps(payload, sort_keys=True, ensure_ascii=False)
        return hashlib.sha256(serialized.encode('utf-8')).hexdigest()

    def to_dict(self, summary: bool = False) -> dict:
        local_started = timezone.localtime(self.started_at).isoformat() if self.started_at else None
        local_finished = timezone.localtime(self.finished_at).isoformat() if self.finished_at else None
        data = {
            "id": self.id,
            "url": self.url,
            "scope": self.scope,
            "status": self.status,
            "startedAt": local_started,
            "finishedAt": local_finished,
            "retries": self.retries,
            "score": self.score,
            "classification": self.classification,
            "errorMessage": self.error_message,
            "errorCode": self.error_code,
        }
        if not summary:
            data["step"] = self.step
            data["total"] = self.total
            data["rules"] = self.rules
            data["log"] = self.log
        return data
