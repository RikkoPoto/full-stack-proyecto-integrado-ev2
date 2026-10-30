import io
import json
from urllib.parse import urlparse
from django.utils import timezone
from reportlab.lib import colors
from reportlab.lib.pagesizes import A4
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
from reportlab.platypus import SimpleDocTemplate, Paragraph, Spacer, Table, TableStyle

from ..catalog import CATALOG
from ..models import Scan

RESULT_LABELS = {
    "C": "Cumple",
    "P": "Parcial",
    "N": "No cumple",
    "E": "No evaluable",
}

SCAN_STATUS_LABELS = {
    "running": "En curso",
    "done": "Completado",
    "error": "Error",
    "cancelled": "Interrumpido",
}

CLASSIFICATION_LABELS = {
    "alto": "Alto",
    "parcial": "Parcial",
    "bajo": "Bajo",
}


def get_report_filename(scan: Scan, ext: str) -> str:
    host = urlparse(scan.url).hostname or "sitio"
    return f"informe-{host}-{scan.id}.{ext}"


def _format_chile_dt(dt) -> str:
    if not dt:
        return "—"
    local_dt = timezone.localtime(dt)
    return local_dt.strftime("%d-%m-%Y %H:%M")


def _scope_text(scope: int) -> str:
    return "solo la página indicada" if scope == 1 else f"hasta {scope} páginas"


def _csv_cell(value) -> str:
    text = str(value if value is not None else "")
    if text and text[0] in ("=", "+", "-", "@", "\t", "\r"):
        text = f"'{text}"
    escaped = text.replace('"', '""')
    return f'"{escaped}"'


def _build_rows(scan: Scan) -> list:
    rule_map = {r["id"]: r for r in CATALOG["rules"]}
    cat_map = {c["id"]: c["label"] for c in CATALOG["categories"]}
    rows = []
    for r in scan.rules or []:
        meta = rule_map.get(r["id"], {})
        status = r.get("status", "E")
        rows.append(
            {
                "id": r["id"],
                "categoria": cat_map.get(meta.get("category"), ""),
                "regla": meta.get("title", r["id"]),
                "resultado": RESULT_LABELS.get(status, status),
                "evidencia": r.get("evidence", ""),
                "corregir": meta.get("fix", "") if status in ("N", "P") else "",
                "referencia": meta.get("legalRef", "Ley N.º 21.719"),
            }
        )
    return rows


def generate_csv_report(scan: Scan) -> bytes:
    integrity_hash = scan.integrity_hash or scan.compute_integrity_hash()
    meta_rows = [
        ["Sitio", scan.url],
        ["Identificador", scan.id],
        ["Fecha y hora", _format_chile_dt(scan.started_at)],
        ["Alcance", _scope_text(scan.scope)],
        ["Puntaje", f"{scan.score}%" if scan.score is not None else ""],
        ["Clasificación", CLASSIFICATION_LABELS.get(scan.classification, "")],
        ["Hash SHA-256", integrity_hash],
        [],
    ]
    header = ["ID", "Categoría", "Regla", "Resultado", "Evidencia", "Qué corregir", "Referencia normativa"]
    body = [
        [
            r["id"],
            r["categoria"],
            r["regla"],
            r["resultado"],
            r["evidencia"],
            r["corregir"],
            r["referencia"],
        ]
        for r in _build_rows(scan)
    ]
    all_rows = meta_rows + [header] + body
    csv_text = "\r\n".join(",".join(_csv_cell(col) for col in row) for row in all_rows)
    return ("\ufeff" + csv_text).encode("utf-8")


def generate_json_report(scan: Scan) -> bytes:
    integrity_hash = scan.integrity_hash or scan.compute_integrity_hash()
    data = {
        "id": scan.id,
        "url": scan.url,
        "estado": SCAN_STATUS_LABELS.get(scan.status, scan.status),
        "inicio": timezone.localtime(scan.started_at).isoformat() if scan.started_at else None,
        "fin": timezone.localtime(scan.finished_at).isoformat() if scan.finished_at else None,
        "alcance": scan.scope,
        "puntaje": scan.score,
        "clasificacion": scan.classification,
        "sha256": integrity_hash,
        "reglas": _build_rows(scan),
    }
    return json.dumps(data, indent=2, ensure_ascii=False).encode("utf-8")


def generate_pdf_report(scan: Scan) -> bytes:
    buffer = io.BytesIO()
    doc = SimpleDocTemplate(
        buffer,
        pagesize=A4,
        leftMargin=36,
        rightMargin=36,
        topMargin=40,
        bottomMargin=40,
        title=f"Informe {scan.id}",
    )
    styles = getSampleStyleSheet()
    title_style = ParagraphStyle(
        "ReportTitle",
        parent=styles["Heading1"],
        fontSize=16,
        leading=20,
        textColor=colors.HexColor("#121A2B"),
        spaceAfter=8,
    )
    sub_style = ParagraphStyle(
        "ReportSub",
        parent=styles["Normal"],
        fontSize=9,
        leading=12,
        textColor=colors.HexColor("#566277"),
    )
    cell_style = ParagraphStyle(
        "TableCell",
        parent=styles["Normal"],
        fontSize=8,
        leading=10,
        textColor=colors.HexColor("#121A2B"),
    )

    elements = []
    elements.append(Paragraph("Informe Técnico de Verificación Ley N.º 21.719", title_style))
    elements.append(Paragraph(f"Sitio evaluado: {scan.url}", styles["Normal"]))
    elements.append(Spacer(1, 10))

    integrity_hash = scan.integrity_hash or scan.compute_integrity_hash()
    summary_data = [
        ["Identificador", scan.id, "Fecha y hora", _format_chile_dt(scan.started_at)],
        ["Alcance", _scope_text(scan.scope), "Cumplimiento", f"{scan.score}% ({CLASSIFICATION_LABELS.get(scan.classification, '')})"],
        ["Hash SHA-256", Paragraph(integrity_hash, sub_style), "", ""],
    ]
    summary_table = Table(summary_data, colWidths=[85, 175, 85, 175])
    summary_table.setStyle(
        TableStyle(
            [
                ("BACKGROUND", (0, 0), (-1, -1), colors.HexColor("#F3F5F8")),
                ("TEXTCOLOR", (0, 0), (-1, -1), colors.HexColor("#121A2B")),
                ("FONTNAME", (0, 0), (0, -1), "Helvetica-Bold"),
                ("FONTNAME", (2, 0), (2, 1), "Helvetica-Bold"),
                ("FONTSIZE", (0, 0), (-1, -1), 9),
                ("SPAN", (1, 2), (3, 2)),
                ("BOX", (0, 0), (-1, -1), 0.5, colors.HexColor("#D6DCE6")),
                ("INNERGRID", (0, 0), (-1, -1), 0.5, colors.HexColor("#D6DCE6")),
                ("VALIGN", (0, 0), (-1, -1), "MIDDLE"),
                ("TOPPADDING", (0, 0), (-1, -1), 6),
                ("BOTTOMPADDING", (0, 0), (-1, -1), 6),
            ]
        )
    )
    elements.append(summary_table)
    elements.append(Spacer(1, 16))

    table_rows = [["ID", "Regla y Referencia Normativa", "Resultado", "Evidencia y Acción Recomendada"]]
    for r in _build_rows(scan):
        rule_info = f"<b>{r['regla']}</b><br/><font color='#566277'>{r['referencia']}</font>"
        ev_info = r["evidencia"]
        if r["corregir"]:
            ev_info += f"<br/><b>Corregir:</b> {r['corregir']}"
        table_rows.append(
            [
                Paragraph(r["id"], cell_style),
                Paragraph(rule_info, cell_style),
                Paragraph(r["resultado"], cell_style),
                Paragraph(ev_info, cell_style),
            ]
        )

    rules_table = Table(table_rows, colWidths=[45, 175, 65, 235], repeatRows=1)
    rules_table.setStyle(
        TableStyle(
            [
                ("BACKGROUND", (0, 0), (-1, 0), colors.HexColor("#1747C9")),
                ("TEXTCOLOR", (0, 0), (-1, 0), colors.white),
                ("FONTNAME", (0, 0), (-1, 0), "Helvetica-Bold"),
                ("FONTSIZE", (0, 0), (-1, 0), 8),
                ("BOX", (0, 0), (-1, -1), 0.5, colors.HexColor("#D6DCE6")),
                ("INNERGRID", (0, 0), (-1, -1), 0.5, colors.HexColor("#D6DCE6")),
                ("VALIGN", (0, 0), (-1, -1), "TOP"),
                ("TOPPADDING", (0, 0), (-1, -1), 5),
                ("BOTTOMPADDING", (0, 0), (-1, -1), 5),
            ]
        )
    )
    elements.append(rules_table)
    elements.append(Spacer(1, 14))
    elements.append(
        Paragraph(
            "Nota técnica: Informe generado automáticamente mediante reglas basadas en la Ley N.º 21.719. "
            "Constituye evidencia técnica de apoyo y no reemplaza una auditoría jurídica formal.",
            sub_style,
        )
    )

    doc.build(elements)
    return buffer.getvalue()
