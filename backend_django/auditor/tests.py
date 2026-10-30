import json
from django.test import TestCase, Client
from django.utils import timezone
from .models import Scan
from .catalog import TOTAL_STEPS


class AuditorApiContractTests(TestCase):
    def setUp(self):
        self.client = Client()

    def test_get_rules_catalog(self):
        response = self.client.get('/api/rules')
        self.assertEqual(response.status_code, 200)
        data = response.json()
        self.assertIn('categories', data)
        self.assertIn('rules', data)
        self.assertEqual(len(data['rules']), 15)

    def test_reject_ssrf_and_invalid_urls(self):
        for invalid in ['http://localhost:8000', 'http://127.0.0.1', 'https://192.168.1.1', '']:
            res = self.client.post(
                '/api/scans',
                data=json.dumps({'url': invalid, 'scope': 10}),
                content_type='application/json',
            )
            self.assertEqual(res.status_code, 400)
            self.assertIn('message', res.json())

    def test_scan_lifecycle_and_exports(self):
        scan = Scan.objects.create(
            id='VER-20261030-0150',
            url='https://www.ejemplo.cl',
            scope=10,
            status='done',
            started_at=timezone.now(),
            finished_at=timezone.now(),
            step=TOTAL_STEPS,
            total=TOTAL_STEPS,
            score=80,
            classification='parcial',
            rules=[{'id': 'PRI-01', 'status': 'C', 'evidence': 'Enlace visible.'}],
            log=[{'ts': timezone.now().isoformat(), 'level': 'info', 'text': 'Completado.'}],
        )
        scan.integrity_hash = scan.compute_integrity_hash()
        scan.save()

        detail = self.client.get(f'/api/scans/{scan.id}')
        self.assertEqual(detail.status_code, 200)
        self.assertEqual(detail.json()['score'], 80)

        for fmt in ('pdf', 'csv', 'json'):
            rep = self.client.get(f'/api/scans/{scan.id}/report?format={fmt}')
            self.assertEqual(rep.status_code, 200)
            self.assertIn('attachment; filename=', rep['Content-Disposition'])

        del_res = self.client.delete(f'/api/scans/{scan.id}')
        self.assertEqual(del_res.status_code, 204)
